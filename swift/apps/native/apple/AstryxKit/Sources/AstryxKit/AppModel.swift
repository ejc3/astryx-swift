import Foundation
import SwiftUI

/// The two stores the TypeScript core publishes, and the way back to it.
///
/// The host calls `receive(store:snapshotJSON:)` when a store changes and gives `send` a
/// function that hands an Action, as JSON, to the core. Nothing else of the core is known here.
@MainActor
public final class AppModel: ObservableObject {
    private let sendJSON: (String) -> Void
    private let decoder = JSONDecoder()
    private var ticker: Task<Void, Never>?

    /// The "app" store: everything drawn for the current screen.
    @Published public private(set) var app: AppSnapshot?
    /// The "theme" store: Astryx's resolved tokens, light and dark.
    @Published public private(set) var theme: ResolvedTheme?

    /// `send` receives an Action encoded as JSON, exactly the shapes in ui.ts,
    /// e.g. `{"type":"press","id":"inbox.select:m3"}`.
    ///
    /// Once a minute, while the app is active, it also sends `{"type":"tick"}` so times like
    /// "12m" stay true. `RootView` pauses the clock when the scene is not active.
    public convenience init(send: @escaping (String) -> Void) {
        self.init(send: send, tickEvery: .seconds(60))
    }

    /// `tickEvery: nil` never ticks (fixtures); a short interval lets tests see a tick.
    init(send: @escaping (String) -> Void, tickEvery: Duration?) {
        self.sendJSON = send
        self.tickInterval = tickEvery
        startTicking()
    }

    private let tickInterval: Duration?

    /// Starts the once-a-minute clock if it is not running.
    func startTicking() {
        guard ticker == nil, let interval = tickInterval else { return }
        ticker = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: interval)
                guard !Task.isCancelled, let self else { return }
                self.perform(.tick)
            }
        }
    }

    /// Stops the clock (the scene is not active). `startTicking()` resumes it.
    func stopTicking() {
        ticker?.cancel()
        ticker = nil
    }

    /// A store changed: `store` is "app" or "theme", `snapshotJSON` the JSON its snapshot.
    /// A snapshot that does not decode is ignored, so the last good screen stays on display.
    public func receive(store: String, snapshotJSON: String) {
        let data = Data(snapshotJSON.utf8)
        switch store {
        case "app":
            if let snapshot = try? decoder.decode(AppSnapshot.self, from: data) { app = snapshot }
        case "theme":
            if let resolved = try? decoder.decode(ResolvedTheme.self, from: data) { theme = resolved }
        default:
            break
        }
    }

    /// Sends an Action to the core.
    func perform(_ action: Action) {
        sendJSON(action.json)
    }

    /// A model with both stores filled from fixture JSON; `send` is ignored. For tests and previews.
    public static func fixture(app: Data, theme: Data) -> AppModel {
        let model = AppModel(send: { _ in }, tickEvery: nil)
        model.app = try? model.decoder.decode(AppSnapshot.self, from: app)
        model.theme = try? model.decoder.decode(ResolvedTheme.self, from: theme)
        return model
    }
}
