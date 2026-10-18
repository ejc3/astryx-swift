import SwiftUI

/// A step's title and the sentence under it.
private struct StepHeading: View {
    let title: String
    var detail: String? = nil
    @Environment(\.ax) private var ax

    var body: some View {
        VStack(alignment: .leading, spacing: ax.space(1)) {
            Text(title).font(ax.heading(2)).foregroundStyle(ax.text).accessibilityAddTraits(.isHeader)
            if let detail {
                Text(detail).font(ax.fontSmall).foregroundStyle(ax.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}

/// Fields that pair side by side on a wide window and stack on a narrow one.
private struct FieldRow<Content: View>: View {
    let narrow: Bool
    @ViewBuilder var content: Content
    @Environment(\.ax) private var ax

    var body: some View {
        if narrow {
            VStack(alignment: .leading, spacing: ax.space(4)) { content }
        } else {
            HStack(alignment: .top, spacing: ax.space(4)) { content }
        }
    }
}

/// A labelled text field of the form, with its error under it and its place in the focus order.
private struct FormText: View {
    let key: String
    let label: String
    let value: String
    let model: CheckoutModel
    var placeholder = ""
    var content: COSContent = .plain
    var optional = false
    var hint: String? = nil
    var info: String? = nil
    var icon: String? = nil
    var focus: FocusState<String?>.Binding

    var body: some View {
        COSField(label: label, optional: optional, hint: hint, error: model.errors[key], info: info) {
            COSTextBox(
                id: CheckoutSender.id(key), label: label, value: value, placeholder: placeholder,
                content: content, icon: icon, hasError: model.errors[key] != nil,
                focusKey: key, focus: focus
            )
        }
    }
}

// MARK: Step 1: the cart

struct CheckoutCartStep: View {
    let model: CheckoutModel
    let actions: CheckoutSender
    @Environment(\.ax) private var ax
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        VStack(alignment: .leading, spacing: ax.space(5)) {
            StepHeading(title: "Review your cart")
            VStack(alignment: .leading, spacing: ax.space(4)) {
                ForEach(model.items, id: \.id) { item in
                    VStack(alignment: .leading, spacing: ax.space(3)) {
                        row(item)
                        AXDivider()
                    }
                }
            }
            if let error = model.errors["items"] {
                COSStatus(tone: .danger, message: error)
            }
            promo
        }
    }

    @ViewBuilder
    private func row(_ item: CheckoutModel.Item) -> some View {
        let stacked = typeSize.isAccessibilitySize
        let details = VStack(alignment: .leading, spacing: ax.space(1)) {
            if stacked {
                VStack(alignment: .leading, spacing: ax.hair) {
                    Text(item.name).font(ax.fontLabel).foregroundStyle(ax.text)
                        .fixedSize(horizontal: false, vertical: true)
                    if item.isLimited { AXBadge(text: "Limited", tone: .success) }
                    Text(item.lineTotal).font(ax.fontStrong).foregroundStyle(ax.text)
                }
            } else {
                HStack(alignment: .top, spacing: ax.space(2)) {
                    HStack(alignment: .firstTextBaseline, spacing: ax.space(2)) {
                        Text(item.name).font(ax.fontLabel).foregroundStyle(ax.text)
                            .fixedSize(horizontal: false, vertical: true)
                        if item.isLimited { AXBadge(text: "Limited", tone: .success) }
                    }
                    Spacer(minLength: ax.space(2))
                    Text(item.lineTotal).font(ax.fontStrong).foregroundStyle(ax.text)
                }
            }
            Text("\(item.variant) \u{B7} \(item.priceEach) each")
                .font(ax.fontSmall)
                .foregroundStyle(ax.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
            ViewThatFits(in: .horizontal) {
                HStack(spacing: ax.space(2)) { quantity(item); remove(item) }
                VStack(alignment: .leading, spacing: ax.space(2)) { quantity(item); remove(item) }
            }
            .padding(.top, ax.space(1))
        }
        if stacked {
            VStack(alignment: .leading, spacing: ax.space(3)) {
                COSThumbnail(src: item.src, name: item.name, side: 72)
                details
            }
        } else {
            HStack(alignment: .top, spacing: ax.space(4)) {
                COSThumbnail(src: item.src, name: item.name, side: 72)
                details
            }
        }
    }

    private func quantity(_ item: CheckoutModel.Item) -> some View {
        CheckoutQuantity(name: item.name, qty: item.qty) { actions.set("qty:\(item.id)", .number(Double($0))) }
    }

    private func remove(_ item: CheckoutModel.Item) -> some View {
        COSButton(label: "Remove", variant: .ghost) { actions.press("remove:\(item.id)") }
            .accessibilityLabel("Remove \(item.name)")
    }

    /// The code and its Apply button level with the box; the status sits under the pair.
    private var promo: some View {
        VStack(alignment: .leading, spacing: ax.space(1)) {
            Text("Promo code").font(ax.fontLabel).foregroundStyle(ax.text)
            ViewThatFits(in: .horizontal) {
                HStack(spacing: ax.space(2)) { promoBox; applyButton }
                VStack(alignment: .leading, spacing: ax.space(2)) { promoBox; applyButton }
            }
            if let status = model.promo.status {
                COSStatus(tone: status.type == "success" ? .success : .warning, message: status.message)
            }
        }
    }

    private var promoBox: some View {
        COSTextBox(
            id: CheckoutSender.id("promo"), label: "Promo code", value: model.promo.value,
            placeholder: "WELCOME10", content: .code, hasError: false
        ) { actions.press("apply") }
    }

    private var applyButton: some View {
        COSButton(label: "Apply", variant: .secondary) { actions.press("apply") }
    }
}

/// A quantity: minus, a number you can type, plus; 0 to 10, as the web field. VoiceOver
/// adjusts it with swipes up and down.
struct CheckoutQuantity: View {
    let name: String
    let qty: Int
    let change: (Int) -> Void
    @State private var text: String
    @Environment(\.ax) private var ax
    @Environment(\.axStatic) private var isStatic

    init(name: String, qty: Int, change: @escaping (Int) -> Void) {
        self.name = name; self.qty = qty; self.change = change
        _text = State(initialValue: String(qty))
    }

    var body: some View {
        let side = 36 * min(ax.scale, 1.4)
        let shape = RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous)
        HStack(spacing: 0) {
            stepper("minus", enabled: qty > 0) { change(max(qty - 1, 0)) }
            Group {
                if isStatic {
                    Text(text)
                } else {
                    TextField("Quantity", text: $text)
                        .textFieldStyle(.plain)
                        .multilineTextAlignment(.center)
                        .cosContent(.integer)
                }
            }
            .font(ax.fontBase.monospacedDigit())
            .foregroundStyle(ax.text)
            .frame(width: 40 * min(ax.scale, 1.4), height: side)
            stepper("plus", enabled: qty < 10) { change(min(qty + 1, 10)) }
        }
        .background(shape.fill(ax.surface))
        .overlay(shape.strokeBorder(ax.borderStrong, lineWidth: 1))
        .fixedSize()
        .onChange(of: text) { _, new in
            if let value = Int(new), (0...10).contains(value), value != qty { change(value) }
        }
        .onChange(of: qty) { _, new in
            if Int(text) != new { text = String(new) }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Quantity of \(name)")
        .accessibilityValue("\(qty)")
        .accessibilityAdjustableAction { direction in
            switch direction {
            case .increment: if qty < 10 { change(qty + 1) }
            case .decrement: if qty > 0 { change(qty - 1) }
            @unknown default: break
            }
        }
    }

    private func stepper(_ symbol: String, enabled: Bool, action: @escaping () -> Void) -> some View {
        let side = 36 * min(ax.scale, 1.4)
        return Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: ax.fontSize("font-size-sm", 12), weight: .semibold))
                .foregroundStyle(enabled ? ax.text : ax.textDisabled)
                .frame(width: side, height: side)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
    }
}

// MARK: Step 2: shipping

struct CheckoutShippingStep: View {
    let model: CheckoutModel
    let actions: CheckoutSender
    let narrow: Bool
    var focus: FocusState<String?>.Binding
    @Environment(\.ax) private var ax

    var body: some View {
        let s = model.shipping
        VStack(alignment: .leading, spacing: ax.space(5)) {
            StepHeading(title: "Where should it go?", detail: "Delivery options and tax are calculated from this address.")
            VStack(alignment: .leading, spacing: ax.space(4)) {
                FormText(
                    key: "email", label: "Email", value: s.email, model: model, placeholder: "you@example.com",
                    content: .email, hint: "Order confirmation and tracking go here.", focus: focus
                )
                FieldRow(narrow: narrow) {
                    FormText(key: "firstName", label: "First name", value: s.firstName, model: model, content: .givenName, focus: focus)
                    FormText(key: "lastName", label: "Last name", value: s.lastName, model: model, content: .familyName, focus: focus)
                }
                COSField(label: "Country") {
                    COSSelect(
                        label: "Country",
                        choices: s.countries.map { .init(value: $0.value, label: $0.label) },
                        value: s.country
                    ) { actions.set("country", .string($0)) }
                }
                FormText(key: "address", label: "Street address", value: s.address, model: model, placeholder: "123 Main Street", content: .street, focus: focus)
                FormText(key: "apartment", label: "Apartment, suite, etc.", value: s.apartment, model: model, content: .street2, optional: true, focus: focus)
                FieldRow(narrow: narrow) {
                    FormText(key: "city", label: "City", value: s.city, model: model, content: .city, focus: focus)
                    if s.hasState {
                        COSField(label: "State", error: model.errors["state"]) {
                            COSSelect(
                                label: "State",
                                choices: s.states.map { .init(value: $0, label: $0) },
                                value: s.state,
                                placeholder: "Select state",
                                hasError: model.errors["state"] != nil
                            ) { actions.set("state", .string($0)) }
                        }
                    }
                    FormText(
                        key: "postalCode", label: s.postalLabel, value: s.postalCode, model: model,
                        placeholder: s.postalPlaceholder, content: .postalCode, focus: focus
                    )
                }
            }
        }
    }
}

// MARK: Step 3: delivery

struct CheckoutDeliveryStep: View {
    let model: CheckoutModel
    let actions: CheckoutSender
    @Environment(\.ax) private var ax

    var body: some View {
        let d = model.delivery
        VStack(alignment: .leading, spacing: ax.space(5)) {
            StepHeading(
                title: "How fast do you need it?",
                detail: "Estimates run from the day the order ships, usually 1\u{2013}3 business days after you place it."
            )
            VStack(alignment: .leading, spacing: ax.space(4)) {
                methods
                AXDivider()
                COSSwitch(label: "This is a gift", isOn: d.isGift) { actions.set("isGift", .bool($0)) }
                COSField(label: d.noteLabel, optional: true, hint: d.noteDescription) {
                    COSTextBox(
                        id: CheckoutSender.id("deliveryNote"), label: d.noteLabel, value: d.note,
                        placeholder: d.notePlaceholder, content: .plain, multiline: true, maxLength: 240
                    )
                }
            }
        }
    }

    private var methods: some View {
        let d = model.delivery
        return VStack(alignment: .leading, spacing: ax.space(2)) {
            Text("Delivery method").font(ax.fontLabel).foregroundStyle(ax.text)
            VStack(spacing: ax.space(2)) {
                ForEach(d.options, id: \.value) { option in
                    let selected = option.value == d.value
                    Button {
                        actions.set("delivery", .string(option.value))
                    } label: {
                        HStack(spacing: ax.space(3)) {
                            Circle()
                                .strokeBorder(selected ? ax.accent : ax.borderStrong, lineWidth: selected ? 5 : 1.5)
                                .background(Circle().fill(ax.surface))
                                .frame(width: 18 * min(ax.scale, 1.5), height: 18 * min(ax.scale, 1.5))
                            VStack(alignment: .leading, spacing: ax.hair) {
                                Text(option.label).font(ax.fontLabel).foregroundStyle(ax.text)
                                Text(option.window).font(ax.fontSmall).foregroundStyle(ax.textSecondary)
                                    .multilineTextAlignment(.leading)
                            }
                            .fixedSize(horizontal: false, vertical: true)
                            Spacer(minLength: ax.space(2))
                            Text(option.price).font(ax.fontLabel).foregroundStyle(ax.text)
                        }
                        .padding(ax.space(3))
                        .frame(minHeight: 44)
                        .background(
                            RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous)
                                .fill(selected ? ax.accentMuted.opacity(0.5) : ax.surface)
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous)
                                .strokeBorder(selected ? ax.accent : ax.borderStrong, lineWidth: selected ? 1.5 : 1)
                        )
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityElement(children: .combine)
                    .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
                }
            }
            if let error = model.errors["delivery"] { COSStatus(tone: .danger, message: error) }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Delivery method")
    }
}

// MARK: Step 4: payment

struct CheckoutPaymentStep: View {
    let model: CheckoutModel
    let actions: CheckoutSender
    let narrow: Bool
    var focus: FocusState<String?>.Binding
    @Environment(\.ax) private var ax

    var body: some View {
        let p = model.payment
        VStack(alignment: .leading, spacing: ax.space(5)) {
            StepHeading(title: "Payment", detail: "This template validates payment details and completes locally. No card is charged.")
            VStack(alignment: .leading, spacing: ax.space(4)) {
                FormText(
                    key: "cardNumber", label: "Card number", value: p.cardNumber, model: model,
                    placeholder: "4242 4242 4242 4242", content: .cardNumber, icon: "lock.fill", focus: focus
                )
                FormText(key: "cardName", label: "Name on card", value: p.cardName, model: model, content: .fullName, focus: focus)
                HStack(alignment: .top, spacing: ax.space(4)) {
                    FormText(key: "expiry", label: "Expiry", value: p.expiry, model: model, placeholder: "MM/YY", content: .cardExpiry, focus: focus)
                        .frame(maxWidth: 140)
                    FormText(
                        key: "cvc", label: "CVC", value: p.cvc, model: model, placeholder: "123", content: .cardCode,
                        info: "Three digits on the back of the card, or four on the front for American Express.", focus: focus
                    )
                    .frame(maxWidth: 140)
                    Spacer(minLength: 0)
                }
                AXDivider()
                COSSwitch(label: "Billing address matches the shipping address", isOn: p.billingMatches) {
                    actions.set("billingMatches", .bool($0))
                }
                if !p.billingMatches {
                    COSBanner(
                        tone: .info, symbol: "info.circle.fill", title: "Connect a billing-address step",
                        description: "This local example does not collect a separate billing address or send payment. Add that flow with your payment provider."
                    )
                }
            }
        }
    }
}
