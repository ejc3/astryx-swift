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
/// - `press` chatSend: Return, or the send button, in the chat composer
/// Every control draws the core's value, which the core never changes, so a click leaves the
/// picture as it was, as on the web. Buttons the web gives no handler (Add to cart, Pay now, Sign
/// in, View all...) send nothing; the core lists them in `inert`, and they are drawn enabled
/// like the web's.
///
/// The template owns its padding (the screen adds none): the top navigation runs to the edges,
/// the store is padded 24, and the cards sit on a full-width band padded 24, as the web's.
struct ShowcaseTemplate: View {
    let view: JSONValue

    var body: some View {
        if let model = try? view.decode(ShowModel.self) {
            ShowContent(model: model)
        } else {
            AXTemplatePlaceholder(template: "showcase")
        }
    }
}

private struct ShowContent: View {
    let model: ShowModel
    @Environment(\.ax) private var ax
    @Environment(\.axWidth) private var width

    var body: some View {
        let pad = ax.space(6)
        let inner = max(width - 2 * pad, 0)
        VStack(alignment: .leading, spacing: 0) {
            ShowStore(nav: model.nav, hero: model.hero, products: model.products, pageWidth: width)
            VStack(alignment: .leading, spacing: ax.space(8)) {
                cardRow(inner: inner)
                reportRow(inner: inner)
            }
            .padding(pad)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(ax.surface)
            .environment(\.axWidth, inner)
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .background(ax.page)
    }

    /// Checkout beside the chat when both fit: flex bases of 300 and 520 points growing 1 to 2;
    /// else one under the other, each the full width.
    @ViewBuilder
    private func cardRow(inner: CGFloat) -> some View {
        let gap = ax.space(4)
        if inner >= 300 + 520 + gap {
            let checkout = 300 + (inner - gap - 820) / 3
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

    /// The web's grid `{ minWidth: 200, repeat: fit }`: Inventory spans three columns and Revenue
    /// takes one. With room for four, they share a row; with three, Revenue is one column wide
    /// under Inventory; narrower, both take the whole width.
    @ViewBuilder
    private func reportRow(inner: CGFloat) -> some View {
        let gap = ax.space(4)
        let columns = max(Int((inner + gap) / (200 + gap)), 1)
        let column = (inner - CGFloat(columns - 1) * gap) / CGFloat(columns)
        if columns >= 4 {
            let inventory = 3 * column + 2 * gap
            HStack(alignment: .top, spacing: gap) {
                ShowInventory(inventory: model.inventory)
                    .environment(\.axWidth, inventory)
                    .frame(width: inventory)
                ShowRevenue(revenue: model.revenue)
                    .environment(\.axWidth, column)
                    .frame(width: column)
            }
        } else if columns == 3 {
            VStack(alignment: .leading, spacing: gap) {
                ShowInventory(inventory: model.inventory)
                ShowRevenue(revenue: model.revenue)
                    .environment(\.axWidth, column)
                    .frame(width: column)
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
    let pageWidth: CGFloat
    @Environment(\.ax) private var ax

    var body: some View {
        let pad = ax.space(6)
        VStack(alignment: .leading, spacing: 0) {
            ShowNav(nav: nav)
            VStack(spacing: ax.space(10)) {
                ShowHero(hero: hero)
                ShowProducts(products: products, width: min(max(pageWidth - 2 * pad, 0), 880))
            }
            .frame(maxWidth: 880)
            .frame(maxWidth: .infinity)
            .padding(pad)
        }
    }
}

private struct ShowNav: View {
    let nav: ShowModel.Nav
    @Environment(\.ax) private var ax
    @Environment(\.axWidth) private var width
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
        }
        .padding(.horizontal, ax.space(4))
        .padding(.vertical, ax.space(2))
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .contain)
        .accessibilityLabel(nav.label)
    }

    @ViewBuilder
    private var actions: some View {
        ForEach(Array(nav.actions.enumerated()), id: \.offset) { _, action in
            ShowIconButton(symbol: ShowModel.symbol(action.icon), label: action.label)
        }
    }

    private var signIn: some View {
        Button {} label: { Text(nav.signIn).lineLimit(typeSize.isAccessibilitySize ? nil : 1) }
            .buttonStyle(AXButtonStyle(variant: .primary, ax: ax))
    }

    private var items: some View {
        FlowLayout(spacing: ax.space(1)) {
            ForEach(Array(nav.items.enumerated()), id: \.offset) { _, item in
                Button {} label: {
                    Text(item.label)
                        .font(item.isSelected ? ax.fontStrong : ax.fontLabel)
                        .foregroundStyle(item.isSelected ? ax.text : ax.textSecondary)
                        .padding(.horizontal, ax.space(3))
                        .frame(minHeight: 32 * min(ax.scale, 1.4))
                        .background(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).fill(item.isSelected ? ax.color("color-neutral") : .clear))
                        .contentShape(Rectangle())
                        .axTapTarget(keepLayout: true)
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(item.isSelected ? [.isSelected, .isButton] : .isButton)
            }
        }
    }
}

private struct ShowHero: View {
    let hero: ShowModel.Hero
    @Environment(\.ax) private var ax

    var body: some View {
        // `display-2`: 35 on 44, regular weight, in the accent.
        let size = ax.fontSize("font-size-4xl", 35)
        VStack(spacing: ax.space(4)) {
            Text(hero.lines.joined(separator: "\n"))
                .font(.system(size: size, weight: ax.weight(Int(ax.size("text-display-2-weight", 400)))))
                .foregroundStyle(ax.tone(.accent).text)
                .multilineTextAlignment(.center)
                .axLeading(ax, size: size, ratio: ax.size("text-display-2-leading", 1.2571))
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityLabel(hero.lines.joined(separator: " "))
                .accessibilityAddTraits(.isHeader)
            Text(hero.body)
                .font(ax.fontBase)
                .foregroundStyle(ax.textSecondary)
                .multilineTextAlignment(.center)
                .axLeading(ax, size: ax.fontSize("font-size-base", 14), ratio: ax.bodyLeading)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: 560)
    }
}

private struct ShowProducts: View {
    let products: [ShowModel.Product]
    let width: CGFloat
    @Environment(\.ax) private var ax

    var body: some View {
        // The web's grid `{ minWidth: 200, max: 3 }`, one column on a phone.
        let gap = ax.space(4)
        let count = width < 480 ? 1 : max(1, min(3, Int((width + gap) / (200 + gap))))
        // The photo is square, as wide as its column.
        let column = (width - gap * CGFloat(count - 1)) / CGFloat(count)
        LazyVGrid(
            columns: Array(repeating: GridItem(.flexible(minimum: 0), spacing: gap, alignment: .top), count: count),
            alignment: .leading,
            spacing: gap
        ) {
            ForEach(products) { ShowProductCard(product: $0, photoHeight: column) }
        }
    }
}

private struct ShowProductCard: View {
    let product: ShowModel.Product
    let photoHeight: CGFloat
    @Environment(\.ax) private var ax

    private var addButton: some View {
        Button {} label: {
            Text(product.addLabel).lineLimit(1).frame(maxWidth: .infinity)
        }
        .buttonStyle(AXButtonStyle(variant: .secondary, ax: ax, small: true))
    }

    private var quantity: some View {
        ShowQuantity(label: product.quantity.label, value: product.quantity.value)
    }

    var body: some View {
        let supporting = ax.fontSize("font-size-sm", 12)
        VStack(spacing: 0) {
            ShowPhoto(height: photoHeight, image: product.image)
            VStack(spacing: ax.space(2)) {
                ShowBadge(text: product.badge, variant: product.badgeVariant)
                Text(product.name)
                    .font(ax.heading(2))
                    .foregroundStyle(ax.text)
                    .multilineTextAlignment(.center)
                    .axLeading(ax, size: ax.fontSize("text-heading-2-size", 20), ratio: ax.headingLeading(2))
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityAddTraits(.isHeader)
                Text(product.description)
                    .font(ax.fontSmall)
                    .foregroundStyle(ax.textSecondary)
                    .multilineTextAlignment(.center)
                    .axLeading(ax, size: supporting, ratio: ax.supportingLeading)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxHeight: .infinity, alignment: .top)
                // Side by side, or one over the other where they cannot share a line.
                ViewThatFits(in: .horizontal) {
                    HStack(spacing: ax.space(2)) {
                        quantity
                        addButton
                    }
                    VStack(spacing: ax.space(2)) {
                        quantity
                        addButton
                    }
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

/// The quantity, as Astryx's small NumberInput draws it: a 72 point field showing the number. The
/// core holds it and the stock page's input has no handler, so it shows the core's value.
private struct ShowQuantity: View {
    let label: String
    let value: Double
    @Environment(\.ax) private var ax

    var body: some View {
        Text(ShowCount.text(value))
            .font(ax.fontBase.monospacedDigit())
            .foregroundStyle(ax.text)
            .padding(.horizontal, ax.space(3))
            .frame(width: 72, alignment: .leading)
            .frame(minHeight: max(axMinTarget, 28 * min(ax.scale, 1.4)))
            .background(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).fill(ax.surface))
            .overlay(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).strokeBorder(ax.borderStrong, lineWidth: 1))
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(label)
            .accessibilityValue(ShowCount.text(value))
    }
}
