import Foundation

/// The checkout wizard's view model: a mirror of `View` in core/src/templates/checkout/model.ts.
/// Every string and number is the core's; the drawing adds only the page's fixed words.
struct CheckoutModel: Decodable, Sendable {
    let step: Int
    let isLastStep: Bool
    let isComplete: Bool
    /// Changes when focus should move to the first invalid field of the current step.
    let focusTicket: Int
    let steps: [Step]
    /// The errors showing for the current step, by field.
    let errors: [String: String]
    /// The current step's text fields in the order they sit on the page: Return moves along it.
    let fieldOrder: [String]
    let items: [Item]
    let summary: Summary
    let actions: Actions
    let promo: Promo
    let shipping: Shipping
    let delivery: Delivery
    let payment: Payment
    let confirmation: String
    /// The words only the native drawing writes.
    let words: Words
    /// The page's heading says what the navigation title says: leave it out (nil in older snapshots).
    let headingRepeatsTitle: Bool?

    struct Step: Decodable, Sendable {
        let label: String
        /// "cart", "pin", "truck" or "card".
        let icon: String
        let hasError: Bool
        /// "Shipping, step 2 of 4".
        let spoken: String
        /// "Current step, Has problems", or empty.
        let state: String
    }

    struct Item: Decodable, Sendable {
        let id: String
        let name: String
        let variant: String
        let src: String
        let qty: Int
        let isLimited: Bool
        let priceEach: String
        let lineTotal: String
        /// "Remove <name>" and "Quantity of <name>", for VoiceOver.
        let removeLabel: String
        let quantityLabel: String
    }

    struct Summary: Decodable, Sendable {
        let itemCount: String
        let trigger: String
        let subtotal: String
        let promoLabel: String?
        let discount: String
        /// The method alone: the page adds " delivery" as its own text.
        let deliveryLabel: String
        let shipping: String
        let tax: String
        let total: String
        let freeShippingTitle: String?
    }

    struct Actions: Decodable, Sendable {
        let blocked: String?
        let backLabel: String
        let nextLabel: String
    }

    struct Promo: Decodable, Sendable {
        struct Status: Decodable, Sendable {
            /// "success" or "warning".
            let type: String
            let message: String
        }
        let value: String
        let status: Status?
    }

    struct Shipping: Decodable, Sendable {
        struct Country: Decodable, Sendable {
            let value: String
            let label: String
        }
        let email: String
        let firstName: String
        let lastName: String
        let country: String
        let address: String
        let apartment: String
        let city: String
        let state: String
        let postalCode: String
        let countries: [Country]
        let states: [String]
        let hasState: Bool
        let postalLabel: String
        let postalPlaceholder: String
    }

    struct Delivery: Decodable, Sendable {
        struct Method: Decodable, Sendable {
            let value: String
            let label: String
            let window: String
            let price: String
        }
        let value: String
        let options: [Method]
        let isGift: Bool
        let note: String
        let noteLabel: String
        let notePlaceholder: String
        let noteDescription: String
    }

    struct Payment: Decodable, Sendable {
        let cardNumber: String
        let cardName: String
        let expiry: String
        let cvc: String
        let billingMatches: Bool
    }

    struct Words: Decodable, Sendable {
        struct Cart: Decodable, Sendable {
            let heading: String, limited: String, remove: String, promoLabel: String, promoPlaceholder: String
            let apply: String, quantity: String
        }
        struct Shipping: Decodable, Sendable {
            let heading: String, detail: String, email: String, emailPlaceholder: String, emailHint: String
            let firstName: String, lastName: String, country: String, address: String, addressPlaceholder: String
            let apartment: String, city: String, state: String, statePlaceholder: String
        }
        struct Delivery: Decodable, Sendable {
            let heading: String, detail: String, method: String, gift: String
        }
        struct Payment: Decodable, Sendable {
            let heading: String, detail: String, cardNumber: String, cardNumberPlaceholder: String, cardName: String
            let expiry: String, expiryPlaceholder: String, cvc: String, cvcPlaceholder: String, cvcInfoLabel: String
            let cvcInfo: String, billingMatches: String, billingTitle: String, billingDetail: String
        }
        struct Confirmed: Decodable, Sendable {
            let title: String, heading: String, detail: String
        }
        struct Summary: Decodable, Sendable {
            let title: String, subtotal: String, deliverySuffix: String, tax: String, total: String, qty: String
        }

        /// The words all three templates share (field marks, the keyboard's buttons, collapsibles).
        let common: COSWords
        /// The page heading.
        let title: String
        let secureCheckout: String
        let progress: String
        let cart: Cart
        let shipping: Shipping
        let delivery: Delivery
        let payment: Payment
        let confirmed: Confirmed
        let summary: Summary

        private enum CodingKeys: String, CodingKey {
            case title, secureCheckout, progress, cart, shipping, delivery, payment, confirmed, summary
        }

        init(from decoder: Decoder) throws {
            common = try COSWords(from: decoder)
            let c = try decoder.container(keyedBy: CodingKeys.self)
            title = try c.decode(String.self, forKey: .title)
            secureCheckout = try c.decode(String.self, forKey: .secureCheckout)
            progress = try c.decode(String.self, forKey: .progress)
            cart = try c.decode(Cart.self, forKey: .cart)
            shipping = try c.decode(Shipping.self, forKey: .shipping)
            delivery = try c.decode(Delivery.self, forKey: .delivery)
            payment = try c.decode(Payment.self, forKey: .payment)
            confirmed = try c.decode(Confirmed.self, forKey: .confirmed)
            summary = try c.decode(Summary.self, forKey: .summary)
        }
    }

    /// The text fields of each step in the order they sit on the page: the first one with an
    /// error is where focus goes.
    static let focusOrder: [Int: [String]] = [
        1: ["email", "firstName", "lastName", "address", "city", "postalCode"],
        3: ["cardNumber", "cardName", "expiry", "cvc"],
    ]

    /// The first text field of the current step that has an error showing.
    var firstInvalidField: String? {
        (Self.focusOrder[step] ?? []).first { errors[$0] != nil }
    }

    /// The Return key's next stop after `key` in this step's text fields, or nil on the last.
    func fieldAfter(_ key: String) -> String? {
        guard let index = fieldOrder.firstIndex(of: key), index + 1 < fieldOrder.count else { return nil }
        return fieldOrder[index + 1]
    }

    /// Fields on a number pad, which has no Return key: they get a keyboard bar with Next and Done.
    static func hasNumberPad(_ key: String) -> Bool {
        key == "cardNumber" || key == "cvc" || key.hasPrefix("qty:")
    }
}
