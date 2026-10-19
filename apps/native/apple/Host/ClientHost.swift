import AstryxKit
import Foundation
import QuartzCore

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
        let began = CACurrentMediaTime()
        model.receive(store: store, snapshotJSON: json)
        web.changed(store: store, snapshotJSON: json)
        FrameMeter.shared.noteSnapshot(bytes: json.utf8.count, seconds: CACurrentMediaTime() - began)
        guard store == "app", let data = json.data(using: .utf8),
              let snapshot = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return }
        if let surface = snapshot["surface"] as? [String: Any], let template = surface["stockTemplate"] as? String { stock.show(template) }
        if let current = snapshot["current"] as? String { own.show(current) }
        play(snapshot["scenarios"] as? [String: Any])
    }

    // MARK: Scenarios

    /// The step being performed now, so a snapshot that repeats it does not perform it twice.
    private var performing: (scenario: String, index: Int)?
    /// The scenario whose run has begun (its stock and own-core panes restarted).
    private var begun: String?

    /// Performs the step the core says is next: from the native side (the step's recorded
    /// actions, sent as the SwiftUI controls send them) or from the web side (its gestures,
    /// done in the web page on Hermes), and in parallel in the panes with state of their own
    /// (stock and own-core). Then tells the core the step is done.
    private func play(_ scenarios: [String: Any]?) {
        guard let playing = scenarios?["playing"] as? [String: Any], let id = playing["id"] as? String else {
            performing = nil
            begun = nil
            return
        }
        guard let step = playing["step"] as? [String: Any], let index = step["index"] as? Int,
              let driver = playing["driver"] as? String else { return }
        if let p = performing, p.scenario == id, p.index == index { return }
        performing = (id, index)
        let gestures = step["gestures"] ?? []
        let actions = (step["actions"] as? [Any]) ?? []
        let fresh = begun != id
        begun = id
        Task { @MainActor [weak self] in
            guard let self else { return }
            if fresh {
                // The panes with state of their own start the scenario from their first state too.
                self.stock.restart()
                self.own.restart()
                try? await Task.sleep(for: .milliseconds(1500))
            }
            switch driver {
            case "web":
                do { try await self.web.webView.performGestures(gestures) }
                catch { NSLog("astryx: scenario %@ step %d failed on the web side: %@", id, index, String(describing: error)) }
            default:
                for action in actions {
                    guard let data = try? JSONSerialization.data(withJSONObject: action),
                          let json = String(data: data, encoding: .utf8) else { continue }
                    self.dispatch(json)
                }
            }
            // The same gestures where state is separate; a step that cannot be done there is noted, not fatal.
            for pane in [self.stock.webView, self.own.webView] {
                do { try await pane.performGestures(gestures) }
                catch { NSLog("astryx: scenario %@ step %d did not replay in a side pane: %@", id, index, String(describing: error)) }
            }
            // Long enough to see each step happen in every drawing.
            try? await Task.sleep(for: .milliseconds(900))
            self.dispatch("{\"type\":\"press\",\"id\":\"scenario.done:\(index)\"}")
        }
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

    /// `-AXScreen t.inbox`, `-AXTheme ocean` and `-AXSurface all` on the command line (the
    /// screen tour, the UI tests) start the core somewhere other than its first state.
    private static func startArgument() -> String? {
        let defaults = UserDefaults.standard
        var start: [String: String] = [:]
        if let screen = defaults.string(forKey: "AXScreen") { start["screen"] = screen }
        if let theme = defaults.string(forKey: "AXTheme") { start["theme"] = theme }
        if let surface = defaults.string(forKey: "AXSurface") { start["surface"] = surface }
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
                if UserDefaults.standard.bool(forKey: "AXFrameMeter") { FrameMeter.shared.start() }
                // `-AXScenario inbox:web` (the UI tests, a demo) starts a scenario at once.
                if let scenario = UserDefaults.standard.string(forKey: "AXScenario") {
                    self.call("dispatch", "{\"type\":\"press\",\"id\":\"scenario.start:\(scenario)\"}")
                }
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
