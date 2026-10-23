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
/// - The token is kept in the Keychain (this device only, after first unlock) and handed to the
///   Hermes runtime (`auth`), which gives it to Zero. It never enters the core, a snapshot or a log.
/// - Renewal: shortly before the token expires, the same flow again, not ephemeral, so the Access
///   session's cookie lets it through without the person typing anything.
/// - Sign out: the token is removed and sync stops; the device's own copy comes back.
@MainActor
final class SignIn: NSObject, ASWebAuthenticationPresentationContextProviding {
    static let callbackScheme = "astryxswift"
    static let redirect = "astryxswift://signed-in"
    /// How long before the token's expiry it is renewed.
    private static let renewBefore: TimeInterval = 5 * 60

    /// Where sync is (zero-cache, and the API's /native/login on the same host); nil: sign-in is off.
    let syncURL: URL?
    /// What the Hermes runtime is given: a token and where sync is, or null (sign out), as JSON.
    var authorize: (String) -> Void = { _ in }
    /// An action for the core, as JSON.
    var dispatch: (String) -> Void = { _ in }

    private var token: String?
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
        token = TokenStore.read()
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
            TokenStore.write(dev)
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
    #endif

    // MARK: The runtime

    /// The runtime is up: a kept token starts sync (a relaunch while signed in, no upload).
    func connected() {
        guard let syncURL, let token else { return }
        send(token: token, to: syncURL, firstSignIn: launchIsSignIn)
        launchIsSignIn = false
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
        TokenStore.write(fresh)
        // The same person renewing keeps their sync; anyone else is an actual sign-in (the device's work may be uploaded).
        send(token: fresh, to: syncURL, firstSignIn: !(renewing && before == claims.sub))
    }

    /// The token in `astryxswift://signed-in#token=...`; anything else is not a sign-in.
    static func token(from url: URL?) -> String? {
        guard let url, url.scheme == callbackScheme, url.host == "signed-in", let fragment = url.fragment,
              let items = URLComponents(string: "?" + fragment)?.queryItems,
              let token = items.first(where: { $0.name == "token" })?.value, !token.isEmpty else { return nil }
        return token
    }

    // MARK: Renewal

    private func scheduleRenewal(for token: String) {
        renewal?.cancel()
        guard let claims = Claims(token: token) else { return }
        let wait = claims.expires.timeIntervalSinceNow - SignIn.renewBefore
        // Already expired: Zero says signed out, and the core offers "Sign in again".
        guard wait > -SignIn.renewBefore else { return }
        renewal = Task { [weak self] in
            if wait > 0 { try? await Task.sleep(for: .seconds(wait)) }
            guard !Task.isCancelled else { return }
            self?.renewIfActive()
        }
    }

    /// Renews while the app is in use; in the background it waits until the app is active again
    /// (the core shows "Sign in again" if the token runs out meanwhile).
    private func renewIfActive() {
        guard token != nil, session == nil else { return }
        #if os(iOS)
        guard UIApplication.shared.applicationState == .active else { return }
        #else
        guard NSApp.isActive else { return }
        #endif
        begin(renewing: true, quiet: true)
    }

    /// The app became active: a token near its end is renewed now.
    func becameActive() {
        guard let token, let claims = Claims(token: token), claims.expires.timeIntervalSinceNow < SignIn.renewBefore,
              claims.expires.timeIntervalSinceNow > 0 else { return }
        renewIfActive()
    }

    // MARK: Signing out

    private func signOut() {
        renewal?.cancel()
        renewal = nil
        session?.cancel()
        session = nil
        token = nil
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

    static func read() -> String? {
        guard isAvailable else { return nil }
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query([kSecReturnData as String: true, kSecMatchLimit as String: kSecMatchLimitOne]) as CFDictionary, &result)
        guard status == errSecSuccess, let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    @discardableResult
    static func write(_ token: String) -> Bool {
        guard isAvailable else { return false }
        let data = Data(token.utf8)
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
