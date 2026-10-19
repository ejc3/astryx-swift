import SwiftUI

/// The revenue card: two figures, then the activity list with a "See all" link. The list fades
/// out over its last 48 points, as the web's does.
struct ShowRevenue: View {
    let revenue: ShowModel.Revenue
    @Environment(\.ax) private var ax
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        ShowCard(fill: { $0.surface }) {
            VStack(alignment: .leading, spacing: ax.space(4)) {
                Text(revenue.heading)
                    .font(ax.heading(2))
                    .foregroundStyle(ax.text)
                    .axLeading(ax, size: ax.fontSize("text-heading-2-size", 20), ratio: ax.headingLeading(2))
                    .accessibilityAddTraits(.isHeader)
                // Two figures in a grid of two columns (one at the sizes where a column cannot hold a figure).
                if typeSize.isAccessibilitySize {
                    VStack(alignment: .leading, spacing: ax.space(3)) { figures }
                } else {
                    HStack(alignment: .top, spacing: ax.space(3)) { figures }
                }
                Rectangle().fill(ax.border).frame(height: 1)
                HStack {
                    Text(revenue.activityHeading)
                        .font(ax.heading(3))
                        .foregroundStyle(ax.text)
                        .axLeading(ax, size: ax.fontSize("text-heading-3-size", 17), ratio: ax.headingLeading(3))
                        .accessibilityAddTraits(.isHeader)
                    Spacer(minLength: ax.space(2))
                    Button {} label: { Text(revenue.seeAll).font(ax.fontBase).foregroundStyle(ax.accent).axTapTarget(keepLayout: true) }
                        .buttonStyle(.plain)
                }
                VStack(spacing: ax.space(1)) {
                    ForEach(revenue.items) { item in
                        ShowActivityRow(item: item)
                    }
                }
                .mask {
                    VStack(spacing: 0) {
                        Rectangle().fill(.black)
                        LinearGradient(colors: [.black, .clear], startPoint: .top, endPoint: .bottom).frame(height: 48)
                    }
                }
            }
        }
        .accessibilityElement(children: .contain)
    }

    @ViewBuilder
    private var figures: some View {
        ForEach(Array(revenue.kpis.enumerated()), id: \.offset) { _, kpi in
            VStack(alignment: .leading, spacing: 0) {
                // 24 on 1.1, bold, in the heading face.
                Text(kpi.value)
                    .font(.system(size: ax.fontSize("font-size-2xl", 24), weight: ax.weight(700)).monospacedDigit())
                    .foregroundStyle(ax.text)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                    .frame(minHeight: ax.fontSize("font-size-2xl", 24) * 1.1)
                Text(kpi.label).font(ax.fontSmall).foregroundStyle(ax.textSecondary)
                    .axLeading(ax, size: ax.fontSize("font-size-sm", 12), ratio: ax.supportingLeading)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityElement(children: .combine)
        }
    }
}

private struct ShowActivityRow: View {
    let item: ShowModel.Revenue.Item
    @Environment(\.ax) private var ax
    @Environment(\.dynamicTypeSize) private var typeSize
    @State private var hovering = false

    var body: some View {
        // The web's activity rows are links: a hover ground and a pointer. They go nowhere.
        Button {} label: {
            HStack(spacing: ax.space(2)) {
                Image(systemName: ShowModel.symbol(item.icon))
                    .font(.system(size: ax.fontSize("font-size-sm", 12) * 1.1))
                    .foregroundStyle(ax.textSecondary)
                    .frame(width: 32 * min(ax.scale, 1.4), height: 32 * min(ax.scale, 1.4))
                    .background(Circle().fill(ax.muted))
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 0) {
                    // An activity's name and detail are what the row is; they wrap at the sizes where one
                    // line would cut them to a few letters.
                    Text(item.label).font(ax.fontBase).foregroundStyle(ax.text).lineLimit(typeSize.isAccessibilitySize ? nil : 1)
                        .axLeading(ax, size: ax.fontSize("font-size-base", 14), ratio: ax.bodyLeading)
                    Text(item.detail).font(ax.fontSmall).foregroundStyle(ax.textSecondary).lineLimit(typeSize.isAccessibilitySize ? nil : 1)
                        .axLeading(ax, size: ax.fontSize("font-size-sm", 12), ratio: ax.supportingLeading)
                }
                Spacer(minLength: ax.space(1))
                Text(item.amount)
                    .font(ax.font("font-size-base", 14, weight: "font-weight-bold").monospacedDigit())
                    .foregroundStyle(item.isMuted ? ax.textSecondary : ax.text)
            }
            .padding(.vertical, ax.space(1) + 1)
            .background(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).fill(hovering ? ax.overlayHover : .clear))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .onHover { hovering = $0 }
        .accessibilityElement(children: .combine)
    }
}
