import SwiftUI

/// Astryx's settings template, drawn natively from the core's view model
/// (core/src/templates/settings/model.ts, its `View` type): section tabs across the top of the
/// page (a menu where the six labels do not fit: the app already has a sidebar, so the page does
/// not add a second), and three groups of settings, each a title and explanation beside its
/// fields. The search for settings lives in the window's toolbar (`.searchable`), where a Mac
/// puts search.
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

    /// The template owns its outer padding, as the web page's `LayoutContent padding={4}` does.
    private var pad: CGFloat { ax.space(4) }
    private var inner: CGFloat { max(width - 2 * pad, 0) }
    /// A group's explanation sits beside its fields when two columns of the core's minimum width
    /// and the gap between them fit in the page's own width (inside its padding), as the web grid does.
    private var columns: Bool { inner >= 2 * model.rules.groupColumnMin + ax.space(10) }
    private var actions: SettingsSender { SettingsSender(send: send) }

    var body: some View {
        VStack(alignment: .leading, spacing: ax.space(4)) {
            // Tabs where the six labels fit; a menu, which works at any width and text size, where not.
            ViewThatFits(in: .horizontal) {
                SettingsSectionTabs(items: model.navItems, label: model.words.sections, actions: actions)
                SettingsSectionMenu(items: model.navItems, label: model.words.sections, actions: actions)
            }
            .frame(maxWidth: .infinity)
            SettingsGroups(model: model, actions: actions, columns: columns)
                .frame(maxWidth: .infinity, alignment: .topLeading)
        }
        .padding(pad)
        .frame(maxWidth: model.rules.contentMaxWidth, alignment: .topLeading)
        .frame(maxWidth: .infinity, alignment: .top)
        .environment(\.axWidth, inner)
        .environment(\.cosWords, model.words.common)
        .modifier(SettingsSearch(model: model))
    }
}

/// The sections as one menu button showing the chosen section, for a narrow screen (a menu
/// does not clip however many sections there are). Choosing sends `press nav:<label>`.
private struct SettingsSectionMenu: View {
    let items: [SettingsModel.NavItem]
    let label: String
    let actions: SettingsSender
    @Environment(\.ax) private var ax
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        let shown = items.first(where: \.isSelected)?.label ?? ""
        Menu {
            ForEach(items, id: \.label) { item in
                Button { actions.press("nav:\(item.label)") } label: {
                    if item.isSelected {
                        Label(item.label, systemImage: "checkmark")
                    } else {
                        Text(item.label)
                    }
                }
            }
        } label: {
            HStack(spacing: ax.space(2)) {
                Text(shown).font(ax.fontLabel).foregroundStyle(ax.text).lineLimit(typeSize.isAccessibilitySize ? nil : 1)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 0)
                Image(systemName: "chevron.up.chevron.down")
                    .font(.system(size: ax.fontSize("font-size-xs", 10), weight: .semibold))
                    .foregroundStyle(ax.iconSecondary)
            }
            .padding(.horizontal, ax.space(3))
            // Astryx's 32 point control; the hit region reaches 44 on a touch screen.
            .frame(minHeight: cosFieldHeight(ax))
            .background(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).fill(ax.surface))
            .overlay(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).strokeBorder(ax.border, lineWidth: 1))
            .contentShape(Rectangle())
            .axTapTarget(keepLayout: true)
        }
        .menuStyle(.button)
        .buttonStyle(.plain)
        .menuIndicator(.hidden)
        .accessibilityLabel(label)
        .accessibilityValue(shown)
    }
}

/// The sections as Astryx's TabList draws them, centered across the page: the labels in a row,
/// the chosen one semibold with an accent underline as wide as the word. Choosing sends
/// `press nav:<label>`.
private struct SettingsSectionTabs: View {
    let items: [SettingsModel.NavItem]
    let label: String
    let actions: SettingsSender
    @Environment(\.ax) private var ax

    var body: some View {
        HStack(spacing: ax.space(7)) {
            ForEach(items, id: \.label) { item in
                Button { actions.press("nav:\(item.label)") } label: {
                    Text(item.label)
                        .font(item.isSelected ? ax.fontStrong : ax.fontBase)
                        .foregroundStyle(item.isSelected ? ax.text : ax.textSecondary)
                        .lineLimit(1)
                        .fixedSize()
                        .frame(minHeight: max(axMinTarget, 40))
                        .overlay(alignment: .bottom) {
                            Rectangle().fill(item.isSelected ? ax.accent : .clear).frame(height: 2)
                        }
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(item.isSelected ? [.isButton, .isSelected] : .isButton)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(label)
    }
}
