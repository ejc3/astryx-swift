import SwiftUI

/// Astryx's checkout template, drawn natively from the core's view model
/// (core/src/templates/checkout/model.ts, its `View` type): a stepped checkout whose form
/// column carries the step indicator, the current step and the actions, with the order
/// summary beside it on a wide window and above it, collapsed, on a narrow one.
struct CheckoutTemplate: View {
    let view: JSONValue

    var body: some View {
        if let model = try? view.decode(CheckoutModel.self) {
            CheckoutScreen(model: model)
        } else {
            AXTemplatePlaceholder(template: "checkout")
        }
    }
}

/// The Astryx page switches to its stacked form at 900 points of host width.
private let checkoutNarrowWidth: CGFloat = 900

/// The model's actions, with the template's id prefix the core's `reduce` expects.
struct CheckoutSender {
    let send: AXSender

    @MainActor func press(_ id: String) { send(.press(id: "tpl.checkout." + id)) }
    @MainActor func set(_ id: String, _ value: Action.Value) { send(.set(id: "tpl.checkout." + id, value: value)) }
    static func id(_ id: String) -> String { "tpl.checkout." + id }
}

struct CheckoutScreen: View {
    let model: CheckoutModel
    @Environment(\.ax) private var ax
    @Environment(\.axWidth) private var width
    @Environment(\.axSend) private var send
    @FocusState private var focus: String?

    private var narrow: Bool { width <= checkoutNarrowWidth }
    private var actions: CheckoutSender { CheckoutSender(send: send) }

    var body: some View {
        VStack(alignment: .leading, spacing: ax.space(6)) {
            HStack(spacing: ax.space(1) + 2) {
                Spacer(minLength: 0)
                Image(systemName: "lock.fill").font(ax.fontSmall).foregroundStyle(ax.iconSecondary)
                Text("Secure checkout").font(ax.fontSmall).foregroundStyle(ax.textSecondary)
            }
            .accessibilityElement(children: .combine)

            if narrow {
                CheckoutSummary(model: model, narrow: true)
                formColumn
            } else {
                HStack(alignment: .top, spacing: ax.space(6)) {
                    formColumn.frame(maxWidth: .infinity, alignment: .topLeading)
                    CheckoutSummary(model: model, narrow: false).frame(width: 360)
                }
            }
        }
        .frame(maxWidth: 1000, alignment: .topLeading)
        .frame(maxWidth: .infinity, alignment: .top)
        .onChange(of: model.focusTicket) { _, _ in
            if let key = model.firstInvalidField { focus = key }
            if let blocked = model.actions.blocked {
                AccessibilityNotification.Announcement(blocked).post()
            }
        }
    }

    /// The form column owns the sequence end to end: progress at the top, the step in the
    /// middle, the way out at the bottom.
    private var formColumn: some View {
        VStack(alignment: .leading, spacing: ax.space(6)) {
            if model.isComplete {
                CheckoutConfirmation(model: model)
            } else {
                CheckoutStepper(model: model, actions: actions)
                switch model.step {
                case 0: CheckoutCartStep(model: model, actions: actions)
                case 1: CheckoutShippingStep(model: model, actions: actions, narrow: narrow, focus: $focus)
                case 2: CheckoutDeliveryStep(model: model, actions: actions)
                default: CheckoutPaymentStep(model: model, actions: actions, narrow: narrow, focus: $focus)
                }
                CheckoutActionRow(model: model, actions: actions)
            }
        }
    }
}

/// The ending: what the web page shows after Pay.
private struct CheckoutConfirmation: View {
    let model: CheckoutModel
    @Environment(\.ax) private var ax

    var body: some View {
        VStack(alignment: .leading, spacing: ax.space(4)) {
            COSBanner(tone: .success, symbol: "checkmark.circle.fill", title: "Order confirmed", description: model.confirmation)
            Text("Thanks for your order")
                .font(ax.heading(2))
                .foregroundStyle(ax.text)
                .accessibilityAddTraits(.isHeader)
            Text("The order is recorded in the app's state, so the template ends in a real, reviewable outcome.")
                .font(ax.fontBase)
                .foregroundStyle(ax.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

/// Back and Continue (or Pay), with the count of problems above them when a step is blocked.
/// Back hugs its label and Continue takes the rest, so the forward path is the wider target.
private struct CheckoutActionRow: View {
    let model: CheckoutModel
    let actions: CheckoutSender
    @Environment(\.ax) private var ax

    var body: some View {
        VStack(alignment: .leading, spacing: ax.space(3)) {
            if let blocked = model.actions.blocked {
                COSStatus(tone: .danger, message: blocked)
            }
            ViewThatFits(in: .horizontal) {
                HStack(spacing: ax.space(3)) {
                    back
                    next
                }
                VStack(spacing: ax.space(3)) {
                    next
                    back
                }
            }
        }
    }

    private var back: some View {
        COSButton(label: model.actions.backLabel, variant: .secondary) { actions.press("back") }
    }

    private var next: some View {
        COSButton(label: model.actions.nextLabel, variant: .primary, fills: true) { actions.press("next") }
    }
}
