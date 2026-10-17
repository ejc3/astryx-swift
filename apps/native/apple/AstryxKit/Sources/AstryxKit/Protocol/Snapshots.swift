import Foundation

/// A screen of the app: a title and subtitle, toolbar buttons and a body tree.
public struct Screen: Decodable, Sendable {
    public let id: String
    public let title: String
    public let subtitle: String
    public let toolbar: [ButtonNode]
    public let body: Node
}

public struct NavItem: Decodable, Sendable, Identifiable {
    public let id: String
    public let label: String
    public let icon: Icon
    public let badge: String?
}

public struct ToastInfo: Decodable, Sendable {
    public struct Action: Decodable, Sendable {
        public let id: String
        public let label: String
    }
    public let id: Int
    public let tone: Tone
    public let text: String
    public let action: Action?
}

public struct DialogInfo: Decodable, Sendable {
    public let title: String
    public let text: String
    public let confirm: ButtonNode
    public let cancel: ButtonNode
}

/// What the "app" store's snapshot holds: everything drawn for the current screen.
public struct AppSnapshot: Decodable, Sendable {
    public struct ThemeChoice: Decodable, Sendable {
        public let id: String
        public let label: String?
        /// The id of the settings control that chooses the theme.
        public let setId: String?
        public let options: [Option]
    }
    /// Which drawings of the screens to show: "native", "web", "stock", "compare" or "all".
    public struct SurfaceChoice: Decodable, Sendable {
        public let id: String
        public let label: String
        public let value: String
        public let options: [Option]
        public let stockTemplate: String?
        public let stockLabel: String?
    }
    public let protocolVersion: Int
    public let appName: String
    public let nav: [NavItem]
    public let current: String
    public let screen: Screen
    public let toast: ToastInfo?
    public let dialog: DialogInfo?
    public let theme: ThemeChoice
    public let surface: SurfaceChoice?

    private enum CodingKeys: String, CodingKey {
        case protocolVersion = "protocol", appName, nav, current, screen, toast, dialog, theme, surface
    }
}

/// One mode of one theme, resolved: colors as #RRGGBBAA, sizes in points.
public struct ResolvedMode: Decodable, Sendable {
    public let colors: [String: String]
    public let sizes: [String: Double]
}

/// What the "theme" store's snapshot holds: Astryx's resolved tokens for light and dark.
public struct ResolvedTheme: Decodable, Sendable {
    public let id: String
    public let label: String
    public let light: ResolvedMode
    public let dark: ResolvedMode
}
