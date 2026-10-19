import SwiftUI

/// The conversation: dividers, system lines and messages, in the model's order.
struct TChatConversation: View {
    let items: [TChatItem]
    /// Opens the artifact (panel or dialog, the caller knows which).
    let openArtifact: () -> Void
    @Environment(\.ax) private var ax

    var body: some View {
        VStack(alignment: .leading, spacing: ax.space(6)) {
            ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                switch item {
                case .divider(let text): TChatDivider(text: text)
                case .status(let text): TChatStatus(text: text)
                case .message(let message): TChatMessageView(message: message, openArtifact: openArtifact)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct TChatDivider: View {
    let text: String
    @Environment(\.ax) private var ax

    var body: some View {
        HStack(spacing: ax.space(3)) {
            Rectangle().fill(ax.border).frame(height: 1)
            Text(text).font(ax.fontSmall).foregroundStyle(ax.textSecondary).fixedSize()
            Rectangle().fill(ax.border).frame(height: 1)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(text)
        .accessibilityAddTraits(.isHeader)
    }
}

private struct TChatStatus: View {
    let text: String
    @Environment(\.ax) private var ax

    var body: some View {
        Text(text)
            .font(ax.fontSmall)
            .foregroundStyle(ax.textSecondary)
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity)
    }
}

// MARK: Messages

private struct TChatMessageView: View {
    let message: TChatMessage
    let openArtifact: () -> Void
    @Environment(\.ax) private var ax
    @Environment(\.axWidth) private var width
    @Environment(\.tChatWords) private var words
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        let mine = message.sender == .user
        let avatarSide: CGFloat = 28 * min(ax.scale, 1.5)
        HStack(alignment: .top, spacing: ax.space(2)) {
            // At accessibility sizes a message takes the whole line; the margins that tell the two
            // sides apart cost the text a third of its room.
            if mine { Spacer(minLength: typeSize.isAccessibilitySize ? 0 : width * 0.12) }
            if !mine, let avatar = message.avatar {
                TChatAvatar(name: avatar, side: avatarSide)
            }
            VStack(alignment: mine ? .trailing : .leading, spacing: ax.space(2)) {
                if !message.files.isEmpty {
                    // A wrapping row measures its height at the width it is offered; in a column
                    // whose width is still being settled (large text) that comes out a row short,
                    // so there the files are simply stacked.
                    if typeSize.isAccessibilitySize {
                        VStack(alignment: mine ? .trailing : .leading, spacing: ax.space(1)) {
                            ForEach(Array(message.files.enumerated()), id: \.offset) { _, file in
                                TChatFileToken(name: file)
                            }
                        }
                    } else {
                        FlowLayout(spacing: ax.space(1)) {
                            ForEach(Array(message.files.enumerated()), id: \.offset) { _, file in
                                TChatFileToken(name: file)
                            }
                        }
                    }
                }
                ForEach(Array(message.parts.enumerated()), id: \.offset) { index, part in
                    TChatPartView(part: part, mine: mine, openArtifact: openArtifact, followsBubble: index > 0 && isBubble(message.parts[index - 1]))
                }
            }
            .frame(maxWidth: mine ? nil : .infinity, alignment: mine ? .trailing : .leading)
            if !mine { Spacer(minLength: 0) }
        }
        .frame(maxWidth: .infinity, alignment: mine ? .trailing : .leading)
        // Who said it: the only difference between the two sides is alignment and fill.
        .accessibilityElement(children: .contain)
        .accessibilityLabel(mine ? words.you : (message.avatar ?? ""))
    }

    private func isBubble(_ part: TChatPart) -> Bool {
        if case .bubble = part { return true }
        return false
    }
}

private struct TChatAvatar: View {
    let name: String
    let side: CGFloat
    @Environment(\.ax) private var ax

    var body: some View {
        // A stable hue from the name, so the same assistant always has the same color.
        let hue = Double(name.unicodeScalars.reduce(0) { ($0 &* 31 &+ Int($1.value)) % 360 })
        let tint = ax.person(hue: hue)
        Text(String(name.prefix(1)).uppercased())
            .font(.system(size: side * 0.42, weight: .semibold))
            .foregroundStyle(tint.mark)
            .frame(width: side, height: side)
            .background(Circle().fill(tint.ground))
            .accessibilityHidden(true)
    }
}

private struct TChatFileToken: View {
    let name: String
    @Environment(\.ax) private var ax
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        HStack(spacing: ax.space(1)) {
            Image(systemName: "paperclip").font(.system(size: ax.fontSize("font-size-xs", 10)))
            Text(name).font(ax.fontSmall).lineLimit(typeSize.isAccessibilitySize ? nil : 1)
        }
        .foregroundStyle(ax.text)
        .padding(.horizontal, ax.space(2))
        .padding(.vertical, ax.hair + 1)
        .background(Capsule().fill(ax.muted))
        .overlay(Capsule().strokeBorder(ax.border, lineWidth: 1))
        .accessibilityElement(children: .combine)
    }
}

private struct TChatPartView: View {
    let part: TChatPart
    let mine: Bool
    let openArtifact: () -> Void
    let followsBubble: Bool
    @Environment(\.ax) private var ax

    var body: some View {
        switch part {
        case .bubble(let bubble):
            TChatBubbleView(bubble: bubble, mine: mine, openArtifact: openArtifact)
        case .tools(let expanded, let calls):
            TChatTools(expanded: expanded, calls: calls)
        case .meta(let time, let footer):
            HStack(spacing: ax.space(2)) {
                Text(time.label)
                if let footer { Text("\u{00B7}"); Text(footer) }
            }
            .font(ax.fontSmall)
            .foregroundStyle(ax.textSecondary)
            .accessibilityElement(children: .combine)
        }
    }
}

// MARK: Bubbles

private struct TChatBubbleView: View {
    let bubble: TChatPart.Bubble
    let mine: Bool
    let openArtifact: () -> Void
    @Environment(\.ax) private var ax
    @Environment(\.axWidth) private var width
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        VStack(alignment: mine ? .trailing : .leading, spacing: ax.hair) {
            content
            if let time = bubble.time {
                HStack(spacing: ax.space(1)) {
                    Text(time.label)
                    if let status = bubble.status {
                        Image(systemName: "checkmark").font(.system(size: ax.fontSize("font-size-xs", 10), weight: .semibold))
                            .accessibilityLabel(status)
                    }
                }
                .font(ax.fontSmall)
                .foregroundStyle(ax.textSecondary)
                .padding(.horizontal, ax.space(1))
            }
        }
        .frame(maxWidth: bubble.width == nil && !mine ? .infinity : nil, alignment: mine ? .trailing : .leading)
        // The bubble is as tall as its wrapped text and time; without this a long message at large
        // text is measured a line short and its time lands on the next message.
        .fixedSize(horizontal: false, vertical: true)
        .accessibilityElement(children: readsAsOne ? .combine : .contain)
    }

    /// A plain message and its time are one thing to hear; code, the document card and rich
    /// text keep their own parts.
    private var readsAsOne: Bool {
        switch bubble.content {
        case .text, .mention: true
        default: false
        }
    }

    @ViewBuilder
    private var content: some View {
        switch bubble.content {
        case .text(let text):
            wrap(Text(text).font(ax.fontBase).foregroundStyle(ax.text).fixedSize(horizontal: false, vertical: true))
        case .mention(let text, let tokens):
            wrap(Text(mentioned(text, tokens)).font(ax.fontBase).foregroundStyle(ax.text).fixedSize(horizontal: false, vertical: true))
        case .markdown(let text):
            wrap(TChatMarkdown(text: text, compact: true))
        case .code(let title, let language, let code):
            TChatCodeBlock(title: title, language: language, code: code)
        case .artifact(let label, let title, let caption):
            Button(action: openArtifact) {
                HStack(spacing: ax.space(3)) {
                    Image(systemName: "doc.text")
                        .font(.system(size: ax.fontSize("font-size-lg", 17)))
                        .foregroundStyle(ax.textSecondary)
                    VStack(alignment: .leading, spacing: 0) {
                        Text(title).font(ax.fontStrong).foregroundStyle(ax.text).multilineTextAlignment(.leading)
                        Text(caption).font(ax.fontSmall).foregroundStyle(ax.textSecondary)
                    }
                    Spacer(minLength: ax.space(2))
                    Image(systemName: "chevron.right")
                        .font(.system(size: ax.fontSize("font-size-sm", 12), weight: .semibold))
                        .foregroundStyle(ax.textSecondary)
                }
                .padding(ax.space(3))
                .frame(maxWidth: 360 * min(ax.scale, 1.4), alignment: .leading)
                .background(RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous).fill(ax.muted))
                .overlay(RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous).strokeBorder(ax.border, lineWidth: 1))
                .contentShape(RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous))
            }
            .buttonStyle(.plain)
            .accessibilityLabel(label)
            .accessibilityAddTraits(.isButton)
        }
    }

    /// The text in a bubble: the user's own sit on a muted ground, an assistant's (ghost) on none.
    @ViewBuilder
    private func wrap<V: View>(_ inner: V) -> some View {
        if bubble.isGhost {
            inner.frame(maxWidth: .infinity, alignment: .leading)
        } else {
            let big = ax.radiusContainer + 6
            let small = ax.radiusInner
            let shape = UnevenRoundedRectangle(
                topLeadingRadius: big,
                bottomLeadingRadius: big,
                bottomTrailingRadius: bubble.group == "first" ? small : big,
                topTrailingRadius: bubble.group == "last" ? small : big,
                style: .continuous
            )
            inner
                .padding(.horizontal, ax.space(3) + 2)
                .padding(.vertical, ax.space(2) + 2)
                .background(shape.fill(ax.color("color-neutral")))
                .frame(maxWidth: typeSize.isAccessibilitySize ? .infinity : width * 0.82, alignment: .trailing)
        }
    }

    /// The text with each mention token's value replaced by its label, painted as a pill.
    private func mentioned(_ text: String, _ tokens: [TChatToken]) -> AttributedString {
        var out = AttributedString(text)
        for token in tokens {
            guard let range = out.range(of: token.value) else { continue }
            var label = AttributedString(token.label)
            label.foregroundColor = ax.color("color-text-\(token.variant)")
            label.backgroundColor = ax.color("color-background-\(token.variant)")
            label.font = ax.fontLabel
            out.replaceSubrange(range, with: label)
        }
        return out
    }
}

// MARK: Tool calls

private struct TChatTools: View {
    let calls: [TChatToolCall]
    @State private var open: Bool
    @Environment(\.ax) private var ax
    @Environment(\.tChatWords) private var words
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dynamicTypeSize) private var typeSize

    init(expanded: Bool, calls: [TChatToolCall]) {
        self.calls = calls
        _open = State(initialValue: expanded)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button {
                // Reduce Motion: no sliding and no turning chevron, the rows just appear.
                if reduceMotion { open.toggle() } else { withAnimation(.snappy(duration: 0.2)) { open.toggle() } }
            } label: {
                HStack(spacing: ax.space(2)) {
                    Image(systemName: reduceMotion && open ? "chevron.down" : "chevron.right")
                        .font(.system(size: ax.fontSize("font-size-xs", 10), weight: .semibold))
                        .rotationEffect(.degrees(open && !reduceMotion ? 90 : 0))
                        .foregroundStyle(ax.textSecondary)
                        .frame(width: 12)
                    TChatStatusIcon(status: overall)
                    Text(summary)
                        .font(ax.font("font-size-sm", 12, weight: "font-weight-medium", design: .monospaced))
                        .foregroundStyle(ax.text)
                        .lineLimit(typeSize.isAccessibilitySize ? nil : 1)
                        .truncationMode(.middle)
                    Spacer(minLength: ax.space(2))
                    if calls.count > 1 {
                        Text("\(calls.count)")
                            .font(ax.font("font-size-xs", 10, weight: "font-weight-semibold").monospacedDigit())
                            .foregroundStyle(ax.textSecondary)
                            .padding(.horizontal, ax.space(half: 1))
                            .background(Capsule().fill(ax.muted))
                    }
                }
                .padding(.horizontal, ax.space(3))
                .padding(.vertical, ax.space(2))
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            // What the header says: how many calls, how it went, whether the rows are showing.
            .accessibilityLabel(summary)
            .accessibilityValue([open ? words.expanded : words.collapsed, words.word(overall), calls.count > 1 ? "\(calls.count)" : nil].compactMap { $0 }.joined(separator: ", "))
            .accessibilityHint(words.showCalls)
            if open {
                ForEach(Array(calls.enumerated()), id: \.offset) { _, call in
                    Rectangle().fill(ax.border).frame(height: 1)
                    TChatToolRow(call: call).transition(.opacity)
                }
            }
        }
        .background(RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous).fill(ax.card))
        .overlay(RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous).strokeBorder(ax.border, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous))
    }

    /// The header's one line: the first call, and the other names after it.
    private var summary: String {
        guard let first = calls.first else { return "" }
        if calls.count == 1 { return "\(first.name) \(first.target)" }
        var seen: [String] = []
        for call in calls where !seen.contains(call.name) { seen.append(call.name) }
        return seen.joined(separator: " \u{00B7} ")
    }

    private var overall: TChatToolCall.Status {
        if calls.contains(where: { $0.status == .error }) { return .error }
        if calls.contains(where: { $0.status == .running }) { return .running }
        if calls.contains(where: { $0.status == .pending }) { return .pending }
        return .complete
    }
}

private struct TChatToolRow: View {
    let call: TChatToolCall
    @Environment(\.ax) private var ax
    @Environment(\.tChatWords) private var words
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        // Name, target, diff and time share a line; at the largest sizes they stack, because a
        // line of 43 pt monospaced text holds one of them.
        let stacked = typeSize.isAccessibilitySize
        HStack(alignment: stacked ? .top : .firstTextBaseline, spacing: ax.space(2)) {
            TChatStatusIcon(status: call.status)
            VStack(alignment: .leading, spacing: ax.hair) {
                HStack(alignment: .firstTextBaseline, spacing: ax.space(2)) {
                    Text(call.name).font(ax.font("font-size-sm", 12, weight: "font-weight-semibold", design: .monospaced)).foregroundStyle(ax.text)
                    if !stacked { target }
                }
                if stacked { target }
                if let node = call.node {
                    Text(node).font(ax.fontXSmall).foregroundStyle(ax.textSecondary)
                }
                if stacked {
                    HStack(spacing: ax.space(2)) { diff; duration }
                }
            }
            .frame(maxWidth: stacked ? .infinity : nil, alignment: .leading)
            if !stacked {
                Spacer(minLength: ax.space(2))
                diff
                duration
            }
        }
        .padding(.horizontal, ax.space(3))
        .padding(.vertical, ax.space(2))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(call.name) \(call.target)")
        .accessibilityValue(spokenValue)
    }

    private var target: some View {
        Text(call.target).font(ax.font("font-size-sm", 12, design: .monospaced)).foregroundStyle(ax.textSecondary)
            .lineLimit(typeSize.isAccessibilitySize ? nil : 2).truncationMode(.middle)
    }

    @ViewBuilder
    private var diff: some View {
        if let additions = call.additions, let deletions = call.deletions {
            HStack(spacing: ax.space(1)) {
                Text("+\(DashNumbers.plain(additions))").foregroundStyle(ax.tone(.success).text)
                Text("\u{2212}\(DashNumbers.plain(deletions))").foregroundStyle(ax.tone(.danger).text)
            }
            .font(ax.fontSmall.monospacedDigit())
        }
    }

    @ViewBuilder
    private var duration: some View {
        if let duration = call.duration {
            Text(duration).font(ax.fontSmall.monospacedDigit()).foregroundStyle(ax.textSecondary)
        }
    }

    /// Everything the row shows: how it went, what changed, how long it took, where it ran.
    private var spokenValue: String {
        var parts = [words.word(call.status)]
        if let additions = call.additions, let deletions = call.deletions {
            parts.append("\(DashNumbers.plain(additions)) \(words.added)")
            parts.append("\(DashNumbers.plain(deletions)) \(words.removed)")
        }
        parts += [call.duration, call.node].compactMap { $0 }
        return parts.joined(separator: ", ")
    }
}

private struct TChatStatusIcon: View {
    let status: TChatToolCall.Status
    @Environment(\.ax) private var ax
    @Environment(\.axStatic) private var isStatic

    var body: some View {
        Group {
            switch status {
            case .complete:
                Image(systemName: "checkmark.circle.fill").foregroundStyle(ax.tone(.success).solid)
            case .error:
                Image(systemName: "xmark.circle.fill").foregroundStyle(ax.tone(.danger).solid)
            case .pending:
                Image(systemName: "circle.dashed").foregroundStyle(ax.textSecondary)
            case .running:
                if isStatic {
                    Image(systemName: "circle.dotted").foregroundStyle(ax.accent)
                } else {
                    ProgressView().controlSize(.mini)
                }
            }
        }
        .font(.system(size: ax.fontSize("font-size-base", 14)))
        .frame(width: 16 * min(ax.scale, 1.4), height: 16 * min(ax.scale, 1.4))
        .accessibilityHidden(true)
    }
}
