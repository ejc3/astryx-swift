import SwiftUI

/// Astryx's settings template, drawn natively from the core's view model
/// (core/src/templates/settings/model.ts, its `View` type): section navigation (a segmented
/// control across the top of the page on a wide window, a menu on a narrow one: the app already
/// has a sidebar, so the page does not add a second), a search for settings, and three groups of
/// settings, each a title and explanation beside its fields.
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

/// Below this width the navigation becomes a menu above the content and the groups stack.
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
    @Environment(\.dynamicTypeSize) private var typeSize

    private var narrow: Bool { width < settingsNarrowWidth }
    private var actions: SettingsSender { SettingsSender(send: send) }

    var body: some View {
        VStack(alignment: .leading, spacing: ax.space(4)) {
            HStack {
                if !narrow { Spacer(minLength: 0) }
                SettingsSearch(items: model.searchItems, selected: model.search, words: model.words, actions: actions)
                    .frame(maxWidth: narrow ? .infinity : 320)
            }
            .zIndex(1)
            // A row of segments needs room for six labels; a menu works at any width and any text size.
            if narrow || typeSize.isAccessibilitySize || width < 760 {
                SettingsSectionMenu(items: model.navItems, label: model.words.sections, actions: actions)
            } else {
                SettingsSectionSegments(items: model.navItems, label: model.words.sections, actions: actions)
            }
            SettingsGroups(model: model, actions: actions, columns: !narrow && width >= 680)
                .frame(maxWidth: .infinity, alignment: .topLeading)
        }
        .frame(maxWidth: 1000, alignment: .topLeading)
        .frame(maxWidth: .infinity, alignment: .top)
        .environment(\.cosWords, model.words.common)
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
            .frame(minHeight: max(cosTouch, 36 * min(ax.scale, 1.4)))
            .background(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).fill(ax.surface))
            .overlay(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).strokeBorder(ax.borderStrong, lineWidth: 1))
            .contentShape(Rectangle())
        }
        .menuStyle(.button)
        .buttonStyle(.plain)
        .menuIndicator(.hidden)
        .accessibilityLabel(label)
        .accessibilityValue(shown)
    }
}

/// The sections as a segmented control across the page, for a wide window: a layout inside the
/// detail rather than a second sidebar next to the app's own. Choosing sends `press nav:<label>`.
private struct SettingsSectionSegments: View {
    let items: [SettingsModel.NavItem]
    let label: String
    let actions: SettingsSender
    @Environment(\.ax) private var ax
    @Environment(\.axStatic) private var isStatic

    var body: some View {
        Group {
            if isStatic {
                // A picker cannot be drawn to an image: the same segments, drawn by hand.
                HStack(spacing: 2) {
                    ForEach(items, id: \.label) { item in
                        Text(item.label)
                            .font(item.isSelected ? ax.fontStrong : ax.fontLabel)
                            .foregroundStyle(ax.text)
                            .frame(maxWidth: .infinity, minHeight: 28)
                            .background(
                                RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous)
                                    .fill(item.isSelected ? ax.surface : .clear)
                            )
                    }
                }
                .padding(2)
                .background(RoundedRectangle(cornerRadius: ax.radiusElement + 2, style: .continuous).fill(ax.muted))
            } else {
                Picker(label, selection: Binding(
                    get: { items.first(where: \.isSelected)?.label ?? "" },
                    set: { actions.press("nav:\($0)") }
                )) {
                    ForEach(items, id: \.label) { Text($0.label).tag($0.label) }
                }
                .pickerStyle(.segmented)
                .labelsHidden()
                .tint(ax.accent)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(label)
    }
}
