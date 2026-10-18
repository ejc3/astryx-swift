import SwiftUI

/// The inventory card: title and Add item, search and filters, view buttons, the low-stock
/// banner, and the rows (a table on a wide card, stacked rows on a narrow one).
struct ShowInventory: View {
    let inventory: ShowModel.Inventory
    @State private var selected: [String: Bool]
    @State private var filterChoice: [String: String] = [:]
    @State private var viewIndex = 0
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send
    @Environment(\.axWidth) private var width
    @Environment(\.showInert) private var inert
    @Environment(\.dynamicTypeSize) private var typeSize

    init(inventory: ShowModel.Inventory) {
        self.inventory = inventory
        _selected = State(initialValue: Dictionary(uniqueKeysWithValues: inventory.rows.map { ($0.id, $0.selected) }))
    }

    private var modelSelection: [String: Bool] {
        Dictionary(uniqueKeysWithValues: inventory.rows.map { ($0.id, $0.selected) })
    }

    /// The table's fixed columns grow with the text, up to the point where a table is no longer
    /// the right form (accessibility sizes), which is when the rows stack.
    private var columnScale: CGFloat { min(max(ax.scale, 1), 1.35) }
    private var availableColumn: CGFloat { 76 * columnScale }
    private var locationColumn: CGFloat { 76 * columnScale }
    private var tagsColumn: CGFloat { 104 * columnScale }

    var body: some View {
        let pad = ax.space(5)
        let tabular = !typeSize.isAccessibilitySize && width - 2 * pad >= 560 + (availableColumn + locationColumn + tagsColumn - 256)
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: ax.space(3)) {
                Text(inventory.heading)
                    .font(ax.heading(2))
                    .foregroundStyle(ax.text)
                    .accessibilityAddTraits(.isHeader)
                Spacer(minLength: ax.space(2))
                Button {} label: {
                    HStack(spacing: ax.space(1)) {
                        Image(systemName: "plus")
                        Text(inventory.addLabel).lineLimit(1)
                    }
                }
                .buttonStyle(AXButtonStyle(variant: .primary, ax: ax))
                .disabled(inert.contains("addItem"))
            }
            .padding(pad)
            Rectangle().fill(ax.border).frame(height: 1)
            filterBar(wide: width - 2 * pad >= 640)
                .padding(.horizontal, pad)
                .padding(.vertical, ax.space(4))
            if let banner = inventory.banner {
                warning(banner)
                    .padding(.horizontal, pad)
                    .padding(.bottom, ax.space(4))
            }
            VStack(spacing: 0) {
                if tabular { tableHeader }
                ForEach(inventory.rows) { row in
                    Rectangle().fill(ax.border).frame(height: 1)
                    if tabular { tableRow(row) } else { stackedRow(row) }
                }
            }
            .padding(.horizontal, pad)
            .padding(.bottom, ax.space(2))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .axSurface(fill: ax.surface, radius: ax.radiusContainer)
        .clipShape(RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous))
        .accessibilityElement(children: .contain)
        .showMirror(modelSelection, into: $selected)
    }

    // MARK: Search and filters

    @ViewBuilder
    private func filterBar(wide: Bool) -> some View {
        VStack(alignment: .leading, spacing: ax.space(3)) {
            HStack(spacing: ax.space(3)) {
                ShowTextField(
                    id: "tpl.showcase.search",
                    label: inventory.search.label,
                    placeholder: inventory.search.placeholder,
                    value: inventory.search.value,
                    icon: "magnifyingglass",
                    showsLabel: false
                )
                .frame(maxWidth: wide ? 240 : .infinity)
                if wide {
                    ForEach(Array(inventory.filters.enumerated()), id: \.offset) { _, filter in
                        filterMenu(filter)
                    }
                    Spacer(minLength: ax.space(2))
                    viewButtons
                } else if width >= 360 {
                    Spacer(minLength: 0)
                }
            }
            if !wide {
                HStack(spacing: ax.space(3)) {
                    moreFilters
                    Spacer(minLength: ax.space(2))
                    viewButtons
                }
            }
        }
    }

    private func filterMenu(_ filter: ShowModel.Inventory.Filter) -> some View {
        let chosen = filterChoice[filter.label]
        return ShowMenuField(text: chosen ?? filter.placeholder, placeholder: chosen == nil, icon: ShowModel.symbol(filter.icon), compact: true) {
            Picker(filter.label, selection: Binding(
                get: { chosen ?? "" },
                set: { choose(filter, $0) }
            )) {
                ForEach(filter.options, id: \.self) { Text($0).tag($0) }
            }
            .pickerStyle(.inline)
            .labelsHidden()
        }
        .accessibilityLabel(filter.label)
        // The label names the filter; what is chosen is its value.
        .accessibilityValue(chosen ?? "")
    }

    /// On a narrow card the three filters fold into one "Filters" menu of submenus.
    @ViewBuilder
    private var moreFilters: some View {
        let label = HStack(spacing: ax.space(2)) {
            Image(systemName: "line.3.horizontal.decrease")
            Text(inventory.moreFiltersLabel).lineLimit(1)
        }
        .font(ax.fontLabel)
        .foregroundStyle(ax.text)
        .padding(.horizontal, ax.space(3))
        .frame(minHeight: max(axMinTarget, 32 * min(ax.scale, 1.4)))
        .background(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).fill(ax.surface))
        .overlay(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).strokeBorder(ax.borderStrong, lineWidth: 1))
        .contentShape(Rectangle())
        MoreFiltersMenu(label: label, filters: inventory.filters, chosen: filterChoice, choose: choose)
    }

    private func choose(_ filter: ShowModel.Inventory.Filter, _ option: String) {
        filterChoice[filter.label] = option
        send(.set(id: "tpl.showcase.filter.\(filter.label)", value: .string(option)))
    }

    private var viewButtons: some View {
        HStack(spacing: ax.space(1)) {
            ForEach(Array(inventory.viewButtons.enumerated()), id: \.offset) { index, button in
                ShowIconButton(symbol: ShowModel.symbol(button.icon), label: button.label, selected: viewIndex == index) {
                    viewIndex = index
                }
            }
        }
    }

    private func warning(_ text: String) -> some View {
        let colors = ax.tone(.warning)
        return HStack(spacing: ax.space(3)) {
            Image(systemName: "exclamationmark.triangle").foregroundStyle(colors.text)
            Text(text).font(ax.fontStrong).foregroundStyle(colors.text)
            Spacer(minLength: 0)
        }
        .padding(ax.space(3))
        .background(RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous).fill(colors.muted))
        .overlay(RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous).strokeBorder(colors.border.opacity(0.6), lineWidth: 1))
        .accessibilityElement(children: .combine)
    }

    // MARK: Rows

    private var tableHeader: some View {
        HStack(spacing: ax.space(3)) {
            Color.clear.frame(width: 28, height: 1)
            Text(inventory.columns.item).frame(maxWidth: .infinity, alignment: .leading)
            Text(inventory.columns.available).frame(width: availableColumn, alignment: .leading)
            Text(inventory.columns.location).frame(width: locationColumn, alignment: .leading)
            Text(inventory.columns.tags).frame(width: tagsColumn, alignment: .trailing)
            Color.clear.frame(width: 32, height: 1)
        }
        .font(ax.font("font-size-sm", 12, weight: "font-weight-medium"))
        .foregroundStyle(ax.textSecondary)
        .padding(.vertical, ax.space(2))
        .accessibilityHidden(true)
    }

    private func tableRow(_ row: ShowModel.Inventory.Row) -> some View {
        HStack(spacing: ax.space(3)) {
            checkbox(row).frame(width: 28)
            HStack(spacing: ax.space(3)) {
                thumbnail(row)
                VStack(alignment: .leading, spacing: 0) {
                    Text(row.name).font(ax.fontStrong).foregroundStyle(ax.text).lineLimit(1)
                    Text(row.meta).font(ax.fontSmall).foregroundStyle(ax.textSecondary).lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Text(ShowCount.text(row.available)).font(ax.fontBase.monospacedDigit()).foregroundStyle(ax.text)
                .frame(width: availableColumn, alignment: .leading)
            Text(row.location).font(ax.fontBase).foregroundStyle(ax.text).lineLimit(1)
                .frame(width: locationColumn, alignment: .leading)
            FlowLayout(spacing: ax.space(1)) { tags(row) }
                .frame(width: tagsColumn, alignment: .trailing)
            rowMenu(row).frame(width: 32)
        }
        .padding(.vertical, ax.space(3))
    }

    private func stackedRow(_ row: ShowModel.Inventory.Row) -> some View {
        HStack(alignment: .top, spacing: ax.space(3)) {
            checkbox(row).padding(.top, ax.space(2))
            thumbnail(row)
            VStack(alignment: .leading, spacing: ax.space(1)) {
                Text(row.name).font(ax.fontStrong).foregroundStyle(ax.text)
                Text(row.meta).font(ax.fontSmall).foregroundStyle(ax.textSecondary)
                HStack(spacing: ax.space(2)) {
                    Text("\(inventory.columns.available) \(ShowCount.text(row.available))")
                    Text("\u{00B7}")
                    Text(row.location)
                }
                .font(ax.fontSmall)
                .foregroundStyle(ax.textSecondary)
                FlowLayout(spacing: ax.space(1)) { tags(row) }
                    .padding(.top, ax.hair)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            rowMenu(row)
        }
        .padding(.vertical, ax.space(3))
    }

    @ViewBuilder
    private func tags(_ row: ShowModel.Inventory.Row) -> some View {
        ForEach(Array(row.tags.enumerated()), id: \.offset) { _, tag in
            ShowBadge(text: tag.label, variant: tag.variant)
        }
    }

    private func checkbox(_ row: ShowModel.Inventory.Row) -> some View {
        let on = selected[row.id] ?? row.selected
        return Button {
            selected[row.id] = !on
            send(.set(id: "tpl.showcase.select.\(row.id)", value: .bool(!on)))
        } label: {
            // A 26 pt box in a 28 pt column, with 44 x 44 pt to tap.
            AXCheckmark(checked: on).padding(ax.space(1)).contentShape(Rectangle()).axTapTarget(keepLayout: true)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(row.selectLabel)
        .axToggleSemantics(isOn: on)
    }

    @ViewBuilder
    private func thumbnail(_ row: ShowModel.Inventory.Row) -> some View {
        let side = 40 * min(ax.scale, 1.4)
        if row.image != nil {
            ShowPhoto(corner: ax.radiusElement, side: side)
        } else {
            Text(row.fallback)
                .font(ax.font("font-size-sm", 12, weight: "font-weight-semibold"))
                .foregroundStyle(ax.textSecondary)
                .frame(width: side, height: side)
                .background(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).fill(ax.muted))
                .accessibilityHidden(true)
        }
    }

    private func rowMenu(_ row: ShowModel.Inventory.Row) -> some View {
        ShowRowMenu(label: inventory.rowMenuLabel, items: inventory.rowMenu)
    }
}

/// The "Filters" menu of a narrow card: one submenu per filter, with the choice checked.
private struct MoreFiltersMenu<Label: View>: View {
    let label: Label
    let filters: [ShowModel.Inventory.Filter]
    let chosen: [String: String]
    let choose: (ShowModel.Inventory.Filter, String) -> Void
    @Environment(\.axStatic) private var isStatic

    var body: some View {
        if isStatic {
            label
        } else {
            Menu {
                ForEach(Array(filters.enumerated()), id: \.offset) { _, filter in
                    Menu(filter.label) {
                        Picker(filter.label, selection: Binding(
                            get: { chosen[filter.label] ?? "" },
                            set: { choose(filter, $0) }
                        )) {
                            ForEach(filter.options, id: \.self) { Text($0).tag($0) }
                        }
                        .pickerStyle(.inline)
                        .labelsHidden()
                    }
                }
            } label: { label }
                .menuStyle(.button)
                .buttonStyle(.plain)
                .menuIndicator(.hidden)
        }
    }
}

/// The three-dots menu of a row: the model's items and divider; they do nothing, as on the web.
private struct ShowRowMenu: View {
    let label: String
    let items: [ShowModel.Inventory.MenuItem]
    @Environment(\.ax) private var ax
    @Environment(\.axStatic) private var isStatic
    @Environment(\.showInert) private var inert

    var body: some View {
        if isStatic {
            glyph
        } else {
            Menu {
                ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                    switch item {
                    case .item(let title): Button(title) {}
                    case .divider: Divider()
                    }
                }
            } label: { glyph }
                .menuStyle(.button)
                .buttonStyle(.plain)
                .menuIndicator(.hidden)
                .fixedSize()
                .disabled(inert.contains("rowMenu"))
                .accessibilityLabel(label)
        }
    }

    private var glyph: some View {
        Image(systemName: "ellipsis")
            .font(.system(size: ax.fontSize("font-size-base", 14), weight: .semibold))
            .foregroundStyle(ax.iconSecondary)
            .frame(width: 32 * min(ax.scale, 1.4), height: 32 * min(ax.scale, 1.4))
            .contentShape(Rectangle())
            .axTapTarget(keepLayout: true)
    }
}

enum ShowCount {
    static func text(_ value: Double) -> String { value == value.rounded() ? String(Int(value)) : String(value) }
}
