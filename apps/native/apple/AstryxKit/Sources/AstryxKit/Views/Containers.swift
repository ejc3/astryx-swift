import SwiftUI

/// `stack`: a VStack or HStack. As in the web renderer, `align` of a horizontal stack is the
/// cross axis (top, center, bottom) and `spread` pushes the ends apart; of a vertical stack it
/// is the horizontal alignment of the children. `wrap` flows a row onto several lines.
struct AXStack: View {
    let node: StackNode
    @Environment(\.ax) private var ax

    var body: some View {
        let spacing = ax.space(node.gap)
        switch node.axis {
        case .vertical:
            VStack(alignment: horizontalAlignment, spacing: spacing) {
                NodeChildren(nodes: node.children)
            }
        case .horizontal:
            if node.align == .spread, node.wrap != true {
                HStack(alignment: verticalAlignment, spacing: spacing) {
                    ForEach(Array(node.children.enumerated()), id: \.offset) { index, child in
                        if index > 0 { Spacer(minLength: 0) }
                        NodeView(node: child)
                    }
                }
            } else {
                // Like the web's flex row: children at their natural width, the spare room
                // shared by those that can grow, and onto more lines when they do not fit.
                FlowLayout(spacing: spacing, crossAlignment: crossFactor) {
                    NodeChildren(nodes: node.children)
                }
            }
        }
    }

    /// 0 for top, 0.5 for center, 1 for bottom.
    private var crossFactor: CGFloat {
        switch node.align {
        case .start: 0
        case .end: 1
        default: 0.5
        }
    }

    private var horizontalAlignment: HorizontalAlignment {
        switch node.align {
        case .center: .center
        case .end: .trailing
        default: .leading
        }
    }

    private var verticalAlignment: VerticalAlignment {
        switch node.align {
        case .start: .top
        case .end: .bottom
        default: .center
        }
    }
}

/// `grid`: an adaptive LazyVGrid whose columns are at least `minColumnWidth` wide.
struct AXGrid: View {
    let node: GridNode
    @Environment(\.ax) private var ax
    @Environment(\.axWidth) private var width

    var body: some View {
        let gap = ax.space(node.gap)
        // A column never asks for more than the width there is.
        let minimum = max(1, min(CGFloat(node.minColumnWidth), width))
        let columns = max(1, Int(((width + gap) / (minimum + gap)).rounded(.down)))
        let columnWidth = (width - gap * CGFloat(columns - 1)) / CGFloat(columns)
        LazyVGrid(
            columns: [GridItem(.adaptive(minimum: minimum, maximum: .infinity), spacing: gap, alignment: .top)],
            alignment: .leading,
            spacing: gap
        ) {
            NodeChildren(nodes: node.children)
        }
        .environment(\.axWidth, max(columnWidth, 0))
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// `split`: primary and detail side by side when wide. When narrow, only one shows:
/// the detail (under a back button) if the core says so, else the primary.
struct AXSplit: View {
    let node: SplitNode
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send
    @Environment(\.axWidth) private var width

    static let wideFrom: CGFloat = 640

    var body: some View {
        if width >= Self.wideFrom {
            let gap = ax.space(4)
            let primaryWidth = min(max(width * 0.4, 280), 420)
            HStack(alignment: .top, spacing: gap) {
                NodeView(node: node.primary)
                    .environment(\.axWidth, primaryWidth)
                    .frame(width: primaryWidth, alignment: .topLeading)
                NodeView(node: node.detail)
                    .environment(\.axWidth, width - primaryWidth - gap)
                    .frame(maxWidth: .infinity, alignment: .topLeading)
            }
        } else if node.showDetailWhenNarrow {
            VStack(alignment: .leading, spacing: ax.space(3)) {
                if let backId = node.backId {
                    Button {
                        send(.press(id: backId))
                    } label: {
                        HStack(spacing: ax.space(1)) {
                            Image(systemName: "chevron.left")
                            if let label = node.backLabel { Text(label) }
                        }
                        .font(ax.fontLabel)
                        .foregroundStyle(ax.accent)
                        .frame(minHeight: 36)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(node.backLabel ?? "")
                }
                NodeView(node: node.detail)
            }
        } else {
            NodeView(node: node.primary)
        }
    }
}

/// `card`: a bordered surface with an optional title, subtitle and action.
struct AXCard: View {
    let node: CardNode
    @Environment(\.ax) private var ax
    @Environment(\.axWidth) private var width

    var body: some View {
        let pad = ax.space(4)
        VStack(alignment: .leading, spacing: ax.space(4)) {
            if node.title != nil || node.subtitle != nil || node.action != nil {
                HStack(alignment: .top, spacing: ax.space(3)) {
                    VStack(alignment: .leading, spacing: ax.hair) {
                        if let title = node.title {
                            Text(title)
                                .font(ax.heading(3))
                                .foregroundStyle(ax.text)
                                .accessibilityAddTraits(.isHeader)
                        }
                        if let subtitle = node.subtitle {
                            Text(subtitle).font(ax.fontSmall).foregroundStyle(ax.textSecondary)
                        }
                    }
                    Spacer(minLength: 0)
                    if let action = node.action { AXButton(node: action) }
                }
            }
            NodeChildren(nodes: node.children)
        }
        .environment(\.axWidth, max(width - 2 * pad - 2, 0))
        .padding(pad)
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .axSurface(fill: ax.card, radius: ax.radiusContainer)
    }
}

/// `section`: a titled group without a surface of its own.
struct AXSection: View {
    let node: SectionNode
    @Environment(\.ax) private var ax

    var body: some View {
        VStack(alignment: .leading, spacing: ax.space(4)) {
            VStack(alignment: .leading, spacing: ax.hair) {
                Text(node.title)
                    .font(ax.heading(2))
                    .foregroundStyle(ax.text)
                    .accessibilityAddTraits(.isHeader)
                if let description = node.description {
                    Text(description).font(ax.fontBase).foregroundStyle(ax.textSecondary)
                }
            }
            NodeChildren(nodes: node.children)
        }
    }
}

extension View {
    /// A rounded fill with a hairline border, the surface of cards, tables and inputs.
    func axSurface(fill: Color, radius: CGFloat, stroke: Color? = nil) -> some View {
        modifier(AXSurface(fill: fill, radius: radius, stroke: stroke))
    }
}

private struct AXSurface: ViewModifier {
    let fill: Color
    let radius: CGFloat
    let stroke: Color?
    @Environment(\.ax) private var ax

    func body(content: Content) -> some View {
        content
            .background(RoundedRectangle(cornerRadius: radius, style: .continuous).fill(fill))
            .overlay(
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .strokeBorder(stroke ?? ax.border, lineWidth: 1)
            )
    }
}

/// A flex row that wraps. Each child has its natural width; when they all fit on one line the
/// spare room is shared between the children that can grow (those a wider offer makes wider),
/// and when they do not fit they flow onto more lines, a child alone on a line growing to it.
struct FlowLayout: Layout {
    var spacing: CGFloat
    /// 0 top, 0.5 center, 1 bottom: where a child sits on a line taller than it.
    var crossAlignment: CGFloat = 0.5

    private struct Item { var index: Int; var width: CGFloat; var height: CGFloat; var grows: Bool }
    private struct Line { var items: [Item] = []; var width: CGFloat = 0; var height: CGFloat = 0 }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let limit = proposal.width ?? .infinity
        let lines = arrange(limit: limit, subviews: subviews)
        let widest = lines.map(\.width).max() ?? 0
        let grows = lines.contains { $0.items.contains { $0.grows } }
        let width = limit.isFinite && grows ? limit : widest
        let height = lines.reduce(0) { $0 + $1.height } + spacing * CGFloat(max(lines.count - 1, 0))
        return CGSize(width: width, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let lines = arrange(limit: bounds.width, subviews: subviews)
        var y = bounds.minY
        for line in lines {
            let growers = line.items.filter(\.grows).count
            let spare = max(bounds.width - line.width, 0)
            var x = bounds.minX
            for item in line.items {
                var width = item.width
                var height = item.height
                if item.grows, growers > 0 {
                    width += spare / CGFloat(growers)
                    height = subviews[item.index].sizeThatFits(ProposedViewSize(width: width, height: nil)).height
                }
                let top = y + (line.height - height) * crossAlignment
                subviews[item.index].place(at: CGPoint(x: x, y: top), proposal: ProposedViewSize(width: width, height: height))
                x += width + spacing
            }
            y += line.height + spacing
        }
    }

    private func arrange(limit: CGFloat, subviews: Subviews) -> [Line] {
        let items: [Item] = subviews.indices.map { index in
            var size = subviews[index].sizeThatFits(.unspecified)
            if limit.isFinite, size.width > limit {
                size = subviews[index].sizeThatFits(ProposedViewSize(width: limit, height: nil))
            }
            let wide = subviews[index].sizeThatFits(ProposedViewSize(width: 10_000, height: nil)).width
            return Item(index: index, width: size.width, height: size.height, grows: wide > size.width + 1)
        }
        var lines: [Line] = []
        var line = Line()
        for item in items {
            let needed = line.items.isEmpty ? item.width : line.width + spacing + item.width
            if needed > limit, !line.items.isEmpty {
                lines.append(line)
                line = Line()
            }
            line.width = line.items.isEmpty ? item.width : line.width + spacing + item.width
            line.height = max(line.height, item.height)
            line.items.append(item)
        }
        if !line.items.isEmpty { lines.append(line) }
        return lines
    }
}
