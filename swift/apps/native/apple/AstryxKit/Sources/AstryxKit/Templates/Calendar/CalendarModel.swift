import Foundation

/// The calendar template's view model: a Swift mirror of `View` in
/// core/src/templates/calendar/model.ts. Dates are plain ISO "YYYY-MM-DD" strings.
struct TCalModel: Decodable {
    /// The words VoiceOver speaks for the grid (view.words in the core). A model from an older
    /// core has none; they are then empty rather than invented here.
    struct Words: Decodable {
        var today = ""
        var selected = ""
        var previousMonth = ""
        var nextMonth = ""
    }

    /// The selected day, or nil when none is.
    let value: String?
    /// A day in the visible month.
    let focusDate: String
    let words: Words

    private enum Keys: String, CodingKey { case value, focusDate, words }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: Keys.self)
        value = try c.decodeIfPresent(String.self, forKey: .value)
        focusDate = try c.decode(String.self, forKey: .focusDate)
        words = try c.decodeIfPresent(Words.self, forKey: .words) ?? Words()
    }
}

/// A calendar date with no time zone: year, month and day, read from and written as ISO.
struct TCalDate: Hashable, Comparable {
    let year: Int
    let month: Int
    let day: Int

    init(year: Int, month: Int, day: Int) {
        self.year = year; self.month = month; self.day = day
    }

    init?(iso: String) {
        let parts = iso.split(separator: "-")
        guard parts.count == 3, let y = Int(parts[0]), let m = Int(parts[1]), let d = Int(parts[2]),
              (1...12).contains(m), (1...31).contains(d) else { return nil }
        self.init(year: y, month: m, day: d)
    }

    var iso: String {
        String(format: "%04d-%02d-%02d", year, month, day)
    }

    static func < (a: TCalDate, b: TCalDate) -> Bool { (a.year, a.month, a.day) < (b.year, b.month, b.day) }

    /// Gregorian, Sunday first (Astryx's Calendar default), independent of the device zone.
    static let calendar: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "UTC")!
        c.firstWeekday = 1
        return c
    }()

    var date: Date {
        TCalDate.calendar.date(from: DateComponents(year: year, month: month, day: day, hour: 12))!
    }

    init(_ date: Date) {
        let c = TCalDate.calendar.dateComponents([.year, .month, .day], from: date)
        self.init(year: c.year!, month: c.month!, day: c.day!)
    }

    /// The first day of this date's month.
    var firstOfMonth: TCalDate { TCalDate(year: year, month: month, day: 1) }

    func addingMonths(_ n: Int) -> TCalDate {
        TCalendarMath.shift(self, months: n)
    }
}

enum TCalendarMath {
    static func shift(_ d: TCalDate, months: Int) -> TCalDate {
        let c = TCalDate.calendar
        let first = c.date(from: DateComponents(year: d.year, month: d.month, day: 1, hour: 12))!
        let moved = c.date(byAdding: .month, value: months, to: first)!
        return TCalDate(moved)
    }

    /// The weeks of a month: seven days per row, from the Sunday on or before the 1st to the
    /// Saturday on or after the last day. Days outside the month are flagged.
    static func weeks(of month: TCalDate) -> [[(date: TCalDate, inMonth: Bool)]] {
        let c = TCalDate.calendar
        let first = c.date(from: DateComponents(year: month.year, month: month.month, day: 1, hour: 12))!
        let days = c.range(of: .day, in: .month, for: first)!.count
        let lead = (c.component(.weekday, from: first) - c.firstWeekday + 7) % 7
        let total = Int((Double(lead + days) / 7).rounded(.up)) * 7
        var out: [[(TCalDate, Bool)]] = []
        var row: [(TCalDate, Bool)] = []
        for i in 0..<total {
            let day = c.date(byAdding: .day, value: i - lead, to: first)!
            let d = TCalDate(day)
            row.append((d, d.month == month.month && d.year == month.year))
            if row.count == 7 { out.append(row); row = [] }
        }
        return out.map { $0.map { (date: $0.0, inMonth: $0.1) } }
    }
}
