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
    /// The text in the search box; `set searchQuery` changes it, and the core chooses the result it spells.
    let searchQuery: String
    /// What the text finds (the core's `searchSettings`): the suggestions to draw.
    let results: [SearchItem]
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
    let rules: Rules
    /// Controls that do nothing in the stock template: "save.basic", "save.password", "save.advanced".
    let inert: [String]
    /// The words only the native drawing writes.
    let words: Words

    /// The layout numbers both drawings read.
    struct Rules: Decodable, Sendable {
        let narrowMaxWidth: Double
        let contentMaxWidth: Double
        let sidebarWidth: Double
        /// Each column of a group's side-by-side form is at least this wide; else the group stacks.
        let groupColumnMin: Double
    }

    func isInert(_ control: String) -> Bool { inert.contains(control) }

    struct Words: Decodable, Sendable {
        struct Basic: Decodable, Sendable {
            let title: String, detail: String, username: String, firstName: String, lastName: String, email: String
        }
        struct Password: Decodable, Sendable {
            let title: String, detail: String, current: String, currentPlaceholder: String
            let new: String, newPlaceholder: String, confirm: String, confirmPlaceholder: String
        }
        struct Advanced: Decodable, Sendable {
            let title: String, detail: String, dataExport: String, dataExportDetail: String
            let adminMembers: String, adminMembersDetail: String, twoFactor: String, twoFactorDetail: String
        }

        let common: COSWords
        let title: String
        let sections: String
        let searchLabel: String
        let searchPlaceholder: String
        let clearSearch: String
        let save: String
        let basic: Basic
        let password: Password
        let advanced: Advanced

        private enum CodingKeys: String, CodingKey {
            case title, sections, searchLabel, searchPlaceholder, clearSearch, save, basic, password, advanced
        }

        init(from decoder: Decoder) throws {
            common = try COSWords(from: decoder)
            let c = try decoder.container(keyedBy: CodingKeys.self)
            title = try c.decode(String.self, forKey: .title)
            sections = try c.decode(String.self, forKey: .sections)
            searchLabel = try c.decode(String.self, forKey: .searchLabel)
            searchPlaceholder = try c.decode(String.self, forKey: .searchPlaceholder)
            clearSearch = try c.decode(String.self, forKey: .clearSearch)
            save = try c.decode(String.self, forKey: .save)
            basic = try c.decode(Basic.self, forKey: .basic)
            password = try c.decode(Password.self, forKey: .password)
            advanced = try c.decode(Advanced.self, forKey: .advanced)
        }
    }
}
