import SwiftUI

/// `progress`: a labelled bar filled in the tone's color.
struct AXProgress: View {
    let node: ProgressNode
    @Environment(\.ax) private var ax

    var body: some View {
        VStack(alignment: .leading, spacing: ax.space(1)) {
            HStack {
                Text(node.label).font(ax.fontLabel).foregroundStyle(ax.text)
                Spacer(minLength: ax.space(2))
                Text(node.valueText).font(ax.fontSmall.monospacedDigit()).foregroundStyle(ax.textSecondary)
            }
            Capsule()
                .fill(ax.track.opacity(0.55))
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

/// `metric`: a figure with its change and a sparkline of the trend.
struct AXMetric: View {
    let node: MetricNode
    @Environment(\.ax) private var ax

    var body: some View {
        VStack(alignment: .leading, spacing: ax.space(1)) {
            Text(node.label).font(ax.fontSmall).foregroundStyle(ax.textSecondary)
            Text(node.value)
                .font(.system(size: ax.fontSize("font-size-3xl", 29), weight: ax.weight(600)).monospacedDigit())
                .foregroundStyle(ax.text)
                .minimumScaleFactor(0.7)
                .lineLimit(1)
            if let delta = node.delta {
                HStack(spacing: ax.space(1)) {
                    Image(systemName: delta.up ? "arrow.up.right" : "arrow.down.right")
                        .font(.system(size: ax.fontSize("font-size-xs", 10), weight: .bold))
                    Text(delta.text).font(ax.font("font-size-sm", 12, weight: "font-weight-medium"))
                }
                .foregroundStyle(ax.tone(delta.tone).text)
            }
            if let trend = node.trend, trend.count > 1 {
                Sparkline(values: trend, color: ax.accent)
                    .frame(height: 36)
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

/// A line over a soft fill; values run 0 to 1 and the core has already normalized them.
struct Sparkline: View {
    let values: [Double]
    let color: Color

    var body: some View {
        GeometryReader { geo in
            let points = values.enumerated().map { index, value in
                CGPoint(
                    x: geo.size.width * CGFloat(index) / CGFloat(max(values.count - 1, 1)),
                    y: geo.size.height * (1 - CGFloat(min(max(value, 0), 1))) * 0.9 + geo.size.height * 0.05
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
                .fill(LinearGradient(colors: [color.opacity(0.22), color.opacity(0)], startPoint: .top, endPoint: .bottom))
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

/// `bars`: a column chart. Heights run 0 to 1; the highlighted bar is in the accent color.
struct AXBars: View {
    let node: BarsNode
    @Environment(\.ax) private var ax
    @Environment(\.axWidth) private var width

    var body: some View {
        let slot = width / CGFloat(max(node.bars.count, 1))
        // Value labels go over every bar when each has room, else over the highlighted ones.
        let labelAll = slot >= 40 * ax.scale
        let chartHeight: CGFloat = 120
        VStack(alignment: .leading, spacing: ax.space(3)) {
            Text(node.label).font(ax.fontLabel).foregroundStyle(ax.text)
            HStack(alignment: .bottom, spacing: ax.space(2)) {
                ForEach(Array(node.bars.enumerated()), id: \.offset) { _, bar in
                    VStack(spacing: ax.space(1)) {
                        Text(labelAll || bar.highlight ? bar.valueText : " ")
                            .font(ax.font("font-size-xs", 10, weight: bar.highlight ? "font-weight-semibold" : "font-weight-normal").monospacedDigit())
                            .foregroundStyle(bar.highlight ? ax.text : ax.textSecondary)
                            .lineLimit(1)
                            .minimumScaleFactor(0.6)
                        Spacer(minLength: 0)
                        RoundedRectangle(cornerRadius: ax.radiusInner, style: .continuous)
                            .fill(bar.highlight ? ax.accent : ax.accent.opacity(0.35))
                            .frame(height: max(chartHeight * CGFloat(min(max(bar.value, 0), 1)), 2))
                        Text(bar.label)
                            .font(ax.fontXSmall)
                            .foregroundStyle(ax.textSecondary)
                            .lineLimit(1)
                            .minimumScaleFactor(0.6)
                    }
                    .frame(maxWidth: .infinity)
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel(bar.label)
                    .accessibilityValue(bar.valueText)
                }
            }
            .frame(height: chartHeight + 36)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// `stepper`: progress through steps, done / current / upcoming.
struct AXStepper: View {
    let node: StepperNode
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send

    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .center, spacing: 0) {
                ForEach(Array(node.steps.enumerated()), id: \.offset) { index, step in
                    if index > 0 {
                        Rectangle()
                            .fill(node.steps[index - 1].state == .done ? ax.accent : ax.border)
                            .frame(height: 2)
                            .frame(minWidth: 12, maxWidth: .infinity)
                            .padding(.horizontal, ax.space(2))
                    }
                    stepLabel(step, lineLimit: 1)
                        .fixedSize()
                }
            }
            VStack(alignment: .leading, spacing: ax.space(3)) {
                ForEach(Array(node.steps.enumerated()), id: \.offset) { _, step in
                    stepLabel(step, lineLimit: nil)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .contain)
    }

    /// A step's marker and name; a button when the core gave it a `selectId`.
    @ViewBuilder
    private func stepLabel(_ step: StepperNode.Step, lineLimit: Int?) -> some View {
        let content = HStack(spacing: ax.space(2)) {
            marker(step.state)
            Text(step.label)
                .font(step.state == .current ? ax.fontStrong : ax.fontBase)
                .foregroundStyle(step.state == .upcoming ? ax.textSecondary : ax.text)
                .lineLimit(lineLimit)
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
    private func marker(_ state: StepperNode.Step.State) -> some View {
        let side = 22 * min(ax.scale, 1.5)
        switch state {
        case .done:
            Circle().fill(ax.accent).frame(width: side, height: side)
                .overlay(Image(systemName: "checkmark").font(.system(size: side * 0.5, weight: .bold)).foregroundStyle(ax.onAccent))
        case .current:
            Circle().strokeBorder(ax.accent, lineWidth: 2).frame(width: side, height: side)
                .overlay(Circle().fill(ax.accent).frame(width: side * 0.4, height: side * 0.4))
        case .upcoming:
            Circle().strokeBorder(ax.borderStrong, lineWidth: 2).frame(width: side, height: side)
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
            Image(systemName: bannerIcon.symbol)
                .font(.system(size: ax.fontSize("font-size-lg", 17)))
                .foregroundStyle(colors.text)
            VStack(alignment: .leading, spacing: ax.space(1)) {
                Text(node.title).font(ax.fontStrong).foregroundStyle(colors.text)
                Text(node.text).font(ax.fontBase).foregroundStyle(ax.text)
                    .fixedSize(horizontal: false, vertical: true)
                if let action = node.action {
                    AXButton(node: action).padding(.top, ax.space(1))
                }
            }
            Spacer(minLength: 0)
            if let dismissId = node.dismissId {
                Button {
                    send(.press(id: dismissId))
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: ax.fontSize("font-size-sm", 12), weight: .semibold))
                        .foregroundStyle(ax.iconSecondary)
                        .padding(ax.space(1))
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(node.title)
            }
        }
        .padding(ax.space(3))
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous).fill(colors.muted))
        .overlay(RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous).strokeBorder(colors.border.opacity(0.6), lineWidth: 1))
        .accessibilityElement(children: .contain)
    }

    private var bannerIcon: Icon {
        switch node.tone {
        case .success: Icon(rawValue: "check")
        case .warning, .danger: Icon(rawValue: "warning")
        default: Icon(rawValue: "info")
        }
    }
}

/// `empty`: an icon, a title, a sentence and an optional action, centered.
struct AXEmpty: View {
    let node: EmptyNode
    @Environment(\.ax) private var ax

    var body: some View {
        VStack(spacing: ax.space(3)) {
            Image(systemName: node.icon.symbol)
                .font(.system(size: ax.fontSize("font-size-2xl", 24)))
                .foregroundStyle(ax.iconSecondary)
                .frame(width: 56 * min(ax.scale, 1.5), height: 56 * min(ax.scale, 1.5))
                .background(Circle().fill(ax.muted))
            VStack(spacing: ax.hair) {
                Text(node.title).font(ax.fontStrong).foregroundStyle(ax.text)
                Text(node.text).font(ax.fontBase).foregroundStyle(ax.textSecondary)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if let action = node.action { AXButton(node: action) }
        }
        .padding(ax.space(6))
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .contain)
    }
}

/// `metadata`: label and value pairs.
struct AXMetadata: View {
    let node: MetadataNode
    @Environment(\.ax) private var ax

    var body: some View {
        VStack(spacing: ax.space(2)) {
            ForEach(Array(node.items.enumerated()), id: \.offset) { _, item in
                HStack(alignment: .firstTextBaseline, spacing: ax.space(3)) {
                    Text(item.label).font(ax.fontBase).foregroundStyle(ax.textSecondary)
                    Spacer(minLength: ax.space(2))
                    Text(item.value).font(ax.fontLabel.monospacedDigit()).foregroundStyle(ax.text)
                        .multilineTextAlignment(.trailing)
                }
                .accessibilityElement(children: .combine)
            }
        }
        .frame(maxWidth: .infinity)
    }
}

/// `pagination`: previous and next with the core's range between them. Each sends `press`.
struct AXPagination: View {
    let node: PaginationNode
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send

    var body: some View {
        HStack(spacing: ax.space(3)) {
            step("chevron.left", id: node.previousId)
            Text(node.label).font(ax.fontBase.monospacedDigit()).foregroundStyle(ax.textSecondary)
            step("chevron.right", id: node.nextId)
        }
        .frame(maxWidth: .infinity, alignment: .center)
    }

    private func step(_ symbol: String, id: String?) -> some View {
        Button {
            if let id { send(.press(id: id)) }
        } label: {
            Image(systemName: symbol)
                .font(.system(size: ax.fontSize("font-size-base", 14), weight: .semibold))
                .frame(width: 36 * min(ax.scale, 1.4), height: 36 * min(ax.scale, 1.4))
        }
        .buttonStyle(AXButtonStyle(variant: .secondary, ax: ax))
        .disabled(id == nil)
        .accessibilityLabel(node.label)
    }
}
