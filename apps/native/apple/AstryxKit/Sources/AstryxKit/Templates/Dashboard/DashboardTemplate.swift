import SwiftUI

/// Astryx's dashboard template, drawn natively from the core's view model
/// (core/src/templates/dashboard/model.ts, its `View` type).
///
/// A report: nothing in it changes state. The one control that sends is Reload
/// (`tpl.dashboard.reload`, which the core accepts and ignores for sample data); the "View
/// more" buttons and the table links have no action in the core (the model lists them as
/// `inert`), so they are drawn disabled.
struct DashboardTemplate: View {
    let view: JSONValue

    var body: some View {
        if let model = try? view.decode(DashModel.self) {
            DashContent(model: model)
        } else {
            AXTemplatePlaceholder(template: "dashboard")
        }
    }
}

private struct DashContent: View {
    let model: DashModel
    @Environment(\.ax) private var ax
    @Environment(\.axWidth) private var width

    var body: some View {
        VStack(alignment: .leading, spacing: ax.space(6)) {
            DashActiveUsers(chart: model.activeUsers, words: model.words)
            DashMetrics(metrics: model.metrics, words: model.words)
            DashDivider()
            DashSectionHeader(title: model.demographics.title, more: model.demographics.moreLabel, isInert: model.inert.contains("viewMore"))
            DashDemographics(cards: model.demographics.cards, words: model.words)
            DashDivider()
            DashSectionHeader(title: model.engagement.title, more: model.engagement.moreLabel, isInert: model.inert.contains("viewMore"))
            DashEngagement(
                pages: DashTableData(model.engagement.pages),
                events: DashTableData(model.engagement.events),
                linksInert: model.inert.contains("tableLink")
            )
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: Pieces shared by the sections

struct DashDivider: View {
    @Environment(\.ax) private var ax
    var body: some View {
        Rectangle().fill(ax.border).frame(height: 1).accessibilityHidden(true)
    }
}

/// A section title with its "View more" button.
private struct DashSectionHeader: View {
    let title: String
    let more: String
    let isInert: Bool
    @Environment(\.ax) private var ax

    var body: some View {
        // A single long word ("Demographics") shrinks to fit the width rather than break.
        let heading = Text(title)
            .font(ax.heading(3))
            .foregroundStyle(ax.text)
            .lineLimit(3)
            .minimumScaleFactor(0.6)
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityAddTraits(.isHeader)
        func button(fills: Bool) -> some View {
            Button {} label: { Text(more) }
                .buttonStyle(AXButtonStyle(variant: .secondary, ax: ax, fills: fills))
                .disabled(isInert)
        }
        return AXAdaptiveRow {
            HStack(alignment: .center, spacing: ax.space(3)) {
                heading
                Spacer(minLength: ax.space(2))
                button(fills: false).axOneLine()
            }
        } column: {
            VStack(alignment: .leading, spacing: ax.space(3)) {
                heading
                button(fills: true)
            }
        }
    }
}

/// A card as Astryx draws one: the card ground, a hairline and the container radius.
struct DashCard<Content: View>: View {
    @ViewBuilder var content: Content
    @Environment(\.ax) private var ax

    var body: some View {
        content
            .padding(ax.space(4))
            .frame(maxWidth: .infinity, alignment: .leading)
            .axSurface(fill: ax.card, radius: ax.radiusContainer)
    }
}

/// A small filled square for a legend, painted in a data color.
struct DashSwatch: View {
    let color: Color
    var body: some View {
        RoundedRectangle(cornerRadius: 2, style: .continuous).fill(color).frame(width: 10, height: 10)
            .accessibilityHidden(true)
    }
}

// MARK: Metrics

private struct DashMetrics: View {
    let metrics: [DashModel.Metric]
    let words: DashModel.Words
    @Environment(\.ax) private var ax
    @Environment(\.axWidth) private var width

    var body: some View {
        let columns = width >= 900 ? 4 : (width >= 300 && ax.scale <= 1.3 ? 2 : (width >= 640 ? 2 : 1))
        LazyVGrid(
            columns: Array(repeating: GridItem(.flexible(minimum: 0), spacing: ax.space(4), alignment: .top), count: min(columns, max(metrics.count, 1))),
            alignment: .leading,
            spacing: ax.space(4)
        ) {
            ForEach(metrics) { DashMetricCard(metric: $0, words: words, stacked: width < 600) }
        }
    }
}

private struct DashMetricCard: View {
    let metric: DashModel.Metric
    let words: DashModel.Words
    /// Value above change, so cards of a narrow two-column grid all have the same height.
    let stacked: Bool
    @Environment(\.ax) private var ax

    var body: some View {
        DashCard {
            VStack(alignment: .leading, spacing: ax.space(2)) {
                // The figures read as one element, with the change in words and its meaning;
                // the sparkline is its own element, an audio graph.
                VStack(alignment: .leading, spacing: ax.space(2)) {
                    Text(metric.label)
                        .font(ax.heading(4))
                        .foregroundStyle(ax.text)
                        .lineLimit(2)
                    if stacked {
                        VStack(alignment: .leading, spacing: ax.hair) { figure; change }
                    } else {
                        ViewThatFits(in: .horizontal) {
                            HStack(alignment: .firstTextBaseline, spacing: ax.space(2)) { figure; change }
                            VStack(alignment: .leading, spacing: ax.hair) { figure; change }
                        }
                    }
                    Text(metric.caption)
                        .font(ax.fontSmall)
                        .foregroundStyle(ax.textSecondary)
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(metric.label)
                .accessibilityValue("\(metric.value), \(metric.changeSpoken). \(metric.caption)")
                DashSparkline(values: metric.sparkline, color: ax.color(DashDataColor.blue.token))
                    .frame(height: 40)
                    .padding(.top, ax.space(1))
                    .accessibilityChartDescriptor(DashSparklineDescriptor(metric: metric, words: words))
            }
        }
        .accessibilityElement(children: .contain)
    }

    private var figure: some View {
        Text(metric.value)
            .font(ax.heading(2).monospacedDigit())
            .foregroundStyle(ax.text)
            .lineLimit(1)
            .minimumScaleFactor(0.7)
    }

    private var change: some View {
        HStack(spacing: ax.space(1)) {
            // The arrow says which way it moved; its color whether that is good news (a falling
            // bounce rate is). The web colors by `positive`, the move's sign; this follows the meaning.
            Image(systemName: metric.direction == "down" ? "arrow.down" : "arrow.up")
                .font(.system(size: ax.fontSize("font-size-xs", 10), weight: .bold))
                .foregroundStyle(ax.tone(metric.favorable ? .success : .danger).solid)
            Text(metric.change)
                .font(ax.fontBase.monospacedDigit())
                .foregroundStyle(ax.textSecondary)
                .lineLimit(1)
        }
    }
}

/// A bare line of the trend: no axes, no fill, as the stock page's sparkline.
private struct DashSparkline: View {
    let values: [Double]
    let color: Color

    var body: some View {
        GeometryReader { geo in
            let low = values.min() ?? 0
            let high = values.max() ?? 1
            let span = max(high - low, 0.0001)
            let step = geo.size.width / CGFloat(max(values.count - 1, 1))
            Path { path in
                for (index, value) in values.enumerated() {
                    let point = CGPoint(
                        x: CGFloat(index) * step,
                        y: geo.size.height * (1 - CGFloat((value - low) / span)) * 0.92 + geo.size.height * 0.04
                    )
                    if index == 0 { path.move(to: point) } else { path.addLine(to: point) }
                }
            }
            .stroke(color, style: StrokeStyle(lineWidth: 1.5, lineCap: .round, lineJoin: .round))
        }
    }
}

// MARK: Demographics

private struct DashDemographics: View {
    let cards: [DashModel.Demographics.Card]
    let words: DashModel.Words
    @Environment(\.ax) private var ax
    @Environment(\.axWidth) private var width

    var body: some View {
        let columns = width >= 640 ? min(cards.count, 2) : 1
        LazyVGrid(
            columns: Array(repeating: GridItem(.flexible(minimum: 0), spacing: ax.space(4), alignment: .top), count: max(columns, 1)),
            alignment: .leading,
            spacing: ax.space(4)
        ) {
            ForEach(cards) { DashSegmentCard(card: $0, words: words) }
        }
    }
}

private struct DashSegmentCard: View {
    let card: DashModel.Demographics.Card
    let words: DashModel.Words
    @Environment(\.ax) private var ax

    var body: some View {
        DashCard {
            VStack(alignment: .leading, spacing: ax.space(4)) {
                Text(card.title)
                    .font(ax.heading(4))
                    .foregroundStyle(ax.text)
                    .accessibilityAddTraits(.isHeader)
                DashStackedBar(segments: card.segments)
                    .frame(height: 24)
                    .accessibilityChartDescriptor(DashBarDescriptor(card: card, words: words))
                FlowLayout(spacing: ax.space(4), crossAlignment: 0) {
                    ForEach(card.segments) { segment in
                        VStack(alignment: .leading, spacing: 0) {
                            HStack(spacing: ax.space(2)) {
                                DashSwatch(color: ax.color(segment.color.token))
                                Text(segment.label).font(ax.fontSmall).foregroundStyle(ax.text)
                            }
                            Text("\(DashNumbers.plain(segment.value)) - \(segment.share)%")
                                .font(ax.fontSmall.monospacedDigit())
                                .foregroundStyle(ax.textSecondary)
                        }
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel(segment.label)
                        .accessibilityValue("\(DashNumbers.plain(segment.value)), \(segment.share)%")
                    }
                }
            }
        }
        .accessibilityElement(children: .contain)
    }
}

/// One bar cut into segments by value, rounded at its two ends only.
private struct DashStackedBar: View {
    let segments: [DashModel.Demographics.Card.Segment]
    @Environment(\.ax) private var ax

    var body: some View {
        let total = max(segments.reduce(0) { $0 + $1.value }, 0.0001)
        GeometryReader { geo in
            HStack(spacing: 0) {
                ForEach(segments) { segment in
                    Rectangle()
                        .fill(ax.color(segment.color.token))
                        .frame(width: geo.size.width * CGFloat(segment.value / total))
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: ax.radiusInner, style: .continuous))
        }
    }
}

enum DashNumbers {
    /// 38.0 as "38", 38.5 as "38.5".
    static func plain(_ value: Double) -> String {
        value == value.rounded() ? String(Int(value)) : String(value)
    }
}

// MARK: Engagement

private struct DashEngagement: View {
    let pages: DashTableData
    let events: DashTableData
    let linksInert: Bool
    @Environment(\.ax) private var ax
    @Environment(\.axWidth) private var width

    var body: some View {
        let sideBySide = width >= 960
        let gap = ax.space(4)
        let cardWidth = sideBySide ? (width - gap) / 2 : width
        let tables = Group {
            DashTable(data: pages, linkInert: linksInert)
            DashTable(data: events, linkInert: linksInert)
        }
        Group {
            if sideBySide {
                HStack(alignment: .top, spacing: gap) { tables }
            } else {
                VStack(spacing: gap) { tables }
            }
        }
        .environment(\.axWidth, cardWidth)
    }
}

private struct DashTable: View {
    let data: DashTableData
    let linkInert: Bool
    @Environment(\.ax) private var ax
    @Environment(\.axWidth) private var width

    private var cardTitle: some View {
        Text(data.title)
            .font(ax.heading(4))
            .foregroundStyle(ax.text)
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityAddTraits(.isHeader)
    }

    private var cardLink: some View {
        Button {} label: {
            Text(data.linkLabel).font(ax.fontLabel).foregroundStyle(ax.accent)
                .frame(minHeight: InboxTarget.side)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(linkInert)
        .opacity(linkInert ? 0.45 : 1)
    }

    var body: some View {
        // The card's inner width decides between a table and stacked rows.
        let inner = width - 2 * ax.space(4)
        let tabular = inner >= 400
        DashCard {
            VStack(alignment: .leading, spacing: ax.space(4)) {
                AXAdaptiveRow {
                    HStack(alignment: .firstTextBaseline) {
                        cardTitle
                        Spacer(minLength: ax.space(2))
                        cardLink.axOneLine()
                    }
                } column: {
                    VStack(alignment: .leading, spacing: 0) {
                        cardTitle
                        cardLink
                    }
                }
                VStack(spacing: 0) {
                    if tabular { header }
                    ForEach(Array(data.rows.enumerated()), id: \.element.id) { index, row in
                        if tabular || index > 0 { DashDivider() }
                        if tabular { tableRow(row) } else { stackedRow(row) }
                    }
                }
            }
        }
        .accessibilityElement(children: .contain)
    }

    private var nameWidth: CGFloat { 132 * min(ax.scale, 1.3) }
    private var extraWidth: CGFloat { 76 * min(ax.scale, 1.3) }

    private var header: some View {
        HStack(spacing: ax.space(3)) {
            Text(data.nameHeader).frame(width: nameWidth, alignment: .leading)
            Text(data.barHeader).frame(maxWidth: .infinity, alignment: .leading)
            ForEach(Array(data.extraHeaders.enumerated()), id: \.offset) { _, title in
                Text(title).frame(width: extraWidth, alignment: .trailing).lineLimit(2)
            }
        }
        .font(ax.font("font-size-sm", 12, weight: "font-weight-medium"))
        .foregroundStyle(ax.textSecondary)
        .padding(.bottom, ax.space(2))
        .accessibilityHidden(true)
    }

    private func tableRow(_ row: DashTableData.Row) -> some View {
        HStack(spacing: ax.space(3)) {
            Text(row.name)
                .font(ax.fontBase)
                .foregroundStyle(ax.text)
                .lineLimit(1)
                .truncationMode(.middle)
                .frame(width: nameWidth, alignment: .leading)
            VStack(alignment: .leading, spacing: ax.space(1)) {
                DashProgress(value: row.bar, max: row.max)
                Text(row.valueLabel).font(ax.fontSmall.monospacedDigit()).foregroundStyle(ax.textSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            ForEach(Array(row.extras.enumerated()), id: \.offset) { _, text in
                Text(text)
                    .font(ax.fontBase.monospacedDigit())
                    .foregroundStyle(ax.text)
                    .lineLimit(1)
                    .frame(width: extraWidth, alignment: .trailing)
            }
        }
        .padding(.vertical, ax.space(2))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(row.name)
        .accessibilityValue(spoken(row))
    }

    private func stackedRow(_ row: DashTableData.Row) -> some View {
        VStack(alignment: .leading, spacing: ax.space(2)) {
            HStack(alignment: .firstTextBaseline) {
                Text(row.name).font(ax.fontLabel).foregroundStyle(ax.text).lineLimit(1).truncationMode(.middle)
                Spacer(minLength: ax.space(2))
                Text(row.valueLabel).font(ax.fontSmall.monospacedDigit()).foregroundStyle(ax.textSecondary)
            }
            DashProgress(value: row.bar, max: row.max)
            HStack(spacing: ax.space(4)) {
                ForEach(Array(row.extras.enumerated()), id: \.offset) { index, text in
                    HStack(spacing: ax.space(1)) {
                        Text(data.extraHeaders[index]).foregroundStyle(ax.textSecondary)
                        Text(text).foregroundStyle(ax.text).monospacedDigit()
                    }
                    .lineLimit(1)
                }
            }
            .font(ax.fontSmall)
        }
        .padding(.vertical, ax.space(3))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(row.name)
        .accessibilityValue(spoken(row))
    }

    private func spoken(_ row: DashTableData.Row) -> String {
        var parts = [row.valueLabel]
        for (index, text) in row.extras.enumerated() { parts.append("\(data.extraHeaders[index]) \(text)") }
        return parts.joined(separator: ", ")
    }
}

/// Astryx's progress bar: a rounded track and an accent fill of `value / max`.
private struct DashProgress: View {
    let value: Double
    let max: Double
    @Environment(\.ax) private var ax

    var body: some View {
        Capsule()
            .fill(ax.track.opacity(0.55))
            .frame(height: 6)
            .overlay(alignment: .leading) {
                GeometryReader { geo in
                    Capsule()
                        .fill(ax.accent)
                        .frame(width: geo.size.width * CGFloat(Swift.min(Swift.max(value / Swift.max(max, 0.0001), 0), 1)))
                }
            }
            .accessibilityHidden(true)
    }
}
