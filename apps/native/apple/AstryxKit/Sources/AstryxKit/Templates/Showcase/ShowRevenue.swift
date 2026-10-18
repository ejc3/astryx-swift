import SwiftUI

/// The revenue card: two figures, then the activity list with a "See all" link.
struct ShowRevenue: View {
    let revenue: ShowModel.Revenue
    @Environment(\.ax) private var ax
    @Environment(\.axWidth) private var width

    var body: some View {
        ShowCard(fill: { $0.surface }) {
            VStack(alignment: .leading, spacing: ax.space(4)) {
                Text(revenue.heading)
                    .font(ax.heading(2))
                    .foregroundStyle(ax.text)
                    .accessibilityAddTraits(.isHeader)
                ViewThatFits(in: .horizontal) {
                    HStack(alignment: .top, spacing: ax.space(3)) { figures }
                    VStack(alignment: .leading, spacing: ax.space(3)) { figures }
                }
                Rectangle().fill(ax.border).frame(height: 1)
                HStack {
                    Text(revenue.activityHeading)
                        .font(ax.heading(3))
                        .foregroundStyle(ax.text)
                        .accessibilityAddTraits(.isHeader)
                    Spacer(minLength: ax.space(2))
                    Button {} label: { Text(revenue.seeAll).font(ax.fontLabel).foregroundStyle(ax.accent) }
                        .buttonStyle(.plain)
                }
                VStack(spacing: ax.space(1)) {
                    ForEach(revenue.items) { item in
                        ShowActivityRow(item: item)
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
                Text(kpi.value)
                    .font(.system(size: ax.fontSize("font-size-2xl", 24), weight: ax.weight(700)).monospacedDigit())
                    .foregroundStyle(ax.text)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Text(kpi.label).font(ax.fontSmall).foregroundStyle(ax.textSecondary)
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

    var body: some View {
        HStack(spacing: ax.space(3)) {
            Image(systemName: ShowModel.symbol(item.icon))
                .font(.system(size: ax.fontSize("font-size-sm", 12) * 1.1))
                .foregroundStyle(ax.textSecondary)
                .frame(width: 32 * min(ax.scale, 1.4), height: 32 * min(ax.scale, 1.4))
                .background(Circle().fill(ax.muted))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 0) {
                Text(item.label).font(ax.fontLabel).foregroundStyle(ax.text).lineLimit(1)
                Text(item.detail).font(ax.fontSmall).foregroundStyle(ax.textSecondary).lineLimit(1)
            }
            Spacer(minLength: ax.space(2))
            Text(item.amount)
                .font(ax.fontStrong.monospacedDigit())
                .foregroundStyle(item.isMuted ? ax.textSecondary : ax.text)
        }
        .padding(.vertical, ax.space(1) + 1)
        .accessibilityElement(children: .combine)
    }
}
