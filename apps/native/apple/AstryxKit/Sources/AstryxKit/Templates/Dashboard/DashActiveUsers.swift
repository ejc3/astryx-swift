import Charts
import SwiftUI

/// The "Active users" block: title, Reload, a line chart of the three series with a legend.
/// The chart draws the model's own domain and ticks. Hover (Mac) or drag (iPhone) over the
/// chart shows the point's label and each series' value, as the web tooltip does.
struct DashActiveUsers: View {
    let chart: DashModel.ActiveUsers
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send
    @Environment(\.axWidth) private var width

    var body: some View {
        VStack(alignment: .leading, spacing: ax.space(6)) {
            HStack(alignment: .center, spacing: ax.space(3)) {
                Text(chart.title)
                    .font(ax.heading(3))
                    .foregroundStyle(ax.text)
                    .accessibilityAddTraits(.isHeader)
                Spacer(minLength: ax.space(2))
                Button {
                    send(.press(id: "tpl.dashboard.reload"))
                } label: {
                    HStack(spacing: ax.space(2)) {
                        Image(systemName: "arrow.clockwise")
                        Text(chart.reloadLabel).lineLimit(1)
                    }
                }
                .buttonStyle(AXButtonStyle(variant: .secondary, ax: ax))
            }
            VStack(alignment: .leading, spacing: ax.space(3)) {
                DashLineChart(chart: chart)
                    .frame(height: width < 500 ? 220 : 300)
                FlowLayout(spacing: ax.space(6), crossAlignment: 0.5) {
                    ForEach(chart.series) { series in
                        HStack(spacing: ax.space(2)) {
                            DashSwatch(color: ax.color(series.color.token))
                            Text(series.name).font(ax.fontSmall).foregroundStyle(ax.textSecondary)
                        }
                    }
                }
                .accessibilityHidden(true)
            }
        }
    }
}

private struct DashLineChart: View {
    let chart: DashModel.ActiveUsers
    @State private var selected: Double?
    @Environment(\.ax) private var ax

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
    private var picked: DashModel.ActiveUsers.Point? {
        guard let selected else { return nil }
        return visible.min { abs($0.hour - selected) < abs($1.hour - selected) }
    }

    var body: some View {
        Chart {
            ForEach(chart.series) { series in
                ForEach(visible) { point in
                    LineMark(
                        x: .value("Time", point.hour),
                        y: .value(series.name, point.value(for: series.key)),
                        series: .value("Series", series.name)
                    )
                    .foregroundStyle(ax.color(series.color.token))
                    .lineStyle(StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
                    .interpolationMethod(.linear)
                }
            }
            if let picked {
                RuleMark(x: .value("Time", picked.hour))
                    .foregroundStyle(ax.border)
                    .annotation(position: .top, spacing: 4, overflowResolution: .init(x: .fit(to: .chart), y: .disabled)) {
                        DashTooltip(point: picked, series: chart.series)
                    }
                ForEach(chart.series) { series in
                    PointMark(x: .value("Time", picked.hour), y: .value(series.name, picked.value(for: series.key)))
                        .foregroundStyle(ax.color(series.color.token))
                        .symbolSize(40)
                }
            }
        }
        .chartXScale(domain: xRange)
        .chartYScale(domain: yRange)
        .chartXSelection(value: $selected)
        .chartLegend(.hidden)
        .chartXAxis {
            AxisMarks(values: ticks.map(\.at)) { value in
                AxisValueLabel(collisionResolution: .disabled) {
                    if let at = value.as(Double.self), let tick = ticks.first(where: { $0.at == at }) {
                        Text(tick.label)
                            .font(ax.fontSmall)
                            .foregroundStyle(ax.textSecondary)
                    }
                }
            }
        }
        .chartYAxis {
            AxisMarks(position: .leading, values: chart.yTicks) { value in
                AxisGridLine(stroke: StrokeStyle(lineWidth: 1)).foregroundStyle(ax.border)
                AxisValueLabel {
                    if let v = value.as(Double.self) {
                        Text(DashNumbers.plain(v)).font(ax.fontSmall).foregroundStyle(ax.textSecondary)
                    }
                }
            }
        }
        .accessibilityLabel(chart.title)
        .accessibilityValue(chart.series.map(\.name).joined(separator: ", "))
    }
}

/// The hovered point: its time label and a swatch and value for each series.
private struct DashTooltip: View {
    let point: DashModel.ActiveUsers.Point
    let series: [DashModel.ActiveUsers.Series]
    @Environment(\.ax) private var ax

    var body: some View {
        VStack(alignment: .leading, spacing: ax.space(1)) {
            Text(point.label).font(ax.fontSmall).foregroundStyle(ax.textSecondary)
            ForEach(series) { s in
                HStack(spacing: ax.space(2)) {
                    DashSwatch(color: ax.color(s.color.token))
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
