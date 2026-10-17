import AstryxKit
import Foundation

/// Runs the core in the headless runtime and carries its two stores to `model`. Every
/// action the views send goes to the core as JSON; every snapshot the core sends comes
/// back to the model on the main actor. Nothing here decides anything.
@MainActor
final class ClientHost: NSObject, AXClientServices {
    let model: AppModel
    /// The web drawing, on the same core: every snapshot goes to it too.
    private(set) var web: WebBridge!
    /// Stock Astryx, on its own state: told only which template the current screen maps to.
    let stock = StockBridge()
    /// The refactored page on its own core: told only the current screen.
    let own = OwnCoreBridge()
    private let runtime = ReactRuntime()
    private var nextCall = 0
    private var connected = false
    /// Actions sent before the core said it was running, in order.
    private var waiting: [String] = []
    /// Read on the JavaScript thread, so not the main actor's: set once, before the runtime starts.
    nonisolated let start: String?
    /// Which store each outstanding getSnapshot asked for.
    private var asked: [Int: String] = [:]
    private(set) var failure: String?

    override init() {
        var send: (String) -> Void = { _ in }
        model = AppModel(send: { send($0) })
        start = ClientHost.startArgument()
        super.init()
        send = { [weak self] action in self?.dispatch(action) }
        web = WebBridge { [weak self] action in self?.dispatch(action) }
    }

    /// One snapshot, to both drawings.
    private func deliver(_ store: String, _ json: String) {
        model.receive(store: store, snapshotJSON: json)
        web.changed(store: store, snapshotJSON: json)
        guard store == "app", let data = json.data(using: .utf8),
              let snapshot = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return }
        if let surface = snapshot["surface"] as? [String: Any], let template = surface["stockTemplate"] as? String { stock.show(template) }
        if let current = snapshot["current"] as? String { own.show(current) }
    }

    func run() {
        guard let bundle = Bundle.main.url(forResource: "main", withExtension: "jsbundle") else {
            failure = "The app has no main.jsbundle"
            return
        }
        AXClientLink.services = self
        runtime.start(bundle: bundle, onLog: { NSLog("%@", $0) }, onFatal: { message in
            DispatchQueue.main.async { MainActor.assumeIsolated { [weak self] in self?.failure = "JavaScript stopped: \(message)" } }
        })
    }

    /// `-AXScreen inbox` and `-AXTheme ocean` on the command line (the screen tour) start
    /// the core somewhere other than the first screen.
    private static func startArgument() -> String? {
        let defaults = UserDefaults.standard
        var start: [String: String] = [:]
        if let screen = defaults.string(forKey: "AXScreen") { start["screen"] = screen }
        if let theme = defaults.string(forKey: "AXTheme") { start["theme"] = theme }
        guard !start.isEmpty, let data = try? JSONSerialization.data(withJSONObject: start) else { return nil }
        return String(data: data, encoding: .utf8)
    }

    private func call(_ operation: String, _ argument: String) {
        guard let emitter = AXClientLink.emitter else { return }
        nextCall += 1
        if operation == "getSnapshot" { asked[nextCall] = argument }
        emitter.call(nextCall, operation: operation, argument: argument)
    }

    private func dispatch(_ actionJSON: String) {
        guard connected else { return waiting.append(actionJSON) }
        call("dispatch", actionJSON)
    }

    // MARK: AXClientServices, called off the main thread.

    nonisolated func libraryConnected(withBridgeVersion bridgeVersion: Int) {
        DispatchQueue.main.async {
            MainActor.assumeIsolated {
                self.connected = true
                self.call("getSnapshot", "theme")
                self.call("getSnapshot", "app")
                let queued = self.waiting
                self.waiting = []
                for action in queued { self.call("dispatch", action) }
            }
        }
    }

    nonisolated func storeChanged(_ storeName: String, snapshotJSON: String) {
        DispatchQueue.main.async { MainActor.assumeIsolated { self.deliver(storeName, snapshotJSON) } }
    }

    /// A getSnapshot's answer is the snapshot of the store it asked for; a dispatch's is empty.
    nonisolated func callAnswered(_ callId: Int, result: String?, error: String?) {
        DispatchQueue.main.async {
            MainActor.assumeIsolated {
                let store = self.asked.removeValue(forKey: callId)
                if let error { NSLog("astryx: call %d refused: %@", callId, error) }
                guard let store, let result else { return }
                self.deliver(store, result)
            }
        }
    }

    nonisolated func startJSON() -> String? {
        start
    }
}
