import Accessibility
import SwiftUI

/// The audio-graph descriptors of the dashboard's charts (`accessibilityChartDescriptor`): a
/// title, a summary written by the core, both axes and every series, so VoiceOver can read and
/// play a chart whose values the picture shows only on hover or drag.

/// The active-users line chart: three series over time.
struct DashLineDescriptor: AXChartDescriptorRepresentable {
    let chart: DashModel.ActiveUsers
    let words: DashModel.Words

    func makeChartDescriptor() -> AXChartDescriptor {
        let hours = chart.points.map(\.hour)
        let lo = min(chart.xDomain.first ?? 0, hours.min() ?? 0)
        let hi = max(chart.xDomain.count > 1 ? chart.xDomain[1] : lo + 1, hours.max() ?? lo + 1)
        let yLo = chart.yDomain.first ?? 0
        let yHi = chart.yDomain.count > 1 ? chart.yDomain[1] : yLo + 1
        let points = chart.points
        let x = AXNumericDataAxisDescriptor(
            title: words.timeTitle,
            range: lo...max(hi, lo + 1),
            gridlinePositions: chart.xTicks.map(\.at),
            valueDescriptionProvider: { value in
                points.min { abs($0.hour - value) < abs($1.hour - value) }?.label ?? DashNumbers.plain(value)
            }
        )
        let y = AXNumericDataAxisDescriptor(
            title: words.usersTitle,
            range: yLo...max(yHi, yLo + 1),
            gridlinePositions: chart.yTicks,
            valueDescriptionProvider: { DashNumbers.plain($0) }
        )
        let series = chart.series.map { s in
            AXDataSeriesDescriptor(
                name: s.name,
                isContinuous: true,
                dataPoints: points.map { AXDataPoint(x: $0.hour, y: $0.value(for: s.key), additionalValues: [], label: $0.label) }
            )
        }
        return AXChartDescriptor(title: chart.title, summary: chart.summary, xAxis: x, yAxis: y, additionalAxes: [], series: series)
    }

    func updateChartDescriptor(_ descriptor: AXChartDescriptor) {
        let next = makeChartDescriptor()
        descriptor.title = next.title
        descriptor.summary = next.summary
        descriptor.xAxis = next.xAxis
        descriptor.yAxis = next.yAxis
        descriptor.series = next.series
    }
}

/// A metric card's sparkline: one series over the last days.
struct DashSparklineDescriptor: AXChartDescriptorRepresentable {
    let metric: DashModel.Metric
    let words: DashModel.Words

    func makeChartDescriptor() -> AXChartDescriptor {
        let values = metric.sparkline
        let low = values.min() ?? 0
        let high = values.max() ?? low + 1
        let x = AXNumericDataAxisDescriptor(
            title: words.trendAxisX,
            range: 1...Double(max(values.count, 2)),
            gridlinePositions: [],
            valueDescriptionProvider: { DashNumbers.plain($0) }
        )
        let y = AXNumericDataAxisDescriptor(
            title: words.trendAxisY,
            range: low...max(high, low + 1),
            gridlinePositions: [],
            valueDescriptionProvider: { DashNumbers.plain($0) }
        )
        let series = AXDataSeriesDescriptor(
            name: metric.label,
            isContinuous: true,
            dataPoints: values.enumerated().map { AXDataPoint(x: Double($0.offset + 1), y: $0.element) }
        )
        return AXChartDescriptor(title: metric.label, summary: metric.trend, xAxis: x, yAxis: y, additionalAxes: [], series: [series])
    }

    func updateChartDescriptor(_ descriptor: AXChartDescriptor) {
        let next = makeChartDescriptor()
        descriptor.title = next.title
        descriptor.summary = next.summary
        descriptor.xAxis = next.xAxis
        descriptor.yAxis = next.yAxis
        descriptor.series = next.series
    }
}

/// A demographics card's segmented bar: one category per segment.
struct DashBarDescriptor: AXChartDescriptorRepresentable {
    let card: DashModel.Demographics.Card
    let words: DashModel.Words

    func makeChartDescriptor() -> AXChartDescriptor {
        let top = card.segments.map(\.value).max() ?? 1
        let x = AXCategoricalDataAxisDescriptor(title: words.shareAxisX, categoryOrder: card.segments.map(\.label))
        let y = AXNumericDataAxisDescriptor(
            title: words.shareTitle,
            range: 0...max(top, 1),
            gridlinePositions: [],
            valueDescriptionProvider: { DashNumbers.plain($0) }
        )
        let series = AXDataSeriesDescriptor(
            name: card.title,
            isContinuous: false,
            dataPoints: card.segments.map { AXDataPoint(x: $0.label, y: $0.value, additionalValues: [], label: "\($0.label), \($0.share)%") }
        )
        return AXChartDescriptor(title: card.title, summary: card.summary, xAxis: x, yAxis: y, additionalAxes: [], series: [series])
    }

    func updateChartDescriptor(_ descriptor: AXChartDescriptor) {
        let next = makeChartDescriptor()
        descriptor.title = next.title
        descriptor.summary = next.summary
        descriptor.xAxis = next.xAxis
        descriptor.yAxis = next.yAxis
        descriptor.series = next.series
    }
}
