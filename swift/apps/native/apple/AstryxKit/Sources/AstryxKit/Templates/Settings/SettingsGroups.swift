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

    /// A text field. `startsEmpty` draws a password field empty (its placeholder showing) although the
    /// core holds the stock template's sample password: native-only, since Apple says never to
    /// prefill a password field and the web copy must match stock.
    private func field(
        _ id: String, _ label: String, _ value: String, placeholder: String = "", content: COSContent = .plain,
        secure: Bool = false
    ) -> some View {
        let following = next(after: id)
        return COSField(label: label) {
            COSTextBox(
                id: "tpl.settings." + id, label: label, value: value, placeholder: placeholder, content: content,
                secure: secure, focusKey: id, focus: $focus, startsEmpty: secure,
                submitLabel: following == nil ? .done : .next
            ) { focus = following }
        }
    }

    private func save(_ control: String) -> some View {
        COSButton(label: model.words.save, variant: .primary) {}
            .disabled(model.isInert(control))
    }

    var body: some View {
        let w = model.words
        VStack(alignment: .leading, spacing: ax.space(6)) {
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
            SettingsGroup(title: w.advanced.title, detail: w.advanced.detail, columns: columns) {
                COSSwitch(label: w.advanced.dataExport, description: w.advanced.dataExportDetail, isOn: model.dataExport) {
                    actions.set("dataExport", .bool($0))
                }
                COSSwitch(label: w.advanced.adminMembers, description: w.advanced.adminMembersDetail, isOn: model.adminMembers) {
                    actions.set("adminMembers", .bool($0))
                }
                COSSwitch(label: w.advanced.twoFactor, description: w.advanced.twoFactorDetail, isOn: model.twoFactor) {
                    actions.set("twoFactor", .bool($0))
                }
                save("save.advanced")
            }
        }
    }
}

/// A group: its title and explanation, and its fields, side by side or one over the other.
private struct SettingsGroup<Fields: View>: View {
    let title: String
    let detail: String
    let columns: Bool
    @ViewBuilder var fields: Fields
    @Environment(\.ax) private var ax

    var body: some View {
        if columns {
            HStack(alignment: .top, spacing: ax.space(10)) {
                heading.frame(maxWidth: .infinity, alignment: .topLeading)
                stack.frame(maxWidth: .infinity, alignment: .topLeading)
            }
        } else {
            VStack(alignment: .leading, spacing: ax.space(4)) {
                heading
                stack
            }
        }
    }

    private var heading: some View {
        VStack(alignment: .leading, spacing: ax.space(1)) {
            Text(title).font(ax.heading(3)).foregroundStyle(ax.text).accessibilityAddTraits(.isHeader)
            Text(detail).font(ax.fontSmall).foregroundStyle(ax.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var stack: some View {
        VStack(alignment: .leading, spacing: ax.space(4)) { fields }
            .frame(maxWidth: 480, alignment: .leading)
    }
}

/// A search box with a list of matches under it. Typing filters; choosing a result sends
/// `set search <id>`; clearing the box (or typing away from the chosen result) sends `set search ""`.
struct SettingsSearch: View {
    let items: [SettingsModel.SearchItem]
    let selected: SettingsModel.SearchItem?
    let words: SettingsModel.Words
    let actions: SettingsSender
    @State private var query: String
    /// The label of a result the user just picked, so the change it makes to `query` is not
    /// taken for typing away from the choice.
    @State private var committed: String?
    @FocusState private var focused: Bool
    @Environment(\.ax) private var ax
    @Environment(\.axStatic) private var isStatic

    init(items: [SettingsModel.SearchItem], selected: SettingsModel.SearchItem?, words: SettingsModel.Words, actions: SettingsSender) {
        self.items = items; self.selected = selected; self.words = words; self.actions = actions
        _query = State(initialValue: selected?.label ?? "")
    }

    private var matches: [SettingsModel.SearchItem] {
        let needle = query.trimmingCharacters(in: .whitespaces).lowercased()
        if needle.isEmpty || query == selected?.label { return items }
        return items.filter { $0.label.lowercased().contains(needle) }
    }

    var body: some View {
        HStack(spacing: ax.space(2)) {
            Image(systemName: "magnifyingglass").foregroundStyle(ax.iconSecondary).accessibilityHidden(true)
            if isStatic {
                Text(query.isEmpty ? words.searchPlaceholder : query)
                    .font(ax.fontBase)
                    .foregroundStyle(query.isEmpty ? ax.textDisabled : ax.text)
                    .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                TextField(words.searchLabel, text: $query, prompt: Text(words.searchPlaceholder).foregroundColor(ax.textDisabled))
                    .textFieldStyle(.plain)
                    .font(ax.fontBase)
                    .foregroundStyle(ax.text)
                    .focused($focused)
                    .submitLabel(.search)
                    .onSubmit { focused = false }
            }
            if !query.isEmpty && !isStatic {
                Button {
                    query = ""
                } label: {
                    Image(systemName: "xmark.circle.fill").foregroundStyle(ax.iconSecondary)
                        .frame(minWidth: cosTouch, minHeight: cosTouch)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(words.clearSearch)
            }
        }
        .padding(.leading, ax.space(3))
        .padding(.trailing, query.isEmpty || isStatic ? ax.space(3) : 0)
        .frame(minHeight: max(cosTouch, 36 * min(ax.scale, 1.4)))
        .background(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).fill(ax.surface))
        .overlay(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).strokeBorder(focused ? ax.accent : ax.borderStrong, lineWidth: 1))
        // Tapping anywhere in the box, its icon and padding included, puts the cursor in it.
        .contentShape(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous))
        .onTapGesture { if !isStatic { focused = true } }
        .overlay(alignment: .bottomLeading) {
            if focused && !matches.isEmpty {
                let gap = ax.space(1)
                results.alignmentGuide(.bottom) { $0[.top] - gap }
            }
        }
        .onChange(of: query) { _, new in
            if new == committed { return }
            if committed != nil {
                committed = nil
                actions.set("search", .string(""))
            } else if let selected, new != selected.label {
                actions.set("search", .string(""))
            }
        }
        .onChange(of: selected) { _, new in
            if let new, new.label != query { committed = new.label; query = new.label }
        }
    }

    private var results: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                ForEach(matches, id: \.id) { item in
                    Button {
                        committed = item.label
                        query = item.label
                        actions.set("search", .string(item.id))
                        focused = false
                    } label: {
                        HStack {
                            Text(item.label).font(ax.fontBase).foregroundStyle(ax.text)
                            Spacer(minLength: 0)
                            if item.id == selected?.id {
                                Image(systemName: "checkmark").foregroundStyle(ax.accent)
                            }
                        }
                        .padding(.horizontal, ax.space(3))
                        .frame(minHeight: cosTouch)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(item.id == selected?.id ? [.isButton, .isSelected] : .isButton)
                }
            }
        }
        .frame(maxHeight: 240)
        .fixedSize(horizontal: false, vertical: true)
        .background(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).fill(ax.surface))
        .overlay(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).strokeBorder(ax.borderStrong, lineWidth: 1))
        .shadow(color: ax.shadow, radius: 8, y: 3)
    }
}
