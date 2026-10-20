import SwiftUI

/// Astryx's CalendarShowcase template, drawn natively from the core's view model
/// (core/src/templates/calendar/model.ts, its `View` type): one month grid with the
/// selected day. Like the stock page it is the Calendar alone, a plain header (previous month,
/// the month, next month), the two-letter weekdays and six weeks; the template pads itself.
///
/// The core works out the month (title, six weeks, flags, spoken labels, the neighboring months);
/// this file lays it out and sends:
/// - tapping a day: `set` `tpl.calendar.pick` "YYYY-MM-DD" (the core also moves the view when the
///   day is in a neighboring month)
/// - the previous / next month buttons and a horizontal swipe: `set` `tpl.calendar.focus` with the
///   view's `previous.target` or `next.target`
struct CalendarTemplate: View {
    let view: JSONValue

    var body: some View {
        if let model = try? view.decode(TCalModel.self), model.weeks.count == 6 {
            TCalMonth(model: model)
        } else {
            AXTemplatePlaceholder(template: "calendar")
        }
    }
}

private struct TCalMonth: View {
    let model: TCalModel
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send
    @Environment(\.axWidth) private var width
    @Environment(\.dynamicTypeSize) private var typeSize

    private var words: TCalModel.Words { model.words }

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
        let weeks = model.weeks
        let cell = cell
        VStack(alignment: .leading, spacing: ax.space(2)) {
            header
            if agenda {
                TCalAgenda(days: weeks.flatMap { $0 }.filter(\.inMonth), words: words, choose: choose)
            } else {
                VStack(spacing: 0) {
                    weekdayRow(cell: cell)
                    ForEach(Array(weeks.enumerated()), id: \.offset) { _, week in
                        HStack(spacing: 0) {
                            ForEach(Array(week.enumerated()), id: \.offset) { _, day in
                                TCalDayCell(day: day, side: cell) {
                                    choose(day)
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
                focus((value.translation.width < 0 ? model.next : model.previous).target)
            }
        )
        .padding(pagePad)
        .frame(maxWidth: .infinity, alignment: .topLeading)
        // VoiceOver hears the new day and the new month; nothing else on the screen changes.
        .onChange(of: model.selectedAnnouncement) { _, new in
            if let new { AccessibilityNotification.Announcement(new).post() }
        }
        .onChange(of: model.title) { _, new in
            AccessibilityNotification.Announcement(new).post()
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
        Text(model.title)
            .font(ax.fontStrong)
            .foregroundStyle(ax.text)
            .multilineTextAlignment(.center)
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityAddTraits(.isHeader)
    }

    private var previous: some View {
        step("chevron.left", label: model.previous.label) { focus(model.previous.target) }
    }

    private var next: some View {
        step("chevron.right", label: model.next.label) { focus(model.next.target) }
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

    private func choose(_ day: TCalModel.Day) {
        send(.set(id: "tpl.calendar.pick", value: .string(day.date)))
    }

    private func focus(_ target: String) {
        send(.set(id: "tpl.calendar.focus", value: .string(target)))
    }
}

private struct TCalDayCell: View {
    let day: TCalModel.Day
    let side: CGFloat
    let action: () -> Void
    @Environment(\.ax) private var ax

    var body: some View {
        Button(action: action) {
            Text("\(day.day)")
                .font(ax.font("font-size-base", 14, weight: day.today && !day.selected ? "font-weight-semibold" : "font-weight-normal").monospacedDigit())
                .foregroundStyle(foreground)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
                .frame(width: side, height: side)
                .background(Circle().fill(day.selected ? ax.accent : Color.clear).padding(ring))
                .overlay(Circle().strokeBorder(day.today && !day.selected ? ax.accent : Color.clear, lineWidth: 1.5).padding(ring))
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(day.label)
        .accessibilityAddTraits(day.selected ? [.isSelected, .isButton] : .isButton)
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
        if day.selected { return ax.onAccent }
        if day.today { return ax.tone(.accent).text }
        return day.inMonth ? ax.text : ax.textSecondary.opacity(0.3)
    }
}

/// The month as a list of days, for text sizes and widths a seven-column grid cannot hold. A day is
/// a row: its name and number, a mark for the selected day and the core's word for today.
private struct TCalAgenda: View {
    let days: [TCalModel.Day]
    let words: TCalModel.Words
    let choose: (TCalModel.Day) -> Void
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

    private func row(_ day: TCalModel.Day) -> some View {
        let isSelected = day.selected
        let isToday = day.today
        return Button { choose(day) } label: {
            HStack(spacing: ax.space(3)) {
                Image(systemName: isSelected ? "checkmark.circle.fill" : (isToday ? "circle" : "circle.dotted"))
                    .font(.system(size: ax.fontSize("font-size-base", 14)))
                    .foregroundStyle(isSelected || isToday ? ax.accent : ax.textDisabled)
                    .accessibilityHidden(true)
                Text(day.agendaLabel)
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
        .accessibilityLabel(day.label)
        .accessibilityAddTraits(isSelected ? [.isSelected, .isButton] : .isButton)
    }
}
