import SwiftUI

/// `heading`: levels 1 to 3 at the theme's heading sizes.
struct AXHeading: View {
    let node: HeadingNode
    @Environment(\.ax) private var ax

    var body: some View {
        Text(node.text)
            .font(ax.heading(node.level))
            .foregroundStyle(ax.text)
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityAddTraits(.isHeader)
    }
}

/// `text`: body, secondary, caption, emphasis or code, optionally in a tone's color.
struct AXText: View {
    let node: TextNode
    @Environment(\.ax) private var ax

    var body: some View {
        Text(node.text)
            .font(font)
            .foregroundStyle(color)
            .fixedSize(horizontal: false, vertical: true)
    }

    private var font: Font {
        switch node.style {
        case .body, .secondary: ax.fontBase
        case .caption: ax.fontSmall
        case .emphasis: ax.fontStrong
        case .code: ax.font("font-size-sm", 12, design: .monospaced)
        }
    }

    private var color: Color {
        if let tone = node.tone, tone != .neutral { return ax.tone(tone).text }
        switch node.style {
        case .secondary, .caption: return ax.textSecondary
        default: return ax.text
        }
    }
}

/// `badge`: a small tinted pill.
struct AXBadge: View {
    let text: String
    let tone: Tone
    @Environment(\.ax) private var ax

    var body: some View {
        let colors = ax.tone(tone)
        Text(text)
            .font(ax.font("font-size-xs", 10, weight: "font-weight-semibold").monospacedDigit())
            .foregroundStyle(colors.text)
            .lineLimit(1)
            .padding(.horizontal, ax.space(2))
            .padding(.vertical, ax.hair)
            .background(Capsule().fill(colors.muted))
    }
}

/// `token`: a removable chip. Its remove control sends `press` with `removeId`.
struct AXToken: View {
    let node: TokenNode
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send

    var body: some View {
        let colors = ax.tone(node.tone)
        HStack(spacing: ax.space(1)) {
            Text(node.text)
                .font(ax.font("font-size-sm", 12, weight: "font-weight-medium"))
            if let removeId = node.removeId {
                Button {
                    send(.press(id: removeId))
                } label: {
                    Image(systemName: Icon(rawValue: "close").symbol)
                        .font(.system(size: ax.fontSize("font-size-2xs", 8), weight: .bold))
                        .padding(ax.space(1))
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(node.text)
            }
        }
        .foregroundStyle(colors.text)
        .padding(.leading, ax.space(2))
        .padding(.trailing, node.removeId == nil ? ax.space(2) : ax.space(1))
        .padding(.vertical, ax.space(1))
        .background(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).fill(colors.muted))
        .overlay(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).strokeBorder(colors.border.opacity(0.5), lineWidth: 1))
    }
}

/// `statusDot`: a colored dot and its label.
struct AXStatusDot: View {
    let node: StatusDotNode
    @Environment(\.ax) private var ax

    var body: some View {
        HStack(spacing: ax.space(2)) {
            Circle().fill(ax.tone(node.tone).solid).frame(width: 8, height: 8)
            Text(node.label).font(ax.fontBase).foregroundStyle(ax.text)
        }
        .accessibilityElement(children: .combine)
    }
}

/// `divider`: a hairline.
struct AXDivider: View {
    @Environment(\.ax) private var ax

    var body: some View {
        Rectangle().fill(ax.border).frame(height: 1).frame(maxWidth: .infinity)
            .accessibilityHidden(true)
    }
}

/// `kbd`: key caps.
struct AXKbd: View {
    let node: KbdNode
    @Environment(\.ax) private var ax

    var body: some View {
        HStack(spacing: ax.space(1)) {
            ForEach(Array(node.keys.enumerated()), id: \.offset) { _, key in
                Text(key)
                    .font(ax.font("font-size-sm", 12, weight: "font-weight-medium", design: .monospaced))
                    .foregroundStyle(ax.textSecondary)
                    .padding(.horizontal, ax.space(half: 1))
                    .padding(.vertical, ax.hair)
                    .frame(minWidth: 22)
                    .background(RoundedRectangle(cornerRadius: ax.radiusInner + 1, style: .continuous).fill(ax.muted))
                    .overlay(RoundedRectangle(cornerRadius: ax.radiusInner + 1, style: .continuous).strokeBorder(ax.borderStrong, lineWidth: 1))
            }
        }
        .accessibilityElement(children: .combine)
    }
}

/// `avatar`: initials on a tint of the person's hue, with an optional status dot.
struct AXAvatar: View {
    let name: String
    let initials: String
    let hue: Double
    let size: AvatarNode.Size
    let status: Tone?
    let statusLabel: String?
    @Environment(\.ax) private var ax

    init(name: String, initials: String, hue: Double, size: AvatarNode.Size = .md, status: Tone? = nil, statusLabel: String? = nil) {
        self.name = name; self.initials = initials; self.hue = hue; self.size = size
        self.status = status; self.statusLabel = statusLabel
    }

    private var diameter: CGFloat {
        let base: CGFloat = switch size { case .sm: 24; case .md: 36; case .lg: 56 }
        return base * min(ax.scale, 1.6)
    }

    var body: some View {
        let tint = ax.person(hue: hue)
        ZStack {
            Circle().fill(tint.ground)
            Text(initials)
                .font(.system(size: diameter * 0.38, weight: .semibold))
                .foregroundStyle(tint.mark)
                .minimumScaleFactor(0.6)
                .lineLimit(1)
        }
        .frame(width: diameter, height: diameter)
        .overlay(alignment: .bottomTrailing) {
            if let status {
                Circle()
                    .fill(ax.tone(status).solid)
                    .frame(width: diameter * 0.28, height: diameter * 0.28)
                    .overlay(Circle().strokeBorder(ax.surface, lineWidth: 2))
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(name.isEmpty ? initials : name)
        .accessibilityValue(statusLabel ?? "")
    }
}

/// `avatarGroup`: overlapping avatars and the core's "more" text.
struct AXAvatarGroup: View {
    let node: AvatarGroupNode
    @Environment(\.ax) private var ax

    var body: some View {
        let d = 28 * min(ax.scale, 1.6)
        HStack(spacing: -d * 0.16) {
            ForEach(Array(node.people.enumerated()), id: \.offset) { _, person in
                let tint = ax.person(hue: person.hue)
                Text(person.initials)
                    .font(.system(size: d * 0.38, weight: .semibold))
                    .foregroundStyle(tint.mark)
                    .frame(width: d, height: d)
                    .background(Circle().fill(tint.ground))
                    .overlay(Circle().strokeBorder(ax.surface, lineWidth: 2))
            }
            if let more = node.more {
                Text(more)
                    .font(.system(size: d * 0.36, weight: .semibold))
                    .foregroundStyle(ax.textSecondary)
                    .frame(minWidth: d, minHeight: d)
                    .background(Circle().fill(ax.muted))
                    .overlay(Circle().strokeBorder(ax.surface, lineWidth: 2))
            }
        }
        .accessibilityElement(children: .combine)
    }
}
