import SwiftUI

/// The support chat card: header with two icon buttons, the messages (a detail card with
/// amounts, a badge and a link inside one reply), suggestion chips and the composer.
struct ShowChat: View {
    let chat: ShowModel.Chat
    @Environment(\.ax) private var ax

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: ax.space(3)) {
                Text(chat.heading)
                    .font(ax.heading(2))
                    .foregroundStyle(ax.text)
                    .axLeading(ax, size: ax.fontSize("text-heading-2-size", 20), ratio: ax.headingLeading(2))
                    .accessibilityAddTraits(.isHeader)
                Spacer(minLength: ax.space(2))
                HStack(spacing: ax.space(1)) {
                    ForEach(Array(chat.actions.enumerated()), id: \.offset) { _, action in
                        ShowIconButton(symbol: ShowModel.symbol(action.icon), label: action.label)
                    }
                }
            }
            .padding(ax.space(4))
            Rectangle().fill(ax.border).frame(height: 1)
            VStack(alignment: .leading, spacing: ax.space(4)) {
                ForEach(Array(chat.messages.enumerated()), id: \.offset) { _, line in
                    ShowChatLine(line: line)
                }
            }
            .padding(ax.space(4))
            .frame(maxWidth: .infinity, alignment: .leading)
            // The suggestions: secondary small buttons, centered, 4 apart.
            ShowCenterFlow(spacing: ax.space(1)) {
                ForEach(Array(chat.suggestions.enumerated()), id: \.offset) { _, question in
                    Button {} label: {
                        Text(question).lineLimit(1)
                    }
                    .buttonStyle(AXButtonStyle(variant: .secondary, ax: ax, small: true))
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.horizontal, ax.space(4))
            .padding(.bottom, ax.space(2))
            ShowChatComposer(composer: chat.composer)
                .padding(.horizontal, ax.space(4))
                .padding(.bottom, ax.space(4))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .axSurface(fill: ax.surface, radius: ax.radiusContainer)
        .accessibilityElement(children: .contain)
    }
}

/// A wrapping row whose lines are each centered.
struct ShowCenterFlow: Layout {
    var spacing: CGFloat

    private struct Line { var indices: [Int] = []; var width: CGFloat = 0; var height: CGFloat = 0 }

    private func lines(_ limit: CGFloat, _ subviews: Subviews) -> [Line] {
        var lines: [Line] = []
        var line = Line()
        for index in subviews.indices {
            let size = subviews[index].sizeThatFits(.unspecified)
            let needed = line.indices.isEmpty ? size.width : line.width + spacing + size.width
            if needed > limit, !line.indices.isEmpty {
                lines.append(line)
                line = Line()
            }
            line.width = line.indices.isEmpty ? size.width : line.width + spacing + size.width
            line.height = max(line.height, size.height)
            line.indices.append(index)
        }
        if !line.indices.isEmpty { lines.append(line) }
        return lines
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let limit = proposal.width ?? .infinity
        let all = lines(limit, subviews)
        let width = limit.isFinite ? limit : (all.map(\.width).max() ?? 0)
        return CGSize(width: width, height: all.reduce(0) { $0 + $1.height } + spacing * CGFloat(max(all.count - 1, 0)))
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var y = bounds.minY
        for line in lines(bounds.width, subviews) {
            var x = bounds.minX + (bounds.width - line.width) / 2
            for index in line.indices {
                let size = subviews[index].sizeThatFits(.unspecified)
                subviews[index].place(at: CGPoint(x: x, y: y + (line.height - size.height) / 2), proposal: ProposedViewSize(size))
                x += size.width + spacing
            }
            y += line.height + spacing
        }
    }
}

private struct ShowChatLine: View {
    let line: ShowModel.Chat.Line
    @Environment(\.ax) private var ax
    @Environment(\.axWidth) private var width

    private var body14: CGFloat { ax.fontSize("font-size-base", 14) }

    var body: some View {
        switch line {
        case .system(let text):
            Text(text)
                .font(ax.fontSmall)
                .foregroundStyle(ax.textSecondary)
                .axLeading(ax, size: ax.fontSize("font-size-sm", 12), ratio: ax.supportingLeading)
                .frame(maxWidth: .infinity)
        case .user(let text):
            HStack {
                Spacer(minLength: width * 0.15)
                Text(text)
                    .font(ax.fontBase)
                    .foregroundStyle(ax.text)
                    .axLeading(ax, size: body14, ratio: ax.bodyLeading)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.horizontal, ax.space(3) + 2)
                    .padding(.vertical, ax.space(2) + 2)
                    .background(RoundedRectangle(cornerRadius: ax.radiusContainer + 6, style: .continuous).fill(ax.color("color-neutral")))
            }
        case .assistant(let paragraphs, let details):
            VStack(alignment: .leading, spacing: ax.space(3)) {
                ForEach(Array(paragraphs.enumerated()), id: \.offset) { _, paragraph in
                    Text(paragraph)
                        .font(ax.fontBase)
                        .foregroundStyle(ax.text)
                        .axLeading(ax, size: body14, ratio: ax.bodyLeading)
                        .fixedSize(horizontal: false, vertical: true)
                }
                if let details, !details.isEmpty {
                    // The card shrinks to its content, up to the column.
                    ViewThatFits(in: .horizontal) {
                        detailCard(details).fixedSize(horizontal: true, vertical: false)
                        detailCard(details).frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func detailCard(_ details: [ShowModel.Chat.Detail]) -> some View {
        VStack(spacing: ax.space(1)) {
            ForEach(Array(details.enumerated()), id: \.offset) { _, detail in
                ShowDetailRow(detail: detail)
            }
        }
        .padding(ax.space(3))
        .axSurface(fill: ax.card, radius: ax.radiusContainer)
    }
}

private struct ShowDetailRow: View {
    let detail: ShowModel.Chat.Detail
    @Environment(\.ax) private var ax

    var body: some View {
        HStack(alignment: .center, spacing: ax.space(3)) {
            VStack(alignment: .leading, spacing: 0) {
                Text(detail.label).font(ax.fontBase).foregroundStyle(ax.text)
                    .axLeading(ax, size: ax.fontSize("font-size-base", 14), ratio: ax.bodyLeading)
                Text(detail.description).font(ax.fontSmall).foregroundStyle(ax.textSecondary)
                    .axLeading(ax, size: ax.fontSize("font-size-sm", 12), ratio: ax.supportingLeading)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: ax.space(2))
            switch detail.end {
            case .amount(let text):
                Text(text).font(ax.font("font-size-base", 14, weight: "font-weight-bold").monospacedDigit()).foregroundStyle(ax.text)
            case .badge(let text, let variant):
                ShowBadge(text: text, variant: variant)
            case .link(let text):
                Button {} label: { Text(text).font(ax.fontBase).foregroundStyle(ax.accent).axTapTarget(keepLayout: true) }
                    .buttonStyle(.plain)
            }
        }
        .padding(.vertical, ax.space(1))
        .accessibilityElement(children: .combine)
    }
}

/// The chat composer, as Astryx's ChatComposer draws it: the text field over a row with attach at
/// the left and voice input and a round send button at the right, on the surface with a shadow.
/// Return or the send button sends `press` `tpl.showcase.chatSend`; the draft stays as the core
/// holds it (the stock page keeps nothing), so nothing is emptied here.
private struct ShowChatComposer: View {
    let composer: ShowModel.Chat.Composer
    @State private var text: String
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send
    @Environment(\.axStatic) private var isStatic

    init(composer: ShowModel.Chat.Composer) {
        self.composer = composer
        _text = State(initialValue: composer.value)
    }

    private var empty: Bool { text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: ax.size("radius-chat", 28), style: .continuous)
        VStack(alignment: .leading, spacing: ax.space(1)) {
            if isStatic {
                Text(text.isEmpty ? composer.placeholder : text)
                    .font(showFieldFont(ax))
                    .foregroundStyle(text.isEmpty ? ax.textDisabled : ax.text)
                    .padding(.horizontal, ax.space(2))
                    .padding(.top, ax.space(2))
                    .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                TextField(composer.placeholder, text: $text, prompt: Text(composer.placeholder).foregroundColor(ax.textDisabled))
                    .textFieldStyle(.plain)
                    .font(showFieldFont(ax))
                    .foregroundStyle(ax.text)
                    .submitLabel(.send)
                    .onSubmit(submit)
                    .accessibilityLabel(composer.placeholder)
                    .padding(.horizontal, ax.space(2))
                    .padding(.top, ax.space(2))
            }
            HStack(spacing: ax.space(1)) {
                ShowIconButton(symbol: "plus", label: composer.attachLabel)
                Spacer(minLength: ax.space(2))
                ShowIconButton(symbol: "mic", label: composer.voiceLabel)
                sendButton
            }
        }
        .padding(ax.space(2))
        .background(shape.fill(ax.surface))
        .overlay(shape.strokeBorder(ax.border, lineWidth: 1))
        .shadow(color: ax.shadow, radius: 4, y: 1)
        .syncedText(id: "tpl.showcase.chatDraft", value: composer.value, text: $text)
    }

    /// The round send button: the accent, pale while there is nothing to send.
    private var sendButton: some View {
        let side = 32 * min(ax.scale, 1.4)
        return Button(action: submit) {
            Image(systemName: "arrow.up")
                .font(.system(size: ax.fontSize("font-size-base", 14), weight: .semibold))
                .foregroundStyle(ax.onAccent)
                .frame(width: side, height: side)
                .background(Circle().fill(ax.accent))
                .opacity(empty ? 0.4 : 1)
                .contentShape(Circle())
                .axTapTarget(keepLayout: true)
        }
        .buttonStyle(.plain)
        .disabled(empty)
        .accessibilityLabel(composer.sendLabel)
    }

    private func submit() {
        guard !empty else { return }
        send(.press(id: "tpl.showcase.chatSend"))
    }
}
