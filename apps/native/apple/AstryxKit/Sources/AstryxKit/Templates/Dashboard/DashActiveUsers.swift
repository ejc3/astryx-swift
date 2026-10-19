import Charts
import SwiftUI

/// The "Active users" block: title, Reload, a line chart of the three series with a legend.
/// The chart draws the model's own domain and ticks. Hover (Mac) or drag (iPhone) over the
/// chart shows the point's label and each series' value, as the web tooltip does.
struct DashActiveUsers: View {
    let chart: DashModel.ActiveUsers
    let words: DashModel.Words
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send
    @Environment(\.axWidth) private var width
    @Environment(\.dynamicTypeSize) private var typeSize
    @Environment(\.accessibilityDifferentiateWithoutColor) private var differentiate
    @ScaledMetric(relativeTo: .body) private var compactHeight: CGFloat = 220
    @ScaledMetric(relativeTo: .body) private var regularHeight: CGFloat = 300

    private var title: some View {
        Text(chart.title)
            .font(ax.heading(3))
            .foregroundStyle(ax.text)
            .axLeading(ax, size: ax.fontSize("text-heading-3-size", 17), ratio: ax.headingLeading(3))
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityAddTraits(.isHeader)
    }

    private func reload(fills: Bool) -> some View {
        Button {
            send(.press(id: "tpl.dashboard.reload"))
        } label: {
            HStack(spacing: ax.space(2)) {
                Image(systemName: "arrow.triangle.2.circlepath")
                Text(chart.reloadLabel)
            }
        }
        .buttonStyle(AXButtonStyle(variant: .secondary, ax: ax, fills: fills))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: ax.space(6)) {
            AXAdaptiveRow {
                HStack(alignment: .center, spacing: ax.space(3)) {
                    title
                    Spacer(minLength: ax.space(2))
                    reload(fills: false).axOneLine()
                }
            } column: {
                VStack(alignment: .leading, spacing: ax.space(3)) {
                    title
                    reload(fills: true)
                }
            }
            VStack(alignment: .leading, spacing: ax.space(3)) {
                DashLineChart(chart: chart, words: words)
                    .frame(height: width < 500 ? min(compactHeight, typeSize.isAccessibilitySize ? 420 : 330) : min(regularHeight, 450))
                FlowLayout(spacing: ax.space(6), crossAlignment: 0.5) {
                    ForEach(Array(chart.series.enumerated()), id: \.element.id) { index, series in
                        HStack(spacing: ax.space(2)) {
                            // Small squares in the series' color; with Differentiate Without Color on, the
                            // line's own pattern, so the legend says what the lines say.
                            if differentiate {
                                DashLineSwatch(color: ax.color(series.color.token), dash: DashSeriesLook.dash(index, differentiate: true))
                            } else {
                                DashSwatch(color: ax.color(series.color.token))
                            }
                            Text(series.name).font(ax.fontSmall).foregroundStyle(ax.textSecondary)
                                .axLeading(ax, size: ax.fontSize("font-size-sm", 12), ratio: ax.supportingLeading)
                        }
                    }
                }
                .accessibilityHidden(true)
            }
        }
    }
}

/// What tells the series apart besides hue: a symbol each on the point being read and, only when
/// the person turns on Differentiate Without Color, a dash pattern each (solid, dashed, dotted),
/// which the legend draws too. Otherwise every line is solid, as on the web.
enum DashSeriesLook {
    static func dash(_ index: Int, differentiate: Bool) -> [CGFloat] {
        guard differentiate else { return [] }
        switch index % 3 {
        case 0: return []
        case 1: return [7, 4]
        default: return [1.5, 4]
        }
    }

    static func symbol(_ index: Int) -> BasicChartSymbolShape {
        switch index % 3 {
        case 0: .circle
        case 1: .square
        default: .triangle
        }
    }
}

/// A short stretch of a series' line: its color and dash pattern.
struct DashLineSwatch: View {
    let color: Color
    let dash: [CGFloat]
    var body: some View {
        Path { path in
            path.move(to: CGPoint(x: 0, y: 5))
            path.addLine(to: CGPoint(x: 22, y: 5))
        }
        .stroke(color, style: StrokeStyle(lineWidth: 2.5, lineCap: dash.isEmpty ? .round : .butt, dash: dash))
        .frame(width: 22, height: 10)
        .accessibilityHidden(true)
    }
}

private struct DashLineChart: View {
    let chart: DashModel.ActiveUsers
    let words: DashModel.Words
    @State private var selected: Double?
    @Environment(\.ax) private var ax
    @Environment(\.axWidth) private var width
    @Environment(\.dynamicTypeSize) private var typeSize
    @Environment(\.accessibilityDifferentiateWithoutColor) private var differentiate

    /// The model's domain widened to hold every point, as Recharts does with a numeric axis
    /// (its domain grows to the data unless `allowDataOverflow` is set), so all points show.
    private var xRange: ClosedRange<Double> {
        let hours = chart.points.map(\.hour)
        let lo = Swift.min(chart.xDomain.first ?? 0, hours.min() ?? 0)
        let hi = Swift.max(chart.xDomain.count > 1 ? chart.xDomain[1] : lo + 1, hours.max() ?? lo + 1)
        return lo...Swift.max(hi, lo + 1)
    }
    private var yRange: ClosedRange<Double> {
        let lo = chart.yDomain.first ?? 0
        let hi = chart.yDomain.count > 1 ? chart.yDomain[1] : lo + 1
        return lo...Swift.max(hi, lo + 1)
    }
    /// Points inside the range (all of them, since the range grows to hold them).
    private var visible: [DashModel.ActiveUsers.Point] {
        chart.points.filter { xRange.contains($0.hour) }
    }
    private var ticks: [DashModel.ActiveUsers.Tick] {
        chart.xTicks.filter { xRange.contains($0.at) }
    }
    /// The time labels under the chart. At accessibility sizes a label is as wide as a third of a
    /// phone, so the labels thin out (the middle one on a narrow screen, the two ends on a wider
    /// one) instead of overprinting each other.
    private var shownTicks: [DashModel.ActiveUsers.Tick] {
        // On a phone the labels would touch: keep the ends and the one near a third of the way.
        if !typeSize.isAccessibilitySize, width < 500, ticks.count > 3 {
            let span = max(xRange.upperBound - xRange.lowerBound, 0.0001)
            return ticks.filter { tick in
                let f = (tick.at - xRange.lowerBound) / span
                return f < 0.01 || f > 0.99 || (f > 0.2 && f < 0.55)
            }
        }
        guard typeSize.isAccessibilitySize, ticks.count > 1 else { return ticks }
        if width < 500 {
            let middle = (xRange.lowerBound + xRange.upperBound) / 2
            return [ticks.min { abs($0.at - middle) < abs($1.at - middle) }!]
        }
        return ticks.count > 2 ? [ticks[0], ticks[ticks.count - 1]] : ticks
    }
    /// The value labels at the side: every other one at accessibility sizes, where each is as
    /// tall as a fifth of the chart.
    private var shownYTicks: [Double] {
        guard typeSize.isAccessibilitySize, chart.yTicks.count > 3 else { return chart.yTicks }
        return chart.yTicks.enumerated().filter { $0.offset % 2 == 0 }.map(\.element)
    }
    private var picked: DashModel.ActiveUsers.Point? {
        guard let selected else { return nil }
        return visible.min { abs($0.hour - selected) < abs($1.hour - selected) }
    }

    var body: some View {
        Chart {
            ForEach(Array(chart.series.enumerated()), id: \.element.id) { index, series in
                let dash = DashSeriesLook.dash(index, differentiate: differentiate)
                ForEach(visible) { point in
                    LineMark(
                        x: .value(words.timeTitle, point.hour),
                        y: .value(series.name, point.value(for: series.key)),
                        series: .value(chart.title, series.name)
                    )
                    .foregroundStyle(ax.color(series.color.token))
                    .lineStyle(StrokeStyle(lineWidth: 2, lineCap: dash.isEmpty ? .round : .butt, lineJoin: .round, dash: dash))
                    .interpolationMethod(.linear)
                }
            }
            if let picked {
                RuleMark(x: .value(words.timeTitle, picked.hour))
                    .foregroundStyle(ax.border)
                    .annotation(position: .top, spacing: 4, overflowResolution: .init(x: .fit(to: .chart), y: .disabled)) {
                        DashTooltip(point: picked, series: chart.series)
                    }
                ForEach(Array(chart.series.enumerated()), id: \.element.id) { index, series in
                    PointMark(x: .value(words.timeTitle, picked.hour), y: .value(series.name, picked.value(for: series.key)))
                        .foregroundStyle(ax.color(series.color.token))
                        .symbol(DashSeriesLook.symbol(index))
                        .symbolSize(56)
                }
            }
        }
        .chartXScale(domain: xRange)
        .chartYScale(domain: yRange)
        .chartXSelection(value: $selected)
        .chartLegend(.hidden)
        .chartXAxis {
            AxisMarks(values: shownTicks.map(\.at)) { value in
                // The last label ends at the plot's right edge, as the web's does: centered on the
                // edge it would be cut off, so it hangs from it.
                let last = value.as(Double.self).map { $0 == shownTicks.last?.at } ?? false
                AxisValueLabel(anchor: last ? .topTrailing : .top, collisionResolution: .disabled) {
                    if let at = value.as(Double.self), let tick = ticks.first(where: { $0.at == at }) {
                        Text(tick.label)
                            .font(ax.fontSmall)
                            .foregroundStyle(ax.textSecondary)
                    }
                }
            }
        }
        .chartYAxis {
            AxisMarks(position: .leading, values: shownYTicks) { value in
                AxisGridLine(stroke: StrokeStyle(lineWidth: 1)).foregroundStyle(ax.border)
                AxisValueLabel {
                    if let v = value.as(Double.self) {
                        Text(DashNumbers.plain(v)).font(ax.fontSmall).foregroundStyle(ax.textSecondary)
                    }
                }
            }
        }
        .accessibilityChartDescriptor(DashLineDescriptor(chart: chart, words: words))
    }
}

/// The hovered point: its time label and a swatch and value for each series.
private struct DashTooltip: View {
    let point: DashModel.ActiveUsers.Point
    let series: [DashModel.ActiveUsers.Series]
    @Environment(\.ax) private var ax
    @Environment(\.accessibilityDifferentiateWithoutColor) private var differentiate

    var body: some View {
        VStack(alignment: .leading, spacing: ax.space(1)) {
            Text(point.label).font(ax.fontSmall).foregroundStyle(ax.textSecondary)
            ForEach(Array(series.enumerated()), id: \.element.id) { index, s in
                HStack(spacing: ax.space(2)) {
                    if differentiate {
                        DashLineSwatch(color: ax.color(s.color.token), dash: DashSeriesLook.dash(index, differentiate: true))
                    } else {
                        DashSwatch(color: ax.color(s.color.token))
                    }
                    Text("\(s.name): \(DashNumbers.plain(point.value(for: s.key)))")
                        .font(ax.fontSmall.monospacedDigit())
                        .foregroundStyle(ax.text)
                }
            }
        }
        .padding(ax.space(3))
        .background(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).fill(ax.color("color-background-popover")))
        .overlay(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).strokeBorder(ax.border, lineWidth: 1))
        .shadow(color: ax.shadow, radius: 8, y: 2)
    }
}
