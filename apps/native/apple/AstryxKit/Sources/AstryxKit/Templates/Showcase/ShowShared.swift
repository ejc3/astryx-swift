import SwiftUI

/// Small pieces the showcase template's sections share.

/// A badge colored by one of the data hues: `color-text-<hue>` on `color-background-<hue>`, as
/// Astryx's Badge draws it: 12 pt medium on a pill 20 high, no border.
struct ShowBadge: View {
    let text: String
    let variant: ShowVariant
    @Environment(\.ax) private var ax

    var body: some View {
        Text(text)
            .font(ax.font("font-size-sm", 12, weight: "font-weight-medium"))
            .foregroundStyle(ax.color("color-text-\(variant.family)"))
            .lineLimit(1)
            .padding(.horizontal, ax.space(2))
            .frame(minHeight: ax.space(5) * min(ax.scale, 1.4))
            .background(Capsule().fill(ax.color("color-background-\(variant.family)")))
    }
}

/// The stand-in for a product photo: the core's own placeholder, drawn from its SVG. The core
/// sends a data URI of a pale ground with an outlined picture mark; its two colors are read from
/// it, and the mark (88 by 88 in a 400 by 300 picture, scaled to fill the frame) is stroked by
/// hand, since the system draws no SVG on every platform.
struct ShowPhoto: View {
    var corner: CGFloat = 0
    var side: CGFloat? = nil
    /// The height when the caller knows the column's width (a grid cell's own size is not reliable).
    var height: CGFloat? = nil
    /// The core's `image` (a data URI); nil draws the theme's muted ground and its disabled ink.
    var image: String? = nil
    @Environment(\.ax) private var ax

    private var svg: String { (image?.removingPercentEncoding) ?? "" }

    /// The first `attribute="#rrggbb"` of the picture.
    private func color(_ attribute: String) -> Color? {
        guard let range = svg.range(of: "\(attribute)=\"#") else { return nil }
        let hex = svg[range.upperBound...].prefix(6)
        return hex.count == 6 ? Color(hex: String(hex)) : nil
    }

    var body: some View {
        let ground = color("fill") ?? ax.muted
        let ink = color("stroke") ?? ax.textDisabled
        Group {
            if let side {
                picture(ground: ground, ink: ink, width: side, height: side)
            } else {
                GeometryReader { geo in
                    picture(ground: ground, ink: ink, width: geo.size.width, height: geo.size.height)
                }
                .frame(maxWidth: .infinity)
                .frame(height: height)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: corner, style: .continuous))
        .accessibilityHidden(true)
    }

    private func picture(ground: Color, ink: Color, width: CGFloat, height: CGFloat) -> some View {
        // `xMidYMid slice`: the 400 by 300 picture covers the frame.
        let k = max(width / 400, height / 300)
        let center = CGPoint(x: width / 2, y: height / 2)
        return ZStack {
            Rectangle().fill(ground)
            Path { p in
                p.addRoundedRect(in: CGRect(x: center.x - 44 * k, y: center.y - 44 * k, width: 88 * k, height: 88 * k), cornerSize: CGSize(width: 16 * k, height: 16 * k), style: .continuous)
                p.move(to: CGPoint(x: center.x - 34 * k, y: center.y + 30 * k))
                p.addLine(to: CGPoint(x: center.x - 8 * k, y: center.y))
                p.addLine(to: CGPoint(x: center.x + 10 * k, y: center.y + 18 * k))
                p.addLine(to: CGPoint(x: center.x + 20 * k, y: center.y + 8 * k))
                p.addLine(to: CGPoint(x: center.x + 34 * k, y: center.y + 24 * k))
            }
            .stroke(ink, style: StrokeStyle(lineWidth: max(5 * k, 0.75), lineCap: .round, lineJoin: .round))
            Circle().fill(ink).frame(width: 5 * k, height: 5 * k).position(x: center.x + 18 * k, y: center.y - 18 * k)
        }
        .frame(width: width, height: height)
    }
}

/// A card on the page's own ground with a hairline, as the showcase's cards are.
struct ShowCard<Content: View>: View {
    var fill: ((AXStyle) -> Color)? = nil
    var padding: CGFloat? = nil
    /// The edge's color; `.clear` for a card with no border (the checkout card's `borderColor: transparent`).
    var stroke: Color? = nil
    @ViewBuilder var content: Content
    @Environment(\.ax) private var ax

    var body: some View {
        content
            .padding(padding ?? ax.space(5))
            .frame(maxWidth: .infinity, alignment: .leading)
            .axSurface(fill: fill?(ax) ?? ax.card, radius: ax.radiusContainer, stroke: stroke)
    }
}

/// A ghost icon-only button: primary-text glyph on a clear ground, as Astryx's ghost icon button.
/// Its label is the VoiceOver label. The controls the core keeps inert (`view.inert`) are drawn
/// enabled and do nothing, as on the web.
struct ShowIconButton: View {
    let symbol: String
    let label: String
    var action: () -> Void = {}
    @Environment(\.ax) private var ax
    @State private var hovering = false

    var body: some View {
        // Drawn at Astryx's 32; `axTapTarget` gives touch its 44 pt region.
        let side = 32 * min(ax.scale, 1.4)
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: ax.fontSize("font-size-base", 14) * 1.1))
                .foregroundStyle(ax.text)
                .frame(width: side, height: side)
                .background(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).fill(hovering ? ax.overlayHover : .clear))
                .contentShape(Rectangle())
                .axTapTarget(keepLayout: true)
        }
        .buttonStyle(.plain)
        .onHover { hovering = $0 }
        .accessibilityLabel(label)
    }
}

extension ShowModel {
    /// The SF Symbol for one of the model's icon names.
    static func symbol(_ icon: String) -> String {
        switch icon {
        case "search": "magnifyingglass"
        case "account": "person"
        case "cart", "bag": "bag"
        case "download": "square.and.arrow.down"
        case "close": "xmark"
        case "card": "creditcard"
        case "smartphone": "iphone"
        case "wallet": "wallet.bifold"
        case "banknote": "banknote"
        case "folder": "folder"
        case "mapPin": "mappin.and.ellipse"
        case "tag": "tag"
        case "list": "list.bullet"
        case "grid": "square.grid.2x2"
        default: "circle"
        }
    }
}

// MARK: Text fields

/// A field's height as Astryx draws it: `lg` (36) or `sm` (32 on the Mac, 28 on a phone). A touch
/// screen still gets its 44 pt hit region around the drawn box (`showFieldHit`).
func showFieldHeight(_ ax: AXStyle, small: Bool = false) -> CGFloat {
    #if os(macOS)
    (small ? 32 : 36) * min(ax.scale, 1.4)
    #else
    (small ? 28 : 36) * min(ax.scale, 1.4)
    #endif
}

/// The text size inside a field: Astryx's touch rule `max(1rem, var(--text-body-size))` on a
/// touch screen, the body size on the Mac.
func showFieldFont(_ ax: AXStyle) -> Font {
    #if os(iOS)
    .system(size: max(16, ax.fontSize("font-size-base", 14)), weight: ax.weight(Int(ax.size("font-weight-normal", 400))))
    #else
    ax.fontBase
    #endif
}

/// A checkbox or radio mark: Astryx's 18 pt, and on a touch screen its coarse-pointer 24 pt.
func showMarkSide(_ ax: AXStyle) -> CGFloat {
    #if os(iOS)
    24 * min(ax.scale, 1.5)
    #else
    18 * min(ax.scale, 1.5)
    #endif
}

/// The box of a checkbox at `showMarkSide` (the shared `AXCheckmark` keeps 18 pt).
struct ShowCheckbox: View {
    let checked: Bool
    @Environment(\.ax) private var ax

    var body: some View {
        let side = showMarkSide(ax)
        RoundedRectangle(cornerRadius: ax.radiusInner + 1, style: .continuous)
            .fill(checked ? ax.accent : ax.surface)
            .overlay(
                RoundedRectangle(cornerRadius: ax.radiusInner + 1, style: .continuous)
                    .strokeBorder(checked ? ax.accent : ax.borderStrong, lineWidth: 1.5)
            )
            .overlay {
                if checked {
                    Image(systemName: "checkmark")
                        .font(.system(size: side * 0.6, weight: .bold))
                        .foregroundStyle(ax.onAccent)
                }
            }
            .frame(width: side, height: side)
            .accessibilityHidden(true)
    }
}

enum ShowKeyboard { case text, email, digits }

private extension View {
    @ViewBuilder
    func showKeyboard(_ kind: ShowKeyboard) -> some View {
        #if os(iOS)
        switch kind {
        case .text: self
        case .email: self.keyboardType(.emailAddress).textContentType(.emailAddress).textInputAutocapitalization(.never).autocorrectionDisabled()
        case .digits: self.keyboardType(.numberPad)
        }
        #else
        self
        #endif
    }
}

/// A one-line text field in a bordered ground, with an optional leading icon. Typing sends
/// `set` with the field's action id; the label (when shown) is also the VoiceOver label.
struct ShowTextField: View {
    let id: String
    let label: String
    let placeholder: String
    let value: String
    var icon: String? = nil
    var showsLabel = true
    var keyboard: ShowKeyboard = .text
    /// Astryx's `sm` field (32) rather than `lg`.
    var small = false
    @State private var text: String
    @FocusState private var focused: Bool
    @Environment(\.ax) private var ax
    @Environment(\.axStatic) private var isStatic

    init(id: String, label: String, placeholder: String, value: String, icon: String? = nil, showsLabel: Bool = true, keyboard: ShowKeyboard = .text, small: Bool = false) {
        self.id = id; self.label = label; self.placeholder = placeholder; self.value = value
        self.icon = icon; self.showsLabel = showsLabel; self.keyboard = keyboard; self.small = small
        _text = State(initialValue: value)
    }

    var body: some View {
        AXField(label: showsLabel ? label : "") {
            HStack(spacing: ax.space(2)) {
                if let icon { Image(systemName: icon).foregroundStyle(ax.iconSecondary).accessibilityHidden(true) }
                if isStatic {
                    Text(text.isEmpty ? placeholder : text)
                        .font(showFieldFont(ax))
                        .foregroundStyle(text.isEmpty ? ax.textDisabled : ax.text)
                        .lineLimit(1)
                        .frame(maxWidth: .infinity, alignment: .leading)
                } else {
                    TextField(label, text: $text, prompt: Text(placeholder).foregroundColor(ax.textDisabled))
                        .textFieldStyle(.plain)
                        .font(showFieldFont(ax))
                        .foregroundStyle(ax.text)
                        .focused($focused)
                        .showKeyboard(keyboard)
                        .accessibilityLabel(label)
                }
            }
            .padding(.horizontal, ax.space(3))
            .frame(minHeight: showFieldHeight(ax, small: small))
            .background(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).fill(ax.surface))
            .overlay(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).strokeBorder(ax.borderStrong, lineWidth: 1))
            .showFieldHit(ax, small: small) { focused = true }
        }
        .syncedText(id: id, value: value, text: $text)
    }
}

/// A menu that looks like a field: the chosen option (or the placeholder) and a chevron.
/// Choosing sends `set` with the option's value.
struct ShowMenuField<Choices: View>: View {
    let text: String
    var placeholder = false
    var icon: String? = nil
    var compact = false
    @ViewBuilder var choices: Choices
    @Environment(\.ax) private var ax
    @Environment(\.axStatic) private var isStatic
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        if isStatic {
            label
        } else {
            Menu { choices } label: { label }
                .menuStyle(.button)
                .buttonStyle(.plain)
                .menuIndicator(.hidden)
        }
    }

    private var label: some View {
        HStack(spacing: ax.space(2)) {
            if let icon { Image(systemName: icon).foregroundStyle(ax.iconSecondary) }
            Text(text)
                .font(showFieldFont(ax))
                .foregroundStyle(placeholder ? ax.textSecondary : ax.text)
                .lineLimit(typeSize.isAccessibilitySize ? nil : 1)
            if !compact { Spacer(minLength: ax.space(2)) }
            Image(systemName: "chevron.up.chevron.down")
                .font(.system(size: ax.fontSize("font-size-xs", 10), weight: .semibold))
                .foregroundStyle(ax.iconSecondary)
        }
        .padding(.horizontal, ax.space(3))
        .frame(minHeight: showFieldHeight(ax, small: compact))
        .frame(maxWidth: compact ? nil : .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).fill(ax.surface))
        .overlay(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).strokeBorder(ax.borderStrong, lineWidth: 1))
        .contentShape(Rectangle())
        .axTapTarget(keepLayout: true)
    }
}

extension View {
    /// Reaches the field's tap out to the 44 pt region on a touch screen without growing the
    /// drawn box: the hit area is padded by what the box lacks, and the padding is taken back.
    @ViewBuilder
    func showFieldHit(_ ax: AXStyle, small: Bool, tap: @escaping () -> Void) -> some View {
        #if os(iOS)
        let extra = max((axMinTarget - showFieldHeight(ax, small: small)) / 2, 0)
        self
            .padding(.vertical, extra)
            .contentShape(Rectangle())
            .onTapGesture(perform: tap)
            .padding(.vertical, -extra)
        #else
        self
        #endif
    }
}
