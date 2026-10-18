import SwiftUI

/// Astryx's settings template, drawn natively from the core's view model
/// (core/src/templates/settings/model.ts, its `View` type): section navigation (a sidebar on a
/// wide window, tabs on a narrow one), a search for settings, and three groups of settings,
/// each a title and explanation beside its fields.
struct SettingsTemplate: View {
    let view: JSONValue

    var body: some View {
        if let model = try? view.decode(SettingsModel.self) {
            SettingsScreen(model: model)
        } else {
            AXTemplatePlaceholder(template: "settings")
        }
    }
}

/// Below this width the navigation becomes tabs above the content and the groups stack.
let settingsNarrowWidth: CGFloat = 640

/// The model's actions, with the template's id prefix the core's `reduce` expects.
struct SettingsSender {
    let send: AXSender
    @MainActor func press(_ id: String) { send(.press(id: "tpl.settings." + id)) }
    @MainActor func set(_ id: String, _ value: Action.Value) { send(.set(id: "tpl.settings." + id, value: value)) }
}

struct SettingsScreen: View {
    let model: SettingsModel
    @Environment(\.ax) private var ax
    @Environment(\.axWidth) private var width
    @Environment(\.axSend) private var send

    private var narrow: Bool { width < settingsNarrowWidth }
    private var actions: SettingsSender { SettingsSender(send: send) }

    var body: some View {
        VStack(alignment: .leading, spacing: ax.space(4)) {
            HStack {
                if !narrow { Spacer(minLength: 0) }
                SettingsSearch(items: model.searchItems, selected: model.search, actions: actions)
                    .frame(maxWidth: narrow ? .infinity : 320)
            }
            .zIndex(1)
            if narrow {
                SettingsTabs(items: model.navItems, actions: actions)
                SettingsGroups(model: model, actions: actions, columns: false)
            } else {
                HStack(alignment: .top, spacing: ax.space(4)) {
                    SettingsSidebar(items: model.navItems, actions: actions)
                        .frame(width: 220)
                    SettingsGroups(model: model, actions: actions, columns: width - 220 - ax.space(4) >= 680)
                        .frame(maxWidth: .infinity, alignment: .topLeading)
                }
            }
        }
        .frame(maxWidth: 1440, alignment: .topLeading)
        .frame(maxWidth: .infinity, alignment: .top)
    }
}

/// The sections as a list down the side; the chosen one is tinted. Choosing sends `press nav:<label>`.
private struct SettingsSidebar: View {
    let items: [SettingsModel.NavItem]
    let actions: SettingsSender
    @Environment(\.ax) private var ax

    var body: some View {
        VStack(alignment: .leading, spacing: ax.hair) {
            ForEach(items, id: \.label) { item in
                Button { actions.press("nav:\(item.label)") } label: {
                    Text(item.label)
                        .font(item.isSelected ? ax.fontStrong : ax.fontLabel)
                        .foregroundStyle(ax.text)
                        .padding(.horizontal, ax.space(3))
                        .frame(maxWidth: .infinity, minHeight: 36, alignment: .leading)
                        .background(
                            RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous)
                                .fill(item.isSelected ? ax.accentMuted : .clear)
                        )
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(item.isSelected ? [.isButton, .isSelected] : .isButton)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Settings sections")
    }
}

/// The sections as tabs above the content, for a narrow window.
private struct SettingsTabs: View {
    let items: [SettingsModel.NavItem]
    let actions: SettingsSender
    @Environment(\.ax) private var ax

    var body: some View {
        AXHScroll {
            HStack(spacing: ax.space(1)) {
                ForEach(items, id: \.label) { item in
                    Button { actions.press("nav:\(item.label)") } label: {
                        Text(item.label)
                            .font(item.isSelected ? ax.fontStrong : ax.fontLabel)
                            .foregroundStyle(item.isSelected ? ax.text : ax.textSecondary)
                            .padding(.horizontal, ax.space(3))
                            .frame(minHeight: 40)
                            .overlay(alignment: .bottom) {
                                Rectangle().fill(item.isSelected ? ax.accent : .clear).frame(height: 2)
                            }
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(item.isSelected ? [.isButton, .isSelected] : .isButton)
                }
            }
        }
        .overlay(alignment: .bottom) { Rectangle().fill(ax.border).frame(height: 1).allowsHitTesting(false) }
    }
}
