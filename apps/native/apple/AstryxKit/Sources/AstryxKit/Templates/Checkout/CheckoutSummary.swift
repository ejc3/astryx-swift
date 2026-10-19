import SwiftUI

/// The order summary: items, totals and the free-shipping nudge, in a card. Beside the form it
/// is open and titled; stacked above it the title row becomes the collapsed trigger that
/// carries the total.
struct CheckoutSummary: View {
    let model: CheckoutModel
    let narrow: Bool
    @Environment(\.ax) private var ax

    var body: some View {
        Group {
            if narrow {
                COSCollapsible(startsOpen: false, spokenTitle: model.summary.trigger) {
                    Text(model.summary.trigger)
                        .font(ax.font("font-size-lg", 17, weight: "font-weight-semibold"))
                        .foregroundStyle(ax.text)
                } content: {
                    bodyContent
                }
            } else {
                VStack(alignment: .leading, spacing: ax.space(4)) {
                    HStack(spacing: ax.space(2)) {
                        Text(model.words.summary.title)
                            .font(ax.fontLabel)
                            .foregroundStyle(ax.text)
                            .accessibilityAddTraits(.isHeader)
                        Spacer(minLength: 0)
                        AXBadge(text: model.summary.itemCount, tone: .neutral)
                    }
                    bodyContent
                }
            }
        }
        .padding(ax.space(5))
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .axSurface(fill: ax.card, radius: ax.radiusContainer)
        .accessibilityElement(children: .contain)
    }

    private var bodyContent: some View {
        VStack(alignment: .leading, spacing: ax.space(4)) {
            VStack(alignment: .leading, spacing: ax.space(3)) {
                ForEach(model.items, id: \.id) { item in
                    HStack(alignment: .top, spacing: ax.space(3)) {
                        COSThumbnail(src: item.src, name: item.name, side: 48)
                        VStack(alignment: .leading, spacing: ax.hair) {
                            HStack(alignment: .top, spacing: ax.space(2)) {
                                Text(item.name).font(ax.fontLabel).foregroundStyle(ax.text)
                                Spacer(minLength: ax.space(2))
                                Text(item.lineTotal).font(ax.fontStrong).foregroundStyle(ax.text)
                            }
                            Text("\(item.variant) \u{B7} \(model.words.summary.qty) \(item.qty)")
                                .font(ax.fontSmall)
                                .foregroundStyle(ax.textSecondary)
                        }
                        .fixedSize(horizontal: false, vertical: true)
                    }
                    .accessibilityElement(children: .combine)
                }
            }
            AXDivider()
            totals
            if let title = model.summary.freeShippingTitle {
                COSBanner(tone: .info, symbol: "box.truck", title: title)
            }
        }
    }

    private var totals: some View {
        let s = model.summary
        return VStack(alignment: .leading, spacing: ax.space(2)) {
            row(model.words.summary.subtotal, s.subtotal)
            if let promo = s.promoLabel { row(promo, s.discount) }
            row("\(s.deliveryLabel) \(model.words.summary.deliverySuffix)", s.shipping)
            row(model.words.summary.tax, s.tax)
            AXDivider()
            HStack(alignment: .firstTextBaseline) {
                Text(model.words.summary.total).font(big).foregroundStyle(ax.text)
                Spacer(minLength: ax.space(2))
                Text(s.total).font(big).foregroundStyle(ax.text)
            }
            .accessibilityElement(children: .combine)
        }
    }

    private var big: Font { .system(size: ax.fontSize("font-size-lg", 17), weight: .bold) }

    private func row(_ label: String, _ value: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: ax.space(2)) {
            Text(label).font(ax.fontBase).foregroundStyle(ax.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: ax.space(2))
            Text(value).font(ax.fontBase).foregroundStyle(ax.text)
        }
        .accessibilityElement(children: .combine)
    }
}
