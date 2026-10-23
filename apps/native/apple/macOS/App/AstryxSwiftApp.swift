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

    /// The window's name before the core's `appName` replaces it with the screen's title.
    private static let windowName = Bundle.main.object(forInfoDictionaryKey: "CFBundleDisplayName") as? String ?? ProcessInfo.processInfo.processName

    var body: some Scene {
        // One window, not a group: every drawing's web view has one superview, so a second
        // window (File > New Window) would take the web views from the first.
        Window(Self.windowName, id: "main") {
            RootView(model: Self.host.model, web: AnyView(WebPane(bridge: Self.host.web)), webOwn: AnyView(OwnCorePane(bridge: Self.host.own)), stock: AnyView(StockPane(bridge: Self.host.stock)))
                .frame(minWidth: 720, minHeight: 520)
                // A sign-in comes back inside its ASWebAuthenticationSession (Host/SignIn.swift). The
                // same address opened from anywhere else carries nothing the app takes.
                .onOpenURL { _ in }
                #if DEBUG
                // `-AXAppearance dark` or `light` (Debug builds only): captures in either appearance
                // without changing the system's.
                .onAppear {
                    switch UserDefaults.standard.string(forKey: "AXAppearance") {
                    case "dark": NSApp.appearance = NSAppearance(named: .darkAqua)
                    case "light": NSApp.appearance = NSAppearance(named: .aqua)
                    default: break
                    }
                }
                #endif
        }
        .defaultSize(width: 1500, height: 920)
        .windowResizability(.contentMinSize)
        .commands {
            SidebarCommands()
            InspectorCommands()
            ToolbarCommands()
            AstryxCommands(model: Self.host.model)
        }
        // The Settings window, opened with the app menu's Settings item or Command-comma.
        Settings {
            AstryxSettingsView(model: Self.host.model)
        }
    }
}
