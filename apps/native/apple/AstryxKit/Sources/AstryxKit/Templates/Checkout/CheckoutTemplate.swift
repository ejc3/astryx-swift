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
    @Environment(\.axStatic) private var isStatic
    @FocusState private var focus: String?

    private var narrow: Bool { width <= checkoutNarrowWidth }
    private var actions: CheckoutSender { CheckoutSender(send: send) }

    var body: some View {
        // Back, Continue (or Pay) and, on a narrow screen, the total stay in view at the bottom of
        // the screen: the last row of the page, pinned to the edge of the scroll view. (When drawn
        // without a window there is no scroll view, so it is simply the last row.)
        Group {
            if isStatic {
                VStack(alignment: .leading, spacing: ax.space(6)) {
                    page
                    if !model.isComplete { CheckoutActionBar(model: model, actions: actions, narrow: narrow) }
                }
            } else {
                LazyVStack(alignment: .leading, spacing: ax.space(6), pinnedViews: [.sectionFooters]) {
                    Section {
                        page
                    } footer: {
                        if !model.isComplete { CheckoutActionBar(model: model, actions: actions, narrow: narrow) }
                    }
                }
            }
        }
        .frame(maxWidth: 1000, alignment: .topLeading)
        .frame(maxWidth: .infinity, alignment: .top)
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
            HStack(spacing: ax.space(1) + 2) {
                Spacer(minLength: 0)
                Image(systemName: "lock.fill").font(ax.fontSmall).foregroundStyle(ax.iconSecondary)
                Text(model.words.secureCheckout).font(ax.fontSmall).foregroundStyle(ax.textSecondary)
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
    }

    /// The form column: progress at the top and the step under it. The way on sits in the bar.
    private var formColumn: some View {
        VStack(alignment: .leading, spacing: ax.space(6)) {
            if model.isComplete {
                CheckoutConfirmation(model: model)
            } else {
                CheckoutStepper(model: model, actions: actions)
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

/// Back and Continue (or Pay), the count of problems when a step is blocked and, on a narrow
/// screen, the total, as Apple's payment sheet keeps the total with the action. It is the page's
/// last row, pinned to the bottom edge while the form scrolls; on iOS and macOS 26 Continue takes
/// the system's prominent Liquid Glass button style over the opaque bar.
private struct CheckoutActionBar: View {
    let model: CheckoutModel
    let actions: CheckoutSender
    let narrow: Bool
    @Environment(\.ax) private var ax
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        VStack(alignment: .leading, spacing: ax.space(2)) {
            if let blocked = model.actions.blocked {
                COSStatus(tone: .danger, message: blocked)
            }
            if typeSize.isAccessibilitySize {
                // At accessibility sizes nothing sits beside anything: the total, then the way
                // forward, then back, each as wide as the bar so a label wraps between words.
                column
            } else {
                ViewThatFits(in: .horizontal) {
                    HStack(spacing: ax.space(3)) {
                        if narrow { total }
                        back(fills: false)
                        next
                    }
                    VStack(spacing: ax.space(2)) {
                        HStack(spacing: ax.space(3)) {
                            if narrow { total }
                            next
                        }
                        back(fills: false)
                    }
                    column
                }
            }
        }
        .padding(ax.space(3))
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous).fill(ax.card))
        .overlay(RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous).strokeBorder(ax.border, lineWidth: 1))
        .shadow(color: ax.shadow, radius: 8, y: 2)
        .padding(.bottom, ax.space(1))
        .accessibilityElement(children: .contain)
    }

    private var column: some View {
        VStack(alignment: .leading, spacing: ax.space(2)) {
            if narrow { total }
            next.frame(maxWidth: .infinity)
            back(fills: true)
        }
    }

    private var total: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(model.words.summary.total).font(ax.fontSmall).foregroundStyle(ax.textSecondary)
            Text(model.summary.total).font(ax.fontStrong).foregroundStyle(ax.text).lineLimit(1)
        }
        .fixedSize()
        .accessibilityElement(children: .combine)
    }

    private func back(fills: Bool) -> some View {
        CheckoutBarButton(label: model.actions.backLabel, prominent: false, fills: fills) { actions.press("back") }
    }

    private var next: some View {
        CheckoutBarButton(label: model.actions.nextLabel, prominent: true, fills: true) { actions.press("next") }
    }
}

/// A bar button: the system's Liquid Glass styles on iOS and macOS 26 (prominent for the way
/// forward), the theme's own buttons before that.
private struct CheckoutBarButton: View {
    let label: String
    let prominent: Bool
    let fills: Bool
    let action: () -> Void
    @Environment(\.ax) private var ax
    @Environment(\.axStatic) private var isStatic
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        if #available(iOS 26, macOS 26, *), !isStatic {
            if prominent {
                Button(action: action) { title }
                    .buttonStyle(.glassProminent)
                    .tint(ax.accent)
                    .controlSize(.large)
            } else {
                Button(action: action) { title }
                    .buttonStyle(.glass)
                    .controlSize(.large)
            }
        } else {
            COSButton(label: label, variant: prominent ? .primary : .secondary, fills: fills, action: action)
        }
    }

    private var title: some View {
        Text(label)
            .font(ax.fontLabel)
            // One line until the text is so large that one line cannot hold it; then it wraps
            // between words and the button grows, never a cut label.
            .lineLimit(typeSize.isAccessibilitySize ? nil : 1)
            .multilineTextAlignment(.center)
            // The label's own width inside the button, so the bar's ViewThatFits can tell
            // when the row does not fit, instead of the label being cut short.
            .fixedSize(horizontal: !typeSize.isAccessibilitySize, vertical: true)
            .frame(maxWidth: fills ? .infinity : nil)
    }
}
