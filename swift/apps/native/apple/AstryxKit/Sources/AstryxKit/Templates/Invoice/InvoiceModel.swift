import Foundation

/// The invoice template's view model: a mirror of the `View` type of
/// core/src/templates/invoice/model.ts, field for field.
struct InvoiceModel: Decodable, Equatable {
    /// The words of the table's controls and spoken labels.
    var words: Words
    /// The layout numbers the core holds; the web reads the same ones.
    var rules: Rules
    /// The table's columns: key, title and the filter each offers.
    var columns: [Column]
    /// Ids of the controls the core has no action for ("downloadPdf", "dispute"): drawn disabled.
    var inert: [String]
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

    struct Rules: Decodable, Equatable {
        /// The facts grid is `auto-fill` columns at least this wide (Astryx's own, which the web's page inherits).
        var factMinWidth: CGFloat
        /// The search box's width beside the billing switch.
        var searchWidth: CGFloat
        /// The width of the Amount figure box: the column's, and the totals' under it.
        var figureWidth: CGFloat
    }

    struct Words: Decodable, Equatable {
        var downloadPdf: String
        var searchPlaceholder: String
        var searchLabel: String
        var clearSearch: String
        var basisLabel: String
        var sort: String
        var sortNone: String
        var filter: String
        var filterActive: String
        var filterColumn: String
        var removeFilter: String
        var clearFilter: String
        var clearFilters: String
        var clearAllFilters: String
        var done: String
        var dispute: String
        var rowHint: String
        var sortHint: String
        var ascending: String
        var descending: String
        var sortedBy: String
        var sortCleared: String
        var containsPrompt: String
        var quantityPrompt: String
        var detail: DetailWords
        var tableLabel: String
        /// What the column filters' field config is called (the web's power search).
        var linesName: String
        /// The labels of the column filters' fields.
        var fields: FieldWords

        struct FieldWords: Decodable, Equatable {
            var description: String
            var category: String
            var quantity: String
        }

        struct DetailWords: Decodable, Equatable {
            var category: String
            var billing: String
            var calculation: String
            var amount: String
            var share: String
        }
    }

    struct Column: Decodable, Equatable {
        var key: String
        var title: String
        /// The filter the column offers, named after the filter's column key.
        var filter: String?
    }

    func isInert(_ id: String) -> Bool { inert.contains(id) }

    /// The spoken word of a sort direction.
    func spoken(_ direction: Direction) -> String { direction == .ascending ? words.ascending : words.descending }

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
        /// The row's hover card as a whole is named this ("Discovery workshop details").
        var detailsLabel: String
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

/// A column as the table lays it out: the core's key and title, and the room each takes here.
struct InvoiceColumn: Identifiable {
    var key: String
    var title: String
    /// The filter this column offers, named after the filter's column key.
    var filter: String?
    var width: CGFloat?
    var trailing: Bool

    var id: String { key }

    /// The width and alignment of a column by key; the words are the model's.
    private static func layout(_ key: String, figure: CGFloat) -> (width: CGFloat?, trailing: Bool) {
        switch key {
        case "category": (150, false)
        case "quantity": (72, true)
        case "unitPrice": (104, true)
        case "amount": (figure, true)
        default: (nil, false)
        }
    }

    static func all(_ model: InvoiceModel) -> [InvoiceColumn] {
        model.columns.map { column in
            let fit = layout(column.key, figure: model.rules.figureWidth)
            return InvoiceColumn(key: column.key, title: column.title, filter: column.filter, width: fit.width, trailing: fit.trailing)
        }
    }
}
