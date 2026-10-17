import SwiftUI

/// `button`: primary, secondary, ghost or destructive, drawn with the theme's tokens.
/// It sends `press` with its id.
struct AXButton: View {
    let node: ButtonNode
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send

    var body: some View {
        Button {
            send(.press(id: node.id))
        } label: {
            HStack(spacing: ax.space(2)) {
                if let icon = node.icon { Image(systemName: icon.symbol) }
                Text(node.label).lineLimit(1)
            }
        }
        .buttonStyle(AXButtonStyle(variant: node.variant, ax: ax))
        .disabled(node.disabled ?? false)
    }
}

struct AXButtonStyle: ButtonStyle {
    let variant: ButtonNode.Variant
    let ax: AXStyle
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        let shape = RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous)
        configuration.label
            .font(ax.fontLabel)
            .foregroundStyle(foreground)
            .padding(.horizontal, ax.space(3))
            .frame(minHeight: 36 * min(ax.scale, 1.4))
            .background(shape.fill(background))
            .overlay(shape.strokeBorder(variant == .secondary ? ax.borderStrong : .clear, lineWidth: 1))
            .opacity(isEnabled ? (configuration.isPressed ? 0.75 : 1) : 0.45)
            .contentShape(shape)
    }

    private var foreground: Color {
        switch variant {
        case .primary: ax.onAccent
        case .destructive: ax.color("color-on-error")
        case .secondary: ax.text
        case .ghost: ax.accent
        }
    }

    private var background: Color {
        switch variant {
        case .primary: ax.accent
        case .destructive: ax.danger
        case .secondary: ax.surface
        case .ghost: .clear
        }
    }
}

/// `iconButton`: a square icon control. Its label is the accessibility label.
struct AXIconButton: View {
    let node: IconButtonNode
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send

    var body: some View {
        let selected = node.selected ?? false
        let side = 36 * min(ax.scale, 1.4)
        Button {
            send(.press(id: node.id))
        } label: {
            Image(systemName: node.icon.symbol)
                .font(.system(size: ax.fontSize("font-size-lg", 17) * 0.95))
                .foregroundStyle(selected ? ax.accent : ax.iconSecondary)
                .frame(width: side, height: side)
                .background(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).fill(selected ? ax.accentMuted : .clear))
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(node.label)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}
