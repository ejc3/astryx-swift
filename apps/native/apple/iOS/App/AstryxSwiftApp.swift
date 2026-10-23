import AstryxKit
import SwiftUI

/// The app: one state, held by the core in the headless Hermes runtime (ClientHost), and
/// two drawings of it: AstryxKit's SwiftUI views and the Astryx web page in a web view.
/// Both read the same snapshots and send actions to the same core, so they always agree.
/// For comparison, two more panes with state of their own: the refactored web page on a
/// core of its own in the page (no Hermes), and stock Astryx (its templates, its React state).
@main
struct AstryxSwiftApp: App {
    @MainActor private static let host: ClientHost = {
        let host = ClientHost()
        host.run()
        return host
    }()

    var body: some Scene {
        // One scene (the Info.plist says so): every drawing's web view has one superview.
        WindowGroup {
            RootView(model: Self.host.model, web: AnyView(WebPane(bridge: Self.host.web)), webOwn: AnyView(OwnCorePane(bridge: Self.host.own)), stock: AnyView(StockPane(bridge: Self.host.stock)))
                // A sign-in comes back inside its ASWebAuthenticationSession (Host/SignIn.swift). The
                // same address opened from anywhere else carries nothing the app takes.
                .onOpenURL { _ in }
        }
        .commands {
            AstryxCommands(model: Self.host.model)
        }
    }
}
