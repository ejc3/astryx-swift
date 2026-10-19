import SwiftUI

/// Astryx's CalendarShowcase template, drawn natively from the core's view model
/// (core/src/templates/calendar/model.ts, its `View` type): one month grid with the
/// selected day. Like the stock page it is the Calendar alone, a plain header (previous month,
/// the month, next month), the two-letter weekdays and six weeks; the template pads itself.
///
/// Actions (the core takes these two `set` ids, with ISO date strings):
/// - tapping a day: `set` `tpl.calendar.select` "YYYY-MM-DD" (a day of a neighboring month
///   also moves the view there, with `set` `tpl.calendar.focus`)
/// - the previous / next month buttons, the arrow keys' equivalent, a horizontal swipe, and
///   `set` `tpl.calendar.focus` with the first of the month shown
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
    @Environment(\.dynamicTypeSize) private var typeSize

    private var today: TCalDate { TCalDate(Date()) }

    /// The page's own padding (the stock calendar sits 24 points in), and the Calendar's own 12 inside it.
    private var pagePad: CGFloat { width < 600 ? ax.space(4) : ax.space(6) }
    private var inset: CGFloat { ax.space(3) }

    /// The room for the grid: the width less both paddings.
    private var room: CGFloat { width - 2 * pagePad - 2 * inset }

    /// The side of a day's cell. On the Mac it is the stock's 32; on a touch screen it is the 44
    /// point target and no more (the grid sits at the left as the web's does, not stretched to fill).
    private var cell: CGFloat {
        #if os(macOS)
        return 32 * min(ax.scale, 1.4)
        #else
        return axMinTarget
        #endif
    }

    /// A grid of seven columns cannot hold the dates at accessibility text sizes, or give each
    /// day a target on a narrow screen: then the month is a list of days, one per row.
    private var agenda: Bool { typeSize.isAccessibilitySize || room / 7 < axMinTarget }

    var body: some View {
        let weeks = TCalendarMath.weeks(of: month)
        let cell = cell
        VStack(alignment: .leading, spacing: ax.space(2)) {
            header
            if agenda {
                TCalAgenda(days: weeks.flatMap { $0 }.filter(\.inMonth).map(\.date), selected: selected, today: today, words: words, choose: choose)
            } else {
                VStack(spacing: 0) {
                    weekdayRow(cell: cell)
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
        .padding(inset)
        .frame(maxWidth: agenda ? .infinity : 7 * cell + 2 * inset, alignment: .leading)
        .gesture(
            DragGesture(minimumDistance: 24).onEnded { value in
                guard abs(value.translation.width) > abs(value.translation.height) * 1.5 else { return }
                move(value.translation.width < 0 ? 1 : -1)
            }
        )
        .padding(pagePad)
        .frame(maxWidth: .infinity, alignment: .topLeading)
        // VoiceOver hears the new day and the new month; nothing else on the screen changes.
        .onChange(of: selected) { _, new in
            if let new { AccessibilityNotification.Announcement("\(words.selected), \(long(new))").post() }
        }
        .onChange(of: month) { _, new in
            AccessibilityNotification.Announcement(formatted(new, "MMMM yyyy")).post()
        }
    }

    // MARK: Header

    /// The stock header: the previous month at the left, the month and year in the middle, the next
    /// month at the right. Where the line cannot hold them (large text) the steps go under the month.
    private var header: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: ax.space(2)) {
                previous
                Spacer(minLength: ax.space(2))
                title
                Spacer(minLength: ax.space(2))
                next
            }
            VStack(spacing: ax.space(1)) {
                title
                HStack {
                    previous
                    Spacer(minLength: ax.space(2))
                    next
                }
            }
        }
    }

    private var title: some View {
        Text(monthTitle)
            .font(ax.fontStrong)
            .foregroundStyle(ax.text)
            .multilineTextAlignment(.center)
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityAddTraits(.isHeader)
    }

    private var previous: some View {
        step("chevron.left", label: "\(words.previousMonth), \(formatted(TCalendarMath.shift(month, months: -1), "MMMM yyyy"))") { move(-1) }
    }

    private var next: some View {
        step("chevron.right", label: "\(words.nextMonth), \(formatted(TCalendarMath.shift(month, months: 1), "MMMM yyyy"))") { move(1) }
    }

    /// A month step: a thin chevron on a 32 point square (44 on a touch screen).
    private func step(_ symbol: String, label: String, action: @escaping () -> Void) -> some View {
        let side = max(axControlHeight(ax), 0)
        return Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: ax.fontSize("font-size-base", 14), weight: .regular))
                .foregroundStyle(ax.iconSecondary)
                .frame(width: side, height: side)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }

    /// The two-letter weekday names the core gives, Sunday first, over the columns.
    private func weekdayRow(cell: CGFloat) -> some View {
        HStack(spacing: 0) {
            ForEach(Array(words.weekdays.prefix(7).enumerated()), id: \.offset) { _, name in
                Text(name)
                    .font(ax.fontSmall)
                    .foregroundStyle(ax.textSecondary)
                    #if os(iOS)
                    // The stock row is 32 high, its names centered (not a whole cell tall).
                    .frame(width: cell, height: 32 * min(ax.scale, 1.4), alignment: .center)
                    #else
                    .padding(.top, ax.hair)
                    .frame(width: cell, height: cell, alignment: .top)
                    #endif
            }
        }
        .padding(.bottom, ax.space(1))
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
                .font(ax.font("font-size-base", 14, weight: today && !selected ? "font-weight-semibold" : "font-weight-normal").monospacedDigit())
                .foregroundStyle(foreground)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
                .frame(width: side, height: side)
                .background(Circle().fill(selected ? ax.accent : Color.clear).padding(ring))
                .overlay(Circle().strokeBorder(today && !selected ? ax.accent : Color.clear, lineWidth: 1.5).padding(ring))
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(spoken)
        .accessibilityAddTraits(selected ? [.isSelected, .isButton] : .isButton)
    }

    /// The painted circle is the stock's 28 points in every cell: 2 points in from the Mac's 32, and
    /// on a touch screen's 44 point cell (the tap target) 8.
    private var ring: CGFloat {
        #if os(iOS)
        max(0, (side - 28 * min(ax.scale, 1.4)) / 2)
        #else
        side > 36 ? 3 : 2
        #endif
    }

    /// A day of a neighboring month is the secondary text at 30 percent, as the stock Calendar paints it
    /// (inactive content is exempt from the contrast minimum).
    private var foreground: Color {
        if selected { return ax.onAccent }
        if today { return ax.tone(.accent).text }
        return inMonth ? ax.text : ax.textSecondary.opacity(0.3)
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
