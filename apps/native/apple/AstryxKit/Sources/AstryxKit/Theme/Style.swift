import SwiftUI

extension Color {
    /// A color from `#RRGGBBAA`, the form the theme store uses. `#RRGGBB` and `#RGB` also read.
    public init(hex: String) {
        var digits = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        if digits.count == 3 { digits = digits.map { "\($0)\($0)" }.joined() }
        if digits.count == 6 { digits += "FF" }
        guard digits.count == 8, let value = UInt32(digits, radix: 16) else {
            self = .clear
            return
        }
        self.init(
            .sRGB,
            red: Double((value >> 24) & 0xFF) / 255,
            green: Double((value >> 16) & 0xFF) / 255,
            blue: Double((value >> 8) & 0xFF) / 255,
            opacity: Double(value & 0xFF) / 255
        )
    }
}

/// The colors a tone paints with, all read from the theme's tokens.
struct ToneColors {
    /// Text and icons of this tone on the page.
    let text: Color
    /// A solid ground (progress fill, dots, filled badges).
    let solid: Color
    /// The tinted ground of a badge or banner.
    let muted: Color
    /// The hairline around a tinted ground.
    let border: Color
    /// Text on `solid`.
    let onSolid: Color
}

/// The tokens of one mode of the theme, with the Dynamic Type scale. Every view reads its
/// colors, radii, spacing and type sizes from here, never from a constant of its own.
struct AXStyle: Sendable {
    let mode: ResolvedMode
    let isDark: Bool
    /// Dynamic Type's multiplier for the token font sizes.
    let scale: CGFloat

    /// A neutral stand-in used before the first theme snapshot arrives.
    static let fallback = AXStyle(
        mode: ResolvedMode(colors: [:], sizes: [:]), isDark: false, scale: 1
    )

    func color(_ key: String) -> Color {
        guard let hex = mode.colors[key] else { return .clear }
        return Color(hex: hex)
    }

    func size(_ key: String, _ fallback: CGFloat) -> CGFloat {
        mode.sizes[key].map { CGFloat($0) } ?? fallback
    }

    // Grounds
    var page: Color { mode.colors["color-background-body"] == nil ? Color.gray.opacity(0.1) : color("color-background-body") }
    var surface: Color { color("color-background-surface") }
    var card: Color { color("color-background-card") }
    var muted: Color { color("color-background-muted") }
    var overlayHover: Color { color("color-overlay-hover") }
    var track: Color { color("color-track") }
    var shadow: Color { color("color-shadow") }
    // Text and strokes
    var text: Color { color("color-text-primary") }
    var textSecondary: Color { color("color-text-secondary") }
    var textDisabled: Color { color("color-text-disabled") }
    var border: Color { color("color-border") }
    var borderStrong: Color { color("color-border-emphasized") }
    var iconSecondary: Color { color("color-icon-secondary") }
    // Accent
    var accent: Color { color("color-accent") }
    var accentMuted: Color { color("color-accent-muted") }
    var onAccent: Color { color("color-on-accent") }
    var danger: Color { color("color-error") }

    // Radii
    var radiusInner: CGFloat { size("radius-inner", 4) }
    var radiusElement: CGFloat { size("radius-element", 8) }
    var radiusContainer: CGFloat { size("radius-container", 12) }
    var radiusFull: CGFloat { 999 }

    // Spacing: the token ladder, used as-is.
    func space(_ step: Int) -> CGFloat {
        size("spacing-\(step)", CGFloat(step) * 4)
    }
    /// The half steps of the ladder: `spacing-1-5` is `space(half: 1)`.
    func space(half step: Int) -> CGFloat { size("spacing-\(step)-5", CGFloat(step) * 4 + 2) }
    /// The smallest step, `spacing-0-5`.
    var hair: CGFloat { size("spacing-0-5", 2) }
    func space(_ gap: Gap) -> CGFloat {
        switch gap {
        case .xs: space(1)
        case .sm: space(2)
        case .md: space(4)
        case .lg: space(6)
        }
    }

    // Type
    func fontSize(_ key: String, _ fallback: CGFloat) -> CGFloat { size(key, fallback) * scale }
    func weight(_ value: Int) -> Font.Weight {
        switch value {
        case ..<350: .light
        case 350..<450: .regular
        case 450..<550: .medium
        case 550..<650: .semibold
        case 650..<750: .bold
        default: .heavy
        }
    }
    func font(_ size: String, _ fallback: CGFloat, weight key: String = "font-weight-normal", design: Font.Design = .default) -> Font {
        .system(size: fontSize(size, fallback), weight: weight(Int(self.size(key, 400))), design: design)
    }
    var fontBase: Font { font("font-size-base", 14) }
    var fontSmall: Font { font("font-size-sm", 12) }
    var fontXSmall: Font { font("font-size-xs", 10) }
    var fontLabel: Font { font("font-size-base", 14, weight: "font-weight-medium") }
    var fontStrong: Font { font("font-size-base", 14, weight: "font-weight-semibold") }
    func heading(_ level: Int) -> Font {
        let l = min(max(level, 1), 6)
        let defaults: [CGFloat] = [24, 20, 17, 14, 12, 10]
        return .system(
            size: fontSize("text-heading-\(l)-size", defaults[l - 1]),
            weight: weight(Int(size("text-heading-\(l)-weight", 600)))
        )
    }

    func tone(_ tone: Tone) -> ToneColors {
        switch tone {
        case .neutral:
            ToneColors(text: color("color-text-gray"), solid: color("color-text-secondary"), muted: color("color-neutral"), border: border, onSolid: color("color-background-surface"))
        case .accent:
            ToneColors(text: color("color-text-accent"), solid: accent, muted: accentMuted, border: accent.opacity(0.35), onSolid: onAccent)
        case .success:
            ToneColors(text: color("color-text-green"), solid: color("color-success"), muted: color("color-success-muted"), border: color("color-border-green"), onSolid: color("color-on-success"))
        case .warning:
            ToneColors(text: color("color-text-orange"), solid: color("color-warning"), muted: color("color-warning-muted"), border: color("color-border-orange"), onSolid: color("color-on-warning"))
        case .danger:
            ToneColors(text: color("color-text-red"), solid: color("color-error"), muted: color("color-error-muted"), border: color("color-border-red"), onSolid: color("color-on-error"))
        case .info:
            ToneColors(text: color("color-text-blue"), solid: color("color-icon-blue"), muted: color("color-background-blue"), border: color("color-border-blue"), onSolid: color("color-on-accent"))
        }
    }

    /// A person's tint: a soft ground and a strong mark of one hue, light or dark.
    func person(hue: Double) -> (ground: Color, mark: Color) {
        let h = (hue.truncatingRemainder(dividingBy: 360) + 360).truncatingRemainder(dividingBy: 360) / 360
        if isDark {
            return (Color(hue: h, saturation: 0.45, brightness: 0.42), Color(hue: h, saturation: 0.25, brightness: 0.97))
        }
        return (Color(hue: h, saturation: 0.28, brightness: 0.96), Color(hue: h, saturation: 0.75, brightness: 0.45))
    }
}

/// Dynamic Type's multiplier for token sizes (Apple's body text scale, relative to Large).
func axScale(for size: DynamicTypeSize) -> CGFloat {
    switch size {
    case .xSmall: 0.82
    case .small: 0.88
    case .medium: 0.94
    case .large: 1
    case .xLarge: 1.12
    case .xxLarge: 1.23
    case .xxxLarge: 1.35
    case .accessibility1: 1.6
    case .accessibility2: 1.9
    case .accessibility3: 2.35
    case .accessibility4: 2.75
    case .accessibility5: 3.1
    @unknown default: 1
    }
}

private struct AXStyleKey: EnvironmentKey { static let defaultValue = AXStyle.fallback }
private struct AXStaticKey: EnvironmentKey { static let defaultValue = false }
private struct AXWidthKey: EnvironmentKey { static let defaultValue: CGFloat = 800 }

/// A closure that sends an Action; the root view sets it, nodes call it.
struct AXSender: Sendable {
    let run: @MainActor @Sendable (Action) -> Void
    @MainActor func callAsFunction(_ action: Action) { run(action) }
}
private struct AXSendKey: EnvironmentKey { static let defaultValue = AXSender { _ in } }

extension EnvironmentValues {
    var ax: AXStyle {
        get { self[AXStyleKey.self] }
        set { self[AXStyleKey.self] = newValue }
    }
    /// The width the screen's content has, so nodes can choose wide or narrow forms.
    var axWidth: CGFloat {
        get { self[AXWidthKey.self] }
        set { self[AXWidthKey.self] = newValue }
    }
    /// True only when a screen is drawn to an image with no window (ImageRenderer draws a
    /// TextField, Toggle, Picker, Slider or ScrollView as an empty box). Controls then draw as
    /// plain stand-ins so the layout around them can be checked; a running app never sets it.
    var axStatic: Bool {
        get { self[AXStaticKey.self] }
        set { self[AXStaticKey.self] = newValue }
    }
    var axSend: AXSender {
        get { self[AXSendKey.self] }
        set { self[AXSendKey.self] = newValue }
    }
}

extension View {
    /// Paints the subtree with a theme's tokens for the current color scheme and text size.
    func axTheme(_ theme: ResolvedTheme?, scheme: ColorScheme, typeSize: DynamicTypeSize) -> some View {
        let style: AXStyle
        if let theme {
            style = AXStyle(mode: scheme == .dark ? theme.dark : theme.light, isDark: scheme == .dark, scale: axScale(for: typeSize))
        } else {
            style = .fallback
        }
        return environment(\.ax, style)
    }
}
