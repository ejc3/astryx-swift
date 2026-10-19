import SwiftUI

/// `chat`: message bubbles and a composer, in one bordered box as tall as 68 % of the window
/// (420 to 720 pt; on a phone the page's height less its gutters, as the web's `flex: 1` box
/// fills the page): the messages scroll inside it, from the bottom, and the composer is pinned
/// under them. The composer's text is sent as `set` while typing and its send button, when the
/// core says it can, as `press` with `sendId`.
struct AXChat: View {
    let node: ChatNode
    @Environment(\.ax) private var ax
    @Environment(\.axHeight) private var windowHeight
    @Environment(\.axWidth) private var width
    @Environment(\.axStatic) private var isStatic

    /// The box's height. On a phone it fills the page: the visible height under the navigation
    /// bar, less the page's gutter above and below, so the composer sits at the bottom.
    private var boxHeight: CGFloat {
        #if os(iOS)
        let gutter = width + 2 * ax.space(4) < 600 ? ax.space(4) : ax.space(6)
        return max(windowHeight - 2 * gutter, 420)
        #else
        return min(max(windowHeight * 0.68, 420), 720)
        #endif
    }

    var body: some View {
        let height = boxHeight
        VStack(spacing: 0) {
            if isStatic {
                // A picture has no scroller: the last messages sit above the composer.
                Color.clear
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .overlay(alignment: .bottom) { messages }
                    .clipped()
            } else {
                ScrollView {
                    messages
                }
                .defaultScrollAnchor(.bottom)
                .frame(maxHeight: .infinity)
            }
            AXComposer(composer: node.composer)
                .padding(.horizontal, ax.space(3))
                .padding(.bottom, ax.space(3))
                .padding(.top, ax.space(1))
        }
        .frame(height: height)
        .frame(maxWidth: .infinity)
        .background(RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous).fill(ax.surface))
        .clipShape(RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous).strokeBorder(ax.border, lineWidth: 1))
    }

    private var messages: some View {
        VStack(spacing: ax.space(6)) {
            ForEach(node.messages, id: \.id) { message in
                AXBubble(message: message)
            }
        }
        .padding(ax.space(4))
        .frame(maxWidth: .infinity)
    }
}

/// A box at its content's one-line width, and at `cap` when the content needs more than that (a
/// wrapped box is as wide as it may be, not as wide as its widest line).
private struct AXHugOrFill: Layout {
    let cap: CGFloat

    private func width(_ proposal: ProposedViewSize, _ subview: LayoutSubview) -> CGFloat {
        let room = min(proposal.width ?? .infinity, cap)
        return min(subview.sizeThatFits(.unspecified).width, room)
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        guard let subview = subviews.first else { return .zero }
        let w = width(proposal, subview)
        return CGSize(width: w, height: subview.sizeThatFits(ProposedViewSize(width: w, height: nil)).height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        subviews.first?.place(at: bounds.origin, proposal: ProposedViewSize(width: bounds.width, height: bounds.height))
    }
}

/// One message as Astryx's Chat draws it: the avatar (36) beside a column of the sender's name,
/// the bubble and the time. Your own messages mirror this, with the avatar at the trailing edge.
/// Both senders' bubbles are `color-neutral`, with primary text.
private struct AXBubble: View {
    let message: ChatMessage
    @Environment(\.ax) private var ax
    @Environment(\.axWidth) private var width

    var body: some View {
        let avatar = 36 * min(ax.scale, 1.6)
        let gap = ax.space(2)
        // The bubble is at most 80 % of the column beside the avatar, and at least 280 pt.
        let cap = max(0.8 * (width - 2 * ax.space(4) - avatar - gap), 280)
        HStack(alignment: .top, spacing: gap) {
            if !message.mine { avatarView }
            VStack(alignment: message.mine ? .trailing : .leading, spacing: ax.space(1)) {
                Text(message.author)
                    .font(ax.font("font-size-sm", 12, weight: "font-weight-semibold"))
                    .foregroundStyle(ax.textSecondary)
                // One line when the text fits it; else the bubble takes the whole width it may
                // have, as a wrapped CSS box takes its max width (no spacer beside it to halve it).
                AXHugOrFill(cap: cap) { bubble }
                Text(message.time)
                    .font(ax.fontSmall)
                    .foregroundStyle(ax.textSecondary)
                    .padding(.top, ax.hair)
            }
            if message.mine { avatarView }
        }
        .frame(maxWidth: .infinity, alignment: message.mine ? .trailing : .leading)
        .accessibilityElement(children: .combine)
    }

    private var bubble: some View {
        Text(message.text)
            .font(ax.fontBase)
            .foregroundStyle(ax.text)
            .lineSpacing(ax.lineSpacing(size: ax.fontSize("font-size-base", 14), ratio: ax.bodyLeading))
            .multilineTextAlignment(.leading)
            // Inside the fill, so the pill is as wide as the box it is given, not as its widest line.
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, ax.space(4))
            .padding(.vertical, ax.space(3))
            .background(
                RoundedRectangle(cornerRadius: ax.size("radius-chat", 28), style: .continuous)
                    .fill(ax.color("color-neutral"))
            )
    }

    private var avatarView: some View {
        AXAvatar(name: message.author, initials: message.initials, hue: message.hue, size: .md)
    }
}

/// A button that draws its label as it is, disabled or not (the plain style dims a disabled one).
private struct AXUndimmedButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
    }
}

private struct AXComposer: View {
    let composer: ChatNode.Composer
    @State private var text: String
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send
    @Environment(\.axStatic) private var isStatic

    init(composer: ChatNode.Composer) {
        self.composer = composer
        _text = State(initialValue: composer.value)
    }

    var body: some View {
        // Astryx's ChatComposer: a rounded box with a soft shadow, a two-line field with the
        // placeholder at its top left, and the send button at the bottom right.
        let line = ax.fieldFontSize * ax.bodyLeading
        HStack(alignment: .bottom, spacing: ax.space(2)) {
            if isStatic {
                Text(text.isEmpty ? composer.placeholder : text)
                    .font(ax.fieldFont)
                    .foregroundStyle(text.isEmpty ? ax.textDisabled : ax.text)
                    .frame(maxWidth: .infinity, minHeight: 2 * line, alignment: .topLeading)
            } else {
                TextField(composer.placeholder, text: $text, prompt: Text(composer.placeholder).foregroundColor(ax.textDisabled), axis: .vertical)
                    .textFieldStyle(.plain)
                    .lineLimit(2...6)
                    .font(ax.fieldFont)
                    .foregroundStyle(ax.text)
                    .submitLabel(.send)
                    .onSubmit { submit() }
                    .frame(maxWidth: .infinity, minHeight: 2 * line, alignment: .topLeading)
            }
            Button {
                submit()
            } label: {
                Image(systemName: Icon(rawValue: "send").symbol)
                    .font(.system(size: ax.fontSize("font-size-base", 14), weight: .semibold))
                    .foregroundStyle(ax.onAccent)
                    .frame(width: 32 * min(ax.scale, 1.4), height: 32 * min(ax.scale, 1.4))
                    .background(Circle().fill(ax.accent))
                    .opacity(composer.canSend ? 1 : 0.5)
                    .contentShape(Circle())
                    .axTapTarget(keepLayout: true)
            }
            // The plain style dims a disabled button too; dimmed once, like Astryx's.
            .buttonStyle(AXUndimmedButtonStyle())
            .disabled(!composer.canSend)
            .accessibilityLabel(composer.sendLabel)
        }
        .padding(.leading, ax.space(4))
        .padding(.trailing, ax.space(2))
        .padding(.vertical, ax.space(3))
        .background(
            RoundedRectangle(cornerRadius: ax.radiusContainer * 2, style: .continuous)
                .fill(ax.surface)
                .shadow(color: ax.shadow, radius: 8, y: 2)
        )
        .syncedText(id: composer.id, value: composer.value, text: $text)
    }

    private func submit() {
        if composer.canSend { send(.press(id: composer.sendId)) }
    }
}

/// `board`: columns of cards, as the web's `.an-board` lays them out: at least 240 pt each,
/// sharing the width between them, and scrolling sideways when they do not fit. A card's move
/// controls send `press`.
struct AXBoard: View {
    let node: BoardNode
    @Environment(\.ax) private var ax
    @Environment(\.axWidth) private var width

    var body: some View {
        let gap = ax.space(4)
        let count = CGFloat(max(node.columns.count, 1))
        let column = max(240 * min(ax.scale, 1.4), (width - gap * (count - 1)) / count)
        if let below = node.stackBelow, Double(width) < below {
            VStack(alignment: .leading, spacing: gap) {
                ForEach(node.columns, id: \.id) { col in
                    AXBoardColumn(column: col)
                        .frame(maxWidth: .infinity, alignment: .topLeading)
                }
            }
        } else {
        AXHScroll {
            HStack(alignment: .top, spacing: gap) {
                ForEach(node.columns, id: \.id) { col in
                    AXBoardColumn(column: col)
                        .frame(width: column, alignment: .topLeading)
                }
            }
            .padding(.bottom, ax.space(2))
        }
        }
    }
}

private struct AXBoardColumn: View {
    let column: BoardColumn
    @Environment(\.ax) private var ax

    var body: some View {
        VStack(alignment: .leading, spacing: ax.space(3)) {
            HStack(spacing: ax.space(2)) {
                Text(column.title).font(ax.heading(4)).foregroundStyle(ax.text)
                    .accessibilityAddTraits(.isHeader)
                AXBadge(text: column.count, tone: .neutral)
                Spacer(minLength: 0)
            }
            VStack(spacing: ax.space(2)) {
                ForEach(column.cards, id: \.id) { card in
                    AXBoardCard(card: card)
                }
            }
        }
        .padding(ax.space(3))
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .background(RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous).fill(ax.muted))
    }
}

private struct AXBoardCard: View {
    let card: BoardCard
    @Environment(\.ax) private var ax

    var body: some View {
        VStack(alignment: .leading, spacing: ax.space(2)) {
            Text(card.title)
                .font(ax.fontLabel)
                .foregroundStyle(ax.text)
                .axLeading(ax, size: ax.fontSize("font-size-base", 14), ratio: ax.bodyLeading)
                .fixedSize(horizontal: false, vertical: true)
            if !card.tags.isEmpty {
                FlowLayout(spacing: ax.space(1)) {
                    ForEach(Array(card.tags.enumerated()), id: \.offset) { _, tag in
                        AXBadge(text: tag.text, tone: tag.tone)
                    }
                }
            }
            HStack(spacing: ax.space(2)) {
                AXAvatar(name: card.assignee.initials, initials: card.assignee.initials, hue: card.assignee.hue, size: .sm)
                Text(card.due).font(ax.fontXSmall).foregroundStyle(ax.textTone(card.dueTone))
                Spacer(minLength: 0)
                move("chevron-left", id: card.moveBackId, label: card.moveBackLabel)
                move("chevron-right", id: card.moveForwardId, label: card.moveForwardLabel)
            }
        }
        .padding(ax.space(3))
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous)
                .fill(ax.card)
                .shadow(color: .black.opacity(0.1), radius: 0.5, y: 1)
                .shadow(color: .black.opacity(0.1), radius: 4, y: 2)
        )
        .overlay(RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous).strokeBorder(ax.border, lineWidth: 1))
    }

    /// Astryx's small ghost icon button: no fill, the chevron in the primary text color.
    @ViewBuilder
    private func move(_ icon: String, id: String?, label: String) -> some View {
        if let id {
            AXIconButton(node: IconButtonNode(id: id, icon: Icon(rawValue: icon), label: label, selected: nil), small: true)
        }
    }
}
