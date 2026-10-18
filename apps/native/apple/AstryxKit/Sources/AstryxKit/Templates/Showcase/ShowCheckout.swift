import SwiftUI

/// The checkout card: email, shipping method, payment method, card details, country, the
/// save-information choice and Pay now.
struct ShowCheckout: View {
    let checkout: ShowModel.Checkout
    @State private var shipping: String
    @State private var payment: String
    @State private var country: String
    @State private var saveInfo: Bool
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send
    @Environment(\.axWidth) private var width
    @Environment(\.showInert) private var inert

    init(checkout: ShowModel.Checkout) {
        self.checkout = checkout
        _shipping = State(initialValue: checkout.shipping.value)
        _payment = State(initialValue: checkout.payment.options.first(where: \.isSelected)?.value ?? "")
        _country = State(initialValue: checkout.country.value)
        _saveInfo = State(initialValue: checkout.saveInfo.value)
    }

    private var selectedPayment: String { checkout.payment.options.first(where: \.isSelected)?.value ?? "" }

    var body: some View {
        // The card is the page's own ground, as in the stock template.
        ShowCard(fill: { $0.page }, padding: width < 380 ? ax.space(4) : ax.space(5)) {
            VStack(alignment: .leading, spacing: ax.space(4)) {
                Text(checkout.heading)
                    .font(ax.heading(2))
                    .foregroundStyle(ax.text)
                    .accessibilityAddTraits(.isHeader)
                VStack(alignment: .leading, spacing: ax.space(3)) {
                    ShowTextField(id: "tpl.showcase.email", label: checkout.email.label, placeholder: checkout.email.placeholder, value: checkout.email.value, keyboard: .email)
                    shippingList
                    paymentCards
                    ShowTextField(id: "tpl.showcase.card", label: checkout.card.label, placeholder: checkout.card.placeholder, value: checkout.card.value, icon: "creditcard", keyboard: .digits)
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
                }
                .buttonStyle(AXButtonStyle(variant: .primary, ax: ax))
                .disabled(inert.contains("pay"))
                .font(ax.fontStrong)
            }
        }
        .accessibilityElement(children: .contain)
        .showMirror(checkout.shipping.value, into: $shipping)
        .showMirror(selectedPayment, into: $payment)
        .showMirror(checkout.country.value, into: $country)
        .showMirror(checkout.saveInfo.value, into: $saveInfo)
    }

    // MARK: Shipping method

    private var shippingList: some View {
        VStack(alignment: .leading, spacing: ax.space(2)) {
            VStack(alignment: .leading, spacing: ax.hair) {
                Text(checkout.shipping.label).font(ax.fontLabel).foregroundStyle(ax.text)
                Text(checkout.shipping.description).font(ax.fontSmall).foregroundStyle(ax.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            VStack(spacing: ax.space(2)) {
                ForEach(checkout.shipping.options) { option in
                    let chosen = option.value == shipping
                    Button {
                        shipping = option.value
                        send(.set(id: "tpl.showcase.shipping", value: .string(option.value)))
                    } label: {
                        HStack(alignment: .center, spacing: ax.space(3)) {
                            ShowRadioMark(on: chosen)
                            VStack(alignment: .leading, spacing: ax.hair) {
                                Text(option.label).font(ax.fontLabel).foregroundStyle(ax.text)
                                Text(option.description).font(ax.fontSmall).foregroundStyle(ax.textSecondary)
                                    .multilineTextAlignment(.leading)
                            }
                            Spacer(minLength: ax.space(2))
                            Text(option.price).font(ax.fontStrong.monospacedDigit()).foregroundStyle(ax.text)
                        }
                        .padding(ax.space(3))
                        .background(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).fill(chosen ? ax.accentMuted : ax.surface))
                        .overlay(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).strokeBorder(chosen ? ax.accent : ax.border, lineWidth: chosen ? 1.5 : 1))
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
            Text(checkout.payment.label).font(ax.fontStrong).foregroundStyle(ax.text)
            LazyVGrid(
                columns: Array(repeating: GridItem(.flexible(minimum: 0), spacing: ax.space(2), alignment: .top), count: ax.scale > 1.2 ? 1 : 3),
                spacing: ax.space(2)
            ) {
                ForEach(checkout.payment.options) { option in
                    let chosen = option.value == payment
                    Button {
                        payment = option.value
                        send(.set(id: "tpl.showcase.payment", value: .string(option.value)))
                    } label: {
                        VStack(spacing: ax.space(1)) {
                            Image(systemName: ShowModel.symbol(option.icon))
                                .font(.system(size: ax.fontSize("font-size-lg", 17) * 1.1))
                                .frame(height: 24 * min(ax.scale, 1.4))
                            Text(option.text).font(ax.fontStrong).lineLimit(1).minimumScaleFactor(0.8)
                        }
                        .foregroundStyle(chosen ? ax.tone(.accent).text : ax.text)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, ax.space(3))
                        .padding(.horizontal, ax.space(1))
                        .background(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).fill(chosen ? ax.accentMuted : ax.surface))
                        .overlay(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).strokeBorder(chosen ? ax.accent : ax.border, lineWidth: chosen ? 1.5 : 1))
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
            ShowMenuField(text: checkout.country.options.first(where: { $0.value == country })?.label ?? country) {
                Picker(checkout.country.label, selection: Binding(
                    get: { country },
                    set: { country = $0; send(.set(id: "tpl.showcase.country", value: .string($0))) }
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
        Button {
            saveInfo.toggle()
            send(.set(id: "tpl.showcase.saveInfo", value: .bool(saveInfo)))
        } label: {
            HStack(alignment: .top, spacing: ax.space(3)) {
                AXCheckmark(checked: saveInfo).padding(.top, 1)
                VStack(alignment: .leading, spacing: ax.hair) {
                    Text(checkout.saveInfo.label).font(ax.fontLabel).foregroundStyle(ax.text)
                        .multilineTextAlignment(.leading)
                    Text(checkout.saveInfo.description).font(ax.fontSmall).foregroundStyle(ax.textSecondary)
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
        .axToggleSemantics(isOn: saveInfo)
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
