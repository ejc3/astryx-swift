import Foundation

/// A color as sRGB components and alpha, 0 to 1. This is pure arithmetic with no SwiftUI in it,
/// so the contrast the theme tokens reach can be computed (and tested) from the same hex strings
/// the theme store sends.
struct AXRGBA: Equatable, Sendable {
    var r: Double
    var g: Double
    var b: Double
    var a: Double = 1

    static let white = AXRGBA(r: 1, g: 1, b: 1)
    /// The dark ink the themes use for text on yellow (`color-on-warning`).
    static let ink = AXRGBA(r: 10.0 / 255, g: 19.0 / 255, b: 23.0 / 255)

    /// `#RRGGBBAA`, `#RRGGBB` or `#RGB`, as the theme store writes them.
    init?(hex: String) {
        var digits = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        if digits.count == 3 { digits = digits.map { "\($0)\($0)" }.joined() }
        if digits.count == 6 { digits += "FF" }
        guard digits.count == 8, let value = UInt32(digits, radix: 16) else { return nil }
        r = Double((value >> 24) & 0xFF) / 255
        g = Double((value >> 16) & 0xFF) / 255
        b = Double((value >> 8) & 0xFF) / 255
        a = Double(value & 0xFF) / 255
    }

    init(r: Double, g: Double, b: Double, a: Double = 1) {
        self.r = r; self.g = g; self.b = b; self.a = a
    }

    /// `#RRGGBBAA`, each channel rounded to 8 bits.
    var hex: String {
        func byte(_ x: Double) -> Int { Int((Swift.min(Swift.max(x, 0), 1) * 255).rounded()) }
        return String(format: "#%02X%02X%02X%02X", byte(r), byte(g), byte(b), byte(a))
    }

    /// This color painted over an opaque ground.
    func over(_ ground: AXRGBA) -> AXRGBA {
        AXRGBA(r: r * a + ground.r * (1 - a), g: g * a + ground.g * (1 - a), b: b * a + ground.b * (1 - a))
    }

    /// The straight blend toward `other`, `t` from 0 (this) to 1 (other), opaque.
    func mixed(toward other: AXRGBA, _ t: Double) -> AXRGBA {
        AXRGBA(r: r + (other.r - r) * t, g: g + (other.g - g) * t, b: b + (other.b - b) * t)
    }

    /// WCAG relative luminance of the color as it is (ignoring alpha).
    var luminance: Double {
        func linear(_ c: Double) -> Double { c <= 0.03928 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4) }
        return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
    }

    /// The WCAG contrast ratio of this color, painted over `ground`, against that ground.
    func contrast(on ground: AXRGBA) -> Double {
        let a = over(ground).luminance
        let b = ground.luminance
        return (Swift.max(a, b) + 0.05) / (Swift.min(a, b) + 0.05)
    }
}

enum AXContrast {
    /// Text up to 17 pt (HIG Accessibility; WCAG AA).
    static let text = 4.5
    /// Large or bold text and non-text parts of controls (WCAG 1.4.11).
    static let control = 3.0
    /// Enhanced contrast (WCAG AAA), used under Increase Contrast.
    static let enhanced = 7.0

    /// The lowest contrast of `color` over each of `grounds`.
    static func lowest(_ color: AXRGBA, on grounds: [AXRGBA]) -> Double {
        grounds.map { color.contrast(on: $0) }.min() ?? .infinity
    }

    /// `color`, moved the least distance toward `target` that reaches `ratio` on every ground
    /// (and `color` itself when it already does). The result is exact to 8 bits per channel.
    static func reaching(_ color: AXRGBA, toward target: AXRGBA, ratio: Double, on grounds: [AXRGBA]) -> AXRGBA {
        if lowest(color, on: grounds) >= ratio { return color }
        if lowest(target, on: grounds) < ratio { return target }
        var low = 0.0, high = 1.0
        for _ in 0..<24 {
            let mid = (low + high) / 2
            if lowest(color.mixed(toward: target, mid), on: grounds) >= ratio { high = mid } else { low = mid }
        }
        // Rounding to 8 bits can cost a hair of contrast; step on until the stored color passes.
        var t = high
        while t < 1 {
            let rounded = quantized(color.mixed(toward: target, t))
            if lowest(rounded, on: grounds) >= ratio { return rounded }
            t = Swift.min(t + 0.002, 1)
        }
        return target
    }

    /// The one of `candidates` with the best worst-case contrast against every one of `solids`.
    static func bestInk(_ candidates: [AXRGBA], on solids: [AXRGBA]) -> AXRGBA {
        candidates.max { lowest($0, on: solids) < lowest($1, on: solids) } ?? .white
    }

    private static func quantized(_ color: AXRGBA) -> AXRGBA {
        func q(_ x: Double) -> Double { (Swift.min(Swift.max(x, 0), 1) * 255).rounded() / 255 }
        return AXRGBA(r: q(color.r), g: q(color.g), b: q(color.b), a: color.a)
    }
}

/// The native drawing's stronger tokens. The core's theme tokens are Astryx's own and must stay as
/// they are (the web matches stock Astryx); a phone held in daylight is a harsher place than a
/// page in a browser, and the HIG asks for 4.5:1 text, so the native side starts from the theme's
/// token and moves it only as far as it has to.
///
/// - `color-text-secondary`: 4.5:1 on every ground, 7:1 under Increase Contrast.
/// - `color-text-disabled` (placeholders and the dates, steppers and hints that stay tappable):
///   4.5:1 on the page and the cards, from the theme's value toward the secondary text.
/// - `color-border-emphasized` (field, checkbox and chip outlines): 3:1.
/// - `color-text-<hue>` on its tinted ground (badges, counts): 4.5:1.
/// - `color-on-accent`, `-error`, `-success`, `-warning`: white or dark ink, whichever reads better
///   on the fill, when the theme's own choice falls under 4.5:1 (white on the dark blue is 3.1).
/// - Increase Contrast also strengthens `color-border` and `color-track` to 3:1.
enum AXPalette {
    /// Tinted grounds that carry text, and the text token of the same hue.
    static let toneText: [(text: String, ground: String)] = [
        ("color-text-accent", "color-accent-muted"),
        ("color-text-red", "color-error-muted"),
        ("color-text-green", "color-success-muted"),
        ("color-text-orange", "color-warning-muted"),
        ("color-text-blue", "color-background-blue"),
        ("color-text-cyan", "color-background-cyan"),
        ("color-text-pink", "color-background-pink"),
        ("color-text-purple", "color-background-purple"),
        ("color-text-teal", "color-background-teal"),
        ("color-text-yellow", "color-background-yellow"),
    ]

    /// Text colors and the fills they sit on.
    static let onSolid: [(on: String, solids: [String])] = [
        ("color-on-accent", ["color-accent", "color-icon-blue"]),
        ("color-on-error", ["color-error"]),
        ("color-on-success", ["color-success"]),
        ("color-on-warning", ["color-warning"]),
    ]

    /// The grounds text and outlines sit on, each painted over the page: the page, a surface, a
    /// card, a muted area and a neutral bubble.
    struct Grounds {
        let body: AXRGBA
        let surface: AXRGBA
        let card: AXRGBA
        let muted: AXRGBA
        let neutral: AXRGBA
        /// Where text and controls are drawn on plain grounds.
        var plain: [AXRGBA] { [body, surface, card] }
        var all: [AXRGBA] { [body, surface, card, muted, neutral] }
    }

    static func grounds(_ colors: [String: String]) -> Grounds? {
        func color(_ key: String) -> AXRGBA? { colors[key].flatMap(AXRGBA.init(hex:)) }
        guard let body = color("color-background-body"), let surface = color("color-background-surface"),
              let card = color("color-background-card") else { return nil }
        let page = body.over(.white)
        let surfaceOnPage = surface.over(page)
        let cardOnPage = card.over(page)
        let muted = (color("color-background-muted") ?? AXRGBA(r: 0, g: 0, b: 0, a: 0)).over(cardOnPage)
        let neutral = (color("color-neutral") ?? AXRGBA(r: 0, g: 0, b: 0, a: 0)).over(surfaceOnPage)
        return Grounds(body: page, surface: surfaceOnPage, card: cardOnPage, muted: muted, neutral: neutral)
    }

    static func strengthened(_ mode: ResolvedMode, increased: Bool = false) -> ResolvedMode {
        var colors = mode.colors
        guard let grounds = Self.grounds(colors), let primary = colors["color-text-primary"].flatMap(AXRGBA.init(hex:)) else {
            return mode
        }
        func color(_ key: String) -> AXRGBA? { colors[key].flatMap(AXRGBA.init(hex:)) }
        func set(_ key: String, _ value: AXRGBA) { colors[key] = value.hex }

        // Secondary text first: the disabled text is moved toward it.
        let textRatio = increased ? AXContrast.enhanced : AXContrast.text
        if let secondary = color("color-text-secondary") {
            let stronger = AXContrast.reaching(secondary, toward: primary, ratio: textRatio, on: grounds.all)
            if stronger != secondary {
                if color("color-icon-secondary") == secondary { set("color-icon-secondary", stronger) }
                set("color-text-secondary", stronger)
            }
        }
        if let disabled = color("color-text-disabled") {
            let secondary = color("color-text-secondary") ?? primary
            let plainGrounds = grounds.plain + [grounds.muted]
            var stronger = AXContrast.reaching(disabled, toward: secondary, ratio: textRatio, on: plainGrounds)
            if AXContrast.lowest(stronger, on: plainGrounds) < textRatio {
                stronger = AXContrast.reaching(disabled, toward: primary, ratio: textRatio, on: plainGrounds)
            }
            set("color-text-disabled", stronger)
        }
        // Outlines of fields, checkboxes and chips.
        if let border = color("color-border-emphasized") {
            let ratio = increased ? AXContrast.text : AXContrast.control
            set("color-border-emphasized", AXContrast.reaching(border, toward: primary, ratio: ratio, on: grounds.plain + [grounds.muted]))
        }
        if increased {
            if let hairline = color("color-border") {
                set("color-border", AXContrast.reaching(hairline.over(grounds.card), toward: primary, ratio: AXContrast.control, on: grounds.plain))
            }
            if let track = color("color-track") {
                set("color-track", AXContrast.reaching(track, toward: primary, ratio: AXContrast.control, on: grounds.plain))
            }
        }
        // Tinted badges and counts.
        for (textKey, groundKey) in toneText {
            guard let text = color(textKey), let tint = color(groundKey) else { continue }
            let onGrounds = grounds.plain.map { tint.over($0) }
            set(textKey, AXContrast.reaching(text, toward: primary, ratio: textRatio, on: onGrounds))
        }
        // Text on solid fills.
        for (onKey, solidKeys) in onSolid {
            guard let declared = color(onKey) else { continue }
            let solids = solidKeys.compactMap(color)
            guard !solids.isEmpty else { continue }
            if AXContrast.lowest(declared, on: solids) >= AXContrast.text { continue }
            set(onKey, AXContrast.bestInk([.white, .ink], on: solids))
        }
        return ResolvedMode(colors: colors, sizes: mode.sizes)
    }
}
