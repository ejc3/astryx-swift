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
    var infoLabel: String? = nil
    var icon: String? = nil
    var focus: FocusState<String?>.Binding

    var body: some View {
        // Return moves to the next text field of the step; the last one puts the keyboard away.
        let next = model.fieldAfter(key)
        COSField(label: label, optional: optional, hint: hint, error: model.errors[key], info: info, infoLabel: infoLabel) {
            COSTextBox(
                id: CheckoutSender.id(key), label: label, value: value, placeholder: placeholder,
                content: content, icon: icon, hasError: model.errors[key] != nil,
                focusKey: key, focus: focus, submitLabel: next == nil ? .done : .next
            ) { focus.wrappedValue = next }
        }
    }
}

// MARK: Step 1: the cart

struct CheckoutCartStep: View {
    let model: CheckoutModel
    let actions: CheckoutSender
    var focus: FocusState<String?>.Binding? = nil
    @Environment(\.ax) private var ax
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        VStack(alignment: .leading, spacing: ax.space(5)) {
            StepHeading(title: model.words.cart.heading)
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
                    if item.isLimited { AXBadge(text: model.words.cart.limited, tone: .success) }
                    Text(item.lineTotal).font(ax.fontStrong).foregroundStyle(ax.text)
                }
            } else {
                HStack(alignment: .top, spacing: ax.space(2)) {
                    HStack(alignment: .firstTextBaseline, spacing: ax.space(2)) {
                        Text(item.name).font(ax.fontLabel).foregroundStyle(ax.text)
                            .fixedSize(horizontal: false, vertical: true)
                        if item.isLimited { AXBadge(text: model.words.cart.limited, tone: .success) }
                    }
                    Spacer(minLength: ax.space(2))
                    Text(item.lineTotal).font(ax.fontStrong).foregroundStyle(ax.text)
                }
            }
            Text("\(item.variant) \u{B7} \(item.priceEach) each")
                .font(ax.fontSmall)
                .foregroundStyle(ax.textSecondary)
                .axLeading(ax, size: ax.fontSize("font-size-sm", 12), ratio: ax.supportingLeading)
                .fixedSize(horizontal: false, vertical: true)
            ViewThatFits(in: .horizontal) {
                HStack(spacing: ax.space(2)) { quantity(item); remove(item) }
                VStack(alignment: .leading, spacing: ax.space(2)) { quantity(item); remove(item) }
            }
            .padding(.top, ax.space(1))
        }
        if stacked {
            VStack(alignment: .leading, spacing: ax.space(3)) {
                COSThumbnail(src: item.src, name: item.name, side: 64)
                details
            }
        } else {
            HStack(alignment: .top, spacing: ax.space(4)) {
                COSThumbnail(src: item.src, name: item.name, side: 64)
                details
            }
        }
    }

    private func quantity(_ item: CheckoutModel.Item) -> some View {
        CheckoutQuantity(
            label: item.quantityLabel, field: model.words.cart.quantity, qty: item.qty, focusKey: "qty:\(item.id)", focus: focus
        ) { actions.set("qty:\(item.id)", .number(Double($0))) }
    }

    private func remove(_ item: CheckoutModel.Item) -> some View {
        COSButton(label: model.words.cart.remove, variant: .ghost) { actions.press("remove:\(item.id)") }
            .accessibilityLabel(item.removeLabel)
    }

    /// The code and its Apply button level with the box; the status sits under the pair.
    private var promo: some View {
        VStack(alignment: .leading, spacing: ax.space(1)) {
            Text(model.words.cart.promoLabel).font(ax.fontLabel).foregroundStyle(ax.textSecondary)
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
            id: CheckoutSender.id("promo"), label: model.words.cart.promoLabel, value: model.promo.value,
            placeholder: model.words.cart.promoPlaceholder, content: .code, hasError: false,
            focusKey: "promo", focus: focus, submitLabel: .done
        ) { actions.press("apply") }
    }

    private var applyButton: some View {
        COSButton(label: model.words.cart.apply, variant: .secondary) { actions.press("apply") }
    }
}

/// A quantity, 0 to 10, as the web field: a number you can type. On the Mac the number sits in a
/// box with the system's up and down arrows at its right (HIG Steppers: a text field beside a
/// stepper); on a touch screen it is minus, the number and plus. VoiceOver adjusts it with swipes
/// up and down.
struct CheckoutQuantity: View {
    /// The spoken name, "Quantity of <name>", and the field's own name ("Quantity").
    let label: String
    let field: String
    let qty: Int
    var focusKey: String? = nil
    var focus: FocusState<String?>.Binding? = nil
    let change: (Int) -> Void
    @State private var text: String
    @FocusState private var ownFocus: Bool
    @Environment(\.ax) private var ax
    @Environment(\.axStatic) private var isStatic

    init(
        label: String, field: String, qty: Int, focusKey: String? = nil, focus: FocusState<String?>.Binding? = nil,
        change: @escaping (Int) -> Void
    ) {
        self.label = label; self.field = field; self.qty = qty; self.focusKey = focusKey; self.focus = focus
        self.change = change
        _text = State(initialValue: String(qty))
    }

    var body: some View {
        let side = axControlHeight(ax)
        let shape = RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous)
        #if os(macOS)
        HStack(spacing: 0) {
            number
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.leading, ax.space(3))
            arrows
                .padding(.trailing, ax.space(2))
        }
        .frame(width: 96 * min(ax.scale, 1.4), height: side)
        .background(shape.fill(ax.surface))
        .overlay(shape.strokeBorder(ax.border, lineWidth: 1))
        .modifier(quantityBehaviour)
        #else
        HStack(spacing: 0) {
            stepper("minus", enabled: qty > 0) { change(max(qty - 1, 0)) }
            number
                .multilineTextAlignment(.center)
                .frame(width: 40 * min(ax.scale, 1.4), height: side)
            stepper("plus", enabled: qty < 10) { change(min(qty + 1, 10)) }
        }
        .background(shape.fill(ax.surface))
        .overlay(shape.strokeBorder(ax.border, lineWidth: 1))
        .fixedSize()
        .modifier(quantityBehaviour)
        #endif
    }

    /// Typing sends the new number; the model's own change shows in the box; VoiceOver adjusts.
    private var quantityBehaviour: some ViewModifier {
        QuantityBehaviour(
            text: $text, qty: qty, label: label, change: change
        )
    }

    private var number: some View {
        Group {
            if isStatic {
                Text(text)
            } else {
                TextField(field, text: $text)
                    .textFieldStyle(.plain)
                    .cosContent(.integer)
                    .modifier(CheckoutQuantityFocus(binding: focus, key: focusKey, own: $ownFocus))
            }
        }
        .font(ax.fontBase.monospacedDigit())
        .foregroundStyle(ax.text)
    }

    #if os(macOS)
    /// The system's up and down arrows (a picture draws them by hand).
    @ViewBuilder
    private var arrows: some View {
        if isStatic {
            Image(systemName: "chevron.up.chevron.down")
                .font(.system(size: ax.fontSize("font-size-xs", 10), weight: .semibold))
                .foregroundStyle(ax.iconSecondary)
        } else {
            Stepper(label, value: Binding(get: { qty }, set: { change($0) }), in: 0...10)
                .labelsHidden()
        }
    }
    #else
    private func stepper(_ symbol: String, enabled: Bool, action: @escaping () -> Void) -> some View {
        let side = axControlHeight(ax)
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
    #endif
}

/// What a quantity does besides draw: typing changes it, the model's own change shows in the
/// box, and VoiceOver adjusts it with swipes up and down.
private struct QuantityBehaviour: ViewModifier {
    @Binding var text: String
    let qty: Int
    let label: String
    let change: (Int) -> Void

    func body(content: Content) -> some View {
        content
            .onChange(of: text) { _, new in
                if let value = Int(new), (0...10).contains(value), value != qty { change(value) }
            }
            .onChange(of: qty) { _, new in
                if Int(text) != new { text = String(new) }
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(label)
            .accessibilityValue("\(qty)")
            .accessibilityAdjustableAction { direction in
                switch direction {
                case .increment: if qty < 10 { change(qty + 1) }
                case .decrement: if qty > 0 { change(qty - 1) }
                @unknown default: break
                }
            }
    }
}

/// Puts the quantity's number field in the form's focus order, or in a focus of its own.
private struct CheckoutQuantityFocus: ViewModifier {
    let binding: FocusState<String?>.Binding?
    let key: String?
    let own: FocusState<Bool>.Binding

    func body(content: Content) -> some View {
        if let binding, let key {
            content.focused(binding, equals: key)
        } else {
            content.focused(own)
        }
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
        let w = model.words.shipping
        VStack(alignment: .leading, spacing: ax.space(5)) {
            StepHeading(title: w.heading, detail: w.detail)
            VStack(alignment: .leading, spacing: ax.space(4)) {
                FormText(
                    key: "email", label: w.email, value: s.email, model: model, placeholder: w.emailPlaceholder,
                    content: .email, hint: w.emailHint, focus: focus
                )
                FieldRow(narrow: narrow) {
                    FormText(key: "firstName", label: w.firstName, value: s.firstName, model: model, content: .givenName, focus: focus)
                    FormText(key: "lastName", label: w.lastName, value: s.lastName, model: model, content: .familyName, focus: focus)
                }
                COSField(label: w.country) {
                    COSSelect(
                        label: w.country,
                        choices: s.countries.map { .init(value: $0.value, label: $0.label) },
                        value: s.country
                    ) { actions.set("country", .string($0)) }
                }
                FormText(key: "address", label: w.address, value: s.address, model: model, placeholder: w.addressPlaceholder, content: .street, focus: focus)
                FormText(key: "apartment", label: w.apartment, value: s.apartment, model: model, content: .street2, optional: true, focus: focus)
                FieldRow(narrow: narrow) {
                    FormText(key: "city", label: w.city, value: s.city, model: model, content: .city, focus: focus)
                    if s.hasState {
                        COSField(label: w.state, error: model.errors["state"]) {
                            COSSelect(
                                label: w.state,
                                choices: s.states.map { .init(value: $0, label: $0) },
                                value: s.state,
                                placeholder: w.statePlaceholder,
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
            StepHeading(title: model.words.delivery.heading, detail: model.words.delivery.detail)
            VStack(alignment: .leading, spacing: ax.space(4)) {
                methods
                AXDivider()
                COSCheckbox(label: model.words.delivery.gift, isOn: d.isGift) { actions.set("isGift", .bool($0)) }
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
            Text(model.words.delivery.method).font(ax.fontLabel).foregroundStyle(ax.text)
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
        .accessibilityLabel(model.words.delivery.method)
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
        let w = model.words.payment
        VStack(alignment: .leading, spacing: ax.space(5)) {
            StepHeading(title: w.heading, detail: w.detail)
            VStack(alignment: .leading, spacing: ax.space(4)) {
                FormText(
                    key: "cardNumber", label: w.cardNumber, value: p.cardNumber, model: model,
                    placeholder: w.cardNumberPlaceholder, content: .cardNumber, icon: "lock.fill", focus: focus
                )
                FormText(key: "cardName", label: w.cardName, value: p.cardName, model: model, content: .fullName, focus: focus)
                HStack(alignment: .top, spacing: ax.space(4)) {
                    FormText(key: "expiry", label: w.expiry, value: p.expiry, model: model, placeholder: w.expiryPlaceholder, content: .cardExpiry, focus: focus)
                        .frame(maxWidth: 140)
                    FormText(
                        key: "cvc", label: w.cvc, value: p.cvc, model: model, placeholder: w.cvcPlaceholder, content: .cardCode,
                        info: w.cvcInfo, infoLabel: w.cvcInfoLabel, focus: focus
                    )
                    .frame(maxWidth: 140)
                    Spacer(minLength: 0)
                }
                AXDivider()
                COSCheckbox(label: w.billingMatches, isOn: p.billingMatches) {
                    actions.set("billingMatches", .bool($0))
                }
                if !p.billingMatches {
                    COSBanner(tone: .info, symbol: "info.circle.fill", title: w.billingTitle, description: w.billingDetail)
                }
            }
        }
    }
}
