import SwiftUI

/// Astryx's theme-showcase template, drawn natively from the core's view model
/// (core/src/templates/showcase/model.ts, its `View` type): a store page (navigation, hero,
/// three products) over a panel of cards (checkout, support chat, revenue, inventory).
///
/// The stock template is a static preview of a theme, so the core ignores every action; the
/// controls still send them, with the ids the web sends (`tpl.showcase.<what>`):
/// - `set` email, card, expiry, cvc, search, chatDraft: the text as you type
/// - `set` shipping, payment, country: the option's value
/// - `set` saveInfo: a Bool; `set` select.<row id>: a Bool; `set` filter.<label>: the option
/// - `press` chatSend: Return in the chat composer
/// Buttons the web gives no handler (Add to cart, Pay now, Sign in, View all...) send nothing; the
/// core lists them in `inert` and they are drawn disabled.
struct ShowcaseTemplate: View {
    let view: JSONValue

    var body: some View {
        if let model = try? view.decode(ShowModel.self) {
            ShowContent(model: model)
                .environment(\.showInert, (try? view.decode(ShowInert.self))?.inert ?? [])
        } else {
            AXTemplatePlaceholder(template: "showcase")
        }
    }
}

/// `view.inert`: the controls the core keeps inert.
private struct ShowInert: Decodable {
    let inert: Set<String>
}

private struct ShowContent: View {
    let model: ShowModel
    @Environment(\.ax) private var ax
    @Environment(\.axWidth) private var width

    var body: some View {
        let pad = width < 600 ? ax.space(4) : ax.space(6)
        let inner = width - 2 * pad
        VStack(alignment: .leading, spacing: ax.space(8)) {
            ShowStore(nav: model.nav, hero: model.hero, products: model.products)
            VStack(alignment: .leading, spacing: ax.space(6)) {
                cardRow(inner: inner)
                reportRow(inner: inner)
            }
            .padding(pad)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: ax.radiusContainer + 4, style: .continuous).fill(ax.surface))
            .overlay(RoundedRectangle(cornerRadius: ax.radiusContainer + 4, style: .continuous).strokeBorder(ax.border, lineWidth: 1))
            .environment(\.axWidth, inner)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// Checkout beside the chat when both fit (300 and 520 points, as the web's flex bases).
    @ViewBuilder
    private func cardRow(inner: CGFloat) -> some View {
        let gap = ax.space(4)
        if inner >= 300 + 520 + gap {
            let checkout = (inner - gap) / 3
            HStack(alignment: .top, spacing: gap) {
                ShowCheckout(checkout: model.checkout)
                    .environment(\.axWidth, checkout)
                    .frame(width: checkout)
                ShowChat(chat: model.chat)
                    .environment(\.axWidth, inner - gap - checkout)
                    .frame(maxWidth: .infinity)
            }
        } else {
            VStack(alignment: .leading, spacing: gap) {
                ShowCheckout(checkout: model.checkout)
                ShowChat(chat: model.chat)
            }
        }
    }

    /// Inventory (three quarters) beside revenue (one quarter), stacked on a narrow screen.
    @ViewBuilder
    private func reportRow(inner: CGFloat) -> some View {
        let gap = ax.space(4)
        if inner >= 860 {
            let revenue = min(max(inner * 0.3, 260), 340)
            HStack(alignment: .top, spacing: gap) {
                ShowInventory(inventory: model.inventory)
                    .environment(\.axWidth, inner - gap - revenue)
                    .frame(maxWidth: .infinity)
                ShowRevenue(revenue: model.revenue)
                    .environment(\.axWidth, revenue)
                    .frame(width: revenue)
            }
        } else {
            VStack(alignment: .leading, spacing: gap) {
                ShowInventory(inventory: model.inventory)
                ShowRevenue(revenue: model.revenue)
            }
        }
    }
}

// MARK: Store: navigation, hero, products

private struct ShowStore: View {
    let nav: ShowModel.Nav
    let hero: ShowModel.Hero
    let products: [ShowModel.Product]
    @Environment(\.ax) private var ax
    @Environment(\.axWidth) private var width

    var body: some View {
        VStack(alignment: .leading, spacing: ax.space(8)) {
            ShowNav(nav: nav)
            VStack(spacing: ax.space(10)) {
                ShowHero(hero: hero)
                ShowProducts(products: products)
            }
            .frame(maxWidth: 880)
            .frame(maxWidth: .infinity)
        }
    }
}

private struct ShowNav: View {
    let nav: ShowModel.Nav
    @Environment(\.ax) private var ax
    @Environment(\.axWidth) private var width
    @Environment(\.showInert) private var inert
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        let wide = width >= 640 && !typeSize.isAccessibilitySize
        VStack(alignment: .leading, spacing: ax.space(2)) {
            if typeSize.isAccessibilitySize {
                // One row cannot hold the name, three icons and Sign in at this size: each group
                // gets as many rows as it needs.
                Text(nav.heading)
                    .font(ax.heading(2))
                    .foregroundStyle(ax.text)
                    .accessibilityAddTraits(.isHeader)
                FlowLayout(spacing: ax.hair) {
                    actions
                    signIn
                }
                items
            } else {
                HStack(spacing: ax.space(3)) {
                    Text(nav.heading)
                        .font(ax.heading(2))
                        .foregroundStyle(ax.text)
                        .accessibilityAddTraits(.isHeader)
                    if wide {
                        Spacer(minLength: ax.space(4))
                        items
                        Spacer(minLength: ax.space(4))
                    } else {
                        Spacer(minLength: ax.space(2))
                    }
                    HStack(spacing: ax.hair) { actions }
                    signIn
                }
                if !wide { items }
            }
            Rectangle().fill(ax.border).frame(height: 1).padding(.top, ax.space(2))
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(nav.label)
    }

    @ViewBuilder
    private var actions: some View {
        ForEach(Array(nav.actions.enumerated()), id: \.offset) { _, action in
            ShowIconButton(symbol: ShowModel.symbol(action.icon), label: action.label, inert: "navActions")
        }
    }

    private var signIn: some View {
        Button {} label: { Text(nav.signIn).lineLimit(typeSize.isAccessibilitySize ? nil : 1) }
            .buttonStyle(AXButtonStyle(variant: .primary, ax: ax))
            .disabled(inert.contains("signIn"))
    }

    private var items: some View {
        FlowLayout(spacing: ax.space(1)) {
            ForEach(Array(nav.items.enumerated()), id: \.offset) { _, item in
                Button {} label: {
                    Text(item.label)
                        .font(item.isSelected ? ax.fontStrong : ax.fontLabel)
                        .foregroundStyle(item.isSelected ? ax.tone(.accent).text : ax.textSecondary)
                        .padding(.horizontal, ax.space(3))
                        .padding(.vertical, ax.space(2))
                        .background(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).fill(item.isSelected ? ax.accentMuted : .clear))
                        .contentShape(Rectangle())
                        .axTapTarget(keepLayout: true)
                }
                .buttonStyle(.plain)
                .disabled(inert.contains("navItems"))
                .accessibilityAddTraits(item.isSelected ? [.isSelected, .isButton] : .isButton)
            }
        }
    }
}

private struct ShowHero: View {
    let hero: ShowModel.Hero
    @Environment(\.ax) private var ax

    var body: some View {
        VStack(spacing: ax.space(4)) {
            Text(hero.lines.joined(separator: "\n"))
                .font(.system(size: ax.fontSize("font-size-4xl", 35), weight: ax.weight(700)))
                .foregroundStyle(ax.tone(.accent).text)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityLabel(hero.lines.joined(separator: " "))
                .accessibilityAddTraits(.isHeader)
            Text(hero.body)
                .font(ax.fontBase)
                .foregroundStyle(ax.textSecondary)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: 560)
        .padding(.top, ax.space(2))
    }
}

private struct ShowProducts: View {
    let products: [ShowModel.Product]
    @Environment(\.ax) private var ax
    @Environment(\.axWidth) private var width

    var body: some View {
        let gap = ax.space(4)
        let columns = max(1, min(3, Int((width + gap) / (200 + gap))))
        let single = columns == 1 || width < 480
        let count = single ? 1 : columns
        LazyVGrid(
            columns: Array(repeating: GridItem(.flexible(minimum: 0), spacing: gap, alignment: .top), count: count),
            alignment: .leading,
            spacing: gap
        ) {
            ForEach(products) { ShowProductCard(product: $0, photoHeight: (width - gap * CGFloat(count - 1)) / CGFloat(count) / (count == 1 ? 1.8 : 1.15)) }
        }
    }
}

private struct ShowProductCard: View {
    let product: ShowModel.Product
    let photoHeight: CGFloat
    @State private var quantity: Int
    @Environment(\.ax) private var ax
    @Environment(\.showInert) private var inert
    @Environment(\.dynamicTypeSize) private var typeSize

    init(product: ShowModel.Product, photoHeight: CGFloat) {
        self.product = product
        self.photoHeight = photoHeight
        _quantity = State(initialValue: Int(product.quantity.value))
    }

    private func addButton(lines: Int?) -> some View {
        Button {} label: {
            Text(product.addLabel).lineLimit(lines).minimumScaleFactor(lines == nil ? 1 : 0.8).frame(maxWidth: .infinity)
        }
        .buttonStyle(AXButtonStyle(variant: .secondary, ax: ax))
        .disabled(inert.contains("addToCart"))
    }

    var body: some View {
        VStack(spacing: 0) {
            ShowPhoto(height: photoHeight)
            VStack(spacing: ax.space(2)) {
                ShowBadge(text: product.badge, variant: product.badgeVariant)
                Text(product.name)
                    .font(ax.heading(2))
                    .foregroundStyle(ax.text)
                    .multilineTextAlignment(.center)
                    .accessibilityAddTraits(.isHeader)
                Text(product.description)
                    .font(ax.fontSmall)
                    .foregroundStyle(ax.textSecondary)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxHeight: .infinity, alignment: .top)
                // Side by side, or one over the other at the text sizes where they cannot share a line.
                if typeSize.isAccessibilitySize {
                    VStack(spacing: ax.space(2)) {
                        ShowQuantity(label: product.quantity.label, value: $quantity, range: Int(product.quantity.min)...Int(product.quantity.max))
                        addButton(lines: nil)
                    }
                    .padding(.top, ax.space(1))
                } else {
                    HStack(spacing: ax.space(2)) {
                        ShowQuantity(label: product.quantity.label, value: $quantity, range: Int(product.quantity.min)...Int(product.quantity.max))
                        addButton(lines: 1)
                    }
                    .padding(.top, ax.space(1))
                }
            }
            .padding(ax.space(4))
            .frame(maxHeight: .infinity, alignment: .top)
        }
        .frame(maxWidth: .infinity)
        .axSurface(fill: ax.card, radius: ax.radiusContainer)
        .clipShape(RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous))
        .accessibilityElement(children: .contain)
    }
}

/// A quantity with minus and plus, adjustable by VoiceOver's swipe up and down.
private struct ShowQuantity: View {
    let label: String
    @Binding var value: Int
    let range: ClosedRange<Int>
    @Environment(\.ax) private var ax

    var body: some View {
        HStack(spacing: 0) {
            step("minus", enabled: value > range.lowerBound) { value -= 1 }
            Text("\(value)")
                .font(ax.fontLabel.monospacedDigit())
                .foregroundStyle(ax.text)
                .frame(minWidth: 22)
            step("plus", enabled: value < range.upperBound) { value += 1 }
        }
        .background(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).fill(ax.surface))
        .overlay(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).strokeBorder(ax.borderStrong, lineWidth: 1))
        .fixedSize()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
        .accessibilityValue("\(value)")
        .accessibilityAdjustableAction { direction in
            switch direction {
            case .increment: if value < range.upperBound { value += 1 }
            case .decrement: if value > range.lowerBound { value -= 1 }
            @unknown default: break
            }
        }
    }

    private func step(_ symbol: String, enabled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: ax.fontSize("font-size-sm", 12), weight: .semibold))
                .foregroundStyle(enabled ? ax.text : ax.textDisabled)
                .frame(width: 30 * min(ax.scale, 1.4), height: 34 * min(ax.scale, 1.4))
                .contentShape(Rectangle())
                // Drawn 30 by 34 pt inside the stepper; 44 by 44 pt to tap.
                .axTapTarget(keepLayout: true)
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
    }
}
