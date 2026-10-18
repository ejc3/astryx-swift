import SwiftUI

/// Small pieces the showcase template's sections share.

/// Mirrors a model value into local state when the model changes it, so a control can be
/// edited at once yet still follow the core. (The showcase core ignores every edit, as the
/// stock page does; a native control keeps what was picked instead of snapping back.)
extension View {
    func showMirror<T: Equatable>(_ model: T, into state: Binding<T>) -> some View {
        onChange(of: model) { _, new in state.wrappedValue = new }
    }
}

/// A badge colored by one of the data hues: `color-text-<hue>` on `color-background-<hue>`.
struct ShowBadge: View {
    let text: String
    let variant: ShowVariant
    @Environment(\.ax) private var ax

    var body: some View {
        Text(text)
            .font(ax.font("font-size-xs", 10, weight: "font-weight-semibold"))
            .foregroundStyle(ax.color("color-text-\(variant.family)"))
            .lineLimit(1)
            .padding(.horizontal, ax.space(2))
            .padding(.vertical, ax.hair + 1)
            .background(Capsule().fill(ax.color("color-background-\(variant.family)")))
            .overlay(Capsule().strokeBorder(ax.color("color-border-\(variant.family)").opacity(0.5), lineWidth: 1))
    }
}

/// The stand-in for a product photo: Astryx's neutral placeholder (a pale ground and an
/// outlined picture mark), drawn with theme tokens.
struct ShowPhoto: View {
    var ratio: CGFloat = 1
    var corner: CGFloat = 0
    var side: CGFloat? = nil
    /// The height when the caller knows the column's width (a grid cell's own size is not reliable).
    var height: CGFloat? = nil
    @Environment(\.ax) private var ax

    var body: some View {
        let mark = Image(systemName: "photo")
            .font(.system(size: (side ?? 120) * 0.3, weight: .light))
            .foregroundStyle(ax.textDisabled)
        Group {
            if let side {
                Rectangle().fill(ax.muted).overlay(mark).frame(width: side, height: side)
            } else if let height {
                Rectangle().fill(ax.muted).overlay(mark).frame(maxWidth: .infinity).frame(height: height)
            } else {
                Color.clear.aspectRatio(ratio, contentMode: .fit).overlay(Rectangle().fill(ax.muted)).overlay(mark)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: corner, style: .continuous))
        .accessibilityHidden(true)
    }
}

/// A card on the page's own ground with a hairline, as the showcase's cards are.
struct ShowCard<Content: View>: View {
    var fill: ((AXStyle) -> Color)? = nil
    var padding: CGFloat? = nil
    @ViewBuilder var content: Content
    @Environment(\.ax) private var ax

    var body: some View {
        content
            .padding(padding ?? ax.space(5))
            .frame(maxWidth: .infinity, alignment: .leading)
            .axSurface(fill: fill?(ax) ?? ax.card, radius: ax.radiusContainer)
    }
}

/// Which of the showcase's controls the core keeps inert (view.inert): the stock page draws them
/// and wires them to nothing, so they are drawn disabled and VoiceOver says so.
private struct ShowInertKey: EnvironmentKey { static let defaultValue: Set<String> = [] }

extension EnvironmentValues {
    var showInert: Set<String> {
        get { self[ShowInertKey.self] }
        set { self[ShowInertKey.self] = newValue }
    }
}

/// A ghost icon-only button; its label is the VoiceOver label. `inert` names the core's inert
/// control it is (nil when it works).
struct ShowIconButton: View {
    let symbol: String
    let label: String
    var selected = false
    var inert: String? = nil
    var action: () -> Void = {}
    @Environment(\.ax) private var ax
    @Environment(\.showInert) private var inertControls

    var body: some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: ax.fontSize("font-size-base", 14) * 1.1))
                .foregroundStyle(selected ? ax.accent : ax.iconSecondary)
                .frame(width: max(axMinTarget, 34 * min(ax.scale, 1.4)), height: max(axMinTarget, 34 * min(ax.scale, 1.4)))
                .background(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).fill(selected ? ax.accentMuted : .clear))
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(inert.map(inertControls.contains) ?? false)
        .accessibilityLabel(label)
        .accessibilityAddTraits(selected ? .isSelected : [])
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
        case "wallet": "wallet.pass"
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
    @State private var text: String
    @Environment(\.ax) private var ax
    @Environment(\.axStatic) private var isStatic

    init(id: String, label: String, placeholder: String, value: String, icon: String? = nil, showsLabel: Bool = true, keyboard: ShowKeyboard = .text) {
        self.id = id; self.label = label; self.placeholder = placeholder; self.value = value
        self.icon = icon; self.showsLabel = showsLabel; self.keyboard = keyboard
        _text = State(initialValue: value)
    }

    var body: some View {
        AXField(label: showsLabel ? label : "") {
            HStack(spacing: ax.space(2)) {
                if let icon { Image(systemName: icon).foregroundStyle(ax.iconSecondary).accessibilityHidden(true) }
                if isStatic {
                    Text(text.isEmpty ? placeholder : text)
                        .font(ax.fontBase)
                        .foregroundStyle(text.isEmpty ? ax.textDisabled : ax.text)
                        .lineLimit(1)
                        .frame(maxWidth: .infinity, alignment: .leading)
                } else {
                    TextField(label, text: $text, prompt: Text(placeholder).foregroundColor(ax.textDisabled))
                        .textFieldStyle(.plain)
                        .font(ax.fontBase)
                        .foregroundStyle(ax.text)
                        .showKeyboard(keyboard)
                        .accessibilityLabel(label)
                }
            }
            .padding(.horizontal, ax.space(3))
            .frame(minHeight: max(axMinTarget, 40 * min(ax.scale, 1.4)))
            .background(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).fill(ax.surface))
            .overlay(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).strokeBorder(ax.borderStrong, lineWidth: 1))
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
                .font(ax.fontBase)
                .foregroundStyle(placeholder ? ax.textSecondary : ax.text)
                .lineLimit(typeSize.isAccessibilitySize ? nil : 1)
            if !compact { Spacer(minLength: ax.space(2)) }
            Image(systemName: "chevron.up.chevron.down")
                .font(.system(size: ax.fontSize("font-size-xs", 10), weight: .semibold))
                .foregroundStyle(ax.iconSecondary)
        }
        .padding(.horizontal, ax.space(3))
        .frame(minHeight: max(axMinTarget, (compact ? 32 : 40) * min(ax.scale, 1.4)))
        .frame(maxWidth: compact ? nil : .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).fill(ax.surface))
        .overlay(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).strokeBorder(ax.borderStrong, lineWidth: 1))
        .contentShape(Rectangle())
    }
}
