import SwiftUI

/// The inventory card: title and Add item, search and filters, view buttons, the low-stock
/// banner, and the rows (a table on a wide card, stacked rows on a narrow one). The core holds
/// every choice (the ticked rows) and the stock page never changes one, so each control draws
/// the core's value.
struct ShowInventory: View {
    let inventory: ShowModel.Inventory
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send
    @Environment(\.axWidth) private var width
    @Environment(\.dynamicTypeSize) private var typeSize

    /// The table's fixed columns grow with the text, up to the point where a table is no longer
    /// the right form (accessibility sizes), which is when the rows stack.
    private var columnScale: CGFloat { min(max(ax.scale, 1), 1.35) }
    private var selectColumn: CGFloat { 64 * columnScale }
    private var availableColumn: CGFloat { 100 * columnScale }
    private var locationColumn: CGFloat { 100 * columnScale }
    private var actionsColumn: CGFloat { 64 * columnScale }
    private var fixedColumns: CGFloat { selectColumn + availableColumn + locationColumn + actionsColumn }

    var body: some View {
        // The header and the filter row are padded 24 (the web's spacing-6); the table is inset the same.
        let pad = ax.space(6)
        let inner = max(width - 2 * pad, 0)
        let tabular = !typeSize.isAccessibilitySize && inner >= fixedColumns + 300
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: ax.space(3)) {
                Text(inventory.heading)
                    .font(ax.heading(2))
                    .foregroundStyle(ax.text)
                    .axLeading(ax, size: ax.fontSize("text-heading-2-size", 20), ratio: ax.headingLeading(2))
                    .accessibilityAddTraits(.isHeader)
                Spacer(minLength: ax.space(2))
                Button {} label: {
                    HStack(spacing: ax.space(1)) {
                        Image(systemName: "plus")
                        Text(inventory.addLabel).lineLimit(1)
                    }
                }
                .buttonStyle(AXButtonStyle(variant: .primary, ax: ax, small: true))
            }
            .padding(pad)
            Rectangle().fill(ax.border).frame(height: 1)
            filterBar(inner: inner)
                .padding(.horizontal, pad)
                .padding(.vertical, ax.space(4))
            if let banner = inventory.banner {
                warning(banner)
                    .padding(.horizontal, pad)
                    .padding(.bottom, ax.space(4))
            }
            VStack(spacing: 0) {
                if tabular { tableHeader(inner: inner) }
                ForEach(inventory.rows) { row in
                    Rectangle().fill(ax.border).frame(height: 1)
                    if tabular { tableRow(row, inner: inner) } else { stackedRow(row) }
                }
            }
            .padding(.horizontal, pad)
            .padding(.bottom, ax.space(2))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .axSurface(fill: ax.surface, radius: ax.radiusContainer)
        .clipShape(RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous))
        .accessibilityElement(children: .contain)
    }

    // MARK: Search and filters

    private var viewButtonsWidth: CGFloat {
        CGFloat(inventory.viewButtons.count) * 32 * min(ax.scale, 1.4) + ax.space(1)
    }

    /// A filter menu's width, estimated from its words: icon, text, chevron and padding. It only
    /// decides how many menus fit before the rest fold into "Filters".
    private func filterWidth(_ filter: ShowModel.Inventory.Filter) -> CGFloat {
        CGFloat(filter.placeholder.count) * 7.2 * ax.scale + 16 + 8 + 8 + 10 + 2 * ax.space(3)
    }

    private var overflowWidth: CGFloat {
        CGFloat(inventory.moreFiltersLabel.count) * 7.2 * ax.scale + 16 + 8 + 2 * ax.space(3)
    }

    /// The web's OverflowList: as many menus as fit beside the search, the rest behind one
    /// "Filters" button.
    private func shownFilters(inner: CGFloat) -> Int {
        let gap = ax.space(2)
        let room = inner - viewButtonsWidth - ax.space(3) - 240 - gap
        let all = inventory.filters
        for count in stride(from: all.count, through: 0, by: -1) {
            let used = all.prefix(count).reduce(0) { $0 + filterWidth($1) + gap } - (count > 0 ? gap : 0)
            let reserve = count < all.count ? (count > 0 ? gap : 0) + overflowWidth : 0
            if used + reserve <= room { return count }
        }
        return 0
    }

    @ViewBuilder
    private func filterBar(inner: CGFloat) -> some View {
        let shown = shownFilters(inner: inner)
        let hidden = Array(inventory.filters.dropFirst(shown))
        ViewThatFits(in: .horizontal) {
            HStack(spacing: ax.space(3)) {
                HStack(spacing: ax.space(2)) {
                    search.frame(maxWidth: 240)
                    ForEach(Array(inventory.filters.prefix(shown).enumerated()), id: \.offset) { _, filter in
                        filterMenu(filter)
                    }
                    if !hidden.isEmpty { moreFilters(hidden) }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                viewButtons
            }
            // Too narrow for one row: the search above, then the folded filters and the view buttons.
            VStack(alignment: .leading, spacing: ax.space(3)) {
                search
                HStack(spacing: ax.space(3)) {
                    moreFilters(inventory.filters)
                    Spacer(minLength: ax.space(2))
                    viewButtons
                }
            }
        }
    }

    private var search: some View {
        ShowTextField(
            id: "tpl.showcase.search",
            label: inventory.search.label,
            placeholder: inventory.search.placeholder,
            value: inventory.search.value,
            icon: "magnifyingglass",
            showsLabel: false,
            small: true
        )
    }

    private func filterMenu(_ filter: ShowModel.Inventory.Filter) -> some View {
        // The web's selector has no value (`value={undefined}`): it shows its placeholder.
        ShowMenuField(text: filter.placeholder, placeholder: true, icon: ShowModel.symbol(filter.icon), compact: true) {
            Picker(filter.label, selection: Binding(
                get: { "" },
                set: { choose(filter, $0) }
            )) {
                ForEach(filter.options, id: \.self) { Text($0).tag($0) }
            }
            .pickerStyle(.inline)
            .labelsHidden()
        }
        .fixedSize()
        .accessibilityLabel(filter.label)
    }

    /// The "Filters" button: a ghost button with a tag; its menu holds one submenu per filter.
    @ViewBuilder
    private func moreFilters(_ filters: [ShowModel.Inventory.Filter]) -> some View {
        let label = HStack(spacing: ax.space(2)) {
            Image(systemName: "tag")
            Text(inventory.moreFiltersLabel).lineLimit(1)
        }
        .font(ax.fontLabel)
        .foregroundStyle(ax.text)
        .padding(.horizontal, ax.space(3))
        .frame(minHeight: showFieldHeight(ax, small: true))
        .contentShape(Rectangle())
        MoreFiltersMenu(label: label, filters: filters, choose: choose)
    }

    private func choose(_ filter: ShowModel.Inventory.Filter, _ option: String) {
        send(.set(id: "tpl.showcase.filter.\(filter.label)", value: .string(option)))
    }

    /// Ghost icon buttons for the list and grid views; neither is selected, as on the web.
    private var viewButtons: some View {
        HStack(spacing: ax.space(1)) {
            ForEach(Array(inventory.viewButtons.enumerated()), id: \.offset) { _, button in
                ShowIconButton(symbol: ShowModel.symbol(button.icon), label: button.label)
            }
        }
    }

    /// Astryx's warning banner: a filled warning triangle and the title in primary bold, on the
    /// warning's muted ground, with no border.
    private func warning(_ text: String) -> some View {
        HStack(spacing: ax.space(3)) {
            Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(ax.color("color-warning"))
            Text(text).font(ax.font("font-size-base", 14, weight: "font-weight-bold")).foregroundStyle(ax.text)
            Spacer(minLength: 0)
        }
        .padding(ax.space(3))
        .background(RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous).fill(ax.color("color-warning-muted")))
        .accessibilityElement(children: .combine)
    }

    // MARK: Rows

    /// The widths the two flexible columns share: item 3 parts, tags 2, neither under 80.
    private func flexible(_ inner: CGFloat) -> (item: CGFloat, tags: CGFloat) {
        let rest = max(inner - fixedColumns, 160)
        return (max(rest * 3 / 5, 80), max(rest * 2 / 5, 80))
    }

    private func tableHeader(inner: CGFloat) -> some View {
        let flex = flexible(inner)
        let cell = ax.space(2)
        return HStack(spacing: 0) {
            Color.clear.frame(width: selectColumn, height: 1)
            Text(inventory.columns.item).padding(.horizontal, cell).frame(width: flex.item, alignment: .leading)
            Text(inventory.columns.available).padding(.horizontal, cell).frame(width: availableColumn, alignment: .leading)
            Text(inventory.columns.location).padding(.horizontal, cell).frame(width: locationColumn, alignment: .leading)
            Text(inventory.columns.tags).padding(.horizontal, cell).frame(width: flex.tags, alignment: .trailing)
            Color.clear.frame(width: actionsColumn, height: 1)
        }
        .font(ax.font("font-size-base", 14, weight: "font-weight-semibold"))
        .foregroundStyle(ax.textSecondary)
        .padding(.vertical, ax.space(2))
        .accessibilityHidden(true)
    }

    private func tableRow(_ row: ShowModel.Inventory.Row, inner: CGFloat) -> some View {
        let flex = flexible(inner)
        let cell = ax.space(2)
        return HStack(spacing: 0) {
            checkbox(row).padding(.horizontal, cell).frame(width: selectColumn, alignment: .leading)
            HStack(spacing: ax.space(3)) {
                thumbnail(row)
                VStack(alignment: .leading, spacing: 0) {
                    Text(row.name).font(ax.font("font-size-base", 14, weight: "font-weight-bold")).foregroundStyle(ax.text)
                        .axLeading(ax, size: ax.fontSize("font-size-base", 14), ratio: ax.bodyLeading)
                    Text(row.meta).font(ax.fontSmall).foregroundStyle(ax.textSecondary)
                        .axLeading(ax, size: ax.fontSize("font-size-sm", 12), ratio: ax.supportingLeading)
                }
                .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.horizontal, cell)
            .frame(width: flex.item, alignment: .leading)
            Text(ShowCount.text(row.available)).font(ax.fontBase.monospacedDigit()).foregroundStyle(ax.text)
                .padding(.horizontal, cell)
                .frame(width: availableColumn, alignment: .leading)
            Text(row.location).font(ax.fontBase).foregroundStyle(ax.text)
                .padding(.horizontal, cell)
                .frame(width: locationColumn, alignment: .leading)
            FlowLayout(spacing: ax.space(1)) { tags(row) }
                .padding(.horizontal, cell)
                .frame(width: flex.tags, alignment: .trailing)
            rowMenu(row).padding(.horizontal, cell).frame(width: actionsColumn, alignment: .trailing)
        }
        .padding(.vertical, ax.space(3))
    }

    private func stackedRow(_ row: ShowModel.Inventory.Row) -> some View {
        HStack(alignment: .top, spacing: ax.space(3)) {
            checkbox(row).padding(.top, ax.space(2))
            thumbnail(row)
            VStack(alignment: .leading, spacing: ax.space(1)) {
                Text(row.name).font(ax.font("font-size-base", 14, weight: "font-weight-bold")).foregroundStyle(ax.text)
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
        let on = row.selected
        return Button {
            send(.set(id: "tpl.showcase.select.\(row.id)", value: .bool(!on)))
        } label: {
            // A 26 pt box in a 28 pt column, with a larger area to tap.
            ShowCheckbox(checked: on).padding(ax.space(1)).contentShape(Rectangle()).axTapTarget(keepLayout: true)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(row.selectLabel)
        .axToggleSemantics(isOn: on)
    }

    @ViewBuilder
    private func thumbnail(_ row: ShowModel.Inventory.Row) -> some View {
        let side = 40 * min(ax.scale, 1.4)
        if let image = row.image {
            ShowPhoto(corner: ax.radiusElement, side: side, image: image)
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

/// The "Filters" menu: one submenu per folded filter.
private struct MoreFiltersMenu<Label: View>: View {
    let label: Label
    let filters: [ShowModel.Inventory.Filter]
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
                            get: { "" },
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
