import Foundation
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

/// The headless React Native runtime: Hermes, the bundle, and no view.
///
/// React Native is here for two things: a JavaScript runtime with the
/// network, timers and `Intl` the client library needs, and a way for that
/// library and the app to call each other. Nothing is ever rendered by it,
/// so no root view and no surface is created: the host is started, the
/// bundle runs, and its entry (js/index.ts) connects the library to the
/// `AXClient` module.
@MainActor
final class ReactRuntime {
    private final class Delegate: RCTDefaultReactNativeFactoryDelegate {
        var bundle: URL?

        override func sourceURL(for bridge: RCTBridge) -> URL? {
            bundle
        }

        override func bundleURL() -> URL? {
            bundle
        }
    }

    private let delegate = Delegate()
    private var factory: RCTReactNativeFactory?

    /// Starts the runtime on `bundle`. JavaScript's own log lines, and an
    /// error it could not recover from, are handed to the closures.
    func start(bundle: URL, onLog: @escaping @Sendable (String) -> Void, onFatal: @escaping @Sendable (String) -> Void) {
        RCTSetLogThreshold(.info)
        RCTSetLogFunction { level, _, _, _, message in
            guard let message else { return }
            onLog("js \(RCTFormatLogLevel(level) ?? "log"): \(message)")
        }
        // React Native's own answer to an uncaught JavaScript error in a
        // release build is to end the process. The screens are Swift and
        // hold their last snapshots, so the app says what happened instead.
        RCTSetFatalHandler { error in
            onFatal(error?.localizedDescription ?? "An unknown JavaScript error")
        }
        RCTSetFatalExceptionHandler { exception in
            onFatal(exception?.reason ?? "An unknown JavaScript exception")
        }

        // A runtime being replaced is taken down before its replacement
        // starts: letting go of its factory invalidates its host, and its
        // JavaScript stops. React Native's fatal handlers are one pair for
        // the process and do not say which runtime an error came from, so
        // the one way a replaced runtime cannot fail its replacement is to
        // be gone.
        // The app always runs its bundled JavaScript, never a Metro server,
        // so React Native's "Connect to Metro" banner (debug builds) has
        // nothing to offer and would sit over the screens.
        RCTDevLoadingViewSetEnabled(false)

        factory = nil
        delegate.bundle = bundle
        delegate.dependencyProvider = RCTAppDependencyProvider()
        let factory = RCTReactNativeFactory(delegate: delegate)
        self.factory = factory
        // The host, and no root view: this is all of `view(withModuleName:)`
        // that comes before a surface is made. The configuration is a bare
        // one, with no developer menu: there is no view to shake or to take
        // a key press, and `RCTDevMenuConfiguration.default()` is nil in a
        // release build although its header says otherwise.
        factory.rootViewFactory.initializeReactHost(launchOptions: nil, devMenuConfiguration: RCTDevMenuConfiguration())
    }
}
