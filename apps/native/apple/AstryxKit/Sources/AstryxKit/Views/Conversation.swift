import SwiftUI

/// `chat`: message bubbles and a composer. The composer's text is sent as `set` while typing
/// and its send button, when the core says it can, as `press` with `sendId`.
struct AXChat: View {
    let node: ChatNode
    @Environment(\.ax) private var ax

    var body: some View {
        VStack(alignment: .leading, spacing: ax.space(4)) {
            VStack(spacing: ax.space(3)) {
                ForEach(node.messages, id: \.id) { message in
                    AXBubble(message: message)
                }
            }
            AXComposer(composer: node.composer)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct AXBubble: View {
    let message: ChatMessage
    @Environment(\.ax) private var ax
    @Environment(\.axWidth) private var width

    var body: some View {
        HStack(alignment: .bottom, spacing: ax.space(2)) {
            if message.mine { Spacer(minLength: width * 0.18) }
            if !message.mine {
                AXAvatar(name: message.author, initials: message.initials, hue: message.hue, size: .sm)
            }
            VStack(alignment: message.mine ? .trailing : .leading, spacing: ax.hair) {
                Text(message.text)
                    .font(ax.fontBase)
                    .foregroundStyle(message.mine ? ax.onAccent : ax.text)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.horizontal, ax.space(3))
                    .padding(.vertical, ax.space(2) + 1)
                    .background(
                        RoundedRectangle(cornerRadius: ax.radiusContainer + 4, style: .continuous)
                            .fill(message.mine ? ax.accent : ax.card)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: ax.radiusContainer + 4, style: .continuous)
                            .strokeBorder(message.mine ? .clear : ax.border, lineWidth: 1)
                    )
                Text(message.author + " · " + message.time)
                    .font(ax.fontXSmall)
                    .foregroundStyle(ax.textSecondary)
            }
            if !message.mine { Spacer(minLength: width * 0.18) }
        }
        .frame(maxWidth: .infinity, alignment: message.mine ? .trailing : .leading)
        .accessibilityElement(children: .combine)
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
        HStack(spacing: ax.space(2)) {
            if isStatic {
                Text(text.isEmpty ? composer.placeholder : text)
                    .font(ax.fontBase)
                    .foregroundStyle(text.isEmpty ? ax.textDisabled : ax.text)
                    .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                TextField(composer.placeholder, text: $text, prompt: Text(composer.placeholder).foregroundColor(ax.textDisabled))
                    .textFieldStyle(.plain)
                    .font(ax.fontBase)
                    .foregroundStyle(ax.text)
                    .submitLabel(.send)
                    .onSubmit { submit() }
            }
            Button {
                submit()
            } label: {
                Image(systemName: Icon(rawValue: "send").symbol)
                    .font(.system(size: ax.fontSize("font-size-base", 14), weight: .semibold))
                    .foregroundStyle(composer.canSend ? ax.onAccent : ax.textDisabled)
                    .frame(width: 32 * min(ax.scale, 1.4), height: 32 * min(ax.scale, 1.4))
                    .background(Circle().fill(composer.canSend ? ax.accent : ax.muted))
                    .contentShape(Circle())
            }
            .buttonStyle(.plain)
            .disabled(!composer.canSend)
            .accessibilityLabel(composer.sendLabel)
        }
        .padding(.leading, ax.space(4))
        .padding(.trailing, ax.space(2))
        .padding(.vertical, ax.space(2))
        .background(Capsule().fill(ax.surface))
        .overlay(Capsule().strokeBorder(ax.borderStrong, lineWidth: 1))
        .syncedText(id: composer.id, value: composer.value, text: $text)
    }

    private func submit() {
        if composer.canSend { send(.press(id: composer.sendId)) }
    }
}

/// `board`: columns of cards that scroll sideways. A card's move controls send `press`.
struct AXBoard: View {
    let node: BoardNode
    @Environment(\.ax) private var ax

    var body: some View {
        AXHScroll {
            HStack(alignment: .top, spacing: ax.space(3)) {
                ForEach(node.columns, id: \.id) { column in
                    AXBoardColumn(column: column)
                }
            }
            .padding(.horizontal, 1)
        }
    }
}

private struct AXBoardColumn: View {
    let column: BoardColumn
    @Environment(\.ax) private var ax

    var body: some View {
        VStack(alignment: .leading, spacing: ax.space(3)) {
            HStack(spacing: ax.space(2)) {
                Text(column.title).font(ax.fontStrong).foregroundStyle(ax.text)
                    .accessibilityAddTraits(.isHeader)
                Text(column.count)
                    .font(ax.font("font-size-xs", 10, weight: "font-weight-semibold").monospacedDigit())
                    .foregroundStyle(ax.textSecondary)
                    .padding(.horizontal, ax.space(half: 1))
                    .padding(.vertical, 1)
                    .background(Capsule().fill(ax.muted))
                Spacer(minLength: 0)
            }
            ForEach(column.cards, id: \.id) { card in
                AXBoardCard(card: card)
            }
        }
        .padding(ax.space(3))
        .frame(width: 280 * min(ax.scale, 1.4), alignment: .topLeading)
        .background(RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous).fill(ax.muted))
    }
}

private struct AXBoardCard: View {
    let card: BoardCard
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send

    var body: some View {
        VStack(alignment: .leading, spacing: ax.space(3)) {
            Text(card.title)
                .font(ax.fontLabel)
                .foregroundStyle(ax.text)
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
                Text(card.due).font(ax.fontSmall).foregroundStyle(card.dueTone == .neutral ? ax.textSecondary : ax.tone(card.dueTone).text)
                Spacer(minLength: 0)
                move("chevron.left", id: card.moveBackId, label: card.moveBackLabel)
                move("chevron.right", id: card.moveForwardId, label: card.moveForwardLabel)
            }
        }
        .padding(ax.space(3))
        .frame(maxWidth: .infinity, alignment: .leading)
        .axSurface(fill: ax.card, radius: ax.radiusElement + 2)
    }

    @ViewBuilder
    private func move(_ symbol: String, id: String?, label: String) -> some View {
        if let id {
            Button {
                send(.press(id: id))
            } label: {
                Image(systemName: symbol)
                    .font(.system(size: ax.fontSize("font-size-sm", 12), weight: .semibold))
                    .foregroundStyle(ax.iconSecondary)
                    .frame(width: 30, height: 30)
                    .background(RoundedRectangle(cornerRadius: ax.radiusInner + 2, style: .continuous).fill(ax.muted))
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(label)
        }
    }
}
