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

/// `text`: body, secondary, caption, emphasis or code, optionally in a tone's color. Each is
/// Astryx's `Text` at its size and line height: body and emphasis 14 on 20, secondary (Astryx's
/// "supporting") 12 on 20, caption (`size="xsm"`) 10 on 16.7.
struct AXText: View {
    let node: TextNode
    @Environment(\.ax) private var ax

    var body: some View {
        Text(node.text)
            .font(font)
            .foregroundStyle(color)
            .axLeading(ax, size: size, ratio: ratio)
            .fixedSize(horizontal: false, vertical: true)
    }

    private var size: CGFloat {
        switch node.style {
        case .body, .emphasis: ax.fontSize("font-size-base", 14)
        case .secondary, .code: ax.fontSize("font-size-sm", 12)
        case .caption: ax.fontSize("font-size-xs", 10)
        }
    }

    private var ratio: CGFloat {
        switch node.style {
        case .body, .emphasis: ax.bodyLeading
        default: ax.supportingLeading
        }
    }

    private var font: Font {
        switch node.style {
        case .body: ax.fontBase
        case .secondary: ax.fontSmall
        case .caption: ax.fontXSmall
        case .emphasis: ax.fontStrong
        case .code: ax.font("font-size-sm", 12, design: .monospaced)
        }
    }

    /// The tone's text color as the web draws it (`TEXT_TONE` in web/src/render/tone.ts).
    private var color: Color {
        if let tone = node.tone { return ax.textTone(tone) }
        switch node.style {
        case .secondary, .caption: return ax.textSecondary
        default: return ax.text
        }
    }
}

/// `badge`: Astryx's Badge: a pill 20 high, 12 medium. Success, warning, danger and info are
/// solid; neutral and accent are soft.
struct AXBadge: View {
    let text: String
    let tone: Tone
    @Environment(\.ax) private var ax

    var body: some View {
        let colors = ax.badge(tone)
        Text(text)
            .font(ax.font("font-size-sm", 12, weight: "font-weight-medium").monospacedDigit())
            .foregroundStyle(colors.ink)
            .lineLimit(1)
            .padding(.horizontal, ax.space(2))
            .frame(minHeight: 20 * min(ax.scale, 1.6))
            .background(Capsule().fill(colors.fill))
            .fixedSize()
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
                .font(ax.fontSmall)
            if let removeId = node.removeId {
                Button {
                    send(.press(id: removeId))
                } label: {
                    Image(systemName: Icon(rawValue: "close").symbol)
                        .font(.system(size: ax.fontSize("font-size-2xs", 8), weight: .bold))
                        .padding(ax.space(1))
                        .contentShape(Rectangle())
                        // The glyph is 8 pt in a chip; the tap still gets 44 x 44 pt around it.
                        .axTapTarget(keepLayout: true)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(node.text)
            }
        }
        .foregroundStyle(colors.text)
        .padding(.leading, ax.space(2))
        .padding(.trailing, node.removeId == nil ? ax.space(2) : ax.space(1))
        .padding(.vertical, ax.space(1))
        // Astryx's Token is 24 high.
        .frame(minHeight: 24 * min(ax.scale, 1.6))
        .background(RoundedRectangle(cornerRadius: ax.radiusInner, style: .continuous).fill(colors.muted))
    }
}

/// `statusDot`: a colored dot and its label.
struct AXStatusDot: View {
    let node: StatusDotNode
    @Environment(\.ax) private var ax

    var body: some View {
        HStack(spacing: ax.space(2)) {
            AXToneMark(tone: node.tone)
            Text(node.label).font(ax.fontSmall).foregroundStyle(ax.textSecondary)
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
                // Astryx's Kbd: 20 high, 12 medium in the body face, a neutral key with a 2 pt
                // edge along its bottom in the emphasized border.
                Text(key)
                    .font(ax.font("font-size-sm", 12, weight: "font-weight-medium"))
                    .foregroundStyle(ax.text)
                    .padding(.horizontal, ax.space(1))
                    .frame(minWidth: 20, minHeight: 20 * min(ax.scale, 1.6))
                    .background(
                        ZStack(alignment: .bottom) {
                            Rectangle().fill(ax.color("color-neutral"))
                            Rectangle().fill(ax.borderStrong).frame(height: 2)
                        }
                        .clipShape(RoundedRectangle(cornerRadius: ax.radiusInner, style: .continuous))
                    )
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

    /// The size before Dynamic Type grows it.
    fileprivate var base: CGFloat { switch size { case .sm: 24; case .md: 36; case .lg: 48 } }

    private var diameter: CGFloat { base * min(ax.scale, 1.6) }

    var body: some View {
        let tint = ax.person(hue: hue)
        ZStack {
            Circle().fill(tint.ground)
            Text(initials)
                .font(.system(size: diameter * 0.38, weight: .regular))
                .foregroundStyle(tint.mark)
                .minimumScaleFactor(0.6)
                .lineLimit(1)
        }
        .frame(width: diameter, height: diameter)
        .overlay(alignment: .bottomTrailing) {
            if let status {
                statusDot(status)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(name.isEmpty ? initials : name)
        .accessibilityValue(statusLabel ?? "")
    }
}

extension AXAvatar {
    /// Astryx's AvatarStatusDot has three looks: success (green), error (red) and a hollow ring
    /// for anything else (Away included), as the web renderer maps the core's tones.
    @ViewBuilder
    fileprivate func statusDot(_ status: Tone) -> some View {
        // Astryx's tiers (AvatarStatusDot): a 10 dot with a 1 ring up to a 36 avatar, a 20 dot
        // with a 2 ring up to 72. The ring is inside the dot's size.
        let small = base <= 36
        let side: CGFloat = small ? 10 : 20
        let ring: CGFloat = small ? 1 : 2
        switch status {
        case .success, .danger:
            Circle()
                .fill(status == .success ? ax.tone(.success).solid : ax.tone(.danger).solid)
                .frame(width: side, height: side)
                .overlay(Circle().strokeBorder(ax.surface, lineWidth: ring))
        default:
            Circle()
                .fill(ax.surface)
                .frame(width: side, height: side)
                .overlay(Circle().strokeBorder(ax.surface, lineWidth: ring))
                .overlay(Circle().strokeBorder(ax.iconSecondary, lineWidth: small ? 1 : 1.5).padding(ring))
        }
    }
}

/// `avatarGroup`: overlapping avatars and the core's "more" text.
struct AXAvatarGroup: View {
    let node: AvatarGroupNode
    @Environment(\.ax) private var ax

    var body: some View {
        let d = 36 * min(ax.scale, 1.6)
        HStack(spacing: -d * 0.16) {
            ForEach(Array(node.people.enumerated()), id: \.offset) { _, person in
                let tint = ax.person(hue: person.hue)
                Text(person.initials)
                    .font(.system(size: d * 0.38, weight: .regular))
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
                    .background(Circle().fill(ax.color("color-neutral")))
                    .overlay(Circle().strokeBorder(ax.surface, lineWidth: 2))
            }
        }
        .accessibilityElement(children: .combine)
    }
}
