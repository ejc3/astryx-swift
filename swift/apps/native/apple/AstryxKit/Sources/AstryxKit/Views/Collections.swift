import SwiftUI

/// The width below which a table stacks its rows when the core gives none (`stackBelow`).
private let tableWideFrom: CGFloat = 520

/// The columns of a table row: an optional fixed leading column (the checkbox), then the first
/// column at 32 % of the rest (Astryx's table sets `width: 32%` on it) and the others sharing what
/// is left, so a header and its rows line up. Each child sits vertically centered in the row.
private struct AXColumns: Layout {
    var spacing: CGFloat
    /// The width of the leading fixed column, 0 for none.
    var leading: CGFloat
    /// The first column's share of the width after the leading column.
    var firstShare: CGFloat = 0.32

    private func widths(_ total: CGFloat, count: Int) -> [CGFloat] {
        let hasLeading = leading > 0 && count > 1
        let rest = max(count - (hasLeading ? 1 : 0), 1)
        let room = max(total - (hasLeading ? leading : 0) - spacing * CGFloat(count - 1), 0)
        var result: [CGFloat] = []
        if hasLeading { result.append(leading) }
        if rest == 1 {
            result.append(room)
        } else {
            let first = room * firstShare
            result.append(first)
            result.append(contentsOf: Array(repeating: (room - first) / CGFloat(rest - 1), count: rest - 1))
        }
        return result
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let total = proposal.width ?? 600
        let columns = widths(total, count: subviews.count)
        let height = zip(subviews, columns).map { $0.sizeThatFits(ProposedViewSize(width: $1, height: nil)).height }.max() ?? 0
        return CGSize(width: total, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let columns = widths(bounds.width, count: subviews.count)
        var x = bounds.minX
        for (subview, width) in zip(subviews, columns) {
            subview.place(at: CGPoint(x: x, y: bounds.midY), anchor: .leading, proposal: ProposedViewSize(width: width, height: bounds.height))
            x += width + spacing
        }
    }
}

/// `table`: columns when wide, stacked rows when narrow. A sortable header sends `press`
/// with its `sortId`; a row's checkbox sends `set` with its `selectId` and the new Bool.
/// It draws no box of its own: inside a card it runs to the card's edges, with dividers
/// between the rows and no fill behind the header, as Astryx's Table does.
struct AXTable: View {
    let node: TableNode
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send
    @Environment(\.axWidth) private var width
    @Environment(\.axBleed) private var bleed

    private var selectable: Bool { node.rows.contains { $0.selectId != nil } }
    /// The table's own width (a table in a card reaches the card's edges) is under the width the
    /// core names, below which each row stacks into a record.
    private var stacked: Bool { width + 2 * bleed < CGFloat(node.stackBelow ?? Double(tableWideFrom)) }
    /// The columns that can be sorted, for the stacked form's Sort menu.
    private var sortable: [TableNode.Column] { node.columns.filter { $0.sortId != nil } }
    /// How far cell text is from the table's edge: the card's padding when there is one.
    private var inset: CGFloat { bleed > 0 ? bleed : ax.space(4) }
    /// The leading column that holds a checkbox.
    private var selectWidth: CGFloat { selectable ? 24 : 0 }

    var body: some View {
        Group {
            if node.rows.isEmpty {
                Text(node.empty)
                    .font(ax.fontBase)
                    .foregroundStyle(ax.textSecondary)
                    .frame(maxWidth: .infinity)
                    .padding(ax.space(6))
            } else if stacked {
                narrow
            } else {
                wide
            }
        }
        // A table in a card reaches the card's edges, so its dividers do.
        .padding(.horizontal, -bleed)
        .environment(\.axBleed, 0)
    }

    // MARK: Wide

    private var wide: some View {
        VStack(spacing: 0) {
            AXColumns(spacing: ax.space(3), leading: selectWidth) {
                if selectable { Color.clear.frame(width: selectWidth, height: 1) }
                ForEach(Array(node.columns.enumerated()), id: \.offset) { _, column in
                    header(column)
                }
            }
            .padding(.horizontal, inset)
            .padding(.vertical, ax.space(2))
            ForEach(node.rows, id: \.id) { row in
                Rectangle().fill(ax.border).frame(height: 1)
                AXColumns(spacing: ax.space(3), leading: selectWidth) {
                    if let selectId = row.selectId {
                        checkbox(row: row, selectId: selectId)
                    } else if selectable {
                        Color.clear.frame(width: selectWidth, height: 1)
                    }
                    ForEach(Array(node.columns.enumerated()), id: \.offset) { index, column in
                        let cell = index < row.cells.count ? row.cells[index] : nil
                        HStack(spacing: ax.space(2)) {
                            if let cell { AXCellView(cell: cell) }
                        }
                        .frame(maxWidth: .infinity, alignment: (cell?.align ?? column.align) == .end ? .trailing : .leading)
                    }
                }
                .padding(.horizontal, inset)
                .padding(.vertical, ax.space(2))
                .background(row.selected ? ax.accentSoft : .clear)
            }
        }
    }

    @ViewBuilder
    private func header(_ column: TableNode.Column) -> some View {
        let alignment: Alignment = column.align == .end ? .trailing : .leading
        // The sort mark is always after the label, whichever side the column is aligned to.
        let label = HStack(spacing: ax.space(1)) {
            // One line, truncated at the end where the column is too narrow, as the web's header
            // is; never broken inside a word.
            Text(column.label)
                .font(ax.fontLabel)
                .foregroundStyle(ax.text)
                .lineLimit(1)
            sortMark(column)
        }
        if let sortId = column.sortId {
            Button {
                send(.press(id: sortId))
            } label: {
                label.frame(maxWidth: .infinity, alignment: alignment).contentShape(Rectangle())
                    .axTapTarget(keepLayout: true)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(column.label)
        } else {
            label.frame(maxWidth: .infinity, alignment: alignment)
        }
    }

    @ViewBuilder
    private func sortMark(_ column: TableNode.Column) -> some View {
        if column.sortId != nil {
            let sorted = column.sort == .asc || column.sort == .desc
            Image(systemName: column.sort == .asc ? "arrow.up" : column.sort == .desc ? "arrow.down" : "arrow.up.arrow.down")
                .font(.system(size: ax.fontSize("font-size-base", 14), weight: .regular))
                .foregroundStyle(sorted ? ax.accent : ax.iconSecondary)
        }
    }

    private func checkbox(row: TableNode.Row, selectId: String) -> some View {
        AXCheckControl(checked: row.selected, label: row.cells.first?.text ?? row.id) {
            send(.set(id: selectId, value: .bool(!row.selected)))
        }
    }

    // MARK: Narrow

    /// Stacked: the first cell is the record's heading, every other column a label and value
    /// line. With no header row to sort by, a Sort pull-down lists the sortable columns.
    private var narrow: some View {
        VStack(spacing: 0) {
            if !sortable.isEmpty { sortMenu }
            ForEach(Array(node.rows.enumerated()), id: \.element.id) { index, row in
                if index > 0 || !sortable.isEmpty { Rectangle().fill(ax.border).frame(height: 1) }
                VStack(alignment: .leading, spacing: ax.space(2)) {
                    HStack(alignment: .top, spacing: ax.space(3)) {
                        if let selectId = row.selectId { checkbox(row: row, selectId: selectId) }
                        if let first = row.cells.first {
                            AXCellView(cell: first, prominent: true)
                        }
                        Spacer(minLength: 0)
                    }
                    ForEach(Array(row.cells.enumerated().dropFirst()), id: \.offset) { index, cell in
                        HStack(alignment: .firstTextBaseline, spacing: ax.space(3)) {
                            Text(index < node.columns.count ? node.columns[index].label : "")
                                .font(ax.fontSmall)
                                .foregroundStyle(ax.textSecondary)
                            Spacer(minLength: ax.space(2))
                            AXCellView(cell: cell)
                        }
                    }
                }
                .padding(.horizontal, inset)
                // The first record sits under the card's header, whose own padding is the gap.
                .padding(.top, index == 0 && sortable.isEmpty ? 0 : ax.space(3))
                .padding(.bottom, ax.space(3))
                .background(row.selected ? ax.accentSoft : .clear)
            }
        }
    }

    /// The pull-down that stands for the header buttons: each sortable column, the current one
    /// checked and marked with its direction. Choosing one sends its `sortId`.
    private var sortMenu: some View {
        Menu {
            ForEach(sortable, id: \.id) { column in
                Button {
                    if let sortId = column.sortId { send(.press(id: sortId)) }
                } label: {
                    let sorted = column.sort == .asc || column.sort == .desc
                    if sorted {
                        Label(column.label, systemImage: column.sort == .asc ? "arrow.up" : "arrow.down")
                    } else {
                        Text(column.label)
                    }
                }
            }
        } label: {
            HStack(spacing: ax.space(1)) {
                Text(sortTitle).font(ax.fontLabel).foregroundStyle(ax.text)
                Image(systemName: "arrow.up.arrow.down").font(ax.iconFont).foregroundStyle(ax.iconSecondary)
            }
            .contentShape(Rectangle())
            .axTapTarget(keepLayout: true)
        }
        .menuStyle(.button)
        .buttonStyle(.plain)
        .menuIndicator(.hidden)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, inset)
        .padding(.bottom, ax.space(2))
        .accessibilityLabel(sortTitle)
    }

    /// "Sort", with the column and direction in use: the label is the core's column label.
    private var sortTitle: String {
        guard let active = sortable.first(where: { $0.sort == .asc || $0.sort == .desc }) else { return sortLabel }
        return "\(sortLabel): \(active.label)"
    }
    private var sortLabel: String { node.sortLabel ?? "Sort" }
}

/// One table cell: text, optionally an avatar, a second line or a badge. The text is medium
/// weight when there is an avatar or a second line, regular otherwise; the second line is the
/// 10 pt supporting text.
struct AXCellView: View {
    let cell: Cell
    var prominent = false
    @Environment(\.ax) private var ax

    var body: some View {
        HStack(spacing: ax.space(2)) {
            if let person = cell.avatar {
                AXAvatar(name: cell.text, initials: person.initials, hue: person.hue, size: .sm)
            }
            if let badge = cell.badge {
                AXBadge(text: badge.text, tone: badge.tone)
            } else {
                VStack(alignment: cell.align == .end ? .trailing : .leading, spacing: 0) {
                    Text(cell.text)
                        .font(font)
                        .foregroundStyle(ax.text)
                        .multilineTextAlignment(cell.align == .end ? .trailing : .leading)
                        .axLeading(ax, size: ax.fontSize("font-size-base", 14), ratio: ax.bodyLeading)
                    if let secondary = cell.secondary {
                        Text(secondary).font(ax.fontXSmall).foregroundStyle(ax.textSecondary).lineLimit(1)
                            .axLeading(ax, size: ax.fontSize("font-size-xs", 10), ratio: ax.supportingLeading)
                    }
                }
            }
        }
    }

    private var font: Font {
        // A stacked record's heading is the table's first cell: medium, as the web's.
        if prominent { return ax.fontLabel.monospacedDigit() }
        let base = (cell.secondary != nil || cell.avatar != nil) ? ax.fontLabel : ax.fontBase
        return base.monospacedDigit()
    }
}

/// `list`: rows with a leading avatar or icon, two lines, a meta line and a trailing badge, with
/// dividers between them and no box of its own (Astryx's List with dividers). A row with a
/// `selectId` is a button that sends `press`.
struct AXList: View {
    let node: ListNode
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send

    var body: some View {
        if node.items.isEmpty {
            Text(node.empty)
                .font(ax.fontBase)
                .foregroundStyle(ax.textSecondary)
                .frame(maxWidth: .infinity)
                .padding(ax.space(6))
        } else {
            VStack(spacing: 0) {
                ForEach(Array(node.items.enumerated()), id: \.element.id) { index, item in
                    if index > 0 { Rectangle().fill(ax.border).frame(height: 1) }
                    if let selectId = item.selectId {
                        Button {
                            send(.press(id: selectId))
                        } label: {
                            row(item)
                        }
                        .buttonStyle(.plain)
                        .accessibilityAddTraits(item.selected ? [.isSelected, .isButton] : .isButton)
                    } else {
                        row(item)
                    }
                }
            }
        }
    }

    private func row(_ item: ListItem) -> some View {
        HStack(alignment: .center, spacing: ax.space(2)) {
            leading(item)
            VStack(alignment: .leading, spacing: 0) {
                Text(item.title)
                    .font(item.emphasized ? ax.fontStrong : ax.fontBase)
                    .foregroundStyle(ax.text)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                    .axLeading(ax, size: ax.fontSize("font-size-base", 14), ratio: ax.bodyLeading)
                if let subtitle = item.subtitle {
                    Text(subtitle)
                        .font(ax.fontXSmall)
                        .foregroundStyle(ax.textSecondary)
                        .lineLimit(1)
                        .axLeading(ax, size: ax.fontSize("font-size-xs", 10), ratio: ax.supportingLeading)
                }
            }
            // The text takes all the room the trailing badge leaves; a spacer beside it would
            // halve what it is offered and wrap it early.
            .frame(maxWidth: .infinity, alignment: .leading)
            if item.trailing != nil || item.meta != nil {
                VStack(alignment: .trailing, spacing: ax.hair) {
                    if let trailing = item.trailing {
                        AXBadge(text: trailing.text, tone: trailing.tone)
                    }
                    if let meta = item.meta {
                        Text(meta).font(ax.fontXSmall.monospacedDigit()).foregroundStyle(ax.textSecondary)
                            .axLeading(ax, size: ax.fontSize("font-size-xs", 10), ratio: ax.supportingLeading)
                    }
                }
                .fixedSize()
                .layoutPriority(1)
            }
        }
        .padding(.horizontal, ax.space(2))
        .padding(.vertical, ax.space(2))
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).fill(item.selected ? ax.accentMuted : .clear))
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder
    private func leading(_ item: ListItem) -> some View {
        switch item.leading {
        case .avatar(let person):
            AXAvatar(name: item.title, initials: person.initials, hue: person.hue, size: .md)
        case .icon(let icon, let tone):
            let side = 32 * min(ax.scale, 1.5)
            Image(systemName: icon.symbol)
                .font(.system(size: ax.fontSize("font-size-base", 14), weight: .medium))
                .foregroundStyle(ax.fillTone(tone))
                .frame(width: side, height: side)
                .background(Circle().fill(ax.softTone(tone)))
        case nil:
            EmptyView()
        }
    }
}

/// `calendar`: a month grid with previous and next beside the title, today's number in bold
/// accent, the selected day a filled cell and tone dots under days with events. A day with a
/// `selectId` sends `press`.
struct AXCalendar: View {
    let node: CalendarNode
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send

    var body: some View {
        VStack(spacing: ax.space(3)) {
            HStack(spacing: ax.space(2)) {
                Text(node.title).font(ax.heading(3)).foregroundStyle(ax.text)
                    .accessibilityAddTraits(.isHeader)
                Spacer(minLength: 0)
                AXIconButton(node: IconButtonNode(id: node.previousId, icon: Icon(rawValue: "chevron-left"), label: node.previousLabel, selected: nil))
                AXIconButton(node: IconButtonNode(id: node.nextId, icon: Icon(rawValue: "chevron-right"), label: node.nextLabel, selected: nil))
            }
            VStack(spacing: ax.space(1)) {
                HStack(spacing: ax.space(1)) {
                    ForEach(Array(node.weekdays.enumerated()), id: \.offset) { _, day in
                        Text(day)
                            .font(ax.fontXSmall)
                            .foregroundStyle(ax.textSecondary)
                            .padding(.vertical, ax.space(1))
                            .frame(maxWidth: .infinity)
                    }
                }
                .accessibilityHidden(true)
                ForEach(Array(node.weeks.enumerated()), id: \.offset) { _, week in
                    HStack(spacing: ax.space(1)) {
                        ForEach(Array(week.enumerated()), id: \.offset) { _, day in
                            dayCell(day)
                        }
                    }
                }
            }
        }
        .frame(maxWidth: .infinity)
    }

    @ViewBuilder
    private func dayCell(_ day: CalendarDay) -> some View {
        let ink: Color = day.selected ? ax.onAccent : day.inMonth ? ax.text : ax.textInactive
        let content = VStack(spacing: 2) {
            Text(day.label)
                .font(ax.fontSmall.monospacedDigit().weight(day.today ? .bold : .regular))
                .foregroundStyle(day.today && !day.selected ? ax.tone(.accent).text : ink)
                .lineLimit(1)
                .minimumScaleFactor(0.5)
            HStack(spacing: 3) {
                ForEach(Array(day.dots.prefix(3).enumerated()), id: \.offset) { _, tone in
                    AXToneDot(tone: tone, diameter: 5, color: day.selected ? ax.onAccent : nil)
                }
            }
            .frame(height: 6)
        }
        .frame(maxWidth: .infinity, minHeight: 48 * min(ax.scale, 1.4))
        .background(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).fill(day.selected ? ax.accent : .clear))
        .contentShape(Rectangle())
        if let selectId = day.selectId {
            Button { send(.press(id: selectId)) } label: { content }
                .buttonStyle(.plain)
                .accessibilityAddTraits(day.selected ? [.isSelected, .isButton] : .isButton)
        } else {
            content
        }
    }
}
