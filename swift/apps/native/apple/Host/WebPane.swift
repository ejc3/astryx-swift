import SwiftUI
import WebKit

/// The Astryx web drawing of the same screens, in a web view, on the same core as the
/// SwiftUI drawing beside it. The page (web/dist, copied into the app as `web/`) runs in
/// its embedded mode: it makes no client of its own; it posts `{type: "ready"}` and
/// `{type: "dispatch", action}` to `astryx`, and the host calls
/// `window.__astryx.receive(store, snapshotJSON)` with every snapshot the core sends.
@MainActor
final class WebBridge: NSObject, WKScriptMessageHandler {
    let webView: WKWebView
    private let dispatch: (String) -> Void
    private var ready = false
    /// The latest snapshot of each store, for a page that loads (or reloads) after they came.
    private var latest: [String: String] = [:]

    init(dispatch: @escaping (String) -> Void) {
        self.dispatch = dispatch
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(BundledPages(), forURLScheme: "astryx")
        let content = WKUserContentController()
        config.userContentController = content
        addScenarioDriver(to: config)
        webView = WKWebView(frame: .zero, configuration: config)
        webView.letPageUseTheSafeArea()
        super.init()
        content.add(WeakHandler(self), name: "astryx")
        #if DEBUG
        if #available(macOS 13.3, iOS 16.4, *) { webView.isInspectable = true }
        #endif
        // Bare: the template alone, wrapped as the stock page wraps its copy, so the panes
        // compare like for like; the app's own sidebar does the navigating.
        webView.load(URLRequest(url: URL(string: "astryx://app/index.html?bare=1")!))
    }

    /// A store changed: kept, and given to the page once it is listening.
    func changed(store: String, snapshotJSON: String) {
        latest[store] = snapshotJSON
        if ready { send(store, snapshotJSON) }
    }

    private func send(_ store: String, _ json: String) {
        // Both arguments as JSON string literals, so nothing in a snapshot is read as script.
        guard let storeLiteral = literal(store), let jsonLiteral = literal(json) else { return }
        webView.evaluateJavaScript("window.__astryx && window.__astryx.receive(\(storeLiteral), \(jsonLiteral))")
    }

    private func literal(_ s: String) -> String? {
        guard let data = try? JSONSerialization.data(withJSONObject: [s], options: [.fragmentsAllowed]),
              let array = String(data: data, encoding: .utf8) else { return nil }
        return String(array.dropFirst().dropLast())
    }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], let type = body["type"] as? String else { return }
        switch type {
        case "ready":
            ready = true
            for store in ["theme", "app"] { if let json = latest[store] { send(store, json) } }
            scrollForCapture(webView)
        case "dispatch":
            guard let action = body["action"], JSONSerialization.isValidJSONObject(action),
                  let data = try? JSONSerialization.data(withJSONObject: action),
                  let json = String(data: data, encoding: .utf8) else { return }
            dispatch(json)
        default:
            return
        }
    }
}


/// The in-page driver (web/public/astryx-drive.js, copied into the app as web/astryx-drive.js),
/// added to every web view so a scenario's gestures can be performed in any of them.
@MainActor
func addScenarioDriver(to config: WKWebViewConfiguration) {
    guard let url = Bundle.main.resourceURL?.appendingPathComponent("web/astryx-drive.js"),
          let source = try? String(contentsOf: url, encoding: .utf8) else { return }
    config.userContentController.addUserScript(WKUserScript(source: source, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
}

extension WKWebView {
    /// The page runs to the display's edges, under the navigation bar and the home indicator, and
    /// scrolls under them as the SwiftUI drawing does. It asks for that with `viewport-fit=cover`
    /// and insets itself by `env(safe-area-inset-*)`; the scroll view adds none of its own on top
    /// (`.automatic` leaves the page's own scrollers to the page, and the document's inset to the
    /// safe area the web view reports).
    @MainActor
    func letPageUseTheSafeArea() {
        #if os(iOS)
        scrollView.contentInsetAdjustmentBehavior = .automatic
        scrollView.automaticallyAdjustsScrollIndicatorInsets = true
        #endif
    }

    /// Performs a scenario step's gestures in the page, as a person would; throws what the page threw.
    @MainActor
    func performGestures(_ gestures: Any) async throws {
        _ = try await callAsyncJavaScript(
            "await window.__astryxDrive.perform(gestures); return true;",
            arguments: ["gestures": gestures], in: nil, contentWorld: .page)
    }
}

/// A script message handler holds its target strongly; the web view's controller would
/// then keep the bridge alive forever.
private final class WeakHandler: NSObject, WKScriptMessageHandler {
    weak var target: WebBridge?
    init(_ target: WebBridge) { self.target = target }
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        MainActor.assumeIsolated { target?.userContentController(controller, didReceive: message) }
    }
}

/// Serves `astryx://app/<path>` from the `web` folder in the app's resources: the built
/// page, so it loads with no server and no network, and its modules load as same-origin.
final class BundledPages: NSObject, WKURLSchemeHandler {
    private static let types = ["html": "text/html", "js": "text/javascript", "css": "text/css", "svg": "image/svg+xml", "png": "image/png", "json": "application/json", "woff2": "font/woff2", "ico": "image/x-icon"]

    func webView(_ webView: WKWebView, start task: any WKURLSchemeTask) {
        guard let url = task.request.url, let root = Bundle.main.resourceURL?.appendingPathComponent("web", isDirectory: true) else {
            return task.didFailWithError(URLError(.badURL))
        }
        let path = url.path.isEmpty || url.path == "/" ? "/index.html" : url.path
        let file = root.appendingPathComponent(String(path.dropFirst())).standardizedFileURL
        // Nothing outside the page's own folder.
        guard file.path.hasPrefix(root.standardizedFileURL.path), let data = try? Data(contentsOf: file) else {
            return task.didFailWithError(URLError(.fileDoesNotExist))
        }
        let type = Self.types[file.pathExtension.lowercased()] ?? "application/octet-stream"
        let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: ["Content-Type": type, "Content-Length": String(data.count)])!
        task.didReceive(response)
        task.didReceive(data)
        task.didFinish()
    }

    func webView(_ webView: WKWebView, stop task: any WKURLSchemeTask) {}
}

#if os(macOS)
struct WebPane: NSViewRepresentable {
    let bridge: WebBridge
    func makeNSView(context: Context) -> WKWebView { bridge.webView }
    func updateNSView(_ view: WKWebView, context: Context) {}
}
#else
struct WebPane: UIViewRepresentable {
    let bridge: WebBridge
    func makeUIView(context: Context) -> WKWebView { bridge.webView }
    func updateUIView(_ view: WKWebView, context: Context) {}
}
#endif

/// Stock Astryx: its own templates with their own state, in a second web view. Nothing of
/// the core reaches it but which template is closest to the current screen.
@MainActor
final class StockBridge {
    let webView: WKWebView
    private var shown: String?

    init() {
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(BundledPages(), forURLScheme: "astryx")
        addScenarioDriver(to: config)
        webView = WKWebView(frame: .zero, configuration: config)
        webView.letPageUseTheSafeArea()
        #if DEBUG
        if #available(macOS 13.3, iOS 16.4, *) { webView.isInspectable = true }
        #endif
    }

    /// Loads the current template afresh: its own state back to the start (a scenario begins).
    func restart() {
        guard let template = shown else { return }
        shown = nil
        show(template)
    }

    /// Shows `template`: the first time by loading the page, after that without a reload.
    func show(_ template: String) {
        guard template != shown else { return }
        let first = shown == nil
        shown = template
        guard let escaped = template.addingPercentEncoding(withAllowedCharacters: .alphanumerics) else { return }
        if first {
            webView.load(URLRequest(url: URL(string: "astryx://app/stock.html?template=\(escaped)")!))
        } else {
            webView.evaluateJavaScript("window.__astryxStock && window.__astryxStock.show(decodeURIComponent('\(escaped)'))")
        }
    }
}

#if os(macOS)
struct StockPane: NSViewRepresentable {
    let bridge: StockBridge
    func makeNSView(context: Context) -> WKWebView { bridge.webView }
    func updateNSView(_ view: WKWebView, context: Context) {}
}
#else
struct StockPane: UIViewRepresentable {
    let bridge: StockBridge
    func makeUIView(context: Context) -> WKWebView { bridge.webView }
    func updateUIView(_ view: WKWebView, context: Context) {}
}
#endif

/// The refactored web page on a core of its own, in the web view's JavaScript: no Hermes, and
/// no `astryx` message handler, so the page runs standalone. Nothing of the shared state
/// reaches it but the current screen, so the drawings stay comparable.
@MainActor
final class OwnCoreBridge {
    let webView: WKWebView
    private var shown: String?
    private var loaded = false

    init() {
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(BundledPages(), forURLScheme: "astryx")
        addScenarioDriver(to: config)
        webView = WKWebView(frame: .zero, configuration: config)
        webView.letPageUseTheSafeArea()
        #if DEBUG
        if #available(macOS 13.3, iOS 16.4, *) { webView.isInspectable = true }
        #endif
    }

    /// Loads the page afresh at the current screen: its own core starts over (a scenario begins).
    func restart() {
        guard let screen = shown else { return }
        loaded = false
        shown = nil
        show(screen)
    }

    /// Follows the shared core to `screen`: the first time by loading the page there.
    func show(_ screen: String) {
        guard screen != shown else { return }
        shown = screen
        guard let escaped = screen.addingPercentEncoding(withAllowedCharacters: .alphanumerics) else { return }
        if !loaded {
            loaded = true
            webView.load(URLRequest(url: URL(string: "astryx://app/index.html?bare=1&screen=\(escaped)")!))
        } else {
            webView.evaluateJavaScript("window.__astryxOwn && window.__astryxOwn.navigate(decodeURIComponent('\(escaped)'))")
        }
    }
}

#if os(macOS)
struct OwnCorePane: NSViewRepresentable {
    let bridge: OwnCoreBridge
    func makeNSView(context: Context) -> WKWebView { bridge.webView }
    func updateNSView(_ view: WKWebView, context: Context) {}
}
#else
struct OwnCorePane: UIViewRepresentable {
    let bridge: OwnCoreBridge
    func makeUIView(context: Context) -> WKWebView { bridge.webView }
    func updateUIView(_ view: WKWebView, context: Context) {}
}
#endif

/// `-AXScrollY <points>` (screen captures): once the page has drawn, scroll it that far, the
/// document and the page's own tallest scrolling box (templates scroll an inner element), so a
/// capture can see below the fold without a pointer. Off unless the argument is given.
func scrollForCapture(_ webView: WKWebView) {
    let y = UserDefaults.standard.double(forKey: "AXScrollY")
    guard y > 0 else { return }
    DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
        webView.evaluateJavaScript("""
        (() => { const y = \(y); window.scrollTo(0, y);
          let best = null; for (const e of document.querySelectorAll('*')) {
            const o = getComputedStyle(e).overflowY;
            if ((o === 'auto' || o === 'scroll') && e.scrollHeight > e.clientHeight + 1 &&
                (!best || e.clientHeight > best.clientHeight)) best = e; }
          if (best) best.scrollTop = y; })()
        """)
    }
}
