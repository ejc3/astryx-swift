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

    /// The template owns its outer padding, as the stock page pads itself (24).
    private var pad: CGFloat { ax.space(6) }
    private var inner: CGFloat { max(width - 2 * pad, 0) }
    private var narrow: Bool { inner <= model.rules.narrowHostAtMost }
    /// The form column's width: the whole page when stacked, else what the summary and the gap leave.
    private var formWidth: CGFloat { narrow ? inner : max(inner - model.rules.summaryWidth - ax.space(6), 0) }
    private var actions: CheckoutSender { CheckoutSender(send: send) }

    var body: some View {
        // The page, then Back and Continue (or Pay) as its last row: in the flow, not pinned.
        VStack(alignment: .leading, spacing: ax.space(6)) {
            page
            if !model.isComplete { CheckoutActionBar(model: model, actions: actions) }
        }
        .padding(pad)
        .frame(maxWidth: model.rules.contentWidth + 2 * pad, alignment: .topLeading)
        .frame(maxWidth: .infinity, alignment: .top)
        .environment(\.axWidth, inner)
        .environment(\.cosWords, model.words.common)
        .onChange(of: model.focusTicket) { _, _ in
            if let key = model.firstInvalidField { focus = key }
            if let blocked = model.actions.blocked {
                AccessibilityNotification.Announcement(blocked).post()
            }
        }
        // Leaving a text field validates it: its error shows now, not only after Continue.
        .onChange(of: focus) { old, new in
            if let old, old != new, model.fieldOrder.contains(old) { actions.press("blur:\(old)") }
        }
        #if os(iOS)
        .toolbar {
            // A number pad has no Return key: a bar above it moves on or puts the keyboard away.
            if let key = focus, CheckoutModel.hasNumberPad(key) {
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    if let next = model.fieldAfter(key) {
                        Button(model.words.common.next) { focus = next }
                    }
                    Button(model.words.common.done) { focus = nil }
                        .fontWeight(.semibold)
                }
            }
        }
        #endif
    }

    private var page: some View {
        VStack(alignment: .leading, spacing: ax.space(6)) {
            HStack(spacing: ax.space(2)) {
                // The navigation title already says "Checkout": the page leaves its heading out.
                if model.headingRepeatsTitle != true {
                    Text(model.words.title)
                        .font(ax.heading(1))
                        .foregroundStyle(ax.text)
                        .accessibilityAddTraits(.isHeader)
                }
                Spacer(minLength: ax.space(2))
                HStack(spacing: ax.space(1) + 2) {
                    Image(systemName: "lock").font(ax.fontSmall).foregroundStyle(ax.iconSecondary)
                    Text(model.words.secureCheckout).font(ax.fontSmall).foregroundStyle(ax.textSecondary)
                }
                .accessibilityElement(children: .combine)
            }

            if narrow {
                CheckoutSummary(model: model, narrow: true)
                formColumn
            } else {
                HStack(alignment: .top, spacing: ax.space(6)) {
                    formColumn.frame(maxWidth: .infinity, alignment: .topLeading)
                    CheckoutSummary(model: model, narrow: false).frame(width: model.rules.summaryWidth)
                }
            }
        }
    }

    /// The form column: progress at the top and the step under it. The way on sits in the bar.
    private var formColumn: some View {
        VStack(alignment: .leading, spacing: ax.space(6)) {
            if model.isComplete {
                CheckoutConfirmation(model: model)
            } else {
                CheckoutStepper(model: model, actions: actions, columnWidth: formWidth)
                switch model.step {
                case 0: CheckoutCartStep(model: model, actions: actions, focus: $focus)
                case 1: CheckoutShippingStep(model: model, actions: actions, narrow: narrow, focus: $focus)
                case 2: CheckoutDeliveryStep(model: model, actions: actions)
                default: CheckoutPaymentStep(model: model, actions: actions, narrow: narrow, focus: $focus)
                }
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
            COSBanner(tone: .success, symbol: "checkmark.circle.fill", title: model.words.confirmed.title, description: model.confirmation)
            Text(model.words.confirmed.heading)
                .font(ax.heading(2))
                .foregroundStyle(ax.text)
                .accessibilityAddTraits(.isHeader)
            Text(model.words.confirmed.detail)
                .font(ax.fontBase)
                .foregroundStyle(ax.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

/// Back and Continue (or Pay) and, when a step is blocked, the count of problems above them: a
/// plain row at the end of the page, as the web draws it. Back is a secondary button, Continue
/// the primary one filling the rest of the row.
private struct CheckoutActionBar: View {
    let model: CheckoutModel
    let actions: CheckoutSender
    @Environment(\.ax) private var ax
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        VStack(alignment: .leading, spacing: ax.space(2)) {
            if let blocked = model.actions.blocked {
                COSStatus(tone: .danger, message: blocked)
            }
            if typeSize.isAccessibilitySize {
                // At accessibility sizes nothing sits beside anything: the way forward, then
                // back, each as wide as the page so a label wraps between words.
                column
            } else {
                ViewThatFits(in: .horizontal) {
                    HStack(spacing: ax.space(3)) {
                        back(fills: false)
                        next
                    }
                    column
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .contain)
    }

    private var column: some View {
        VStack(alignment: .leading, spacing: ax.space(2)) {
            next.frame(maxWidth: .infinity)
            back(fills: true)
        }
    }

    private func back(fills: Bool) -> some View {
        COSButton(label: model.actions.backLabel, variant: .secondary, fills: fills) { actions.press("back") }
    }

    private var next: some View {
        COSButton(label: model.actions.nextLabel, variant: .primary, fills: true) { actions.press("next") }
    }
}
