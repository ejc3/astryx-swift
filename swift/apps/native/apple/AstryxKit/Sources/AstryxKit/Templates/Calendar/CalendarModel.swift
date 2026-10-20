import Foundation

/// The calendar template's view model: a Swift mirror of `View` in
/// core/src/templates/calendar/model.ts. The core works out the month: its title, the six weeks of
/// days with their flags and spoken labels, and the previous and next months. Swift draws them and
/// does no date math or date formatting of its own.
struct TCalModel: Decodable {
    /// The words VoiceOver speaks for the grid (view.words in the core). A model from an older
    /// core has none; they are then empty rather than invented here.
    struct Words: Decodable {
        var today = ""
        var selected = ""
        var previousMonth = ""
        var nextMonth = ""
        /// The two-letter weekday names, Sunday first ("Su" to "Sa").
        var weekdays: [String] = []
    }

    /// One cell of the grid.
    struct Day: Decodable, Hashable {
        /// "YYYY-MM-DD": what tapping the day sends as `pick`.
        let date: String
        /// The number drawn in the cell.
        let day: Int
        let inMonth: Bool
        let selected: Bool
        let today: Bool
        /// Spoken: "Wednesday, April 15, 2026", "Today, " first for today.
        let label: String
        /// For the list form of the month: "Wednesday 15".
        let agendaLabel: String
    }

    /// A month to step to.
    struct Step: Decodable {
        /// The first of that month: the `focus` value that shows it.
        var target = ""
        /// Spoken: "Previous month, March 2026".
        var label = ""
    }

    /// The selected day, or nil when none is.
    let value: String?
    /// A day in the visible month.
    let focusDate: String
    let words: Words
    /// The visible month: "April 2026".
    let title: String
    /// Six weeks of seven days, Sunday first.
    let weeks: [[Day]]
    let previous: Step
    let next: Step
    /// What VoiceOver announces when the selection changes.
    let selectedAnnouncement: String?

    private enum Keys: String, CodingKey { case value, focusDate, words, title, weeks, previous, next, selectedAnnouncement }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: Keys.self)
        value = try c.decodeIfPresent(String.self, forKey: .value)
        focusDate = try c.decode(String.self, forKey: .focusDate)
        words = try c.decodeIfPresent(Words.self, forKey: .words) ?? Words()
        title = try c.decodeIfPresent(String.self, forKey: .title) ?? ""
        weeks = try c.decodeIfPresent([[Day]].self, forKey: .weeks) ?? []
        previous = try c.decodeIfPresent(Step.self, forKey: .previous) ?? Step()
        next = try c.decodeIfPresent(Step.self, forKey: .next) ?? Step()
        selectedAnnouncement = try c.decodeIfPresent(String.self, forKey: .selectedAnnouncement)
    }
}
