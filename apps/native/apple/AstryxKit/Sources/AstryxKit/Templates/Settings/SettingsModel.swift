import Foundation

/// The settings page's view model: a mirror of `View` in core/src/templates/settings/model.ts.
struct SettingsModel: Decodable, Sendable {
    struct NavItem: Decodable, Sendable {
        let label: String
        let isSelected: Bool
    }

    /// A search result: the id is what `set search` sends back.
    struct SearchItem: Decodable, Sendable, Hashable {
        let id: String
        let label: String
    }

    let navItems: [NavItem]
    let searchItems: [SearchItem]
    /// The chosen search result, or nil.
    let search: SearchItem?
    let username: String
    let firstName: String
    let lastName: String
    let email: String
    let currentPw: String
    let newPw: String
    let confirmPw: String
    let dataExport: Bool
    let adminMembers: Bool
    let twoFactor: Bool
}
