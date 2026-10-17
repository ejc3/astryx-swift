import SwiftUI

/// Draws one node of the screen tree: the view named after its kind.
struct NodeView: View {
    let node: Node

    var body: some View {
        switch node {
        case .stack(let n): AXStack(node: n)
        case .grid(let n): AXGrid(node: n)
        case .split(let n): AXSplit(node: n)
        case .card(let n): AXCard(node: n)
        case .section(let n): AXSection(node: n)
        case .heading(let n): AXHeading(node: n)
        case .text(let n): AXText(node: n)
        case .badge(let n): AXBadge(text: n.text, tone: n.tone)
        case .token(let n): AXToken(node: n)
        case .button(let n): AXButton(node: n)
        case .iconButton(let n): AXIconButton(node: n)
        case .textInput(let n): AXTextInput(node: n)
        case .toggle(let n): AXSwitch(node: n)
        case .checkbox(let n): AXCheckbox(node: n)
        case .radio(let n): AXRadio(node: n)
        case .segmented(let n): AXSegmented(node: n)
        case .select(let n): AXSelect(node: n)
        case .slider(let n): AXSlider(node: n)
        case .progress(let n): AXProgress(node: n)
        case .avatar(let n): AXAvatar(name: n.name, initials: n.initials, hue: n.hue, size: n.size, status: n.status, statusLabel: n.statusLabel)
        case .avatarGroup(let n): AXAvatarGroup(node: n)
        case .statusDot(let n): AXStatusDot(node: n)
        case .divider: AXDivider()
        case .kbd(let n): AXKbd(node: n)
        case .metric(let n): AXMetric(node: n)
        case .bars(let n): AXBars(node: n)
        case .table(let n): AXTable(node: n)
        case .list(let n): AXList(node: n)
        case .tabs(let n): AXTabs(node: n)
        case .stepper(let n): AXStepper(node: n)
        case .banner(let n): AXBanner(node: n)
        case .empty(let n): AXEmpty(node: n)
        case .metadata(let n): AXMetadata(node: n)
        case .pagination(let n): AXPagination(node: n)
        case .calendar(let n): AXCalendar(node: n)
        case .chat(let n): AXChat(node: n)
        case .board(let n): AXBoard(node: n)
        case .unknown(let kind): AXPlaceholder(kind: kind)
        }
    }
}

/// What an unknown node draws as: visible, so a missing kind is noticed, and never fatal.
struct AXPlaceholder: View {
    let kind: String
    @Environment(\.ax) private var ax

    var body: some View {
        HStack(spacing: ax.space(2)) {
            Image(systemName: "questionmark.square.dashed")
            Text(kind).font(ax.font("font-size-sm", 12, design: .monospaced))
        }
        .foregroundStyle(ax.tone(.warning).text)
        .padding(ax.space(2))
        .background(
            RoundedRectangle(cornerRadius: ax.radiusElement)
                .strokeBorder(ax.tone(.warning).solid, style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
        )
        .accessibilityLabel(kind)
    }
}

/// The node's children, in order.
struct NodeChildren: View {
    let nodes: [Node]

    var body: some View {
        ForEach(Array(nodes.enumerated()), id: \.offset) { _, node in
            NodeView(node: node)
        }
    }
}
