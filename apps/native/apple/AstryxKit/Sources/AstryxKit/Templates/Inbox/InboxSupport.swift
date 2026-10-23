import SwiftUI

/// The action id of the inbox template: `tpl.inbox.<what>`.
func inboxAction(_ what: String) -> String { "tpl.inbox.\(what)" }

/// Small facts about people, for the avatar: initials and a steady hue from the name.
enum InboxPeople {
    static func initials(_ name: String) -> String {
        let words = name.split(whereSeparator: { $0 == " " || $0 == "." || $0 == "@" })
        let letters = words.prefix(2).compactMap { $0.first.map { String($0).uppercased() } }
        return letters.joined()
    }

    /// The same name always gets the same hue (djb2 over its scalars).
    static func hue(_ name: String) -> Double {
        var hash: UInt64 = 5381
        for scalar in name.unicodeScalars { hash = (hash &* 33) &+ UInt64(scalar.value) }
        return Double(hash % 360)
    }
}

extension InboxModel.TokenColor {
    var tone: Tone {
        switch self {
        case .red: .danger
        case .orange: .warning
        case .default: .neutral
        }
    }
}

/// The smallest hit target of a control: 44 points on iOS (HIG Accessibility and Buttons), 28 on the Mac.
enum InboxTarget {
    #if os(iOS)
    static let side: CGFloat = 44
    #else
    static let side: CGFloat = 28
    #endif

    /// How far a small inline glyph's hit area grows on each side to reach `side`.
    static func grow(from size: CGFloat) -> CGFloat { max((side - size) / 2, 0) }
}

extension View {
    /// Grows the hit area of a small inline control (a chip's remove mark, an info glyph) to the
    /// platform's minimum target without moving anything around it. `size` is the control's own side.
    func inboxHitTarget(size: CGFloat) -> some View {
        let grow = InboxTarget.grow(from: size)
        return padding(grow).contentShape(Rectangle()).padding(-grow)
    }
}

/// The glyph of a row or thread action id.
func inboxSymbol(_ id: String) -> String {
    switch id {
    case "archive": "archivebox"
    case "move": "folder"
    case "delete": "trash"
    case "reply": "arrowshape.turn.up.left"
    case "replyAll": "arrowshape.turn.up.left.2"
    default: "ellipsis"
    }
}

/// A small token: a priority, a tag, the "+2" of a clipped row.
struct InboxChip: View {
    let label: String
    var color: InboxModel.TokenColor = .default
    @Environment(\.ax) private var ax

    var body: some View {
        let colors = ax.tone(color.tone)
        Text(label)
            .font(ax.font("font-size-xs", 11, weight: "font-weight-medium"))
            .foregroundStyle(colors.text)
            .lineLimit(1)
            .padding(.horizontal, ax.space(2))
            .padding(.vertical, ax.hair)
            .background(RoundedRectangle(cornerRadius: ax.radiusInner + 2, style: .continuous).fill(colors.muted))
            .overlay(RoundedRectangle(cornerRadius: ax.radiusInner + 2, style: .continuous).strokeBorder(colors.border.opacity(0.5), lineWidth: 1))
            .fixedSize()
    }
}

/// A priority chip (when there is one) and the tags, wrapping.
struct InboxChips: View {
    let priority: InboxModel.Token?
    let tags: [String]
    @Environment(\.ax) private var ax

    var body: some View {
        if priority != nil || !tags.isEmpty {
            FlowLayout(spacing: ax.space(1), crossAlignment: 0.5) {
                if let priority { InboxChip(label: priority.label, color: priority.color) }
                ForEach(tags, id: \.self) { InboxChip(label: $0) }
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(([priority?.label].compactMap { $0 } + tags).joined(separator: ", "))
        }
    }
}

/// The chips of one table row, as many as fit in `width`, then "+N" for the rest.
struct InboxClippedChips: View {
    let priority: InboxModel.Token?
    let tags: [String]
    let width: CGFloat
    /// Before the count of the chips that do not fit.
    let overflowMark: String
    @Environment(\.ax) private var ax

    private var all: [(label: String, color: InboxModel.TokenColor)] {
        (priority.map { [($0.label, $0.color)] } ?? []) + tags.map { ($0, .default) }
    }

    /// How many chips fit: the room each needs is estimated from its text, which only decides where to cut.
    private func fitting(_ items: [(label: String, color: InboxModel.TokenColor)]) -> Int {
        let chars = 6.4 * ax.scale
        let pad = (ax.space(2) * 2 + 2) + ax.space(1)
        var used: CGFloat = 0
        var shown = 0
        for item in items {
            let need = CGFloat(item.label.count) * chars + pad
            let more = items.count - shown - 1
            let reserve: CGFloat = more > 0 ? 34 * ax.scale : 0
            if used + need + reserve > width && shown > 0 { break }
            if used + need > width && shown == 0 { return 1 }
            used += need
            shown += 1
        }
        return shown
    }

    var body: some View {
        let items = all
        let shown = fitting(items)
        let hidden = items.count - shown
        HStack(spacing: ax.space(1)) {
            ForEach(Array(items.prefix(shown).enumerated()), id: \.offset) { _, item in
                InboxChip(label: item.label, color: item.color)
            }
            if hidden > 0 { InboxChip(label: "\(overflowMark)\(hidden)") }
        }
        .frame(width: width, alignment: .leading)
        .clipped()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(items.map(\.label).joined(separator: ", "))
    }
}

/// A square ghost icon control: 30 points on the Mac, 44 on iOS (the web's small icon button is 28).
/// Disable it with `.disabled` where the core has no action behind it.
/// An icon button that opens a menu of folders (Move to folder), drawn as `InboxIconButton` is.
/// Each target's `id` is the action it presses.
struct InboxIconMenu: View {
    let symbol: String
    let label: String
    var help: String? = nil
    let targets: [InboxModel.MoveTarget]
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send
    @State private var hovering = false

    var body: some View {
        let side = max(30 * min(ax.scale, 1.4), InboxTarget.side)
        Menu {
            ForEach(targets) { target in
                Button(target.label) { send(.press(id: target.id)) }
            }
        } label: {
            Image(systemName: symbol)
                .font(.system(size: min(ax.fontSize("font-size-base", 14), 24), weight: .regular))
                .foregroundStyle(ax.iconSecondary)
                .frame(width: side, height: side)
                .background(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).fill(hovering ? ax.overlayHover : .clear))
                .contentShape(Rectangle())
        }
        .menuStyle(.button)
        .menuIndicator(.hidden)
        .buttonStyle(.plain)
        .fixedSize()
        .onHover { hovering = $0 }
        .help(help ?? label)
        .accessibilityLabel(label)
    }
}

struct InboxIconButton: View {
    let symbol: String
    let label: String
    var help: String? = nil
    var action: (() -> Void)? = nil
    @Environment(\.ax) private var ax
    @Environment(\.isEnabled) private var isEnabled
    @State private var hovering = false

    var body: some View {
        let side = max(30 * min(ax.scale, 1.4), InboxTarget.side)
        Button {
            action?()
        } label: {
            Image(systemName: symbol)
                // The glyph grows with the text but stays inside its 44 pt box (past it, at the
                // largest sizes, neighbouring glyphs would touch).
                .font(.system(size: min(ax.fontSize("font-size-base", 14), 24), weight: .regular))
                .foregroundStyle(ax.iconSecondary)
                .opacity(isEnabled ? 1 : 0.4)
                .frame(width: side, height: side)
                .background(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).fill(hovering ? ax.overlayHover : .clear))
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .onHover { hovering = $0 }
        .help(help ?? label)
        .accessibilityLabel(label)
    }
}

/// A hairline in the theme's border color.
struct InboxHairline: View {
    @Environment(\.ax) private var ax
    var body: some View { Rectangle().fill(ax.border).frame(height: 1) }
}

/// A square checkbox with the kit's box, a larger touch target around it.
struct InboxCheckbox: View {
    let checked: Bool
    let label: String
    let selected: String
    let notSelected: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            ShowCheckbox(checked: checked)
                .frame(minWidth: 28, minHeight: 28)
                .contentShape(Rectangle())
                .inboxHitTarget(size: 28)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityValue(checked ? selected : notSelected)
        .accessibilityAddTraits(checked ? [.isSelected] : [])
    }
}

/// The content of a popover that becomes a sheet on a compact width (an iPhone): there it gets a
/// title bar with a Done button and medium and large heights, since a sheet has no arrow to tap
/// away. Where the popover stays a popover (iPad, Mac) the content is shown as it is.
struct InboxCompactSheet<Content: View>: View {
    let title: String
    let done: String
    @ViewBuilder var content: Content
    #if os(iOS)
    @Environment(\.horizontalSizeClass) private var sizeClass
    @Environment(\.dismiss) private var dismiss
    #endif

    var body: some View {
        #if os(iOS)
        if sizeClass == .compact {
            NavigationStack {
                content
                    .navigationTitle(title)
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .confirmationAction) { Button(done) { dismiss() } }
                    }
            }
            .presentationDetents([.medium, .large])
        } else {
            content
        }
        #else
        content
        #endif
    }
}

/// The widths of the list's columns, shared by a row and the header above it: the web's table
/// gives From about 160 and the received time about 118, and Subject takes the rest.
enum InboxColumns {
    static let dot: CGFloat = 8
    static let from: CGFloat = 160
    static let tags: CGFloat = 190
    static let received: CGFloat = 118
}

/// A person's avatar in the list: initials in the secondary ink on `color-neutral`, as Astryx's
/// own avatar draws when it is given no color.
struct InboxAvatar: View {
    let name: String
    let initials: String
    @Environment(\.ax) private var ax

    var body: some View {
        let d = 24 * min(ax.scale, 1.6)
        Text(initials)
            .font(.system(size: d * 0.38, weight: .medium))
            .foregroundStyle(ax.textSecondary)
            .minimumScaleFactor(0.6)
            .lineLimit(1)
            .frame(width: d, height: d)
            .background(Circle().fill(ax.color("color-neutral")))
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(name.isEmpty ? initials : name)
    }
}
