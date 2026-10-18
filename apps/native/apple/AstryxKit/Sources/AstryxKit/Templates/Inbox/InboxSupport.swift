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
            if hidden > 0 { InboxChip(label: "+\(hidden)") }
        }
        .frame(width: width, alignment: .leading)
        .clipped()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(items.map(\.label).joined(separator: ", "))
    }
}

/// A square ghost icon control, 28 points at the base size (the web's small icon button).
struct InboxIconButton: View {
    let symbol: String
    let label: String
    var help: String? = nil
    var action: (() -> Void)? = nil
    @Environment(\.ax) private var ax
    @State private var hovering = false

    var body: some View {
        let side = 30 * min(ax.scale, 1.4)
        Button {
            action?()
        } label: {
            Image(systemName: symbol)
                .font(.system(size: ax.fontSize("font-size-base", 14), weight: .regular))
                .foregroundStyle(ax.iconSecondary)
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
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            AXCheckmark(checked: checked)
                .frame(minWidth: 28, minHeight: 28)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityValue(checked ? "selected" : "not selected")
        .accessibilityAddTraits(checked ? [.isSelected] : [])
    }
}
