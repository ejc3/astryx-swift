import SwiftUI

/// `progress`: a labelled bar filled in the tone's color.
struct AXProgress: View {
    let node: ProgressNode
    @Environment(\.ax) private var ax

    var body: some View {
        VStack(alignment: .leading, spacing: ax.space(2)) {
            HStack {
                // Astryx's ProgressBar label is primary, medium weight.
                Text(node.label).font(ax.fontLabel).foregroundStyle(ax.text)
                Spacer(minLength: ax.space(2))
                Text(node.valueText).font(ax.fontBase.monospacedDigit()).foregroundStyle(ax.textSecondary)
            }
            Capsule()
                .fill(ax.muted)
                .frame(height: 8)
                .overlay(alignment: .leading) {
                    GeometryReader { geo in
                        Capsule()
                            .fill(ax.tone(node.tone == .neutral ? .accent : node.tone).solid)
                            .frame(width: geo.size.width * min(max(node.value, 0), 1))
                    }
                }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(node.label)
        .accessibilityValue(node.valueText)
    }
}

/// `metric`: a figure with its change and a sparkline of the trend. The figure is a level 2
/// heading, the change 10 pt in the tone's text color, the sparkline 32 high.
struct AXMetric: View {
    let node: MetricNode
    @Environment(\.ax) private var ax

    var body: some View {
        VStack(alignment: .leading, spacing: ax.space(1)) {
            Text(node.label).font(ax.fontSmall).foregroundStyle(ax.textSecondary)
                .axLeading(ax, size: ax.fontSize("font-size-sm", 12), ratio: ax.supportingLeading)
            Text(node.value)
                .font(ax.heading(2).monospacedDigit())
                .foregroundStyle(ax.text)
                .minimumScaleFactor(0.7)
                .lineLimit(1)
                .axLeading(ax, size: ax.fontSize("text-heading-2-size", 20), ratio: ax.headingLeading(2))
            if let delta = node.delta {
                HStack(spacing: ax.hair) {
                    Image(systemName: delta.up ? "arrow.up" : "arrow.down")
                        .font(.system(size: ax.fontSize("font-size-xs", 10), weight: .regular))
                    Text(delta.text).font(ax.fontXSmall)
                }
                .foregroundStyle(ax.textTone(delta.tone))
                // The figure and its change are a stack with gap 2 on the web (4 + this 4).
                .padding(.top, ax.space(1))
            }
            if let trend = node.trend, trend.count > 1 {
                Sparkline(values: trend, color: ax.accent)
                    .frame(height: 32)
                    .padding(.top, ax.space(2))
                    .accessibilityHidden(true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(ax.space(4))
        .axSurface(fill: ax.card, radius: ax.radiusContainer)
        .accessibilityElement(children: .combine)
    }
}

/// A line over a flat fill at 12 %; values run 0 to 1 and the core has already normalized them.
struct Sparkline: View {
    let values: [Double]
    let color: Color

    var body: some View {
        GeometryReader { geo in
            let pad: CGFloat = 2
            let points = values.enumerated().map { index, value in
                CGPoint(
                    x: geo.size.width * CGFloat(index) / CGFloat(max(values.count - 1, 1)),
                    y: geo.size.height - pad - CGFloat(min(max(value, 0), 1)) * (geo.size.height - 2 * pad)
                )
            }
            ZStack {
                Path { path in
                    guard let first = points.first, let last = points.last else { return }
                    path.move(to: CGPoint(x: first.x, y: geo.size.height))
                    points.forEach { path.addLine(to: $0) }
                    path.addLine(to: CGPoint(x: last.x, y: geo.size.height))
                    path.closeSubpath()
                }
                .fill(color.opacity(0.12))
                Path { path in
                    guard let first = points.first else { return }
                    path.move(to: first)
                    points.dropFirst().forEach { path.addLine(to: $0) }
                }
                .stroke(color, style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
            }
        }
    }
}

/// `bars`: a column chart, 180 high. Heights run 0 to 1; only the highlighted bar shows its value,
/// in the accent color, the others at 16 % accent. The chart's name is a 10 pt caption below.
struct AXBars: View {
    let node: BarsNode
    @Environment(\.ax) private var ax

    var body: some View {
        let chartHeight: CGFloat = 180
        // A value row and a label row of 12 pt each, with the gap, leave the track for the fills.
        let line = ax.fontSize("font-size-xs", 10) * 1.2
        let track = max(chartHeight - 2 * (line + ax.space(1)), 20)
        VStack(alignment: .leading, spacing: ax.space(4)) {
            HStack(alignment: .bottom, spacing: ax.space(1)) {
                ForEach(Array(node.bars.enumerated()), id: \.offset) { _, bar in
                    VStack(spacing: ax.space(1)) {
                        Text(bar.highlight ? bar.valueText : " ")
                            .font(ax.font("font-size-xs", 10, weight: bar.highlight ? "font-weight-semibold" : "font-weight-normal").monospacedDigit())
                            .foregroundStyle(bar.highlight ? ax.text : ax.textSecondary)
                            .lineLimit(1)
                            .minimumScaleFactor(0.6)
                            .frame(height: line)
                        Spacer(minLength: 0)
                        UnevenRoundedRectangle(topLeadingRadius: ax.radiusInner, bottomLeadingRadius: 0, bottomTrailingRadius: 0, topTrailingRadius: ax.radiusInner, style: .continuous)
                            .fill(bar.highlight ? ax.accent : ax.accentSoft)
                            .frame(height: max(track * CGFloat(min(max(bar.value, 0), 1)), 2))
                        Text(bar.label)
                            .font(ax.fontXSmall)
                            .foregroundStyle(ax.textSecondary)
                            .lineLimit(1)
                            .minimumScaleFactor(0.6)
                            .frame(height: line)
                    }
                    .frame(maxWidth: .infinity)
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel(bar.label)
                    .accessibilityValue(bar.valueText)
                }
            }
            .frame(height: chartHeight)
            Text(node.label).font(ax.fontXSmall).foregroundStyle(ax.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// `stepper`: progress through steps, done / current / upcoming, as Astryx's Stepper draws it: a
/// bar above each step (accent when done or current), then a marker (a check when done, a radio
/// dot when current, the step's number in a gray disc when upcoming) and the label.
struct AXStepper: View {
    let node: StepperNode
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send
    @Environment(\.axWidth) private var width

    /// Astryx's default `minimumStepWidth`: below this much room per step the stepper collapses
    /// to its bars and the current step between a previous and a next control.
    private static let minimumStepWidth: CGFloat = 112

    private var collapsed: Bool { Self.collapses(width: width, steps: node.steps.count) }

    static func collapses(width: CGFloat, steps: Int) -> Bool {
        steps > 0 && width / CGFloat(steps) < minimumStepWidth
    }

    var body: some View {
        Group {
            if collapsed {
                collapsedBody
            } else {
                ViewThatFits(in: .horizontal) {
                    HStack(alignment: .top, spacing: ax.space(2)) {
                        ForEach(Array(node.steps.enumerated()), id: \.offset) { index, step in
                            stepView(step, index: index, lineLimit: 1)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                    VStack(alignment: .leading, spacing: ax.space(3)) {
                        ForEach(Array(node.steps.enumerated()), id: \.offset) { index, step in
                            stepView(step, index: index, lineLimit: nil)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .contain)
    }

    // MARK: Collapsed

    /// The step the summary names: the current one, else the last done.
    private var shownIndex: Int {
        node.steps.firstIndex { $0.state == .current }
            ?? node.steps.lastIndex { $0.state == .done } ?? 0
    }

    /// The nearest step to move to in a direction: one the core gave a `selectId`, as Astryx's
    /// controls skip disabled steps.
    private func neighbor(_ delta: Int) -> (index: Int, id: String)? {
        var index = shownIndex + delta
        while node.steps.indices.contains(index) {
            if let id = node.steps[index].selectId { return (index, id) }
            index += delta
        }
        return nil
    }

    private var collapsedBody: some View {
        VStack(alignment: .leading, spacing: 0) {
            // The track: one bar for every step.
            HStack(spacing: ax.space(2)) {
                ForEach(Array(node.steps.enumerated()), id: \.offset) { _, step in
                    Capsule()
                        .fill(step.state == .upcoming ? ax.color("color-neutral") : ax.accent)
                        .frame(maxWidth: .infinity)
                        .frame(height: 4)
                }
            }
            .accessibilityHidden(true)
            HStack(spacing: ax.space(2)) {
                control("chevron-left", target: neighbor(-1))
                Spacer(minLength: 0)
                if node.steps.indices.contains(shownIndex) {
                    let step = node.steps[shownIndex]
                    HStack(spacing: ax.space(2)) {
                        marker(step.state, index: shownIndex)
                        Text(step.label)
                            .font(step.state == .current ? ax.fontStrong : ax.fontBase)
                            .foregroundStyle(ax.text)
                            .lineLimit(1)
                    }
                }
                Spacer(minLength: 0)
                control("chevron-right", target: neighbor(1))
            }
            .padding(.top, ax.space(2))
        }
    }

    /// Astryx's ghost icon button, named for the step it goes to, dimmed when there is none.
    private func control(_ icon: String, target: (index: Int, id: String)?) -> some View {
        AXIconButton(
            node: IconButtonNode(id: target?.id ?? "", icon: Icon(rawValue: icon), label: target.map { node.steps[$0.index].label } ?? "", selected: nil),
            disabled: target == nil
        )
    }

    /// A step: its bar, then its marker and name; a button when the core gave it a `selectId`.
    @ViewBuilder
    private func stepView(_ step: StepperNode.Step, index: Int, lineLimit: Int?) -> some View {
        let content = VStack(alignment: .leading, spacing: ax.space(2)) {
            Capsule()
                .fill(step.state == .upcoming ? ax.color("color-neutral") : ax.accent)
                .frame(maxWidth: .infinity)
                .frame(height: 4)
            HStack(spacing: ax.space(2)) {
                marker(step.state, index: index)
                Text(step.label)
                    .font(step.state == .current ? ax.fontStrong : ax.fontBase)
                    .foregroundStyle(step.state == .upcoming ? ax.textSecondary : ax.text)
                    .lineLimit(lineLimit)
                    .fixedSize(horizontal: lineLimit == 1, vertical: true)
            }
        }
        .contentShape(Rectangle())
        if let selectId = step.selectId {
            Button { send(.press(id: selectId)) } label: { content }
                .buttonStyle(.plain)
                .accessibilityAddTraits(step.state == .current ? [.isSelected, .isButton] : .isButton)
        } else {
            content
        }
    }

    @ViewBuilder
    private func marker(_ state: StepperNode.Step.State, index: Int) -> some View {
        let side = 20 * min(ax.scale, 1.5)
        switch state {
        case .done:
            Circle().fill(ax.accent).frame(width: side, height: side)
                .overlay(Image(systemName: "checkmark").font(.system(size: side * 0.5, weight: .bold)).foregroundStyle(ax.onAccent))
        case .current:
            Circle().strokeBorder(ax.accent, lineWidth: 2).frame(width: side, height: side)
                .overlay(Circle().fill(ax.accent).frame(width: side * 0.4, height: side * 0.4))
        case .upcoming:
            Circle().fill(ax.color("color-neutral")).frame(width: side, height: side)
                .overlay(Text("\(index + 1)").font(ax.fontXSmall.monospacedDigit()).foregroundStyle(ax.textSecondary))
        }
    }
}

/// `banner`: a tinted notice with an optional action and dismiss control.
struct AXBanner: View {
    let node: BannerNode
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send

    var body: some View {
        let colors = ax.tone(node.tone)
        HStack(alignment: .top, spacing: ax.space(3)) {
            Image(systemName: bannerSymbol)
                .font(.system(size: ax.fontSize("font-size-lg", 17)))
                .foregroundStyle(ax.fillTone(node.tone))
            // The text takes all the room the dismiss control leaves; a spacer beside it would
            // halve what it is offered and wrap it early.
            VStack(alignment: .leading, spacing: ax.space(1)) {
                Text(node.title).font(ax.fontStrong).foregroundStyle(ax.text)
                Text(node.text).font(ax.fontSmall).foregroundStyle(ax.textSecondary)
                    .lineSpacing(ax.lineSpacing(size: ax.fontSize("font-size-sm", 12), ratio: ax.supportingLeading))
                    .fixedSize(horizontal: false, vertical: true)
                if let action = node.action {
                    AXButton(node: action, small: true).padding(.top, ax.space(1))
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            if let dismissId = node.dismissId {
                Button {
                    send(.press(id: dismissId))
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: ax.fontSize("font-size-sm", 12), weight: .semibold))
                        .foregroundStyle(ax.iconSecondary)
                        .padding(ax.space(1))
                        .contentShape(Rectangle())
                        .axTapTarget(keepLayout: true)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(node.title)
            }
        }
        // Astryx's Banner pads 12 above and below and 16 at the sides.
        .padding(.vertical, ax.space(3))
        .padding(.horizontal, ax.space(4))
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous).fill(colors.muted))
        .accessibilityElement(children: .contain)
    }

    /// The filled glyph of the tone, in the tone's color.
    private var bannerSymbol: String {
        switch node.tone {
        case .success: "checkmark.circle.fill"
        case .warning, .danger: "exclamationmark.triangle.fill"
        default: "info.circle.fill"
        }
    }
}

/// `empty`: an icon, a title, a sentence and an optional action, centered.
struct AXEmpty: View {
    let node: EmptyNode
    @Environment(\.ax) private var ax

    var body: some View {
        // Astryx's EmptyState: gap 16, padding 32 above and below and 24 at the sides.
        VStack(spacing: ax.space(4)) {
            Image(systemName: node.icon.symbol)
                .font(.system(size: ax.fontSize("font-size-xl", 20)))
                .foregroundStyle(ax.text)
            VStack(spacing: ax.hair) {
                Text(node.title).font(ax.heading(3)).foregroundStyle(ax.text)
                Text(node.text).font(ax.fontBase).foregroundStyle(ax.textSecondary)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if let action = node.action { AXButton(node: action) }
        }
        .padding(.vertical, ax.space(8))
        .padding(.horizontal, ax.space(6))
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .contain)
    }
}

/// `metadata`: label and value pairs in two columns, the values beginning where the column of
/// labels ends, as Astryx's MetadataList sets them.
struct AXMetadata: View {
    let node: MetadataNode
    @Environment(\.ax) private var ax

    var body: some View {
        Grid(alignment: .topLeading, horizontalSpacing: ax.space(3), verticalSpacing: ax.space(3) + 2) {
            ForEach(Array(node.items.enumerated()), id: \.offset) { _, item in
                GridRow {
                    Text(item.label).font(ax.fontBase).foregroundStyle(ax.textSecondary)
                        .axLeading(ax, size: ax.fontSize("font-size-base", 14), ratio: ax.bodyLeading)
                    Text(item.value).font(ax.fontBase.monospacedDigit()).foregroundStyle(ax.text)
                        .axLeading(ax, size: ax.fontSize("font-size-base", 14), ratio: ax.bodyLeading)
                        .gridColumnAlignment(.leading)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// `pagination`: the core's range at the leading edge and two ghost icon buttons, previous and
/// next, at the trailing edge (Astryx's Pagination with no page numbers). Each sends `press`.
struct AXPagination: View {
    let node: PaginationNode
    @Environment(\.ax) private var ax

    var body: some View {
        HStack(spacing: ax.space(3)) {
            Text(node.label).font(ax.fontSmall.monospacedDigit()).foregroundStyle(ax.textSecondary)
            Spacer(minLength: ax.space(2))
            step("chevron-left", id: node.previousId, label: node.previousLabel ?? node.label)
            step("chevron-right", id: node.nextId, label: node.nextLabel ?? node.label)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func step(_ icon: String, id: String?, label: String) -> some View {
        AXIconButton(node: IconButtonNode(id: id ?? "", icon: Icon(rawValue: icon), label: label, selected: nil), disabled: id == nil)
    }
}
