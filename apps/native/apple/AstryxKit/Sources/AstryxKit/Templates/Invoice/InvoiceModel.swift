import Foundation

/// The invoice template's view model: a mirror of the `View` type of
/// core/src/templates/invoice/model.ts, field for field.
struct InvoiceModel: Decodable, Equatable {
    var title: String
    var details: [Detail]
    var basisFilters: [Choice]
    var basis: String
    var query: String
    /// The column filters' values, by column ("description", "category", "quantity").
    var filters: [String: FilterValue]
    var categories: [Choice]
    var sort: [Sort]
    /// The rows to show, filtered and sorted.
    var rows: [Row]
    /// Shown instead of the table when no row survives.
    var empty: Notice?
    var totals: [Total]
    /// Shown under the table when the figures describe a subset.
    var banner: Notice?

    struct Detail: Decodable, Equatable {
        var label: String
        var value: String
    }

    struct Choice: Decodable, Equatable, Identifiable {
        var value: String
        var label: String
        var id: String { value }
    }

    /// A column filter's value: text, a category key, or a number.
    enum FilterValue: Decodable, Equatable {
        case text(String)
        case number(Double)

        init(from decoder: Decoder) throws {
            let c = try decoder.singleValueContainer()
            if let number = try? c.decode(Double.self) { self = .number(number) }
            else { self = .text(try c.decode(String.self)) }
        }

        var text: String {
            switch self {
            case .text(let s): s
            case .number(let n): n == n.rounded() ? String(Int(n)) : String(n)
            }
        }
    }

    enum Direction: String, Decodable, Equatable {
        case ascending, descending
    }

    struct Sort: Decodable, Equatable {
        var sortKey: String
        var direction: Direction
    }

    struct Card: Decodable, Equatable {
        var category: String
        var billing: String
        var calculation: String
        var amount: String
        var share: String
    }

    struct Row: Decodable, Equatable, Identifiable {
        var id: String
        var description: String
        var category: String
        var quantity: String
        var rate: String
        var amount: String
        /// What the row's hover card says.
        var card: Card
    }

    struct Notice: Decodable, Equatable {
        var title: String
        var description: String
    }

    /// "muted" | "strong" | nil
    enum Emphasis: String, Decodable, Equatable {
        case muted, strong
        init(from decoder: Decoder) throws {
            let raw = try decoder.singleValueContainer().decode(String.self)
            self = Emphasis(rawValue: raw) ?? .muted
        }
    }

    struct Total: Decodable, Equatable {
        var label: String
        var value: String
        var emphasis: Emphasis?
    }
}
