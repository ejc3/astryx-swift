import Foundation

/// The kanban template's view model: a mirror of the `View` type of
/// core/src/templates/kanban/model.ts, field for field.
struct KanbanModel: Decodable, Equatable {
    /// The words of the board's controls and spoken labels.
    var words: Words
    /// Ids of the controls the core has no action for ("sort", "addTask"...): drawn disabled.
    var inert: [String]
    var title: String
    /// The number of cards on the board.
    var total: Int
    var sprint: String
    var sprintOptions: [SprintOption]
    var columns: [Column]

    struct Words: Decodable, Equatable {
        var boardActions: String
        var sort: String
        var filter: String
        var search: String
        var addTask: String
        var sprint: String
        var workItemActions: String
        var open: String
        var assignToMe: String
        /// Spoken after a column's title on its colored dot.
        var status: String
        /// Closes a column's tip when it is a sheet.
        var done: String
        /// Announced when a card lands in a column; the column's title follows.
        var movedTo: String
    }

    func isInert(_ id: String) -> Bool { inert.contains(id) }

    struct SprintOption: Decodable, Equatable, Identifiable {
        var value: String
        var label: String
        var id: String { value }
    }

    /// "neutral" | "accent" | "warning" | "success". Anything else draws as neutral.
    enum ColumnVariant: String, Decodable, Equatable {
        case neutral, accent, warning, success
        init(from decoder: Decoder) throws {
            let raw = try decoder.singleValueContainer().decode(String.self)
            self = ColumnVariant(rawValue: raw) ?? .neutral
        }
    }

    /// "error" | "warning" | "teal". Anything else draws as neutral.
    enum PriorityVariant: String, Decodable, Equatable {
        case error, warning, teal, neutral
        init(from decoder: Decoder) throws {
            let raw = try decoder.singleValueContainer().decode(String.self)
            self = PriorityVariant(rawValue: raw) ?? .neutral
        }
    }

    /// "inbox" | "arrow-path" | "clipboard-check" | "check-circle": which icon an empty column shows.
    struct EmptyIcon: Decodable, Equatable {
        var name: String
        init(from decoder: Decoder) throws { name = try decoder.singleValueContainer().decode(String.self) }
    }

    struct MoveTarget: Decodable, Equatable, Identifiable {
        /// The action to press.
        var id: String
        var label: String
    }

    struct Card: Decodable, Equatable, Identifiable {
        var id: String
        var ref: String
        var priorityLabel: String
        var priorityVariant: PriorityVariant
        var title: String
        var description: String
        var edited: String
        var due: String
        /// "Edited 2h ago · Due Jul 8", the two above in one line.
        var meta: String
        /// The card menu's "Move to ..." entries.
        var moveTargets: [MoveTarget]
    }

    struct Column: Decodable, Equatable, Identifiable {
        var id: String
        var title: String
        var variant: ColumnVariant
        var tooltip: String
        var emptyTitle: String
        var emptyDescription: String
        var emptyIcon: EmptyIcon
        var count: Int
        var cards: [Card]
    }
}
