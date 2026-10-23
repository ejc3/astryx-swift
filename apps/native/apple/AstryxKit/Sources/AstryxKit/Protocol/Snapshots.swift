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
    /** The group the core puts it in ("Astryx templates", "More demos"). */
    public let section: String
    /// What VoiceOver says: the label and its section (both sections share some names).
    public let accessibilityLabel: String?
}

extension AppSnapshot {
    /// The nav items in the core's order, grouped by section in order of first appearance.
    var navSections: [(title: String, items: [NavItem])] {
        var order: [String] = []
        var groups: [String: [NavItem]] = [:]
        for item in nav {
            if groups[item.section] == nil { order.append(item.section) }
            groups[item.section, default: []].append(item)
        }
        return order.map { ($0, groups[$0]!) }
    }
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
    /// The tone in a word for VoiceOver (absent when neutral), and the close button's label.
    public let toneLabel: String?
    public let dismissLabel: String?
}

/// Signing in to sync (core/src/account.ts): who is signed in and the sync status, in the
/// core's words. The host does the signing in when `request` changes; the views only draw this
/// and send its buttons' ids.
public struct AccountInfo: Decodable, Sendable, Equatable {
    public struct Status: Decodable, Sendable, Equatable {
        /// "connecting", "synced", "pending", "offline" or "signed-out".
        public let state: String
        public let text: String
        public let tone: Tone
        public let icon: Icon
    }
    public struct Request: Decodable, Sendable, Equatable {
        /// "signIn" or "signOut".
        public let kind: String
        public let seq: Int
    }
    /// False: nothing of the account is drawn (sign-in is not configured).
    public let available: Bool
    /// "signed-out", "signing-in" or "signed-in".
    public let state: String
    public let label: String
    public let title: String
    public let detail: String
    public let status: Status?
    public let signIn: ButtonNode?
    public let signOut: ButtonNode?
    public let accessibilityLabel: String
    public let request: Request?

    public static func == (a: AccountInfo, b: AccountInfo) -> Bool {
        a.available == b.available && a.state == b.state && a.title == b.title && a.detail == b.detail && a.status == b.status
            && a.signIn?.id == b.signIn?.id && a.signIn?.label == b.signIn?.label && a.signOut?.id == b.signOut?.id && a.request == b.request
    }
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
        public struct OptionGroup: Decodable, Sendable {
            public let label: String
            public let values: [String]
        }
        public let id: String
        public let label: String
        public let value: String
        public let options: [Option]
        /// The options in groups: which drawing, and how many at once.
        public let groups: [OptionGroup]?
        /// Why a side-by-side choice is dimmed when the window is too small.
        public let unavailable: String?
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
    public let scenarios: ScenariosSnapshot?
    public let account: AccountInfo?

    private enum CodingKeys: String, CodingKey {
        case protocolVersion = "protocol", appName, nav, current, screen, toast, dialog, theme, surface, scenarios, account
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
