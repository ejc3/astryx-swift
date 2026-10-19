import SwiftUI

/// The checkout card: email, shipping method, payment method, card details, country, the
/// save-information choice and Pay now. Each control draws the core's value (the stock page
/// never changes one) and tells the core what was picked.
struct ShowCheckout: View {
    let checkout: ShowModel.Checkout
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send
    @Environment(\.axWidth) private var width

    var body: some View {
        // The card is the page's own ground, with no border, as in the stock template.
        ShowCard(fill: { $0.page }, padding: width < 380 ? ax.space(4) : ax.space(5), stroke: .clear) {
            VStack(alignment: .leading, spacing: ax.space(4)) {
                Text(checkout.heading)
                    .font(ax.heading(2))
                    .foregroundStyle(ax.text)
                    .axLeading(ax, size: ax.fontSize("text-heading-2-size", 20), ratio: ax.headingLeading(2))
                    .accessibilityAddTraits(.isHeader)
                VStack(alignment: .leading, spacing: ax.space(3)) {
                    ShowTextField(id: "tpl.showcase.email", label: checkout.email.label, placeholder: checkout.email.placeholder, value: checkout.email.value, keyboard: .email)
                    shippingList
                    paymentCards
                    ShowTextField(id: "tpl.showcase.card", label: checkout.card.label, placeholder: checkout.card.placeholder, value: checkout.card.value, icon: width < 380 ? nil : "creditcard", keyboard: .digits)
                    expiryAndCVC
                    countryMenu
                }
                saveRow
                Button {} label: {
                    HStack(spacing: ax.space(2)) {
                        Image(systemName: "lock")
                        Text(checkout.payLabel)
                    }
                    .frame(maxWidth: .infinity)
                    #if os(macOS)
                    // Astryx's `lg` button.
                    .frame(minHeight: 40 * min(ax.scale, 1.4))
                    #endif
                }
                .buttonStyle(AXButtonStyle(variant: .primary, ax: ax))
            }
        }
        .accessibilityElement(children: .contain)
    }

    private var selectedPayment: String { checkout.payment.options.first(where: \.isSelected)?.value ?? "" }

    // MARK: Shipping method

    /// A radio list: the label and its description over plain rows (radio, label and detail, the
    /// price at the end), on the card's own ground.
    private var shippingList: some View {
        VStack(alignment: .leading, spacing: ax.space(2)) {
            VStack(alignment: .leading, spacing: 0) {
                Text(checkout.shipping.label).font(ax.fontBase).foregroundStyle(ax.textSecondary)
                    .axLeading(ax, size: ax.fontSize("font-size-base", 14), ratio: ax.bodyLeading)
                Text(checkout.shipping.description).font(ax.fontSmall).foregroundStyle(ax.textSecondary)
                    .axLeading(ax, size: ax.fontSize("font-size-sm", 12), ratio: ax.supportingLeading)
                    .fixedSize(horizontal: false, vertical: true)
            }
            VStack(spacing: ax.space(1)) {
                ForEach(checkout.shipping.options) { option in
                    let chosen = option.value == checkout.shipping.value
                    Button {
                        send(.set(id: "tpl.showcase.shipping", value: .string(option.value)))
                    } label: {
                        HStack(alignment: .center, spacing: ax.space(3)) {
                            ShowRadioMark(on: chosen)
                            VStack(alignment: .leading, spacing: 0) {
                                Text(option.label).font(ax.fontBase).foregroundStyle(ax.text)
                                    .axLeading(ax, size: ax.fontSize("font-size-base", 14), ratio: ax.bodyLeading)
                                Text(option.description).font(ax.fontSmall).foregroundStyle(ax.textSecondary)
                                    .axLeading(ax, size: ax.fontSize("font-size-sm", 12), ratio: ax.supportingLeading)
                                    .multilineTextAlignment(.leading)
                            }
                            Spacer(minLength: ax.space(2))
                            Text(option.price).font(ax.font("font-size-base", 14, weight: "font-weight-bold").monospacedDigit()).foregroundStyle(ax.text)
                        }
                        .padding(.vertical, ax.space(1))
                        .frame(minHeight: axMinTarget)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel(option.label)
                    .accessibilityValue("\(option.description), \(option.price)")
                    .accessibilityAddTraits(chosen ? [.isSelected, .isButton] : .isButton)
                }
            }
        }
    }

    // MARK: Payment method

    private var paymentCards: some View {
        VStack(alignment: .leading, spacing: ax.space(2)) {
            Text(checkout.payment.label).font(ax.font("font-size-sm", 12, weight: "font-weight-bold")).foregroundStyle(ax.text)
                .axLeading(ax, size: ax.fontSize("font-size-sm", 12), ratio: ax.supportingLeading)
            LazyVGrid(
                columns: Array(repeating: GridItem(.flexible(minimum: 0), spacing: ax.space(2), alignment: .top), count: ax.scale > 1.2 || width < 380 ? 1 : 3),
                spacing: ax.space(2)
            ) {
                ForEach(checkout.payment.options) { option in
                    let chosen = option.value == selectedPayment
                    let shape = RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous)
                    Button {
                        send(.set(id: "tpl.showcase.payment", value: .string(option.value)))
                    } label: {
                        VStack(spacing: ax.space(1)) {
                            Image(systemName: ShowModel.symbol(option.icon))
                                .font(.system(size: ax.fontSize("font-size-lg", 17) * 1.1))
                                .frame(height: 24 * min(ax.scale, 1.4))
                            Text(option.text).font(ax.font("font-size-sm", 12, weight: "font-weight-bold")).lineLimit(1).minimumScaleFactor(0.8)
                        }
                        .foregroundStyle(ax.text)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, ax.space(3))
                        .padding(.horizontal, ax.space(1))
                        .background(shape.fill(ax.surface))
                        .overlay(shape.strokeBorder(chosen ? ax.accent : ax.border, lineWidth: chosen ? 2 : 1))
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(option.label)
                    .accessibilityAddTraits(chosen ? [.isSelected, .isButton] : .isButton)
                }
            }
        }
    }

    // MARK: Expiry, CVC, country

    @ViewBuilder
    private var expiryAndCVC: some View {
        let expiry = ShowTextField(id: "tpl.showcase.expiry", label: checkout.expiry.label, placeholder: checkout.expiry.placeholder, value: checkout.expiry.value, keyboard: .digits)
        let cvc = ShowTextField(id: "tpl.showcase.cvc", label: checkout.cvc.label, placeholder: checkout.cvc.placeholder, value: checkout.cvc.value, keyboard: .digits)
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .top, spacing: ax.space(2)) { expiry; cvc }
                .frame(minWidth: 240)
            VStack(alignment: .leading, spacing: ax.space(3)) { expiry; cvc }
        }
    }

    private var countryMenu: some View {
        AXField(label: checkout.country.label) {
            ShowMenuField(text: checkout.country.options.first(where: { $0.value == checkout.country.value })?.label ?? checkout.country.value) {
                Picker(checkout.country.label, selection: Binding(
                    get: { checkout.country.value },
                    set: { send(.set(id: "tpl.showcase.country", value: .string($0))) }
                )) {
                    ForEach(checkout.country.options) { Text($0.label).tag($0.value) }
                }
                .pickerStyle(.inline)
                .labelsHidden()
            }
        }
    }

    // MARK: Save information

    private var saveRow: some View {
        let on = checkout.saveInfo.value
        return Button {
            send(.set(id: "tpl.showcase.saveInfo", value: .bool(!on)))
        } label: {
            HStack(alignment: .top, spacing: ax.space(3)) {
                AXCheckmark(checked: on).padding(.top, 1)
                VStack(alignment: .leading, spacing: 0) {
                    Text(checkout.saveInfo.label).font(ax.fontLabel).foregroundStyle(ax.text)
                        .axLeading(ax, size: ax.fontSize("font-size-base", 14), ratio: ax.bodyLeading)
                        .multilineTextAlignment(.leading)
                    Text(checkout.saveInfo.description).font(ax.fontSmall).foregroundStyle(ax.textSecondary)
                        .axLeading(ax, size: ax.fontSize("font-size-sm", 12), ratio: ax.supportingLeading)
                        .multilineTextAlignment(.leading)
                }
                Spacer(minLength: 0)
            }
            .frame(minHeight: axMinTarget)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(checkout.saveInfo.label)
        .accessibilityHint(checkout.saveInfo.description)
        .axToggleSemantics(isOn: on)
    }
}

/// A radio button's mark, drawn with the tokens.
struct ShowRadioMark: View {
    let on: Bool
    @Environment(\.ax) private var ax

    var body: some View {
        Circle()
            .strokeBorder(on ? ax.accent : ax.borderStrong, lineWidth: on ? 5 : 1.5)
            .background(Circle().fill(ax.surface))
            .frame(width: 18 * min(ax.scale, 1.5), height: 18 * min(ax.scale, 1.5))
            .accessibilityHidden(true)
    }
}
