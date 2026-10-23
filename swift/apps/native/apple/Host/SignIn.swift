import AuthenticationServices
import Foundation
import Security
#if os(iOS)
import UIKit
#else
import AppKit
#endif

/// Signing in to sync (docs/SYNC.md, "Signing in, and signing out"). Optional: with no sync
/// server configured (`AstryxSyncURL` empty) it is off and the core shows nothing of it.
///
/// - Sign in: `<sync URL>/native/login` in `ASWebAuthenticationSession`. That path is behind
///   Cloudflare Access; once Access has signed the person in, the API redirects to
///   `astryxswift://signed-in#token=...`, and the token is read from the fragment.
/// - The token, and the refresh token that comes with it, are kept in the Keychain (this device
///   only, after first unlock); the token is handed to the Hermes runtime (`auth`), which gives it
///   to Zero. Neither enters the core, a snapshot or a log.
/// - Staying signed in: a sign-in lasts until sign-out (server/src/sessions.ts). Shortly before the
///   hour-long token expires, and whenever the app comes back with it near its end, the refresh
///   token is traded at `/api/token/refresh` for a new pair: no browser, no prompt. Only if the
///   server ends the session (signed out elsewhere, or a copied token) does the person sign in again.
/// - Sign out: the session is ended on the server, the tokens are removed and sync stops; the
///   device's own copy comes back.
@MainActor
final class SignIn: NSObject, ASWebAuthenticationPresentationContextProviding {
    static let callbackScheme = "astryxswift"
    static let redirect = "astryxswift://signed-in"
    /// How long before the token's expiry it is renewed.
    private static let renewBefore: TimeInterval = 5 * 60
    /// Waits between tries when the server cannot be reached (it is retried; the session stands).
    private static let retryAfter: [TimeInterval] = [15, 60, 300, 900]

    /// Where sync is (zero-cache, and the API's /native/login on the same host); nil: sign-in is off.
    let syncURL: URL?
    /// What the Hermes runtime is given: a token and where sync is, or null (sign out), as JSON.
    var authorize: (String) -> Void = { _ in }
    /// An action for the core, as JSON.
    var dispatch: (String) -> Void = { _ in }

    private var token: String?
    /// Trades for a new token at /api/token/refresh; nil with a server that keeps no sessions.
    private var refreshToken: String?
    /// The refresh under way: one at a time, because each one replaces the refresh token.
    private var refreshing: Task<Void, Never>?
    private var failedRefreshes = 0
    private var session: ASWebAuthenticationSession?
    private var renewal: Task<Void, Never>?
    /// The last request of the core's acted on.
    private var handled = 0
    /// Whether this launch's first `auth` is an actual sign-in (a token from `-AXDevToken`).
    private var launchIsSignIn = false

    var isAvailable: Bool { syncURL != nil }
    /// Signed in at launch: a kept token (expired or not; an expired one shows "Sign in again").
    var isSignedIn: Bool { syncURL != nil && token != nil }

    override init() {
        syncURL = SignIn.configuredSyncURL()
        super.init()
        guard syncURL != nil else { return }
        let kept = TokenStore.read()
        token = kept?.token
        refreshToken = kept?.refresh
        #if os(iOS)
        let active = UIApplication.didBecomeActiveNotification
        #else
        let active = NSApplication.didBecomeActiveNotification
        #endif
        NotificationCenter.default.addObserver(forName: active, object: nil, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { self?.becameActive() }
        }
        #if DEBUG
        // A token from a local stack, for testing without a browser (Debug builds only).
        if let dev = SignIn.devToken(), let claims = Claims(token: dev) {
            launchIsSignIn = Claims(token: token ?? "")?.sub != claims.sub
            token = dev
            refreshToken = SignIn.devRefresh()
            TokenStore.write(.init(token: dev, refresh: refreshToken))
        }
        #endif
    }

    // MARK: Configuration

    /// `AstryxSyncURL` from Info.plist (a build setting per configuration): https only. In a
    /// Debug build `-AXSyncURL` overrides it, and http is allowed for this machine (a local stack).
    static func configuredSyncURL() -> URL? {
        #if DEBUG
        if let override = UserDefaults.standard.string(forKey: "AXSyncURL") { return accept(override, localHTTP: true) }
        let localHTTP = true
        #else
        let localHTTP = false
        #endif
        return accept(Bundle.main.object(forInfoDictionaryKey: "AstryxSyncURL") as? String ?? "", localHTTP: localHTTP)
    }

    private static func accept(_ text: String, localHTTP: Bool) -> URL? {
        let trimmed = text.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty, let parts = URLComponents(string: trimmed), let host = parts.host, !host.isEmpty,
              parts.query == nil, parts.fragment == nil, parts.user == nil, parts.password == nil else { return nil }
        switch parts.scheme {
        case "https": break
        case "http" where localHTTP && (host == "localhost" || host == "127.0.0.1"): break
        default: return nil
        }
        var clean = parts
        while clean.path.hasSuffix("/") { clean.path.removeLast() }
        return clean.url
    }

    #if DEBUG
    /// `-AXDevToken <token>`, or `-AXDevTokenFile <path>` (a file the app may read: in a sandboxed
    /// Mac app, one in its container). Compiled out of Release.
    private static func devToken() -> String? {
        let defaults = UserDefaults.standard
        if let token = defaults.string(forKey: "AXDevToken"), !token.isEmpty { return token }
        if let path = defaults.string(forKey: "AXDevTokenFile"),
           let text = try? String(contentsOfFile: (path as NSString).expandingTildeInPath, encoding: .utf8) {
            let token = text.trimmingCharacters(in: .whitespacesAndNewlines)
            return token.isEmpty ? nil : token
        }
        return nil
    }

    /// `-AXDevRefresh <refresh token>` with `-AXDevToken`, to test staying signed in against a local stack.
    private static func devRefresh() -> String? {
        let value = UserDefaults.standard.string(forKey: "AXDevRefresh") ?? ""
        return value.isEmpty ? nil : value
    }
    #endif

    // MARK: The runtime

    /// The runtime is up: a kept token starts sync (a relaunch while signed in, no upload).
    func connected() {
        guard let syncURL, let token else { return }
        let firstSignIn = launchIsSignIn
        launchIsSignIn = false
        // A kept token that has run out (the app was closed for a while): a new one first.
        if let claims = Claims(token: token), claims.expires.timeIntervalSinceNow < SignIn.renewBefore, refreshToken != nil {
            renew(then: { [weak self] fresh in self?.send(token: fresh ?? token, to: syncURL, firstSignIn: firstSignIn) })
            return
        }
        send(token: token, to: syncURL, firstSignIn: firstSignIn)
    }

    /// The core's sync status: when the server refuses the token (it ran out while the app slept), renew it.
    func observe(syncState: String?) {
        guard syncState == "signed-out", token != nil, refreshToken != nil, refreshing == nil else { return }
        renew()
    }

    /// A new app snapshot: the core may be asking to sign in or out.
    func observe(request: [String: Any]?) {
        guard let request, let seq = request["seq"] as? Int, let kind = request["kind"] as? String, seq > handled else { return }
        handled = seq
        switch kind {
        case "signIn": begin(renewing: token != nil)
        case "signOut": signOut()
        default: break
        }
    }

    private func send(token: String, to syncURL: URL, firstSignIn: Bool) {
        let argument: [String: Any] = ["token": token, "syncURL": syncURL.absoluteString, "firstSignIn": firstSignIn]
        guard let data = try? JSONSerialization.data(withJSONObject: argument), let json = String(data: data, encoding: .utf8) else { return }
        authorize(json)
        scheduleRenewal(for: token)
    }

    private func tell(_ event: [String: Any]) {
        var action = event
        action["type"] = "account"
        guard let data = try? JSONSerialization.data(withJSONObject: action), let json = String(data: data, encoding: .utf8) else { return }
        dispatch(json)
    }

    // MARK: Signing in

    /// Opens the sign-in. `renewing`: a token is kept already (a renewal, or "Sign in again").
    /// `quiet`: the app's own renewal, which tells the core nothing if it does not work out (the
    /// status turns to "Sign in again" when the token runs out).
    private func begin(renewing: Bool, quiet: Bool = false) {
        guard let syncURL, session == nil else { return }
        var login = URLComponents(url: syncURL.appendingPathComponent("native/login"), resolvingAgainstBaseURL: false)!
        login.queryItems = [URLQueryItem(name: "redirect", value: SignIn.redirect)]
        guard let url = login.url else { return }
        let session = ASWebAuthenticationSession(url: url, callback: .customScheme(SignIn.callbackScheme)) { [weak self] callback, error in
            Task { @MainActor in self?.finish(callback: callback, error: error, renewing: renewing, quiet: quiet) }
        }
        session.presentationContextProvider = self
        // Not ephemeral: the Access session's cookie is what lets a renewal through without typing.
        session.prefersEphemeralWebBrowserSession = false
        self.session = session
        if !session.start() {
            self.session = nil
            if !quiet { tell(["event": "signedOut", "why": "failed"]) }
        }
    }

    private func finish(callback: URL?, error: Error?, renewing: Bool, quiet: Bool) {
        session = nil
        guard let syncURL else { return }
        if let error {
            let cancelled = (error as? ASWebAuthenticationSessionError)?.code == .canceledLogin
            if !quiet { tell(["event": "signedOut", "why": cancelled ? "cancelled" : "failed"]) }
            return
        }
        guard let fresh = SignIn.token(from: callback), let claims = Claims(token: fresh), claims.expires > Date() else {
            if !quiet { tell(["event": "signedOut", "why": "failed"]) }
            return
        }
        let before = token.flatMap { Claims(token: $0) }?.sub
        token = fresh
        refreshToken = SignIn.fragmentItem("refresh", in: callback)
        failedRefreshes = 0
        TokenStore.write(.init(token: fresh, refresh: refreshToken))
        // The same person renewing keeps their sync; anyone else is an actual sign-in (the device's work may be uploaded).
        send(token: fresh, to: syncURL, firstSignIn: !(renewing && before == claims.sub))
    }

    /// The token in `astryxswift://signed-in#token=...`; anything else is not a sign-in.
    static func token(from url: URL?) -> String? {
        fragmentItem("token", in: url)
    }

    /// One item of the sign-in redirect's fragment (`token`, `refresh`); nil for any other URL.
    static func fragmentItem(_ name: String, in url: URL?) -> String? {
        guard let url, url.scheme == callbackScheme, url.host == "signed-in", let fragment = url.fragment,
              let items = URLComponents(string: "?" + fragment)?.queryItems,
              let value = items.first(where: { $0.name == name })?.value, !value.isEmpty else { return nil }
        return value
    }

    // MARK: Renewal

    private func scheduleRenewal(for token: String) {
        renewal?.cancel()
        guard let claims = Claims(token: token) else { return }
        let wait = claims.expires.timeIntervalSinceNow - SignIn.renewBefore
        // Already expired with nothing to renew it: Zero says signed out, and the core offers "Sign in again".
        guard wait > -SignIn.renewBefore || refreshToken != nil else { return }
        renewal = Task { [weak self] in
            if wait > 0 { try? await Task.sleep(for: .seconds(wait)) }
            guard !Task.isCancelled else { return }
            self?.renewIfActive()
        }
    }

    /// Renews the token: with the refresh token when there is one (no browser); otherwise, with a
    /// server that keeps no sessions, the sign-in again while the app is in use.
    private func renewIfActive() {
        guard token != nil, session == nil else { return }
        if refreshToken != nil { return renew() }
        #if os(iOS)
        guard UIApplication.shared.applicationState == .active else { return }
        #else
        guard NSApp.isActive else { return }
        #endif
        begin(renewing: true, quiet: true)
    }

    /// Trades the refresh token for a new pair. On success the runtime gets the new token (Zero
    /// takes it without reconnecting); if the server ends the session, the refresh token is
    /// dropped and the person is asked to sign in again when the token runs out; if the server
    /// cannot be reached, it is tried again later. `then` gets the new token, or nil.
    private func renew(then: ((String?) -> Void)? = nil) {
        guard let syncURL, let refresh = refreshToken, refreshing == nil else { then?(nil); return }
        refreshing = Task { [weak self] in
            let outcome = await SignIn.trade(refresh, at: syncURL)
            guard let self else { return }
            self.refreshing = nil
            switch outcome {
            case .renewed(let fresh, let next):
                guard Claims(token: fresh)?.sub == self.token.flatMap({ Claims(token: $0) })?.sub || self.token == nil else { then?(nil); return }
                self.token = fresh
                self.refreshToken = next
                self.failedRefreshes = 0
                TokenStore.write(.init(token: fresh, refresh: next))
                if let then { then(fresh) } else { self.send(token: fresh, to: syncURL, firstSignIn: false) }
            case .ended:
                self.refreshToken = nil
                if let token = self.token { TokenStore.write(.init(token: token, refresh: nil)) }
                then?(nil)
            case .unreachable:
                let wait = SignIn.retryAfter[min(self.failedRefreshes, SignIn.retryAfter.count - 1)]
                self.failedRefreshes += 1
                then?(nil)
                self.renewal?.cancel()
                self.renewal = Task { [weak self] in
                    try? await Task.sleep(for: .seconds(wait))
                    guard !Task.isCancelled else { return }
                    self?.renew()
                }
            }
        }
    }

    enum Trade { case renewed(String, String), ended, unreachable }

    /// POST /api/token/refresh. 401 means the session has ended; anything else that fails is "try later".
    private static func trade(_ refresh: String, at syncURL: URL) async -> Trade {
        var request = URLRequest(url: syncURL.appendingPathComponent("api/token/refresh"), timeoutInterval: 20)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: ["refresh": refresh])
        guard let (data, response) = try? await URLSession.shared.data(for: request), let http = response as? HTTPURLResponse else { return .unreachable }
        if http.statusCode == 401 { return .ended }
        guard http.statusCode == 200, let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let token = object["token"] as? String, let next = object["refresh"] as? String, Claims(token: token) != nil else { return .unreachable }
        return .renewed(token, next)
    }

    /// The app became active: a token near its end is renewed now.
    func becameActive() {
        guard let token, let claims = Claims(token: token), claims.expires.timeIntervalSinceNow < SignIn.renewBefore else { return }
        // A run-out token can still be renewed with the refresh token; without one, only before it runs out.
        guard refreshToken != nil || claims.expires.timeIntervalSinceNow > 0 else { return }
        renewIfActive()
    }

    // MARK: Signing out

    private func signOut() {
        renewal?.cancel()
        renewal = nil
        refreshing?.cancel()
        refreshing = nil
        session?.cancel()
        session = nil
        // End the session on the server too, so the refresh token is worth nothing anywhere. Best
        // effort: signed out here whatever the network says.
        if let syncURL, let refresh = refreshToken {
            var request = URLRequest(url: syncURL.appendingPathComponent("api/token/revoke"), timeoutInterval: 20)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "content-type")
            request.httpBody = try? JSONSerialization.data(withJSONObject: ["refresh": refresh])
            URLSession.shared.dataTask(with: request).resume()
        }
        token = nil
        refreshToken = nil
        TokenStore.delete()
        authorize("null")
    }

    // MARK: ASWebAuthenticationPresentationContextProviding

    nonisolated func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        MainActor.assumeIsolated {
            #if os(iOS)
            let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
            let active = scenes.filter { $0.activationState == .foregroundActive }
            return (active + scenes).flatMap(\.windows).first(where: \.isKeyWindow)
                ?? (active + scenes).first?.windows.first
                ?? ASPresentationAnchor()
            #else
            return NSApp.keyWindow ?? NSApp.mainWindow ?? NSApp.windows.first(where: \.isVisible) ?? ASPresentationAnchor()
            #endif
        }
    }
}

/// What the app reads from a token without checking it (the server checks it): who, and until when.
struct Claims {
    let sub: String
    let expires: Date

    init?(token: String) {
        let parts = token.split(separator: ".")
        guard parts.count == 3 else { return nil }
        var base64 = parts[1].replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        while base64.count % 4 != 0 { base64.append("=") }
        guard let data = Data(base64Encoded: base64),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let sub = object["sub"] as? String, !sub.isEmpty,
              let exp = object["exp"] as? Double else { return nil }
        self.sub = sub
        self.expires = Date(timeIntervalSince1970: exp)
    }
}

/// The token in the Keychain: a generic password for this app, on this device only, readable
/// after the first unlock (sync can resume in the background). Its access group is the app's
/// own (its application identifier: the team and the bundle id), the same for the iPhone and Mac
/// apps. On the Mac that is the iOS-style (data protection) keychain, which needs the app to be
/// signed with a team; a local build signed without one keeps the token for the run only, rather
/// than in the login keychain, whose items ask for the person's password after every rebuild.
enum TokenStore {
    private static let service = (Bundle.main.bundleIdentifier ?? "astryxswift") + ".sync"
    private static let account = "token"

    /// Whether the token can be kept: always on iOS; on the Mac, when the app has an application identifier.
    private static let isAvailable: Bool = {
        #if os(macOS)
        guard let task = SecTaskCreateFromSelf(nil) else { return false }
        let available = SecTaskCopyValueForEntitlement(task, "com.apple.application-identifier" as CFString, nil) != nil
        if !available { NSLog("astryx: this build is signed without a team; a sign-in lasts until the app quits") }
        return available
        #else
        return true
        #endif
    }()

    private static func query(_ extra: [String: Any] = [:]) -> [String: Any] {
        var q: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: account]
        #if os(macOS)
        q[kSecUseDataProtectionKeychain as String] = true
        #endif
        return q.merging(extra) { $1 }
    }

    /// The kept sign-in: the access token, and the refresh token when the server keeps sessions.
    struct Kept: Codable {
        var token: String
        var refresh: String?
    }

    static func read() -> Kept? {
        guard isAvailable else { return nil }
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query([kSecReturnData as String: true, kSecMatchLimit as String: kSecMatchLimitOne]) as CFDictionary, &result)
        guard status == errSecSuccess, let data = result as? Data else { return nil }
        if let kept = try? JSONDecoder().decode(Kept.self, from: data) { return kept }
        // Kept by an earlier build: the token alone.
        return String(data: data, encoding: .utf8).map { Kept(token: $0, refresh: nil) }
    }

    @discardableResult
    static func write(_ kept: Kept) -> Bool {
        guard isAvailable, let data = try? JSONEncoder().encode(kept) else { return false }
        var status = SecItemUpdate(query() as CFDictionary, [kSecValueData as String: data] as CFDictionary)
        if status == errSecItemNotFound {
            status = SecItemAdd(query([kSecValueData as String: data, kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly]) as CFDictionary, nil)
        }
        if status != errSecSuccess { NSLog("astryx: the sign-in could not be kept in the Keychain (%d)", status) }
        return status == errSecSuccess
    }

    static func delete() {
        guard isAvailable else { return }
        SecItemDelete(query() as CFDictionary)
    }
}
