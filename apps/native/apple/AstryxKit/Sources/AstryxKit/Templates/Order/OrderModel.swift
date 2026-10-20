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
    /// The tabs in order; those with `more` sit behind the More menu.
    let tabs: [Tab]
    /// "5 ordered items".
    let itemsLabel: String
    /// Controls that do nothing in the stock template, drawn disabled: "allOrders", "restock",
    /// "edit", "seeAll", "fulfill", "label", "refund", "invoice", "filters", "like", "reply".
    /// If Refund is ever wired it moves money out and cannot be undone: it needs a destructive
    /// confirmation (a `.confirmationDialog` with a destructive Refund and a Cancel) first.
    let inert: [String]
    /// The words both drawings write.
    let words: Words
    /// The layout numbers both drawings keep from Astryx's stock template.
    let rules: Rules

    func isInert(_ control: String) -> Bool { inert.contains(control) }

    struct Rules: Decodable, Sendable {
        /// The web page's viewport threshold; this drawing measures its pane and uses `paneNarrowBelow`.
        let viewportNarrowAtMost: CGFloat
        /// Narrow below this pane width, in points: the page and the panel cannot sit side by side.
        let paneNarrowBelow: CGFloat
        let contentWidth: CGFloat
        let panelWidth: CGFloat
    }

    struct Tab: Decodable, Sendable {
        let value: String
        let label: String
        let more: Bool
    }

    struct Words: Decodable, Sendable {
        let common: COSWords
        let allOrders: String, restock: String, edit: String, seeAll: String, date: String
        let showPanel: String, hidePanel: String, more: String, panelTitle: String
        let items: String, fulfillItem: String, createLabel: String, invoice: String, paid: String
        let refund: String, sendInvoice: String, timeline: String, filters: String
        let like: String, reply: String, reactions: String
        let notes: String, showMore: String, customer: String, fraudAnalysis: String, riskLevel: String

        private enum CodingKeys: String, CodingKey {
            case allOrders, restock, edit, seeAll, date, showPanel, hidePanel, more, panelTitle
            case items, fulfillItem, createLabel, invoice, paid, refund, sendInvoice, timeline, filters
            case like, reply, reactions, notes, showMore, customer, fraudAnalysis, riskLevel
        }

        init(from decoder: Decoder) throws {
            common = try COSWords(from: decoder)
            let c = try decoder.container(keyedBy: CodingKeys.self)
            allOrders = try c.decode(String.self, forKey: .allOrders)
            restock = try c.decode(String.self, forKey: .restock)
            edit = try c.decode(String.self, forKey: .edit)
            seeAll = try c.decode(String.self, forKey: .seeAll)
            date = try c.decode(String.self, forKey: .date)
            showPanel = try c.decode(String.self, forKey: .showPanel)
            hidePanel = try c.decode(String.self, forKey: .hidePanel)
            more = try c.decode(String.self, forKey: .more)
            panelTitle = try c.decode(String.self, forKey: .panelTitle)
            items = try c.decode(String.self, forKey: .items)
            fulfillItem = try c.decode(String.self, forKey: .fulfillItem)
            createLabel = try c.decode(String.self, forKey: .createLabel)
            invoice = try c.decode(String.self, forKey: .invoice)
            paid = try c.decode(String.self, forKey: .paid)
            refund = try c.decode(String.self, forKey: .refund)
            sendInvoice = try c.decode(String.self, forKey: .sendInvoice)
            timeline = try c.decode(String.self, forKey: .timeline)
            filters = try c.decode(String.self, forKey: .filters)
            like = try c.decode(String.self, forKey: .like)
            reply = try c.decode(String.self, forKey: .reply)
            reactions = try c.decode(String.self, forKey: .reactions)
            notes = try c.decode(String.self, forKey: .notes)
            showMore = try c.decode(String.self, forKey: .showMore)
            customer = try c.decode(String.self, forKey: .customer)
            fraudAnalysis = try c.decode(String.self, forKey: .fraudAnalysis)
            riskLevel = try c.decode(String.self, forKey: .riskLevel)
        }
    }

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
        /// "3 reactions" (or "Reactions" with no count), for VoiceOver.
        let reactionsLabel: String
        let time: String
    }

    struct Field: Decodable, Sendable {
        let label: String
        let value: String
    }

    struct Fraud: Decodable, Sendable {
        /// 0 to 100.
        let risk: Double
        /// "15 percent", for VoiceOver.
        let riskValue: String
        let recommendation: String
        let detail: String
    }
}
