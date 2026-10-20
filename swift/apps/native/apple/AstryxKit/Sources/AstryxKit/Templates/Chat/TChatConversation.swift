import SwiftUI

/// The conversation: dividers, system lines and messages, in the model's order. The sizes follow the
/// stock page (ChatLayout, spacious): 16 between messages, a 36 point avatar, parts 4 apart, and
/// the person's own message at most 80 percent of the column it sits in.
struct TChatConversation: View {
    let items: [TChatItem]
    /// Opens the artifact (panel or dialog, the caller knows which).
    let openArtifact: () -> Void
    @Environment(\.ax) private var ax

    var body: some View {
        VStack(alignment: .leading, spacing: ax.space(4)) {
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
        HStack(spacing: 0) {
            Rectangle().fill(ax.border).frame(height: 1)
            Text(text)
                .font(ax.fontSmall)
                .foregroundStyle(ax.textSecondary)
                .padding(.horizontal, ax.space(3))
                .fixedSize()
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
            .padding(.vertical, ax.space(1))
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
        let avatarSide: CGFloat = 36 * min(ax.scale, 1.5)
        // The room this message has: the whole line for the person's own, what is left of it
        // beside the avatar for the assistant's.
        let column = mine ? width : width - avatarSide - ax.space(2)
        // The person's own message is at most 80 percent of the line, the margin that tells the two
        // sides apart (at accessibility sizes it takes the whole line, as the margin would cost the
        // text a fifth of its room). The assistant's runs the full column beside its avatar.
        let cap = mine && !typeSize.isAccessibilitySize ? column * 0.8 : column
        HStack(alignment: .top, spacing: ax.space(2)) {
            if mine { Spacer(minLength: 0) }
            if !mine, let avatar = message.avatar {
                TChatAvatar(name: avatar, side: avatarSide)
            }
            VStack(alignment: mine ? .trailing : .leading, spacing: ax.space(1)) {
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
                    TChatPartView(part: part, mine: mine, cap: cap, openArtifact: openArtifact, followsBubble: index > 0 && isBubble(message.parts[index - 1]))
                }
            }
            .frame(maxWidth: mine ? cap : .infinity, alignment: mine ? .trailing : .leading)
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

/// The assistant's avatar: the stock Avatar, neutral ground and the first letter in the secondary
/// text color.
private struct TChatAvatar: View {
    let name: String
    let side: CGFloat
    @Environment(\.ax) private var ax

    var body: some View {
        Text(String(name.prefix(1)).uppercased())
            .font(.system(size: side * 0.4, weight: .medium))
            .foregroundStyle(ax.textSecondary)
            .frame(width: side, height: side)
            .background(Circle().fill(ax.color("color-neutral")))
            .accessibilityHidden(true)
    }
}

/// An attached file: the stock Token, a name on the neutral ground with a small radius.
private struct TChatFileToken: View {
    let name: String
    @Environment(\.ax) private var ax
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        Text(name)
            .font(ax.font("font-size-sm", 12, weight: "font-weight-medium"))
            .foregroundStyle(ax.text)
            .lineLimit(typeSize.isAccessibilitySize ? nil : 1)
            .padding(.horizontal, ax.space(2))
            .axLeading(ax, size: ax.fontSize("font-size-sm", 12), ratio: ax.supportingLeading)
            .padding(.vertical, ax.hair)
            .background(RoundedRectangle(cornerRadius: ax.radiusInner, style: .continuous).fill(ax.color("color-neutral")))
            .accessibilityElement(children: .combine)
    }
}

private struct TChatPartView: View {
    let part: TChatPart
    let mine: Bool
    /// The widest a bubble may be (80 percent of its column).
    let cap: CGFloat
    let openArtifact: () -> Void
    let followsBubble: Bool
    @Environment(\.ax) private var ax

    var body: some View {
        switch part {
        case .bubble(let bubble):
            TChatBubbleView(bubble: bubble, mine: mine, cap: cap, openArtifact: openArtifact)
        case .tools(let expanded, let label, let calls):
            TChatTools(expanded: expanded, label: label, calls: calls)
                // A group sits a little clear of the text above it.
                .padding(.top, followsBubble ? ax.space(2) : 0)
        case .meta(let time, let footer):
            HStack(spacing: ax.space(1)) {
                Text(time.label)
                if let footer { Text("\u{00B7}"); Text(footer) }
            }
            .font(ax.fontSmall)
            .foregroundStyle(ax.textSecondary)
            .axLeading(ax, size: ax.fontSize("font-size-sm", 12), ratio: ax.supportingLeading)
            .padding(.top, ax.space(1))
            .accessibilityElement(children: .combine)
        }
    }
}

// MARK: Bubbles

private struct TChatBubbleView: View {
    let bubble: TChatPart.Bubble
    let mine: Bool
    let cap: CGFloat
    let openArtifact: () -> Void
    @Environment(\.ax) private var ax
    @Environment(\.tChatWords) private var words
    @Environment(\.tChatRules) private var rules
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        VStack(alignment: mine ? .trailing : .leading, spacing: ax.hair) {
            content
            if let time = bubble.time { timeRow(time) }
        }
        .frame(maxWidth: bubble.width == nil && !mine ? .infinity : nil, alignment: mine ? .trailing : .leading)
        // The bubble is as tall as its wrapped text and time; without this a long message at large
        // text is measured a line short and its time lands on the next message.
        .fixedSize(horizontal: false, vertical: true)
        .accessibilityElement(children: readsAsOne ? .combine : .contain)
    }

    /// "10:20 AM", or for a delivered message the double check, "Delivered", a dot and the time.
    private func timeRow(_ time: TChatStamp) -> some View {
        HStack(spacing: ax.space(1)) {
            if let status = bubble.status {
                HStack(spacing: ax.space(1)) {
                    TChatDoubleCheck()
                    Text(status == "delivered" && !words.delivered.isEmpty ? words.delivered : status)
                }
                Text("\u{00B7}")
            }
            Text(time.label)
        }
        .font(ax.fontSmall)
        .foregroundStyle(ax.textSecondary)
        .lineLimit(1)
        .fixedSize(horizontal: true, vertical: false)
        .axLeading(ax, size: ax.fontSize("font-size-sm", 12), ratio: ax.supportingLeading)
        .padding(.horizontal, ax.space(4))
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
        case .code(let title, let header, let code):
            wrap(TChatCodeBlock(title: title, header: header, code: code))
        case .artifact(let label, let title, let caption):
            wrap(artifact(label: label, title: title, caption: caption))
        }
    }

    private func artifact(label: String, title: String, caption: String) -> some View {
        Button(action: openArtifact) {
            HStack(spacing: ax.space(3)) {
                Image(systemName: "doc.text")
                    .font(.system(size: ax.fontSize("font-size-lg", 17)))
                    .foregroundStyle(ax.textSecondary)
                    .frame(width: 20 * min(ax.scale, 1.4))
                VStack(alignment: .leading, spacing: 0) {
                    Text(title)
                        .font(ax.fontStrong)
                        .foregroundStyle(ax.text)
                        .multilineTextAlignment(.leading)
                        .axLeading(ax, size: ax.fontSize("font-size-base", 14), ratio: ax.bodyLeading)
                    Text(caption)
                        .font(ax.fontSmall)
                        .foregroundStyle(ax.textSecondary)
                        .axLeading(ax, size: ax.fontSize("font-size-sm", 12), ratio: ax.supportingLeading)
                }
                Spacer(minLength: ax.space(2))
                Image(systemName: "chevron.right")
                    .font(.system(size: ax.fontSize("font-size-base", 14)))
                    .foregroundStyle(ax.textSecondary)
            }
            .padding(ax.space(3))
            .frame(maxWidth: (rules?.cardWidth ?? .infinity) * min(ax.scale, 1.4), alignment: .leading)
            .background(RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous).fill(ax.muted))
            .contentShape(RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityAddTraits(.isButton)
    }

    /// The text in a bubble: the person's own sit on the neutral ground in a rounded bubble, an assistant's
    /// (ghost) on none, held in from the column's edge by the same 16 points.
    @ViewBuilder
    private func wrap<V: View>(_ inner: V) -> some View {
        if bubble.isGhost {
            inner
                .padding(.horizontal, ax.space(4))
                .frame(maxWidth: cap, alignment: .leading)
        } else {
            let big = ax.radiusContainer + 16
            let small = ax.radiusInner
            let fill = ax.color("color-neutral")
            Group {
                if bubble.group == nil {
                    inner
                        .padding(.horizontal, ax.space(4))
                        .padding(.vertical, ax.space(3))
                        .background(RoundedRectangle(cornerRadius: big, style: .continuous).fill(fill))
                } else {
                    inner
                        .padding(.horizontal, ax.space(4))
                        .padding(.vertical, ax.space(3))
                        .background(
                            UnevenRoundedRectangle(
                                topLeadingRadius: big,
                                bottomLeadingRadius: big,
                                bottomTrailingRadius: bubble.group == "first" ? small : big,
                                topTrailingRadius: bubble.group == "last" ? small : big,
                                style: .continuous
                            )
                            .fill(fill)
                        )
                }
            }
            .frame(maxWidth: cap, alignment: .trailing)
        }
    }

    /// The text with each mention token's value replaced by its label, on the token's ground. A
    /// text run cannot be padded or rounded, so the highlight gets its width from two spaces.
    private func mentioned(_ text: String, _ tokens: [TChatToken]) -> AttributedString {
        var out = AttributedString(text)
        for token in tokens {
            guard let range = out.range(of: token.value) else { continue }
            var label = AttributedString("\u{2002}\(token.label)\u{2002}")
            label.foregroundColor = ax.color("color-text-\(token.variant)")
            label.backgroundColor = ax.color("color-background-\(token.variant)")
            label.font = ax.font("font-size-sm", 12, weight: "font-weight-medium")
            out.replaceSubrange(range, with: label)
        }
        return out
    }
}

/// The delivered mark: two checks, the second a little behind the first.
private struct TChatDoubleCheck: View {
    @Environment(\.ax) private var ax

    var body: some View {
        // Drawn in the 12 point caption box (scaled like the text), about as wide as the web's 9 point mark.
        let box = ax.fontSize("font-size-sm", 12)
        let size = box * 0.62
        ZStack {
            Image(systemName: "checkmark").offset(x: -size * 0.28)
            Image(systemName: "checkmark").offset(x: size * 0.28)
        }
        .font(.system(size: size, weight: .semibold))
        .frame(width: box)
        .accessibilityHidden(true)
    }
}

// MARK: Tool calls

/// A group of tool calls. Several: a header ("3 tool calls", from the core) that opens and closes
/// the rows, which sit under it with no card. One: just its row.
private struct TChatTools: View {
    let label: String
    let calls: [TChatToolCall]
    @State private var open: Bool
    @Environment(\.ax) private var ax
    @Environment(\.tChatWords) private var words
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    init(expanded: Bool, label: String, calls: [TChatToolCall]) {
        self.label = label
        self.calls = calls
        _open = State(initialValue: expanded)
    }

    var body: some View {
        if calls.count == 1, let call = calls.first {
            TChatToolRow(call: call)
        } else {
            VStack(alignment: .leading, spacing: 0) {
                Button {
                    // Reduce Motion: no sliding and no turning chevron, the rows just appear.
                    if reduceMotion { open.toggle() } else { withAnimation(.snappy(duration: 0.2)) { open.toggle() } }
                } label: {
                    HStack(spacing: ax.space(half: 1)) {
                        Image(systemName: "wrench")
                            .font(.system(size: ax.fontSize("font-size-base", 14)))
                            .foregroundStyle(ax.textSecondary)
                            .frame(width: 16 * min(ax.scale, 1.4), height: 16 * min(ax.scale, 1.4))
                            .accessibilityHidden(true)
                        Text(label)
                            .font(ax.font("font-size-sm", 12, weight: "font-weight-medium"))
                            .foregroundStyle(ax.textSecondary)
                            .axLeading(ax, size: ax.fontSize("font-size-sm", 12), ratio: ax.supportingLeading)
                        // The Mac's disclosure triangle: down when the rows show, right when not.
                        Image(systemName: reduceMotion && open ? "chevron.down" : "chevron.right")
                            .font(.system(size: ax.fontSize("font-size-xs", 10), weight: .semibold))
                            .rotationEffect(.degrees(open && !reduceMotion ? 90 : 0))
                            .foregroundStyle(ax.textSecondary)
                            .frame(width: 12)
                            .accessibilityHidden(true)
                    }
                    .padding(.vertical, ax.hair)
                    .contentShape(Rectangle())
                    .axTapTarget(keepLayout: true)
                }
                .buttonStyle(.plain)
                // What the header says: how many calls, how it went, whether the rows are showing.
                .accessibilityLabel(label)
                .accessibilityValue([open ? words.expanded : words.collapsed, words.word(overall)].joined(separator: ", "))
                .accessibilityHint(words.showCalls)
                if open {
                    ForEach(Array(calls.enumerated()), id: \.offset) { _, call in
                        TChatToolRow(call: call).transition(.opacity)
                    }
                }
            }
        }
    }

    private var overall: TChatToolCall.Status {
        if calls.contains(where: { $0.status == .error }) { return .error }
        if calls.contains(where: { $0.status == .running }) { return .running }
        if calls.contains(where: { $0.status == .pending }) { return .pending }
        return .complete
    }
}

/// One call on one line, as the stock page draws it: how it went, the tool's name, the node it ran
/// on as a chip, the target, what changed and how long it took.
private struct TChatToolRow: View {
    let call: TChatToolCall
    @Environment(\.ax) private var ax
    @Environment(\.tChatWords) private var words
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        // Name, chip, target, diff and time share a line; at the largest sizes they stack, because
        // a line of 43 pt text holds one of them.
        let stacked = typeSize.isAccessibilitySize
        Group {
            if stacked {
                HStack(alignment: .top, spacing: ax.space(half: 1)) {
                    TChatStatusIcon(status: call.status)
                    VStack(alignment: .leading, spacing: ax.hair) {
                        name
                        node
                        target
                        HStack(spacing: ax.space(1)) { diff; duration }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            } else {
                HStack(alignment: .center, spacing: ax.space(half: 1)) {
                    TChatStatusIcon(status: call.status)
                    name
                    node
                    target
                    diff
                    duration
                    Spacer(minLength: 0)
                }
            }
        }
        .padding(.vertical, ax.hair)
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(call.name) \(call.target)")
        .accessibilityValue(spokenValue)
    }

    private var line: some ViewModifier {
        TChatLine(ax: ax)
    }

    private var name: some View {
        Text(call.name)
            .font(ax.font("font-size-sm", 12, weight: "font-weight-medium", design: .monospaced))
            .foregroundStyle(ax.textSecondary)
            .modifier(line)
    }

    @ViewBuilder
    private var node: some View {
        if let node = call.node {
            Text(node)
                .font(ax.font("font-size-sm", 12, weight: "font-weight-medium"))
                .foregroundStyle(ax.text)
                .lineLimit(1)
                .padding(.horizontal, ax.space(2))
                .modifier(line)
                .background(Capsule().fill(ax.color("color-neutral")))
        }
    }

    private var target: some View {
        Text(call.target)
            .font(ax.fontSmall)
            .foregroundStyle(ax.textSecondary)
            // The path wraps rather than being cut in the middle, so no word of it is lost.
            .fixedSize(horizontal: false, vertical: true)
            .modifier(line)
    }

    @ViewBuilder
    private var diff: some View {
        if let additions = call.additions, let deletions = call.deletions {
            HStack(spacing: ax.space(1)) {
                Text("+\(DashNumbers.plain(additions))").foregroundStyle(ax.tone(.success).solid)
                Text("-\(DashNumbers.plain(deletions))").foregroundStyle(ax.tone(.danger).solid)
            }
            .font(ax.fontSmall)
            .modifier(line)
        }
    }

    @ViewBuilder
    private var duration: some View {
        if let duration = call.duration {
            Text(duration).font(ax.fontSmall).foregroundStyle(ax.textSecondary).modifier(line).fixedSize()
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

/// A line of 12 point supporting text, on Astryx's line height.
private struct TChatLine: ViewModifier {
    let ax: AXStyle

    func body(content: Content) -> some View {
        content.axLeading(ax, size: ax.fontSize("font-size-sm", 12), ratio: ax.supportingLeading)
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
