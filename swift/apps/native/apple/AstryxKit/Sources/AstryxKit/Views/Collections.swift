import SwiftUI

/// The width below which a table stacks its rows instead of laying out columns.
private let tableWideFrom: CGFloat = 520

/// `table`: columns when wide, stacked rows when narrow. A sortable header sends `press`
/// with its `sortId`; a row's checkbox sends `set` with its `selectId` and the new Bool.
struct AXTable: View {
    let node: TableNode
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send
    @Environment(\.axWidth) private var width

    /// The first column carries the names; it gets room for a name and an address.
    private var firstColumnMin: CGFloat { 220 * min(ax.scale, 1.4) }
    private var selectable: Bool { node.rows.contains { $0.selectId != nil } }

    var body: some View {
        Group {
            if node.rows.isEmpty {
                Text(node.empty)
                    .font(ax.fontBase)
                    .foregroundStyle(ax.textSecondary)
                    .frame(maxWidth: .infinity)
                    .padding(ax.space(6))
            } else if width >= tableWideFrom {
                wide
            } else {
                narrow
            }
        }
        .background(ax.card)
        .clipShape(RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous).strokeBorder(ax.border, lineWidth: 1))
    }

    // MARK: Wide

    private var wide: some View {
        VStack(spacing: 0) {
            HStack(spacing: ax.space(3)) {
                if selectable { Color.clear.frame(width: 18 * min(ax.scale, 1.5), height: 1) }
                ForEach(Array(node.columns.enumerated()), id: \.offset) { index, column in header(column).frame(minWidth: index == 0 ? firstColumnMin : 0, alignment: .leading).frame(maxWidth: .infinity, alignment: column.align == .end ? .trailing : .leading) }
            }
            .padding(.horizontal, ax.space(4))
            .padding(.vertical, ax.space(2))
            .background(ax.muted)
            ForEach(node.rows, id: \.id) { row in
                Rectangle().fill(ax.border).frame(height: 1)
                HStack(spacing: ax.space(3)) {
                    if let selectId = row.selectId {
                        checkbox(row: row, selectId: selectId)
                    } else if selectable {
                        Color.clear.frame(width: 18 * min(ax.scale, 1.5), height: 1)
                    }
                    ForEach(Array(node.columns.enumerated()), id: \.offset) { index, column in
                        let cell = index < row.cells.count ? row.cells[index] : nil
                        HStack(spacing: ax.space(2)) {
                            if let cell { AXCellView(cell: cell) }
                        }
                        .frame(minWidth: index == 0 ? firstColumnMin : 0, alignment: .leading)
                        .frame(maxWidth: .infinity, alignment: (cell?.align ?? column.align) == .end ? .trailing : .leading)
                    }
                }
                .padding(.horizontal, ax.space(4))
                .padding(.vertical, ax.space(3))
                .background(row.selected ? ax.accentMuted.opacity(0.6) : .clear)
            }
        }
    }

    @ViewBuilder
    private func header(_ column: TableNode.Column) -> some View {
        let alignment: Alignment = column.align == .end ? .trailing : .leading
        let label = HStack(spacing: ax.space(1)) {
            if column.align == .end { sortMark(column) }
            Text(column.label)
                .font(ax.font("font-size-sm", 12, weight: "font-weight-semibold"))
                .foregroundStyle(column.sort == nil || column.sort == Optional(TableNode.Column.Sort.none) ? ax.textSecondary : ax.text)
            if column.align != .end { sortMark(column) }
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
            Image(systemName: column.sort == .asc ? "arrow.up" : column.sort == .desc ? "arrow.down" : "arrow.up.arrow.down")
                .font(.system(size: ax.fontSize("font-size-xs", 10), weight: .semibold))
                .foregroundStyle(column.sort == .asc || column.sort == .desc ? ax.accent : ax.textDisabled)
        }
    }

    private func checkbox(row: TableNode.Row, selectId: String) -> some View {
        Button {
            send(.set(id: selectId, value: .bool(!row.selected)))
        } label: {
            // An 18 pt box with a 44 x 44 pt target around it.
            AXCheckmark(checked: row.selected).contentShape(Rectangle()).axTapTarget(keepLayout: true)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(row.cells.first?.text ?? row.id)
        .axToggleSemantics(isOn: row.selected)
    }

    // MARK: Narrow

    private var narrow: some View {
        VStack(spacing: 0) {
            ForEach(Array(node.rows.enumerated()), id: \.element.id) { index, row in
                if index > 0 { Rectangle().fill(ax.border).frame(height: 1) }
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
                .padding(ax.space(3))
                .background(row.selected ? ax.accentMuted.opacity(0.6) : .clear)
            }
        }
    }
}

/// One table cell: text, optionally an avatar, a second line or a badge.
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
                VStack(alignment: cell.align == .end ? .trailing : .leading, spacing: ax.hair) {
                    Text(cell.text)
                        .font(prominent ? ax.fontStrong : ax.fontBase.monospacedDigit())
                        .foregroundStyle(ax.text)
                        .multilineTextAlignment(cell.align == .end ? .trailing : .leading)
                    if let secondary = cell.secondary {
                        Text(secondary).font(ax.fontSmall).foregroundStyle(ax.textSecondary).lineLimit(1)
                    }
                }
            }
        }
    }
}

/// `list`: rows with a leading avatar or icon, two lines, a meta line and a trailing tone text.
/// A row with a `selectId` is a button that sends `press`.
struct AXList: View {
    let node: ListNode
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send

    var body: some View {
        Group {
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
        .background(ax.card)
        .clipShape(RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous).strokeBorder(ax.border, lineWidth: 1))
    }

    private func row(_ item: ListItem) -> some View {
        HStack(alignment: .center, spacing: ax.space(3)) {
            leading(item)
            VStack(alignment: .leading, spacing: ax.hair) {
                Text(item.title)
                    .font(item.emphasized ? ax.fontStrong : ax.fontLabel)
                    .foregroundStyle(ax.text)
                    .lineLimit(2)
                if let subtitle = item.subtitle {
                    Text(subtitle)
                        .font(ax.fontSmall)
                        .foregroundStyle(item.emphasized ? ax.text : ax.textSecondary)
                        .lineLimit(2)
                }
            }
            Spacer(minLength: ax.space(2))
            VStack(alignment: .trailing, spacing: ax.hair) {
                if let meta = item.meta {
                    Text(meta).font(ax.fontSmall.monospacedDigit()).foregroundStyle(ax.textSecondary)
                }
                if let trailing = item.trailing {
                    Text(trailing.text)
                        .font(ax.font("font-size-xs", 10, weight: "font-weight-semibold"))
                        .foregroundStyle(ax.tone(trailing.tone).text)
                }
            }
            if item.emphasized {
                Circle().fill(ax.accent).frame(width: 8, height: 8).accessibilityHidden(true)
            }
        }
        .padding(.horizontal, ax.space(3))
        .padding(.vertical, ax.space(2) + 2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(item.selected ? ax.accentMuted : .clear)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder
    private func leading(_ item: ListItem) -> some View {
        switch item.leading {
        case .avatar(let person):
            AXAvatar(name: item.title, initials: person.initials, hue: person.hue, size: .md)
        case .icon(let icon, let tone):
            let colors = ax.tone(tone)
            let side = 36 * min(ax.scale, 1.5)
            Image(systemName: icon.symbol)
                .font(.system(size: ax.fontSize("font-size-base", 14), weight: .medium))
                .foregroundStyle(colors.text)
                .frame(width: side, height: side)
                .background(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).fill(colors.muted))
        case nil:
            EmptyView()
        }
    }
}

/// `calendar`: a month grid with previous and next, today ringed, the selected day filled
/// and tone dots under days with events. A day with a `selectId` sends `press`.
struct AXCalendar: View {
    let node: CalendarNode
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send

    var body: some View {
        VStack(spacing: ax.space(3)) {
            HStack {
                navButton("chevron.left", id: node.previousId, label: node.previousLabel)
                Spacer()
                Text(node.title).font(ax.heading(3)).foregroundStyle(ax.text)
                    .accessibilityAddTraits(.isHeader)
                Spacer()
                navButton("chevron.right", id: node.nextId, label: node.nextLabel)
            }
            HStack(spacing: 0) {
                ForEach(Array(node.weekdays.enumerated()), id: \.offset) { _, day in
                    Text(day)
                        .font(ax.font("font-size-xs", 10, weight: "font-weight-medium"))
                        .foregroundStyle(ax.textSecondary)
                        .frame(maxWidth: .infinity)
                }
            }
            .accessibilityHidden(true)
            VStack(spacing: ax.space(1)) {
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

    private func navButton(_ symbol: String, id: String, label: String) -> some View {
        Button {
            send(.press(id: id))
        } label: {
            Image(systemName: symbol)
                .font(.system(size: ax.fontSize("font-size-base", 14), weight: .semibold))
                .foregroundStyle(ax.iconSecondary)
                .frame(width: axMinTarget, height: axMinTarget)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }

    @ViewBuilder
    private func dayCell(_ day: CalendarDay) -> some View {
        let content = VStack(spacing: 2) {
            Text(day.label)
                .font(ax.fontBase.monospacedDigit().weight(day.today || day.selected ? .semibold : .regular))
                .foregroundStyle(day.selected ? ax.onAccent : day.inMonth ? ax.text : ax.textDisabled)
                .lineLimit(1)
                .minimumScaleFactor(0.5)
                .frame(width: 32 * min(ax.scale, 1.4), height: 32 * min(ax.scale, 1.4))
                .background(Circle().fill(day.selected ? ax.accent : .clear))
                .overlay(Circle().strokeBorder(day.today && !day.selected ? ax.accent : .clear, lineWidth: 1.5))
            HStack(spacing: 2) {
                ForEach(Array(day.dots.prefix(3).enumerated()), id: \.offset) { _, tone in
                    AXToneDot(tone: tone, diameter: 5)
                }
            }
            .frame(height: 5)
        }
        .frame(maxWidth: .infinity, minHeight: 44)
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
