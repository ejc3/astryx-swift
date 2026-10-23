import SwiftUI

/// The three groups of settings, with a hairline between them.
struct SettingsGroups: View {
    let model: SettingsModel
    let actions: SettingsSender
    /// The explanation beside the fields (true) or above them (false).
    let columns: Bool
    @Environment(\.ax) private var ax
    @FocusState private var focus: String?

    /// The text fields in the order they sit on the page: Return moves along them.
    private static let order = ["username", "firstName", "lastName", "email", "currentPw", "newPw", "confirmPw"]

    private func next(after key: String) -> String? {
        guard let index = Self.order.firstIndex(of: key), index + 1 < Self.order.count else { return nil }
        return Self.order[index + 1]
    }

    /// A text field. A password field shows the core's value, as the web page does.
    private func field(
        _ id: String, _ label: String, _ value: String, placeholder: String = "", content: COSContent = .plain,
        secure: Bool = false
    ) -> some View {
        let following = next(after: id)
        return COSField(label: label) {
            COSTextBox(
                id: "tpl.settings." + id, label: label, value: value, placeholder: placeholder, content: content,
                secure: secure, focusKey: id, focus: $focus,
                submitLabel: following == nil ? .done : .next
            ) { focus = following }
        }
    }

    /// The fields that are saved; the password fields never are.
    private static let saved = ["username", "firstName", "lastName", "email"]

    /// A group's Save. The stock page draws three that do nothing, enabled, and so do we while the
    /// core lists them in `inert` (stock behaviour only, and the password group's: there is no
    /// authentication backend to change a password in). Where saving works the platform's way
    /// applies (HIG: settings take effect as they are made, with no Save button): a checkbox
    /// commits when it is set, and a text field commits when editing ends.
    @ViewBuilder private func save(_ control: String) -> some View {
        if model.isInert(control) {
            COSButton(label: model.words.save, variant: .primary) {}
        }
    }

    /// A checkbox: set it, then commit it at once when saving works.
    private func toggle(_ field: String, _ on: Bool) {
        actions.set(field, .bool(on))
        if !model.isInert("save.advanced") { actions.press("commit:" + field) }
    }

    var body: some View {
        let w = model.words
        VStack(alignment: .leading, spacing: ax.space(4)) {
            SettingsGroup(title: w.basic.title, detail: w.basic.detail, columns: columns) {
                field("username", w.basic.username, model.username, content: .username)
                field("firstName", w.basic.firstName, model.firstName, content: .givenName)
                field("lastName", w.basic.lastName, model.lastName, content: .familyName)
                field("email", w.basic.email, model.email, content: .email)
                save("save.basic")
            }
            AXDivider()
            SettingsGroup(title: w.password.title, detail: w.password.detail, columns: columns) {
                field("currentPw", w.password.current, model.currentPw, placeholder: w.password.currentPlaceholder, content: .password, secure: true)
                field("newPw", w.password.new, model.newPw, placeholder: w.password.newPlaceholder, content: .newPassword, secure: true)
                field("confirmPw", w.password.confirm, model.confirmPw, placeholder: w.password.confirmPlaceholder, content: .newPassword, secure: true)
                save("save.password")
            }
            AXDivider()
            SettingsGroup(title: w.advanced.title, detail: w.advanced.detail, columns: columns, spacing: ax.space(5)) {
                COSCheckbox(label: w.advanced.dataExport, description: w.advanced.dataExportDetail, isOn: model.dataExport) {
                    toggle("dataExport", $0)
                }
                COSCheckbox(label: w.advanced.adminMembers, description: w.advanced.adminMembersDetail, isOn: model.adminMembers) {
                    toggle("adminMembers", $0)
                }
                COSCheckbox(label: w.advanced.twoFactor, description: w.advanced.twoFactorDetail, isOn: model.twoFactor) {
                    toggle("twoFactor", $0)
                }
                save("save.advanced")
            }
        }
        // A text field commits when editing ends: Return, or focus moving to another field or away.
        // The core has every keystroke already (each was a `set`), so this only asks it to save.
        .onChange(of: focus) { old, new in
            guard let old, old != new, Self.saved.contains(old), !model.isInert("save.basic") else { return }
            actions.press("commit:" + old)
        }
    }
}

/// A group: its title and explanation, and its fields, side by side or one over the other.
private struct SettingsGroup<Fields: View>: View {
    let title: String
    let detail: String
    let columns: Bool
    /// The room between the fields: 16 (gap 4), and 20 (gap 5) between the checkboxes.
    var spacing: CGFloat? = nil
    @ViewBuilder var fields: Fields
    @Environment(\.ax) private var ax

    var body: some View {
        if columns {
            HStack(alignment: .top, spacing: ax.space(10)) {
                heading.frame(maxWidth: .infinity, alignment: .topLeading)
                stack.frame(maxWidth: .infinity, alignment: .topLeading)
            }
        } else {
            // Stacked, the web's grid keeps its 40 point gap (gap 10) between the heading and the fields.
            VStack(alignment: .leading, spacing: ax.space(10)) {
                heading
                stack
            }
        }
    }

    private var heading: some View {
        VStack(alignment: .leading, spacing: ax.space(1)) {
            Text(title).font(ax.heading(3)).foregroundStyle(ax.text).accessibilityAddTraits(.isHeader)
            Text(detail).font(ax.fontSmall).foregroundStyle(ax.textSecondary)
                .axLeading(ax, size: ax.fontSize("font-size-sm", 12), ratio: ax.supportingLeading)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var stack: some View {
        VStack(alignment: .leading, spacing: spacing ?? ax.space(4)) { fields }
    }
}

/// Search for a setting, in the window's toolbar (a Mac puts search there, and on an iPhone the
/// navigation bar holds it). The text goes to the core (`set searchQuery`), which chooses the
/// result the text spells and clears the choice otherwise; the suggestions are the core's
/// `results`. A picture with no window has no toolbar, so it draws none.
struct SettingsSearch: ViewModifier {
    let model: SettingsModel
    @State private var query: String
    @Environment(\.axStatic) private var isStatic

    init(model: SettingsModel) {
        self.model = model
        _query = State(initialValue: model.searchQuery)
    }

    func body(content: Content) -> some View {
        if isStatic {
            content
        } else {
            content
                .searchable(text: $query, prompt: Text(model.words.searchPlaceholder))
                .searchSuggestions {
                    ForEach(model.results, id: \.id) { item in
                        Text(item.label).searchCompletion(item.label)
                    }
                }
                .syncedText(id: "tpl.settings.searchQuery", value: model.searchQuery, text: $query)
        }
    }
}
