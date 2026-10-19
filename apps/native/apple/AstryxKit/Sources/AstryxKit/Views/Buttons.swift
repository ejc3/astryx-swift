import SwiftUI

/// `button`: primary, secondary, ghost or destructive, drawn with the theme's tokens.
/// It sends `press` with its id.
struct AXButton: View {
    let node: ButtonNode
    /// Astryx's `sm` button (28 high), for a card's action and a back button.
    var small = false
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        Button {
            send(.press(id: node.id))
        } label: {
            HStack(spacing: ax.space(2)) {
                if let icon = node.icon { Image(systemName: icon.symbol).font(ax.iconFont) }
                // A label is one line until the text is so large that one line cannot hold it.
                Text(node.label).lineLimit(typeSize.isAccessibilitySize ? nil : 1)
                    .multilineTextAlignment(.center)
            }
        }
        .buttonStyle(AXButtonStyle(variant: node.variant, ax: ax, small: small))
        .disabled(node.disabled ?? false)
    }
}

struct AXButtonStyle: ButtonStyle {
    let variant: ButtonNode.Variant
    let ax: AXStyle
    /// The button takes the whole width it is given (a button in a stacked column), its label
    /// centered and wrapping between words.
    var fills = false
    /// Astryx's `sm` size: 28 high rather than 32.
    var small = false
    @Environment(\.isEnabled) private var isEnabled

    /// Astryx's `size-element-md` (32), `sm` (28), on a touch screen too: the tap region reaches
    /// 44 without the button being drawn any taller.
    private var height: CGFloat {
        (small ? 28 : 32) * min(ax.scale, 1.4)
    }

    func makeBody(configuration: Configuration) -> some View {
        let shape = RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous)
        configuration.label
            .font(ax.fontLabel)
            .foregroundStyle(foreground)
            .multilineTextAlignment(.center)
            .frame(maxWidth: fills ? .infinity : nil)
            .padding(.horizontal, ax.space(3))
            .frame(minHeight: height)
            .fixedSize(horizontal: false, vertical: true)
            .background(shape.fill(background))
            .opacity(isEnabled ? (configuration.isPressed ? 0.75 : 1) : 0.5)
            .contentShape(shape)
            // The button is drawn 32 pt high; the taps around it still count (44 x 44).
            .axTapTarget(keepLayout: true)
    }

    private var foreground: Color {
        switch variant {
        case .primary: ax.onAccent
        case .destructive: ax.color("color-on-error")
        case .secondary: ax.text
        case .ghost: ax.text
        }
    }

    private var background: Color {
        switch variant {
        case .primary: ax.accent
        case .destructive: ax.danger
        case .secondary: ax.color("color-neutral")
        case .ghost: .clear
        }
    }
}

/// `iconButton`: a square icon control. Its label is the accessibility label.
struct AXIconButton: View {
    let node: IconButtonNode
    /// Astryx's `sm` icon button, 28 square.
    var small = false
    /// No action behind it (the first page has no previous): drawn dimmed, and it does nothing.
    var disabled = false
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send

    var body: some View {
        let selected = node.selected ?? false
        let side = (small ? 28 : 32) * min(ax.scale, 1.4)
        Button {
            send(.press(id: node.id))
        } label: {
            Image(systemName: node.icon.symbol)
                // Astryx's ghost icon button: the primary text color, a glyph of about 12 in a 32 box
                // (9 in the small one).
                .font(.system(size: ax.fontSize("font-size-base", 14) * (small ? 0.78 : 0.9)))
                .foregroundStyle(ax.text)
                .frame(width: side, height: side)
                .background(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).fill(selected ? ax.color("color-neutral") : .clear))
                .contentShape(Rectangle())
                .axTapTarget(keepLayout: true)
        }
        .buttonStyle(.plain)
        .disabled(disabled)
        .opacity(disabled ? 0.5 : 1)
        .accessibilityLabel(node.label)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}
