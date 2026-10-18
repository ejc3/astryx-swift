import Foundation

/// The kanban template's view model: a mirror of the `View` type of
/// core/src/templates/kanban/model.ts, field for field.
struct KanbanModel: Decodable, Equatable {
    var title: String
    /// The number of cards on the board.
    var total: Int
    var sprint: String
    var sprintOptions: [SprintOption]
    var columns: [Column]

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
