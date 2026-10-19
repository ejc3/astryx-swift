import Foundation

/// The showcase template's view model: a Swift mirror of `View` in
/// core/src/templates/showcase/model.ts.

/// A badge's color name; an unknown name draws as blue.
struct ShowVariant: Decodable, Hashable {
    let name: String
    init(from decoder: Decoder) throws {
        name = try decoder.singleValueContainer().decode(String.self)
    }
    /// The theme token family: `color-text-<family>`, `color-background-<family>`, ...
    var family: String {
        ["blue", "cyan", "green", "orange", "pink", "purple", "red", "teal", "yellow"].contains(name) ? name : "blue"
    }
}

struct ShowModel: Decodable {
    struct Nav: Decodable {
        struct Item: Decodable { let label: String; let isSelected: Bool }
        struct Action: Decodable { let label: String; let icon: String }
        let label: String
        let heading: String
        let items: [Item]
        let actions: [Action]
        let signIn: String
    }

    struct Hero: Decodable {
        let lines: [String]
        let body: String
    }

    struct Product: Decodable, Identifiable {
        struct Quantity: Decodable {
            let label: String
            let value: Double
            let min: Double
            let max: Double
        }
        let name: String
        let description: String
        let badge: String
        let badgeVariant: ShowVariant
        /// A data URI of a neutral placeholder photo; the native drawing paints its own.
        let image: String
        let quantity: Quantity
        let addLabel: String
        var id: String { name }
    }

    struct Field: Decodable {
        let label: String
        let placeholder: String
        let value: String
    }

    struct Checkout: Decodable {
        struct Shipping: Decodable {
            struct Option: Decodable, Identifiable {
                let value: String
                let label: String
                let description: String
                let price: String
                var id: String { value }
            }
            let label: String
            let description: String
            let value: String
            let options: [Option]
        }
        struct Payment: Decodable {
            struct Option: Decodable, Identifiable {
                let value: String
                let label: String
                let text: String
                let icon: String
                let isSelected: Bool
                var id: String { value }
            }
            let label: String
            let options: [Option]
        }
        struct Country: Decodable {
            struct Option: Decodable, Identifiable {
                let value: String
                let label: String
                var id: String { value }
            }
            let label: String
            let value: String
            let options: [Option]
        }
        struct SaveInfo: Decodable {
            let label: String
            let description: String
            let value: Bool
        }
        let heading: String
        let email: Field
        let shipping: Shipping
        let payment: Payment
        let card: Field
        let expiry: Field
        let cvc: Field
        let country: Country
        let saveInfo: SaveInfo
        let payLabel: String
    }

    struct Chat: Decodable {
        struct Action: Decodable { let label: String; let icon: String }
        struct Detail: Decodable {
            enum End: Decodable {
                case amount(String)
                case badge(text: String, variant: ShowVariant)
                case link(String)

                private enum Keys: String, CodingKey { case kind, text, variant }
                init(from decoder: Decoder) throws {
                    let c = try decoder.container(keyedBy: Keys.self)
                    let text = try c.decode(String.self, forKey: .text)
                    switch try c.decode(String.self, forKey: .kind) {
                    case "amount": self = .amount(text)
                    case "badge": self = .badge(text: text, variant: try c.decode(ShowVariant.self, forKey: .variant))
                    case "link": self = .link(text)
                    case let other:
                        throw DecodingError.dataCorruptedError(forKey: .kind, in: c, debugDescription: "unknown end \(other)")
                    }
                }
            }
            let label: String
            let description: String
            let end: End
        }
        enum Line: Decodable {
            case system(String)
            case user(String)
            case assistant(paragraphs: [String], details: [Detail]?)

            private enum Keys: String, CodingKey { case kind, text, paragraphs, details }
            init(from decoder: Decoder) throws {
                let c = try decoder.container(keyedBy: Keys.self)
                switch try c.decode(String.self, forKey: .kind) {
                case "system": self = .system(try c.decode(String.self, forKey: .text))
                case "user": self = .user(try c.decode(String.self, forKey: .text))
                case "assistant":
                    self = .assistant(paragraphs: try c.decode([String].self, forKey: .paragraphs), details: try c.decodeIfPresent([Detail].self, forKey: .details))
                case let other:
                    throw DecodingError.dataCorruptedError(forKey: .kind, in: c, debugDescription: "unknown line \(other)")
                }
            }
        }
        struct Composer: Decodable {
            let value: String
            let placeholder: String
            let attachLabel: String
            let voiceLabel: String
        }
        let heading: String
        let actions: [Action]
        let messages: [Line]
        let suggestions: [String]
        let composer: Composer
    }

    struct Revenue: Decodable {
        struct KPI: Decodable { let value: String; let label: String }
        struct Item: Decodable, Identifiable {
            let id: String
            let icon: String
            let label: String
            let detail: String
            let amount: String
            let isMuted: Bool
        }
        let heading: String
        let kpis: [KPI]
        let activityHeading: String
        let seeAll: String
        let items: [Item]
    }

    struct Inventory: Decodable {
        struct Search: Decodable { let label: String; let placeholder: String; let value: String }
        struct Filter: Decodable {
            let label: String
            let placeholder: String
            let icon: String
            let options: [String]
        }
        struct ViewButton: Decodable { let label: String; let icon: String }
        struct Columns: Decodable {
            let select: String
            let item: String
            let available: String
            let location: String
            let tags: String
            let actions: String
        }
        struct Tag: Decodable { let label: String; let variant: ShowVariant }
        struct Row: Decodable, Identifiable {
            let id: String
            let selectLabel: String
            let selected: Bool
            let image: String?
            let fallback: String
            let name: String
            let meta: String
            let available: Double
            let location: String
            let tags: [Tag]
        }
        /// `{ label }` or `{ divider: true }`.
        enum MenuItem: Decodable {
            case item(String)
            case divider

            private enum Keys: String, CodingKey { case label, divider }
            init(from decoder: Decoder) throws {
                let c = try decoder.container(keyedBy: Keys.self)
                if let label = try c.decodeIfPresent(String.self, forKey: .label) { self = .item(label) }
                else if try c.decodeIfPresent(Bool.self, forKey: .divider) == true { self = .divider }
                else { throw DecodingError.dataCorruptedError(forKey: .label, in: c, debugDescription: "neither label nor divider") }
            }
        }
        let heading: String
        let addLabel: String
        let search: Search
        let filters: [Filter]
        let moreFiltersLabel: String
        let viewButtons: [ViewButton]
        /// The low-stock warning, or nil when nothing is low.
        let banner: String?
        let columns: Columns
        let rows: [Row]
        let rowMenuLabel: String
        let rowMenu: [MenuItem]
    }

    let nav: Nav
    let hero: Hero
    let products: [Product]
    let checkout: Checkout
    let chat: Chat
    let revenue: Revenue
    let inventory: Inventory
}
