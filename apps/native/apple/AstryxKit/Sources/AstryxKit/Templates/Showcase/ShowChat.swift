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
            FlowLayout(spacing: ax.space(2), crossAlignment: 0.5, spread: false) {
                ForEach(Array(chat.suggestions.enumerated()), id: \.offset) { _, question in
                    Button {} label: {
                        Text(question)
                            .font(ax.fontSmall)
                            .foregroundStyle(ax.text)
                            .lineLimit(1)
                            .padding(.horizontal, ax.space(3))
                            .frame(minHeight: 28 * min(ax.scale, 1.4))
                            .background(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).fill(ax.surface))
                            .overlay(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).strokeBorder(ax.borderStrong, lineWidth: 1))
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }
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

private struct ShowChatLine: View {
    let line: ShowModel.Chat.Line
    @Environment(\.ax) private var ax
    @Environment(\.axWidth) private var width

    var body: some View {
        switch line {
        case .system(let text):
            Text(text)
                .font(ax.fontSmall)
                .foregroundStyle(ax.textSecondary)
                .frame(maxWidth: .infinity)
        case .user(let text):
            HStack {
                Spacer(minLength: width * 0.15)
                Text(text)
                    .font(ax.fontBase)
                    .foregroundStyle(ax.text)
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
                        .fixedSize(horizontal: false, vertical: true)
                }
                if let details, !details.isEmpty {
                    VStack(spacing: ax.space(1)) {
                        ForEach(Array(details.enumerated()), id: \.offset) { _, detail in
                            ShowDetailRow(detail: detail)
                        }
                    }
                    .padding(ax.space(3))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .axSurface(fill: ax.card, radius: ax.radiusContainer)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

private struct ShowDetailRow: View {
    let detail: ShowModel.Chat.Detail
    @Environment(\.ax) private var ax

    var body: some View {
        HStack(alignment: .center, spacing: ax.space(3)) {
            VStack(alignment: .leading, spacing: ax.hair) {
                Text(detail.label).font(ax.fontLabel).foregroundStyle(ax.text)
                Text(detail.description).font(ax.fontSmall).foregroundStyle(ax.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: ax.space(2))
            switch detail.end {
            case .amount(let text):
                Text(text).font(ax.fontStrong.monospacedDigit()).foregroundStyle(ax.text)
            case .badge(let text, let variant):
                ShowBadge(text: text, variant: variant)
            case .link(let text):
                Button {} label: { Text(text).font(ax.fontLabel).foregroundStyle(ax.accent) }
                    .buttonStyle(.plain)
            }
        }
        .padding(.vertical, ax.space(1))
        .accessibilityElement(children: .combine)
    }
}

/// The chat composer: attach, the text field and voice input. Return sends `press`
/// `tpl.showcase.chatSend` and empties the field.
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

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: ax.radiusContainer + 6, style: .continuous)
        HStack(spacing: ax.space(1)) {
            ShowIconButton(symbol: "plus", label: composer.attachLabel)
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
                    .onSubmit(submit)
                    .accessibilityLabel(composer.placeholder)
            }
            ShowIconButton(symbol: "mic", label: composer.voiceLabel)
        }
        .padding(.horizontal, ax.space(2))
        .padding(.vertical, ax.space(1))
        .background(shape.fill(ax.page))
        .overlay(shape.strokeBorder(ax.borderStrong, lineWidth: 1))
        .syncedText(id: "tpl.showcase.chatDraft", value: composer.value, text: $text)
    }

    private func submit() {
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        send(.press(id: "tpl.showcase.chatSend"))
        text = ""
    }
}
