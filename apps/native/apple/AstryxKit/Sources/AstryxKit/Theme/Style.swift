import CoreText
import SwiftUI

extension Color {
    /// A color from hue (degrees), saturation and lightness (0 to 1), as CSS `hsl()` reads them.
    public init(hue degrees: Double, saturation s: Double, lightness l: Double) {
        let h = ((degrees.truncatingRemainder(dividingBy: 360)) + 360).truncatingRemainder(dividingBy: 360)
        let c = (1 - abs(2 * l - 1)) * s
        let x = c * (1 - abs((h / 60).truncatingRemainder(dividingBy: 2) - 1))
        let m = l - c / 2
        let (r, g, b): (Double, Double, Double) = switch h {
        case ..<60: (c, x, 0)
        case ..<120: (x, c, 0)
        case ..<180: (0, c, x)
        case ..<240: (0, x, c)
        case ..<300: (x, 0, c)
        default: (c, 0, x)
        }
        self.init(.sRGB, red: r + m, green: g + m, blue: b + m, opacity: 1)
    }

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
    /// The theme's tokens with the native drawing's contrast floors applied (see `AXPalette`).
    let mode: ResolvedMode
    let isDark: Bool
    /// Dynamic Type's growth for body-sized text (17 pt and smaller)...
    let scale: CGFloat
    /// ...and for large-title-sized text (34 pt and larger); sizes between interpolate.
    var largeScale: CGFloat = 1
    /// True under Settings > Accessibility > Increase Contrast.
    var increasedContrast = false

    init(mode: ResolvedMode, isDark: Bool, scale: CGFloat, largeScale: CGFloat = 1, increasedContrast: Bool = false) {
        self.mode = AXPalette.strengthened(mode, increased: increasedContrast)
        self.isDark = isDark
        self.scale = scale
        self.largeScale = largeScale
        self.increasedContrast = increasedContrast
    }

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
    /// Placeholders and text that is dimmed but still works (an out-of-month date). The theme's own
    /// disabled gray is 2:1 on white; this is raised to 4.5:1 (see `AXPalette`).
    var textDisabled: Color { color("color-text-disabled") }
    /// Inactive content that is not a control's own words (an out-of-month date): the theme's
    /// disabled token as it is, as the web draws it. WCAG exempts inactive content from 4.5:1.
    var textInactive: Color { mode.colors["color-text-inactive"] == nil ? textDisabled : color("color-text-inactive") }
    var border: Color { color("color-border") }
    var borderStrong: Color { color("color-border-emphasized") }
    var iconSecondary: Color { color("color-icon-secondary") }
    // Accent
    var accent: Color { color("color-accent") }
    var accentMuted: Color { color("color-accent-muted") }
    /// The theme's accent thinned to 16 %: the web's `ACCENT_SOFT` (web/src/render/tone.ts). Astryx's
    /// own muted accent does not follow a theme's accent override; this does.
    var accentSoft: Color { accent.opacity(0.16) }
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
    func fontSize(_ key: String, _ fallback: CGFloat) -> CGFloat { scaled(size(key, fallback)) }

    /// A token size grown as Dynamic Type grows Apple's own text styles: small text by the body
    /// factor, large text by the large-title factor (at the largest accessibility size, body
    /// grows 3.1× but a large title only 1.76×), and sizes in between by a blend of the two.
    func scaled(_ points: CGFloat) -> CGFloat {
        let t = Swift.min(Swift.max((points - 17) / (34 - 17), 0), 1)
        return points * (scale + (largeScale - scale) * t)
    }
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
            ToneColors(text: color("color-text-primary"), solid: color("color-icon-secondary"), muted: color("color-neutral"), border: border, onSolid: color("color-background-surface"))
        case .accent:
            ToneColors(text: color("color-text-accent"), solid: accent, muted: accentSoft, border: accent.opacity(0.35), onSolid: onAccent)
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

    /// A person's mark: initials in white on `hsl(hue 52% 40%)`, in light and dark alike, as the
    /// web's `.an-avatar` paints them (web/src/styles.css).
    func person(hue: Double) -> (ground: Color, mark: Color) {
        (Color(hue: hue, saturation: 0.52, lightness: 0.40), .white)
    }

    // MARK: Line heights

    /// The space to add between lines so that a line of `size` points is `ratio` times its size,
    /// as Astryx's `--text-*-leading` tokens set it (a system font is about 1.19 times its size
    /// before any).
    func lineSpacing(size: CGFloat, ratio: CGFloat) -> CGFloat {
        Swift.max(0, size * ratio - axNaturalLineHeight(size))
    }

    /// Body text: 14 on 20.
    var bodyLeading: CGFloat { size("text-body-leading", 1.4286) }
    /// Supporting text and badges: 12 on 20.
    var supportingLeading: CGFloat { size("text-supporting-leading", 1.6667) }
    /// A heading's line height ratio.
    func headingLeading(_ level: Int) -> CGFloat {
        let l = min(max(level, 1), 6)
        let defaults: [CGFloat] = [1.3333, 1.4, 1.4118, 1.4286, 1.6667, 1.6]
        return size("text-heading-\(l)-leading", defaults[l - 1])
    }

    /// A tone as text, as the web's `TEXT_TONE` does (web/src/render/tone.ts): success and danger
    /// read the plain `color-success` and `color-error`, neutral reads the secondary text.
    func textTone(_ tone: Tone) -> Color {
        switch tone {
        case .neutral: textSecondary
        case .accent: color("color-text-accent")
        case .success: color("color-success")
        case .warning: color("color-text-orange")
        case .danger: color("color-error")
        case .info: color("color-text-blue")
        }
    }

    /// A tone as a fill (dots, bars, an icon's color): the web's `FILL_TONE`.
    func fillTone(_ tone: Tone) -> Color {
        switch tone {
        case .neutral: iconSecondary
        case .accent: accent
        case .success: color("color-success")
        case .warning: color("color-warning")
        case .danger: color("color-error")
        case .info: color("color-icon-blue")
        }
    }

    /// A tone as a soft ground behind an icon or a chip: the web's `SOFT_TONE`.
    func softTone(_ tone: Tone) -> Color {
        switch tone {
        case .neutral: muted
        case .accent: accentSoft
        case .success: color("color-success-muted")
        case .warning: color("color-warning-muted")
        case .danger: color("color-error-muted")
        case .info: color("color-background-blue")
        }
    }

    // MARK: Badge colors

    /// A badge's fill and ink, as Astryx's `Badge` and the web's `ToneBadge` set them: success,
    /// warning, error and info are solid; neutral is `color-neutral` with primary text; accent is
    /// the thinned accent with accent text.
    func badge(_ tone: Tone) -> (fill: Color, ink: Color) {
        switch tone {
        case .neutral: (color("color-neutral"), text)
        case .accent: (accentSoft, color("color-text-accent"))
        case .success: (color("color-success"), color("color-on-success"))
        case .warning: (color("color-warning"), color("color-on-warning"))
        case .danger: (color("color-error"), color("color-on-error"))
        case .info: (accent, onAccent)
        }
    }
}

/// A system font's natural line height at `size` (ascent, descent and leading).
func axNaturalLineHeight(_ size: CGFloat) -> CGFloat {
    let font = CTFontCreateUIFontForLanguage(.system, size, nil) ?? CTFontCreateWithName("Helvetica" as CFString, size, nil)
    return CTFontGetAscent(font) + CTFontGetDescent(font) + CTFontGetLeading(font)
}

extension View {
    /// Text laid out on Astryx's line height: `ratio` times the point `size` per line (a one-line
    /// text takes that height too, centered in it).
    func axLeading(_ ax: AXStyle, size: CGFloat, ratio: CGFloat) -> some View {
        lineSpacing(ax.lineSpacing(size: size, ratio: ratio))
            .frame(minHeight: size * ratio, alignment: Alignment(horizontal: .leading, vertical: .center))
    }
}

/// Dynamic Type's multiplier for a large title (Apple's Large Title, 34 pt at Large).
func axLargeScale(for size: DynamicTypeSize) -> CGFloat {
    switch size {
    case .xSmall: 0.91
    case .small: 0.94
    case .medium: 0.97
    case .large: 1
    case .xLarge: 1.06
    case .xxLarge: 1.12
    case .xxxLarge: 1.18
    case .accessibility1: 1.29
    case .accessibility2: 1.41
    case .accessibility3: 1.53
    case .accessibility4: 1.65
    case .accessibility5: 1.76
    @unknown default: 1
    }
}

/// Dynamic Type's multiplier for body-sized token text (Apple's Body, 17 pt at Large).
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
private struct AXFillButtonsKey: EnvironmentKey { static let defaultValue = false }
private struct AXWidthKey: EnvironmentKey { static let defaultValue: CGFloat = 800 }
private struct AXHeightKey: EnvironmentKey { static let defaultValue: CGFloat = 800 }
private struct AXInRowKey: EnvironmentKey { static let defaultValue = false }
private struct AXBleedKey: EnvironmentKey { static let defaultValue: CGFloat = 0 }

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
    /// True inside a horizontal stack: a text input or select there keeps a width of its own
    /// (as in a flex row) instead of taking the whole width, as it does in a column.
    var axInRow: Bool {
        get { self[AXInRowKey.self] }
        set { self[AXInRowKey.self] = newValue }
    }
    /// The height the screen has, for boxes sized by the window (the chat's box is 68 % of it).
    var axHeight: CGFloat {
        get { self[AXHeightKey.self] }
        set { self[AXHeightKey.self] = newValue }
    }
    /// The padding of the card a table sits in: a table runs to the card's edges (as Astryx's
    /// Table pulls itself out of its container) and pads its cells by this much.
    var axBleed: CGFloat {
        get { self[AXBleedKey.self] }
        set { self[AXBleedKey.self] = newValue }
    }
    /// True only when a screen is drawn to an image with no window (ImageRenderer draws a
    /// TextField, Toggle, Picker, Slider or ScrollView as an empty box). Controls then draw as
    /// plain stand-ins so the layout around them can be checked; a running app never sets it.
    var axStatic: Bool {
        get { self[AXStaticKey.self] }
        set { self[AXStaticKey.self] = newValue }
    }
    /// Set by a column of stacked buttons: the buttons inside take the column's whole width.
    var axFillButtons: Bool {
        get { self[AXFillButtonsKey.self] }
        set { self[AXFillButtonsKey.self] = newValue }
    }
    var axSend: AXSender {
        get { self[AXSendKey.self] }
        set { self[AXSendKey.self] = newValue }
    }
}

/// Applies the theme as the `ax` environment value; it reads Increase Contrast itself, which a
/// plain View method cannot.
private struct AXThemeModifier: ViewModifier {
    let theme: ResolvedTheme?
    let scheme: ColorScheme
    let typeSize: DynamicTypeSize
    @Environment(\.colorSchemeContrast) private var contrast

    func body(content: Content) -> some View {
        let style: AXStyle
        if let theme {
            style = AXStyle(
                mode: scheme == .dark ? theme.dark : theme.light,
                isDark: scheme == .dark,
                scale: axScale(for: typeSize),
                largeScale: axLargeScale(for: typeSize),
                increasedContrast: contrast == .increased
            )
        } else {
            style = .fallback
        }
        return content.environment(\.ax, style)
    }
}

extension View {
    /// Paints the subtree with a theme's tokens for the current color scheme and text size.
    func axTheme(_ theme: ResolvedTheme?, scheme: ColorScheme, typeSize: DynamicTypeSize) -> some View {
        modifier(AXThemeModifier(theme: theme, scheme: scheme, typeSize: typeSize))
    }
}
