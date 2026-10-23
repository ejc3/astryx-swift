import CoreText
import SwiftUI

/// The routing and labelling rules of core/src/diagram.ts, ported line for line (its doc comment
/// says them in words); the tests check this port against what the core computed.
enum DiagramRouting {
    static let lane: CGFloat = 12
    static let step: CGFloat = 4
    static let clear: CGFloat = 2

    static func anchor(_ r: CGRect, _ side: DiagramNode.Side, _ at: Double = 0.5) -> CGPoint {
        switch side {
        case .top: CGPoint(x: r.minX + r.width * at, y: r.minY)
        case .bottom: CGPoint(x: r.minX + r.width * at, y: r.maxY)
        case .left: CGPoint(x: r.minX, y: r.minY + r.height * at)
        case .right: CGPoint(x: r.maxX, y: r.minY + r.height * at)
        }
    }

    private static func horizontal(_ side: DiagramNode.Side) -> Bool { side == .left || side == .right }

    static func route(from: CGRect, to: CGRect, _ route: DiagramNode.Route, grid: CGRect? = nil) -> [CGPoint] {
        let a = anchor(from, route.from, route.fromAt ?? 0.5)
        let b = anchor(to, route.to, route.toAt ?? 0.5)
        let bend = route.bend ?? 0.5
        let out = lane * (route.lane ?? 1)
        let fh = horizontal(route.from), th = horizontal(route.to)
        if route.from == route.to {
            let g = route.outside == true ? grid : nil
            if fh {
                let x = route.from == .left ? (g?.minX ?? min(a.x, b.x)) - out : (g?.maxX ?? max(a.x, b.x)) + out
                return [a, CGPoint(x: x, y: a.y), CGPoint(x: x, y: b.y), b]
            }
            let y = route.from == .top ? (g?.minY ?? min(a.y, b.y)) - out : (g?.maxY ?? max(a.y, b.y)) + out
            return [a, CGPoint(x: a.x, y: y), CGPoint(x: b.x, y: y), b]
        }
        if fh && th {
            if a.y >= to.minY && a.y <= to.maxY { return [a, CGPoint(x: b.x, y: a.y)] }
            let x = a.x + (b.x - a.x) * bend
            return [a, CGPoint(x: x, y: a.y), CGPoint(x: x, y: b.y), b]
        }
        if !fh && !th {
            if a.x >= to.minX && a.x <= to.maxX { return [a, CGPoint(x: a.x, y: b.y)] }
            let y = a.y + (b.y - a.y) * bend
            return [a, CGPoint(x: a.x, y: y), CGPoint(x: b.x, y: y), b]
        }
        return fh ? [a, CGPoint(x: b.x, y: a.y), b] : [a, CGPoint(x: a.x, y: b.y), b]
    }

    struct Placement: Equatable {
        let id: String
        let center: CGPoint
        let size: CGSize
        let fits: Bool
    }

    private static func hits(_ a: CGRect, _ b: CGRect, _ by: CGFloat) -> Bool {
        a.minX - by < b.maxX && b.minX - by < a.maxX && a.minY - by < b.maxY && b.minY - by < a.maxY
    }

    private static func segmentRect(_ p: CGPoint, _ q: CGPoint) -> CGRect {
        CGRect(x: min(p.x, q.x), y: min(p.y, q.y), width: abs(q.x - p.x), height: abs(q.y - p.y))
    }

    /// Where each label goes: centred on its own route, the longest segment first, from its middle
    /// outwards; the first place inside `bounds` and clear of every box, other edge and placed label.
    static func placeLabels(routes: [(id: String, points: [CGPoint])], labels: [(id: String, size: CGSize)], boxes: [CGRect], bounds: CGRect) -> [Placement] {
        var placed: [Placement] = []
        func rect(_ c: CGPoint, _ s: CGSize) -> CGRect { CGRect(x: c.x - s.width / 2, y: c.y - s.height / 2, width: s.width, height: s.height) }
        for label in labels {
            guard let own = routes.first(where: { $0.id == label.id }), own.points.count >= 2 else { continue }
            var others: [CGRect] = []
            for r in routes where r.id != label.id {
                for i in r.points.indices.dropFirst() { others.append(segmentRect(r.points[i - 1], r.points[i])) }
            }
            struct Segment { let p: CGPoint; let q: CGPoint; let length: CGFloat; let order: Int }
            var segments: [Segment] = []
            for i in own.points.indices.dropFirst() {
                let p = own.points[i - 1], q = own.points[i]
                segments.append(Segment(p: p, q: q, length: abs(q.x - p.x) + abs(q.y - p.y), order: i))
            }
            // The longest first; of equals, the first along the route (a stable sort, as the core's).
            segments.sort { $0.length != $1.length ? $0.length > $1.length : $0.order < $1.order }
            func free(_ r: CGRect) -> Bool {
                r.minX >= bounds.minX && r.minY >= bounds.minY && r.maxX <= bounds.maxX && r.maxY <= bounds.maxY
                    && !boxes.contains { hits(r, $0, clear) } && !others.contains { hits(r, $0, clear) }
                    && !placed.contains { hits(r, rect($0.center, $0.size), clear) }
            }
            var found: CGPoint?
            search: for s in segments {
                let half = s.length / 2
                var d: CGFloat = 0
                while d <= half {
                    for sign in d == 0 ? [CGFloat(1)] : [1, -1] {
                        let t = s.length == 0 ? 0.5 : (half + sign * d) / s.length
                        let c = CGPoint(x: s.p.x + (s.q.x - s.p.x) * t, y: s.p.y + (s.q.y - s.p.y) * t)
                        if free(rect(c, label.size)) { found = c; break search }
                    }
                    d += step
                }
            }
            if let found {
                placed.append(Placement(id: label.id, center: found, size: label.size, fits: true))
            } else {
                let s = segments[0]
                let mid = CGPoint(x: (s.p.x + s.q.x) / 2, y: (s.p.y + s.q.y) / 2)
                let x = min(max(mid.x, bounds.minX + label.size.width / 2), bounds.maxX - label.size.width / 2)
                let y = min(max(mid.y, bounds.minY + label.size.height / 2), bounds.maxY - label.size.height / 2)
                placed.append(Placement(id: label.id, center: CGPoint(x: x, y: y), size: label.size, fits: false))
            }
        }
        return placed
    }
}

/// The words as given, with a line break allowed after each "/" (package names and paths) and nowhere inside a word.
func axBreakable(_ text: String) -> String { text.replacingOccurrences(of: "/", with: "/\u{200B}") }

/// A line style's dash pattern, as the web draws it: data solid, control dashed, sync dash-dot, build dotted.
func diagramStroke(_ style: DiagramNode.EdgeStyle, highlighted: Bool) -> StrokeStyle {
    let width: CGFloat = highlighted ? 3 : style == .build ? 2.75 : 2
    switch style {
    case .data: return StrokeStyle(lineWidth: width)
    case .control: return StrokeStyle(lineWidth: width, dash: [7, 5])
    case .sync: return StrokeStyle(lineWidth: width, dash: [12, 4, 3, 4])
    case .build: return StrokeStyle(lineWidth: width, lineCap: .round, dash: [0.5, 5])
    }
}

private struct AXPanelElsewhereKey: EnvironmentKey { static var defaultValue: Bool { false } }
private struct AXScrollToKey: EnvironmentKey { static var defaultValue: (@MainActor (String) -> Void)? { nil } }
extension EnvironmentValues {
    /// Drawn to an image of a whole window: the inspector column holds the panel, not the page.
    var axPanelElsewhere: Bool {
        get { self[AXPanelElsewhereKey.self] }
        set { self[AXPanelElsewhereKey.self] = newValue }
    }
    /// Scrolls the screen to a view with that id (the page's ScrollViewReader), where there is one.
    var axScrollTo: (@MainActor (String) -> Void)? {
        get { self[AXScrollToKey.self] }
        set { self[AXScrollToKey.self] = newValue }
    }
}

/// `diagram`: the note, the hint, the legend and the grid with its edges and labels. The selected
/// box's panel is the screen's inspector (`DiagramInspector`): a column on the Mac and iPad that
/// stays open with an empty state, a non-modal sheet on iPhone. Drawn to an image, the panel or
/// the empty state sits beside the grid (or below it on a phone).
struct AXDiagram: View {
    let node: DiagramNode
    @Environment(\.ax) private var ax
    @Environment(\.axWidth) private var width
    @Environment(\.axStatic) private var isStatic
    @Environment(\.axSend) private var send
    @Environment(\.axScrollTo) private var scrollTo
    @Environment(\.axPanelElsewhere) private var panelElsewhere
    @Environment(\.dynamicTypeSize) private var typeSize
    @Environment(\.horizontalSizeClass) private var sizeClass

    /// The core's hint for this platform: the Mac has no Close button in its inspector.
    private var hint: String {
        #if os(macOS)
        node.hintMac
        #else
        node.hint
        #endif
    }

    /// Drawn to an image, the inspector's content sits beside the grid where both fit, else below it.
    private var panelBeside: Bool { isStatic && !panelElsewhere && Double(width - 320 - ax.space(4)) >= node.narrowBelow }
    private var gridWidth: CGFloat { panelBeside ? width - 320 - ax.space(4) : width }
    private var layout: DiagramNode.Layout {
        if node.singleWhenTextIsLarge && typeSize.isAccessibilitySize { return .single }
        if Double(gridWidth) < node.singleBelow { return .single }
        return Double(gridWidth) < node.narrowBelow ? .narrow : .wide
    }

    var body: some View {
        let layout = layout
        let grid = node.grid(layout)
        HStack(alignment: .top, spacing: ax.space(4)) {
            VStack(alignment: .leading, spacing: ax.space(3)) {
                Text(node.note)
                    .font(ax.fontStrong)
                    .foregroundStyle(ax.text)
                    .fixedSize(horizontal: false, vertical: true)
                Text(hint)
                    .font(ax.fontBase)
                    .foregroundStyle(ax.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                DiagramLegend(node: node)
                DiagramCanvas(node: node, layout: layout, width: gridWidth - CGFloat(grid.margin.left + grid.margin.right))
                    .padding(.leading, CGFloat(grid.margin.left))
                    .padding(.trailing, CGFloat(grid.margin.right))
                    .padding(.top, CGFloat(grid.margin.top))
                    .padding(.bottom, CGFloat(grid.pad))
                if isStatic, !panelBeside, !panelElsewhere, let panel = node.panel {
                    AXDiagramPanel(panel: panel, showsClose: true)
                        .padding(ax.space(5))
                        .axSurface(fill: ax.card, radius: ax.radiusContainer, stroke: ax.border)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            if panelBeside {
                Group {
                    if let panel = node.panel { AXDiagramPanel(panel: panel, showsClose: false) } else { DiagramEmpty(node: node) }
                }
                .padding(ax.space(5))
                .frame(width: 320, alignment: .topLeading)
                .axSurface(fill: ax.card, radius: ax.radiusContainer, stroke: ax.border)
            }
        }
        .onChange(of: node.selected, initial: true) { old, selected in
            // Say what happened (the core's sentence), and on a phone bring the box above the sheet.
            if old != selected || selected != nil { AccessibilityNotification.Announcement(hint).post() }
            if let selected, sizeClass == .compact, let scrollTo {
                // After the grid has laid out (on a screen's first appearance it has not yet).
                Task { @MainActor in
                    try? await Task.sleep(for: .milliseconds(400))
                    scrollTo(selected)
                }
            }
        }
        #if os(macOS)
        .onExitCommand { if let panel = node.panel { send(.press(id: panel.closeId)) } }
        #endif
    }
}

/// What the inspector says with nothing selected.
struct DiagramEmpty: View {
    let node: DiagramNode
    @Environment(\.ax) private var ax

    var body: some View {
        VStack(alignment: .leading, spacing: ax.space(2)) {
            Text(node.inspector.emptyTitle).font(ax.heading(2)).foregroundStyle(ax.text).accessibilityAddTraits(.isHeader)
            Text(node.inspector.emptyText).font(ax.fontBase).foregroundStyle(ax.textSecondary).fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
    }
}

/// The line styles and the shared tag, in the core's words.
private struct DiagramLegend: View {
    let node: DiagramNode
    @Environment(\.ax) private var ax

    var body: some View {
        FlowLayout(spacing: ax.space(4)) {
            ForEach(node.legend, id: \.label) { item in
                HStack(spacing: ax.space(2)) {
                    DiagramLineSample(style: item.style).frame(width: 40, height: 12)
                    Text(item.label).font(ax.fontSmall).foregroundStyle(ax.text)
                }
                .accessibilityElement(children: .combine)
            }
            HStack(spacing: ax.space(2)) {
                AXBadge(text: node.sharedTag, tone: .neutral)
                Text(node.sharedLegend).font(ax.fontSmall).foregroundStyle(ax.text)
            }
            .accessibilityElement(children: .combine)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(node.legendLabel)
    }
}

private struct DiagramLineSample: View {
    let style: DiagramNode.EdgeStyle
    @Environment(\.ax) private var ax

    var body: some View {
        Canvas { context, size in
            var path = Path()
            path.move(to: CGPoint(x: 2, y: size.height / 2))
            path.addLine(to: CGPoint(x: size.width - 2, y: size.height / 2))
            context.stroke(path, with: .color(ax.iconSecondary), style: diagramStroke(style, highlighted: false))
        }
        .accessibilityHidden(true)
    }
}

/// Where a subview of the grid goes, and what it is.
private struct DiagramPlacement: LayoutValueKey {
    enum Kind { case group, title, box }
    static var defaultValue: (kind: Kind, area: DiagramNode.Area) { (.box, DiagramNode.Area(col: 0, row: 0, cols: 1, rows: 1)) }
}

/// The core's grid: equal columns, each row as tall as its tallest box or title, groups behind
/// their cells and `pad` beyond them.
private struct DiagramGridLayout: Layout {
    let grid: DiagramNode.Grid
    let pad: CGFloat

    private var gap: CGSize { CGSize(width: grid.gap.x, height: grid.gap.y) }

    private func geometry(width: CGFloat, subviews: Subviews) -> (column: CGFloat, tops: [CGFloat], heights: [CGFloat], height: CGFloat) {
        let column = (width - CGFloat(grid.columns - 1) * gap.width) / CGFloat(max(grid.columns, 1))
        var heights = Array(repeating: CGFloat(0), count: grid.rows)
        for subview in subviews {
            let p = subview[DiagramPlacement.self]
            guard p.kind != .group, p.area.row < grid.rows else { continue }
            let w = CGFloat(p.area.cols) * column + CGFloat(p.area.cols - 1) * gap.width
            heights[p.area.row] = max(heights[p.area.row], subview.sizeThatFits(ProposedViewSize(width: w, height: nil)).height)
        }
        var tops: [CGFloat] = []
        var y: CGFloat = 0
        for r in 0..<grid.rows {
            tops.append(y)
            y += heights[r] + (r < grid.rows - 1 ? gap.height : 0)
        }
        return (column, tops, heights, y)
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? 800
        return CGSize(width: width, height: geometry(width: width, subviews: subviews).height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let g = geometry(width: bounds.width, subviews: subviews)
        for subview in subviews {
            let p = subview[DiagramPlacement.self]
            let a = p.area
            guard a.row + a.rows <= grid.rows else { continue }
            var rect = CGRect(
                x: bounds.minX + CGFloat(a.col) * (g.column + gap.width),
                y: bounds.minY + g.tops[a.row],
                width: CGFloat(a.cols) * g.column + CGFloat(a.cols - 1) * gap.width,
                height: g.tops[a.row + a.rows - 1] + g.heights[a.row + a.rows - 1] - g.tops[a.row]
            )
            if p.kind == .group { rect = rect.insetBy(dx: -pad, dy: -pad) }
            if p.kind == .title {
                // A title keeps its own width (its ground hides the lines behind its words only).
                let size = subview.sizeThatFits(ProposedViewSize(width: rect.width, height: nil))
                subview.place(at: CGPoint(x: rect.minX, y: rect.maxY - size.height), proposal: ProposedViewSize(size))
                continue
            }
            subview.place(at: rect.origin, proposal: ProposedViewSize(rect.size))
        }
    }
}

/// The boxes' and the group titles' frames, by id, for drawing the edges and placing the labels.
private struct DiagramFrames: PreferenceKey {
    static var defaultValue: [String: Anchor<CGRect>] { [:] }
    static func reduce(value: inout [String: Anchor<CGRect>], nextValue: () -> [String: Anchor<CGRect>]) {
        value.merge(nextValue()) { $1 }
    }
}

private struct DiagramCanvas: View {
    let node: DiagramNode
    let layout: DiagramNode.Layout
    let width: CGFloat
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send
    @FocusState private var focused: String?

    private var pad: CGFloat { CGFloat(node.grid(layout).pad) }

    var body: some View {
        let grid = node.grid(layout)
        let column = (width - CGFloat(grid.columns - 1) * grid.gap.x) / CGFloat(max(grid.columns, 1))
        let large = column >= 180
        DiagramGridLayout(grid: grid, pad: pad) {
            ForEach(node.groups, id: \.id) { group in
                RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous)
                    .fill(ax.muted)
                    .anchorPreference(key: DiagramFrames.self, value: .bounds) { ["group:\(group.id)": $0] }
                    .layoutValue(key: DiagramPlacement.self, value: (.group, group.area(layout)))
                    .accessibilityHidden(true)
            }
            ForEach(node.groups, id: \.id) { group in
                let a = group.area(layout)
                // Laid out here for its size and frame; drawn above the edges (`DiagramEdges`).
                DiagramGroupTitle(title: group.title)
                    .hidden()
                    .anchorPreference(key: DiagramFrames.self, value: .bounds) { ["title:\(group.id)": $0] }
                    .layoutValue(key: DiagramPlacement.self, value: (.title, DiagramNode.Area(col: a.col, row: a.row, cols: a.cols, rows: 1)))
                    .accessibilityHidden(true)
            }
            ForEach(Array(node.boxes.enumerated()), id: \.element.id) { index, box in
                DiagramBoxView(box: box, sharedTag: node.sharedTag, large: large, focused: focused == box.id)
                    .id(box.id)
                    .focusable()
                    .focused($focused, equals: box.id)
                    .focusEffectDisabled()
                    .onKeyPress(keys: [.return, .space]) { _ in
                        send(.press(id: box.selectId))
                        return .handled
                    }
                    .anchorPreference(key: DiagramFrames.self, value: .bounds) { [box.id: $0] }
                    .layoutValue(key: DiagramPlacement.self, value: (.box, box.area(layout)))
                    // VoiceOver reads the boxes in the core's order (the flow), not by position.
                    .accessibilitySortPriority(Double(node.boxes.count - index))
            }
        }
        .frame(width: max(width, 0))
        .overlayPreferenceValue(DiagramFrames.self) { anchors in
            GeometryReader { proxy in
                DiagramEdges(node: node, layout: layout, size: proxy.size, frames: anchors.mapValues { proxy[$0] })
            }
            .accessibilityHidden(true)
        }
        #if os(macOS)
        // The arrow keys move between boxes in the flow's order.
        .onMoveCommand { direction in
            let ids = node.boxes.map(\.id)
            let i = focused.flatMap { ids.firstIndex(of: $0) } ?? -1
            switch direction {
            case .down, .right: focused = ids[min(i + 1, ids.count - 1)]
            case .up, .left: focused = ids[max(i - 1, 0)]
            @unknown default: break
            }
        }
        #endif
        .accessibilityElement(children: .contain)
        .accessibilityLabel(node.label)
    }
}

private struct DiagramBoxView: View {
    let box: DiagramNode.Box
    let sharedTag: String
    let large: Bool
    let focused: Bool
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send
    @Environment(\.colorSchemeContrast) private var contrast

    var body: some View {
        let selected = box.state == .selected
        // Dimmed: the ground and border recede; the words stay readable. Under Increase Contrast nothing dims.
        let dimmed = box.state == .dimmed && contrast != .increased
        Button {
            send(.press(id: box.selectId))
        } label: {
            VStack(alignment: .leading, spacing: ax.hair) {
                Text(axBreakable(box.title))
                    .font(large ? ax.font("font-size-lg", 17, weight: "font-weight-semibold") : ax.fontStrong)
                    .foregroundStyle(dimmed ? ax.textSecondary : ax.text)
                if box.shared {
                    // The tag flows after the line's last word, on a line of its own only when there is no room.
                    FlowLayout(spacing: ax.fontSize("font-size-sm", 12) * 0.3) {
                        ForEach(Array(box.detail.split(separator: " ").enumerated()), id: \.offset) { _, word in
                            Text(String(word)).font(large ? ax.fontBase : ax.fontSmall).foregroundStyle(ax.textSecondary)
                        }
                        AXBadge(text: sharedTag, tone: .neutral)
                    }
                    .accessibilityElement(children: .combine)
                } else {
                    Text(axBreakable(box.detail))
                        .font(large ? ax.fontBase : ax.fontSmall)
                        .foregroundStyle(ax.textSecondary)
                }
            }
            .fixedSize(horizontal: false, vertical: true)
            .padding(.horizontal, ax.space(2))
            .padding(.vertical, ax.space(half: 1))
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(
                RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous)
                    .fill(selected ? ax.accentSoft : dimmed ? Color.clear : ax.card)
            )
            .overlay(
                RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous)
                    .strokeBorder(selected ? ax.accent : box.state == .linked ? ax.borderStrong : ax.border, lineWidth: selected ? 2 : 1)
            )
            .overlay(
                // The keyboard's focus ring, outside the box.
                RoundedRectangle(cornerRadius: ax.radiusElement + 3, style: .continuous)
                    .strokeBorder(ax.accent, lineWidth: 2)
                    .padding(-4)
                    .opacity(focused ? 1 : 0)
            )
            .contentShape(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(box.accessibilityLabel)
        .accessibilityValue(box.accessibilityValue)
        .accessibilityAddTraits(selected ? .isSelected : [])
        .help(box.detail)
    }
}

/// The edges over the grid, routed between the boxes' frames, with the labels that have a clear place.
private struct DiagramEdges: View {
    let node: DiagramNode
    let layout: DiagramNode.Layout
    let size: CGSize
    let frames: [String: CGRect]
    @Environment(\.ax) private var ax
    @Environment(\.colorSchemeContrast) private var contrast

    private struct Drawn: Identifiable {
        let id: String
        let points: [CGPoint]
        let edge: DiagramNode.Edge
    }

    private var labelSize: CGFloat { ax.fontSize("font-size-sm", 12) }

    /// A label's size as drawn: its words on one line, the padding and the border.
    private func measure(_ label: String) -> CGSize {
        let font = CTFontCreateUIFontForLanguage(.system, labelSize, nil) ?? CTFontCreateWithName("Helvetica" as CFString, labelSize, nil)
        let line = CTLineCreateWithAttributedString(NSAttributedString(string: label, attributes: [NSAttributedString.Key(kCTFontAttributeName as String): font]))
        let width = ceil(CGFloat(CTLineGetTypographicBounds(line, nil, nil, nil)) * 1.06) + 2 * ax.space(1) + 2
        // One line at 1.25 of the size, and the border: 17 points at 12, as the web draws it.
        return CGSize(width: width, height: ceil(labelSize * ax.size("text-label-leading", 1.4286)) + 2)
    }

    var body: some View {
        let gridRect = CGRect(origin: .zero, size: size)
        let edges: [Drawn] = node.edges.filter { $0.isDrawn(layout) }.compactMap { edge in
            guard let from = frames[edge.from], let to = frames[edge.toGroup ? "group:\(edge.to)" : edge.to] else { return nil }
            return Drawn(id: edge.id, points: DiagramRouting.route(from: from, to: to, edge.route(layout), grid: gridRect), edge: edge)
        }
        let grid = node.grid(layout)
        let obstacles = frames.filter { !$0.key.hasPrefix("group:") }.map(\.value)
        let bounds = CGRect(x: -grid.margin.left, y: -grid.margin.top, width: size.width + grid.margin.left + grid.margin.right, height: size.height + grid.margin.top + grid.pad)
        let wanted = grid.labels ? edges.filter(\.edge.showLabel).map { (id: $0.id, size: measure($0.edge.label)) } : []
        let placed = DiagramRouting.placeLabels(routes: edges.map { (id: $0.id, points: $0.points) }, labels: wanted, boxes: obstacles, bounds: bounds).filter(\.fits)
        // The layer reaches over the margins (routes run there), shifted back so the grid's coordinates still hold.
        let shift = CGSize(width: bounds.minX, height: bounds.minY)
        ZStack(alignment: .topLeading) {
            Canvas { context, _ in
                context.translateBy(x: -shift.width, y: -shift.height)
                for d in edges {
                    let highlighted = d.edge.state == .highlighted
                    let color = highlighted ? ax.accent : ax.iconSecondary
                    var layer = context
                    layer.opacity = d.edge.state == .dimmed && contrast != .increased ? 0.3 : 1
                    var path = Path()
                    path.addLines(d.points)
                    layer.stroke(path, with: .color(color), style: diagramStroke(d.edge.style, highlighted: highlighted))
                    if d.points.count >= 2 {
                        layer.fill(arrow(d.points[d.points.count - 2], d.points[d.points.count - 1]), with: .color(color))
                        if d.edge.direction == .both { layer.fill(arrow(d.points[1], d.points[0]), with: .color(color)) }
                    }
                }
            }
            // The group titles, above the edges on an opaque ground.
            ForEach(node.groups, id: \.id) { group in
                if let frame = frames["title:\(group.id)"] {
                    DiagramGroupTitle(title: group.title)
                        .frame(width: frame.width, height: frame.height, alignment: .leading)
                        .position(x: frame.midX - shift.width, y: frame.midY - shift.height)
                }
            }
            ForEach(placed, id: \.id) { p in
                let edge = node.edges.first { $0.id == p.id }!
                let highlighted = edge.state == .highlighted
                Text(edge.label)
                    .font(.system(size: labelSize, weight: .medium))
                    .foregroundStyle(highlighted ? ax.color("color-text-accent") : ax.textSecondary)
                    .lineLimit(1)
                    .fixedSize()
                    .frame(width: p.size.width, height: p.size.height)
                    .background(
                        RoundedRectangle(cornerRadius: ax.radiusInner, style: .continuous)
                            .fill(ax.surface)
                            .overlay(RoundedRectangle(cornerRadius: ax.radiusInner, style: .continuous).strokeBorder(highlighted ? ax.accent : ax.border, lineWidth: 1))
                    )
                    .position(x: p.center.x - shift.width, y: p.center.y - shift.height)
            }
        }
        .frame(width: bounds.width, height: bounds.height, alignment: .topLeading)
        .offset(x: shift.width, y: shift.height)
        .allowsHitTesting(false)
    }

    /// A filled arrowhead at `q`, pointing along p→q (the web's geometry).
    private func arrow(_ p: CGPoint, _ q: CGPoint) -> Path {
        let length = max(hypot(q.x - p.x, q.y - p.y), 1)
        let ux = (q.x - p.x) / length, uy = (q.y - p.y) / length
        let s: CGFloat = 8, w: CGFloat = 4.5
        let bx = q.x - ux * s, by = q.y - uy * s
        var path = Path()
        path.move(to: q)
        path.addLine(to: CGPoint(x: bx - uy * w, y: by + ux * w))
        path.addLine(to: CGPoint(x: bx + uy * w, y: by - ux * w))
        path.closeSubpath()
        return path
    }
}

/// The selected box: what it is, its numbers, its connections (each selects the box at the other
/// end) and its files. All of it in the core's words. `showsClose`: in a sheet or below the grid;
/// a Mac inspector has no close button of its own (it is shown and hidden from the toolbar).
struct AXDiagramPanel: View {
    let panel: DiagramNode.Panel
    var showsClose: Bool = true
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send

    var body: some View {
        VStack(alignment: .leading, spacing: ax.space(4)) {
            HStack(alignment: .top, spacing: ax.space(2)) {
                VStack(alignment: .leading, spacing: ax.space(1)) {
                    Text(panel.group).font(ax.fontSmall).foregroundStyle(ax.textSecondary)
                    Text(panel.title).font(ax.heading(2)).foregroundStyle(ax.text)
                        .accessibilityAddTraits(.isHeader)
                    Text(panel.detail).font(ax.fontBase).foregroundStyle(ax.textSecondary)
                }
                Spacer(minLength: 0)
                if showsClose {
                    Button {
                        send(.press(id: panel.closeId))
                    } label: {
                        Image(systemName: "xmark")
                            .font(ax.fontBase)
                            .foregroundStyle(ax.iconSecondary)
                            .frame(minWidth: chromeTarget, minHeight: chromeTarget)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(panel.closeLabel)
                    .help(panel.closeLabel)
                    .keyboardShortcut(.cancelAction)
                }
            }
            Text(panel.about)
                .font(ax.fontBase)
                .foregroundStyle(ax.text)
                .axLeading(ax, size: ax.fontSize("font-size-base", 14), ratio: ax.bodyLeading)
                .fixedSize(horizontal: false, vertical: true)
            if !panel.facts.isEmpty {
                section(panel.factsLabel) {
                    Grid(alignment: .topLeading, horizontalSpacing: ax.space(3), verticalSpacing: ax.space(2)) {
                        ForEach(Array(panel.facts.enumerated()), id: \.offset) { _, fact in
                            GridRow {
                                Text(fact.label).font(ax.fontBase).foregroundStyle(ax.textSecondary)
                                Text(fact.value).font(ax.fontBase.monospacedDigit()).foregroundStyle(ax.text)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                            .accessibilityElement(children: .combine)
                        }
                    }
                }
            }
            section(panel.linksLabel) {
                VStack(alignment: .leading, spacing: ax.space(1)) {
                    ForEach(Array(panel.links.enumerated()), id: \.offset) { _, link in
                        Button {
                            send(.press(id: link.selectId))
                        } label: {
                            HStack(alignment: .firstTextBaseline, spacing: ax.space(2)) {
                                Image(systemName: "arrow.right").font(ax.fontSmall).foregroundStyle(ax.iconSecondary)
                                    .accessibilityHidden(true)
                                Text(link.text).font(ax.fontBase).foregroundStyle(ax.color("color-text-accent"))
                                    .multilineTextAlignment(.leading)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                            .frame(maxWidth: .infinity, minHeight: chromeTarget, alignment: .leading)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            section(panel.filesLabel) {
                VStack(alignment: .leading, spacing: ax.space(1)) {
                    ForEach(panel.files, id: \.self) { file in
                        Text(axBreakable(file))
                            .font(ax.font("font-size-sm", 12, design: .monospaced))
                            .foregroundStyle(ax.textSecondary)
                            .textSelection(.enabled)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
    }

    private func section<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: ax.space(2)) {
            Text(title).font(ax.heading(3)).foregroundStyle(ax.text).accessibilityAddTraits(.isHeader)
            content()
        }
    }
}

/// The diagram's panel as the screen's inspector (HIG, Inspectors). On the Mac and iPad it is a
/// column that stays open (showing "No Selection" until a box is selected), shown and hidden from
/// a toolbar button and View > Show Inspector; selecting never opens, closes or moves anything. On
/// iPhone it is a non-modal sheet: the diagram stays bright and tappable behind it up to the
/// medium height, and closing it clears the selection.
struct DiagramInspector: ViewModifier {
    let screenBody: Node
    @Environment(\.axSend) private var send
    @Environment(\.axStatic) private var isStatic
    @Environment(\.horizontalSizeClass) private var sizeClass
    @Environment(\.ax) private var ax
    @AppStorage("AXDiagramInspectorShown") private var shown = true

    private var diagram: DiagramNode? {
        if case .diagram(let d) = screenBody { return d }
        return nil
    }

    func body(content: Content) -> some View {
        if let diagram, !isStatic {
            if sizeClass == .compact {
                // On iPhone the inspector is a sheet (HIG, Inspectors); presented as one directly.
                content.sheet(isPresented: Binding(
                    get: { diagram.panel != nil },
                    set: { open in if !open, let panel = diagram.panel { send(.press(id: panel.closeId)) } }
                )) {
                    sheet(diagram)
                        .presentationDetents([.medium, .large])
                        .presentationBackgroundInteraction(.enabled(upThrough: .medium))
                        .presentationDragIndicator(.visible)
                }
            } else {
                content
                    .inspector(isPresented: $shown) {
                        ScrollView {
                            Group {
                                if let panel = diagram.panel { AXDiagramPanel(panel: panel, showsClose: false) } else { DiagramEmpty(node: diagram) }
                            }
                            .padding(20)
                        }
                        .inspectorColumnWidth(min: 240, ideal: 260, max: 420)
                    }
                    .toolbar {
                        ToolbarItem(placement: .primaryAction) {
                            Button { shown.toggle() } label: { Label(diagram.inspector.label, systemImage: "sidebar.trailing") }
                                .help(diagram.inspector.label)
                        }
                    }
            }
        } else {
            content
        }
    }

    /// On iPhone: the panel in a navigation stack with a Close button in the sheet's own bar.
    @ViewBuilder
    private func sheet(_ diagram: DiagramNode) -> some View {
        NavigationStack {
            ScrollView {
                if let panel = diagram.panel { AXDiagramPanel(panel: panel, showsClose: false).padding(20) }
            }
            .toolbar {
                if let panel = diagram.panel {
                    ToolbarItem(placement: .cancellationAction) {
                        Button(panel.closeLabel) { send(.press(id: panel.closeId)) }
                    }
                }
            }
        }
    }
}

/// A group's title on the group's own ground, made opaque over the surface, so no line shows through it.
struct DiagramGroupTitle: View {
    let title: String
    @Environment(\.ax) private var ax

    var body: some View {
        Text(title)
            .font(ax.font("font-size-sm", 12, weight: "font-weight-semibold"))
            .foregroundStyle(ax.textSecondary)
            .padding(.trailing, ax.space(2))
            .background(
                RoundedRectangle(cornerRadius: ax.radiusInner)
                    .fill(ax.muted)
                    .background(RoundedRectangle(cornerRadius: ax.radiusInner).fill(ax.surface))
            )
            .fixedSize()
    }
}
