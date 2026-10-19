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
            TCalMonth(selected: model.value.flatMap(TCalDate.init(iso:)), month: focus.firstOfMonth, words: model.words)
        } else {
            AXTemplatePlaceholder(template: "calendar")
        }
    }
}

private struct TCalMonth: View {
    let selected: TCalDate?
    let month: TCalDate
    let words: TCalModel.Words
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send
    @Environment(\.axWidth) private var width
    @Environment(\.axStatic) private var isStatic
    @Environment(\.dynamicTypeSize) private var typeSize

    private var today: TCalDate { TCalDate(Date()) }

    /// What a day cell would measure from the room there is, before it is held to a range.
    private var naturalCell: CGFloat { (min(width, 560) - 2 * ax.space(4)) / 7 }

    /// A grid of seven columns cannot hold the dates at accessibility text sizes, or give each
    /// day a 44 pt target on a narrow screen: then the month is a list of days, one per row.
    private var agenda: Bool { typeSize.isAccessibilitySize || naturalCell < axMinTarget }

    var body: some View {
        let weeks = TCalendarMath.weeks(of: month)
        let cell = min(max(naturalCell, axMinTarget), 64)
        VStack(alignment: .leading, spacing: ax.space(4)) {
            VStack(alignment: .leading, spacing: ax.space(3)) {
                header
                if agenda {
                    TCalAgenda(days: weeks.flatMap { $0 }.filter(\.inMonth).map(\.date), selected: selected, today: today, words: words, choose: choose)
                } else {
                    weekdayRow(cell: cell)
                    VStack(spacing: ax.space(1)) {
                        ForEach(Array(weeks.enumerated()), id: \.offset) { _, week in
                            HStack(spacing: 0) {
                                ForEach(Array(week.enumerated()), id: \.offset) { _, day in
                                    TCalDayCell(date: day.date, inMonth: day.inMonth, selected: day.date == selected, today: day.date == today, side: cell, words: words) {
                                        choose(day.date)
                                    }
                                }
                            }
                        }
                    }
                    .accessibilityElement(children: .contain)
                }
            }
            .padding(ax.space(4))
            .frame(maxWidth: agenda ? .infinity : 7 * cell + 2 * ax.space(4), alignment: .leading)
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
        // VoiceOver hears the new day and the new month; nothing else on the screen changes.
        .onChange(of: selected) { _, new in
            if let new { AccessibilityNotification.Announcement("\(words.selected), \(long(new))").post() }
        }
        .onChange(of: month) { _, new in
            AccessibilityNotification.Announcement(formatted(new, "MMMM yyyy")).post()
        }
    }

    // MARK: Header

    /// The month and the two steps on one line; where the line cannot hold them (large text) the
    /// steps go under the month.
    private var header: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: ax.space(2)) {
                monthMenu(wraps: false)
                Spacer(minLength: ax.space(2))
                steps
            }
            VStack(alignment: .leading, spacing: ax.space(1)) {
                monthMenu(wraps: true)
                steps
            }
        }
    }

    private var steps: some View {
        HStack(spacing: ax.space(1)) {
            step("chevron.left", label: "\(words.previousMonth), \(formatted(TCalendarMath.shift(month, months: -1), "MMMM yyyy"))") { move(-1) }
            step("chevron.right", label: "\(words.nextMonth), \(formatted(TCalendarMath.shift(month, months: 1), "MMMM yyyy"))") { move(1) }
        }
    }

    /// The month and year as a heading; on a tap, the months around it to jump to.
    @ViewBuilder
    private func monthMenu(wraps: Bool) -> some View {
        let title = Text(monthTitle)
            .font(ax.heading(3))
            .foregroundStyle(ax.text)
            .multilineTextAlignment(.leading)
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
                    if wraps { title.fixedSize(horizontal: false, vertical: true) } else { title }
                    Image(systemName: "chevron.down")
                        .font(.system(size: ax.fontSize("font-size-xs", 10), weight: .semibold))
                        .foregroundStyle(ax.textSecondary)
                }
                .frame(minHeight: axMinTarget)
                .contentShape(Rectangle())
            }
            .menuStyle(.button)
            .buttonStyle(.plain)
            // One line at the sizes where the line fits; the stacked form lets the title wrap.
            .fixedSize(horizontal: !wraps, vertical: true)
            .accessibilityAddTraits(.isHeader)
        }
    }

    private func step(_ symbol: String, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: ax.fontSize("font-size-base", 14), weight: .semibold))
                .foregroundStyle(ax.iconSecondary)
                .frame(width: max(axMinTarget, 36 * min(ax.scale, 1.4)), height: max(axMinTarget, 36 * min(ax.scale, 1.4)))
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

    nonisolated(unsafe) private static let agendaFormatter: DateFormatter = {
        let f = DateFormatter()
        f.calendar = TCalDate.calendar
        f.timeZone = TCalDate.calendar.timeZone
        f.locale = .autoupdatingCurrent
        f.setLocalizedDateFormatFromTemplate("EEEEd")
        return f
    }()

    static func full(_ date: TCalDate) -> String { fullFormatter.string(from: date.date) }

    /// "Wednesday 15": the day's name and number, for the agenda's rows.
    static func agenda(_ date: TCalDate) -> String { agendaFormatter.string(from: date.date) }
}

private struct TCalDayCell: View {
    let date: TCalDate
    let inMonth: Bool
    let selected: Bool
    let today: Bool
    let side: CGFloat
    let words: TCalModel.Words
    let action: () -> Void
    @Environment(\.ax) private var ax

    var body: some View {
        Button(action: action) {
            Text("\(date.day)")
                .font(ax.font("font-size-base", 14, weight: selected || today ? "font-weight-semibold" : "font-weight-normal").monospacedDigit())
                .foregroundStyle(foreground)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
                .frame(width: side, height: side)
                .background(Circle().fill(selected ? ax.accent : Color.clear).padding(3))
                .overlay(Circle().strokeBorder(today && !selected ? ax.accent : Color.clear, lineWidth: 1.5).padding(3))
                // A cell is never under 44 pt either way.
                .frame(height: max(side, axMinTarget))
                .contentShape(Rectangle())
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

    /// "Today, Wednesday, April 15, 2026".
    private var spoken: String { today ? "\(words.today), \(TCalFormats.full(date))" : TCalFormats.full(date) }
}

/// The month as a list of days, for text sizes and widths a seven-column grid cannot hold. A day is
/// a row: its name and number, a mark for the selected day and the core's word for today.
private struct TCalAgenda: View {
    let days: [TCalDate]
    let selected: TCalDate?
    let today: TCalDate
    let words: TCalModel.Words
    let choose: (TCalDate) -> Void
    @Environment(\.ax) private var ax

    var body: some View {
        VStack(spacing: 0) {
            ForEach(Array(days.enumerated()), id: \.offset) { index, day in
                if index > 0 { Rectangle().fill(ax.border).frame(height: 1) }
                row(day)
            }
        }
        .accessibilityElement(children: .contain)
    }

    private func row(_ day: TCalDate) -> some View {
        let isSelected = day == selected
        let isToday = day == today
        return Button { choose(day) } label: {
            HStack(spacing: ax.space(3)) {
                Image(systemName: isSelected ? "checkmark.circle.fill" : (isToday ? "circle" : "circle.dotted"))
                    .font(.system(size: ax.fontSize("font-size-base", 14)))
                    .foregroundStyle(isSelected || isToday ? ax.accent : ax.textDisabled)
                    .accessibilityHidden(true)
                Text(TCalFormats.agenda(day))
                    .font(ax.font("font-size-base", 14, weight: isSelected || isToday ? "font-weight-semibold" : "font-weight-normal").monospacedDigit())
                    .foregroundStyle(isSelected ? ax.tone(.accent).text : ax.text)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: ax.space(2))
                if isToday {
                    Text(words.today)
                        .font(ax.font("font-size-sm", 12, weight: "font-weight-medium"))
                        .foregroundStyle(ax.tone(.accent).text)
                }
            }
            .padding(.vertical, ax.space(2))
            .frame(minHeight: axMinTarget)
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(isToday ? "\(words.today), \(TCalFormats.full(day))" : TCalFormats.full(day))
        .accessibilityAddTraits(isSelected ? [.isSelected, .isButton] : .isButton)
    }
}
