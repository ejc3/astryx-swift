import SwiftUI

/// Astryx's CalendarShowcase template, drawn natively from the core's view model
/// (core/src/templates/calendar/model.ts, its `View` type): one month grid with the
/// selected day.
///
/// Actions (the core takes these two `set` ids, with ISO date strings):
/// - tapping a day: `set` `tpl.calendar.select` "YYYY-MM-DD" (a day of a neighboring month
///   also moves the view there, with `set` `tpl.calendar.focus`)
/// - the previous / next month buttons, the arrow keys' equivalent, a horizontal swipe, and
///   the month menu: `set` `tpl.calendar.focus` with the first of the month shown
struct CalendarTemplate: View {
    let view: JSONValue

    var body: some View {
        if let model = try? view.decode(TCalModel.self), let focus = TCalDate(iso: model.focusDate) {
            TCalMonth(selected: model.value.flatMap(TCalDate.init(iso:)), month: focus.firstOfMonth)
        } else {
            AXTemplatePlaceholder(template: "calendar")
        }
    }
}

private struct TCalMonth: View {
    let selected: TCalDate?
    let month: TCalDate
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send
    @Environment(\.axWidth) private var width
    @Environment(\.axStatic) private var isStatic

    private var today: TCalDate { TCalDate(Date()) }

    var body: some View {
        let weeks = TCalendarMath.weeks(of: month)
        let cell = min(max((min(width, 560) - 2 * ax.space(4)) / 7, 36), 64)
        VStack(alignment: .leading, spacing: ax.space(4)) {
            VStack(alignment: .leading, spacing: ax.space(3)) {
                header
                weekdayRow(cell: cell)
                VStack(spacing: ax.space(1)) {
                    ForEach(Array(weeks.enumerated()), id: \.offset) { _, week in
                        HStack(spacing: 0) {
                            ForEach(Array(week.enumerated()), id: \.offset) { _, day in
                                TCalDayCell(date: day.date, inMonth: day.inMonth, selected: day.date == selected, today: day.date == today, side: cell) {
                                    choose(day.date)
                                }
                            }
                        }
                    }
                }
                .accessibilityElement(children: .contain)
                .accessibilityLabel(monthTitle)
            }
            .padding(ax.space(4))
            .frame(maxWidth: 7 * cell + 2 * ax.space(4))
            .axSurface(fill: ax.card, radius: ax.radiusContainer)
            .gesture(
                DragGesture(minimumDistance: 24).onEnded { value in
                    guard abs(value.translation.width) > abs(value.translation.height) * 1.5 else { return }
                    move(value.translation.width < 0 ? 1 : -1)
                }
            )
            if let selected {
                HStack(spacing: ax.space(2)) {
                    Image(systemName: "calendar").foregroundStyle(ax.iconSecondary)
                    Text(long(selected)).font(ax.fontBase).foregroundStyle(ax.text)
                }
                .accessibilityElement(children: .combine)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: Header

    private var header: some View {
        HStack(spacing: ax.space(2)) {
            monthMenu
            Spacer(minLength: ax.space(2))
            step("chevron.left", label: formatted(TCalendarMath.shift(month, months: -1), "MMMM yyyy")) { move(-1) }
            step("chevron.right", label: formatted(TCalendarMath.shift(month, months: 1), "MMMM yyyy")) { move(1) }
        }
    }

    /// The month and year as a heading; on a tap, the months around it to jump to.
    @ViewBuilder
    private var monthMenu: some View {
        let title = Text(monthTitle)
            .font(ax.heading(3))
            .foregroundStyle(ax.text)
        if isStatic {
            title
        } else {
            Menu {
                ForEach(-6...6, id: \.self) { offset in
                    let target = TCalendarMath.shift(month, months: offset)
                    Button(formatted(target, "MMMM yyyy")) { focus(target) }
                }
            } label: {
                HStack(spacing: ax.space(1)) {
                    title
                    Image(systemName: "chevron.down")
                        .font(.system(size: ax.fontSize("font-size-xs", 10), weight: .semibold))
                        .foregroundStyle(ax.textSecondary)
                }
                .contentShape(Rectangle())
            }
            .menuStyle(.button)
            .buttonStyle(.plain)
            .fixedSize()
            .accessibilityAddTraits(.isHeader)
        }
    }

    private func step(_ symbol: String, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: ax.fontSize("font-size-base", 14), weight: .semibold))
                .foregroundStyle(ax.iconSecondary)
                .frame(width: 36 * min(ax.scale, 1.4), height: 36 * min(ax.scale, 1.4))
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }

    private func weekdayRow(cell: CGFloat) -> some View {
        HStack(spacing: 0) {
            ForEach(Array(weekdaySymbols.enumerated()), id: \.offset) { _, symbol in
                Text(symbol)
                    .font(ax.font("font-size-sm", 12, weight: "font-weight-medium"))
                    .foregroundStyle(ax.textSecondary)
                    .frame(width: cell)
            }
        }
        .accessibilityHidden(true)
    }

    // MARK: Actions

    private func choose(_ date: TCalDate) {
        send(.set(id: "tpl.calendar.select", value: .string(date.iso)))
        if date.firstOfMonth != month { focus(date.firstOfMonth) }
    }

    private func move(_ months: Int) { focus(TCalendarMath.shift(month, months: months)) }

    private func focus(_ date: TCalDate) {
        send(.set(id: "tpl.calendar.focus", value: .string(date.firstOfMonth.iso)))
    }

    // MARK: Words

    private var monthTitle: String { formatted(month, "MMMM yyyy") }

    private var weekdaySymbols: [String] {
        let f = DateFormatter()
        f.calendar = TCalDate.calendar
        f.timeZone = TCalDate.calendar.timeZone
        f.locale = .autoupdatingCurrent
        // Sunday first, the two-letter names the web's grid shows.
        return (f.veryShortStandaloneWeekdaySymbols ?? ["S", "M", "T", "W", "T", "F", "S"])
    }

    private func formatted(_ date: TCalDate, _ template: String) -> String {
        let f = DateFormatter()
        f.calendar = TCalDate.calendar
        f.timeZone = TCalDate.calendar.timeZone
        f.locale = .autoupdatingCurrent
        f.setLocalizedDateFormatFromTemplate(template)
        return f.string(from: date.date)
    }

    private func long(_ date: TCalDate) -> String { TCalFormats.full(date) }
}

/// Date words for the grid, formatted in the Gregorian calendar of `TCalDate` and the
/// device's language. Formatters are made once: a month draws 42 of them.
enum TCalFormats {
    nonisolated(unsafe) private static let fullFormatter: DateFormatter = {
        let f = DateFormatter()
        f.calendar = TCalDate.calendar
        f.timeZone = TCalDate.calendar.timeZone
        f.locale = .autoupdatingCurrent
        f.dateStyle = .full
        return f
    }()

    static func full(_ date: TCalDate) -> String { fullFormatter.string(from: date.date) }
}

private struct TCalDayCell: View {
    let date: TCalDate
    let inMonth: Bool
    let selected: Bool
    let today: Bool
    let side: CGFloat
    let action: () -> Void
    @Environment(\.ax) private var ax

    var body: some View {
        Button(action: action) {
            Text("\(date.day)")
                .font(ax.font("font-size-base", 14, weight: selected || today ? "font-weight-semibold" : "font-weight-normal").monospacedDigit())
                .foregroundStyle(foreground)
                .frame(width: side, height: side)
                .background(Circle().fill(selected ? ax.accent : Color.clear).padding(3))
                .overlay(Circle().strokeBorder(today && !selected ? ax.accent : Color.clear, lineWidth: 1.5).padding(3))
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(spoken)
        .accessibilityAddTraits(selected ? [.isSelected, .isButton] : .isButton)
    }

    private var foreground: Color {
        if selected { return ax.onAccent }
        if today { return ax.tone(.accent).text }
        return inMonth ? ax.text : ax.textDisabled
    }

    private var spoken: String { TCalFormats.full(date) }
}
