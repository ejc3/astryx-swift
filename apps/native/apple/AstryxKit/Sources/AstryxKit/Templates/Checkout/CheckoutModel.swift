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
    let items: [Item]
    let summary: Summary
    let actions: Actions
    let promo: Promo
    let shipping: Shipping
    let delivery: Delivery
    let payment: Payment
    let confirmation: String

    struct Step: Decodable, Sendable {
        let label: String
        /// "cart", "pin", "truck" or "card".
        let icon: String
        let hasError: Bool
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
}
