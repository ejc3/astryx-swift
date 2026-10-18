import SwiftUI

/// The three groups of settings, with a hairline between them.
struct SettingsGroups: View {
    let model: SettingsModel
    let actions: SettingsSender
    /// The explanation beside the fields (true) or above them (false).
    let columns: Bool
    @Environment(\.ax) private var ax

    private func field(_ id: String, _ label: String, _ value: String, content: COSContent = .plain, secure: Bool = false) -> some View {
        COSField(label: label) {
            COSTextBox(id: "tpl.settings." + id, label: label, value: value, content: content, secure: secure)
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: ax.space(6)) {
            SettingsGroup(
                title: "Basic information",
                detail: "View and update your personal details and account information.",
                columns: columns
            ) {
                field("username", "Username", model.username, content: .username)
                field("firstName", "First name", model.firstName, content: .givenName)
                field("lastName", "Last name", model.lastName, content: .familyName)
                field("email", "Email address", model.email, content: .email)
                COSButton(label: "Save", variant: .primary) {}
            }
            AXDivider()
            SettingsGroup(
                title: "Change password",
                detail: "Update your password to keep your account secure.",
                columns: columns
            ) {
                field("currentPw", "Verify current password", model.currentPw, content: .password, secure: true)
                field("newPw", "New password", model.newPw, content: .newPassword, secure: true)
                field("confirmPw", "Confirm password", model.confirmPw, content: .newPassword, secure: true)
                COSButton(label: "Save", variant: .primary) {}
            }
            AXDivider()
            SettingsGroup(
                title: "Advanced settings",
                detail: "Configure detailed account preferences and security options.",
                columns: columns
            ) {
                COSSwitch(label: "Data Export Access", description: "Allow export of personal data and backups.", isOn: model.dataExport) {
                    actions.set("dataExport", .bool($0))
                }
                COSSwitch(label: "Allow Admin to Add Members", description: "Admins can invite and manage members.", isOn: model.adminMembers) {
                    actions.set("adminMembers", .bool($0))
                }
                COSSwitch(label: "Enable Two-Factor Authentication", description: "Require 2FA for added account security.", isOn: model.twoFactor) {
                    actions.set("twoFactor", .bool($0))
                }
                COSButton(label: "Save", variant: .primary) {}
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
    let actions: SettingsSender
    @State private var query: String
    /// The label of a result the user just picked, so the change it makes to `query` is not
    /// taken for typing away from the choice.
    @State private var committed: String?
    @FocusState private var focused: Bool
    @Environment(\.ax) private var ax
    @Environment(\.axStatic) private var isStatic

    init(items: [SettingsModel.SearchItem], selected: SettingsModel.SearchItem?, actions: SettingsSender) {
        self.items = items; self.selected = selected; self.actions = actions
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
                Text(query.isEmpty ? "Search settings..." : query)
                    .font(ax.fontBase)
                    .foregroundStyle(query.isEmpty ? ax.textDisabled : ax.text)
                    .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                TextField("Search", text: $query, prompt: Text("Search settings...").foregroundColor(ax.textDisabled))
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
                    Image(systemName: "xmark.circle.fill").foregroundStyle(ax.iconSecondary).frame(minWidth: 24, minHeight: 24)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Clear search")
            }
        }
        .padding(.horizontal, ax.space(3))
        .frame(minHeight: 36 * min(ax.scale, 1.4))
        .background(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).fill(ax.surface))
        .overlay(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).strokeBorder(focused ? ax.accent : ax.borderStrong, lineWidth: 1))
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
                        .frame(minHeight: 36)
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
