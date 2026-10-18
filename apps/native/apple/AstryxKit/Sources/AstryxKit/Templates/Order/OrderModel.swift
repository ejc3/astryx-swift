import Foundation

/// The order page's view model: a mirror of `View` in core/src/templates/order/model.ts.
struct OrderModel: Decodable, Sendable {
    /// "details", "invoices", "timeline", "customer" or "analysis".
    let tab: String
    /// Wide windows: the side panel is shown.
    let sidePanel: Bool
    /// Narrow windows: the panel's dialog is open.
    let panelDialog: Bool
    /// The order number as the heading shows it.
    let number: String
    let itemCount: Int
    let customerName: String
    let status: String
    let date: String
    let flag: String
    let products: [Product]
    let summary: [SummaryRow]
    let paidBy: PaidBy
    let activity: [Activity]
    let notes: String
    let customer: [Field]
    let fraud: Fraud

    struct Product: Decodable, Sendable {
        let name: String
        let image: String
        let lines: [String]
        let amount: String
        /// Parts drawn one after another: a price, a sign, a count.
        let unit: [COSPart]
    }

    struct SummaryRow: Decodable, Sendable {
        let label: String
        let note: [COSPart]?
        let amount: String
        let strong: Bool
    }

    struct PaidBy: Decodable, Sendable {
        let label: String
        let note: String
        let amount: String
    }

    struct Activity: Decodable, Sendable {
        let user: String
        let text: String
        let changes: [String]?
        let reactions: Int?
        let time: String
    }

    struct Field: Decodable, Sendable {
        let label: String
        let value: String
    }

    struct Fraud: Decodable, Sendable {
        /// 0 to 100.
        let risk: Double
        let recommendation: String
        let detail: String
    }
}
