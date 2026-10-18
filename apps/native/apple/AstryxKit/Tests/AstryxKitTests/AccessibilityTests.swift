import ImageIO
import SwiftUI
import UniformTypeIdentifiers
import XCTest
@testable import AstryxKit

/// The accessibility floors of the native drawing: the contrast its tokens reach (computed from the
/// theme fixtures, for every theme, light and dark), the words the three templates take from the
/// core, and the layouts that must hold at the largest text.
@MainActor
final class AccessibilityTests: XCTestCase {
    private let themes = ["astryx", "ember", "grape", "ocean"]

    private func modes(_ name: String) throws -> [(label: String, mode: ResolvedMode)] {
        let theme = try Library.theme("theme-\(name)")
        return [("light", theme.light), ("dark", theme.dark)]
    }

    private func color(_ mode: ResolvedMode, _ key: String, file: StaticString = #filePath, line: UInt = #line) throws -> AXRGBA {
        let hex = try XCTUnwrap(mode.colors[key], key, file: file, line: line)
        return try XCTUnwrap(AXRGBA(hex: hex), key, file: file, line: line)
    }

    // MARK: Contrast

    func testTheMathMatchesWCAG() throws {
        let black = try XCTUnwrap(AXRGBA(hex: "#000000"))
        let white = try XCTUnwrap(AXRGBA(hex: "#FFFFFF"))
        XCTAssertEqual(black.contrast(on: white), 21, accuracy: 0.001)
        XCTAssertEqual(white.contrast(on: white), 1, accuracy: 0.001)
        // #767676 on white is the classic 4.54:1.
        XCTAssertEqual(try XCTUnwrap(AXRGBA(hex: "#767676")).contrast(on: white), 4.54, accuracy: 0.01)
        // A tint is composited over its ground before it is measured.
        let half = try XCTUnwrap(AXRGBA(hex: "#00000080"))
        XCTAssertEqual(half.contrast(on: white), AXRGBA(r: 127.0 / 255, g: 127.0 / 255, b: 127.0 / 255).contrast(on: white), accuracy: 0.05)
        XCTAssertEqual(AXRGBA(hex: "#0A1317FF")?.hex, "#0A1317FF")
    }

    func testReachingMovesAColorOnlyAsFarAsItMust() throws {
        let white = AXRGBA.white
        let gray = try XCTUnwrap(AXRGBA(hex: "#A4B0BC"))
        let black = try XCTUnwrap(AXRGBA(hex: "#0A1317"))
        XCTAssertLessThan(gray.contrast(on: white), 3)
        let fixed = AXContrast.reaching(gray, toward: black, ratio: 4.5, on: [white])
        XCTAssertGreaterThanOrEqual(fixed.contrast(on: white), 4.5)
        // Not darker than it has to be: a step back toward the original falls under.
        XCTAssertLessThan(fixed.mixed(toward: gray, 0.1).contrast(on: white), 4.5)
        // A color that already passes is returned as it is.
        XCTAssertEqual(AXContrast.reaching(black, toward: black, ratio: 4.5, on: [white]), black)
    }

    func testPlaceholdersAndSecondaryTextReach45OnEveryGround() throws {
        for name in themes {
            for (label, raw) in try modes(name) {
                let mode = AXPalette.strengthened(raw)
                let grounds = try XCTUnwrap(AXPalette.grounds(mode.colors))
                let context = "\(name) \(label)"
                XCTAssertGreaterThanOrEqual(AXContrast.lowest(try color(mode, "color-text-secondary"), on: grounds.all), 4.5, "secondary text, \(context)")
                XCTAssertGreaterThanOrEqual(AXContrast.lowest(try color(mode, "color-text-disabled"), on: grounds.plain + [grounds.muted]), 4.5, "placeholder, \(context)")
                XCTAssertGreaterThanOrEqual(AXContrast.lowest(try color(mode, "color-text-primary"), on: grounds.all), 4.5, "primary text, \(context)")
            }
        }
    }

    func testFieldBordersReach3OnEveryGround() throws {
        for name in themes {
            for (label, raw) in try modes(name) {
                let mode = AXPalette.strengthened(raw)
                let grounds = try XCTUnwrap(AXPalette.grounds(mode.colors))
                XCTAssertGreaterThanOrEqual(AXContrast.lowest(try color(mode, "color-border-emphasized"), on: grounds.plain + [grounds.muted]), 3, "\(name) \(label)")
            }
        }
    }

    func testTextOnFillsReaches45() throws {
        for name in themes {
            for (label, raw) in try modes(name) {
                let mode = AXPalette.strengthened(raw)
                for (on, solids) in AXPalette.onSolid {
                    let ink = try color(mode, on)
                    for solid in solids {
                        XCTAssertGreaterThanOrEqual(ink.contrast(on: try color(mode, solid)), 4.5, "\(on) on \(solid), \(name) \(label)")
                    }
                }
            }
        }
    }

    func testTintedBadgesReach45OnPageSurfaceAndCard() throws {
        for name in themes {
            for (label, raw) in try modes(name) {
                let mode = AXPalette.strengthened(raw)
                let grounds = try XCTUnwrap(AXPalette.grounds(mode.colors))
                for (textKey, groundKey) in AXPalette.toneText where mode.colors[textKey] != nil && mode.colors[groundKey] != nil {
                    let tint = try color(mode, groundKey)
                    let text = try color(mode, textKey)
                    for ground in grounds.plain {
                        XCTAssertGreaterThanOrEqual(text.contrast(on: tint.over(ground)), 4.5, "\(textKey), \(name) \(label)")
                    }
                }
            }
        }
    }

    func testIncreaseContrastIsStrongerStill() throws {
        for name in themes {
            for (label, raw) in try modes(name) {
                let mode = AXPalette.strengthened(raw, increased: true)
                let grounds = try XCTUnwrap(AXPalette.grounds(mode.colors))
                let context = "\(name) \(label)"
                XCTAssertGreaterThanOrEqual(AXContrast.lowest(try color(mode, "color-text-secondary"), on: grounds.all), 7, "secondary, \(context)")
                XCTAssertGreaterThanOrEqual(AXContrast.lowest(try color(mode, "color-text-disabled"), on: grounds.plain + [grounds.muted]), 7, "placeholder, \(context)")
                XCTAssertGreaterThanOrEqual(AXContrast.lowest(try color(mode, "color-border-emphasized"), on: grounds.plain + [grounds.muted]), 4.5, "field border, \(context)")
                XCTAssertGreaterThanOrEqual(AXContrast.lowest(try color(mode, "color-border"), on: grounds.plain), 3, "hairline, \(context)")
                XCTAssertGreaterThanOrEqual(AXContrast.lowest(try color(mode, "color-track"), on: grounds.plain), 3, "track, \(context)")
            }
        }
    }

    func testTheThemeItselfIsNotTouched() throws {
        // The stronger tokens are a copy the native drawing paints with; the core's tokens (and the
        // web, which matches stock Astryx) keep the theme's own values.
        let theme = try Library.theme("theme-astryx")
        let raw = try color(theme.dark, "color-on-accent")
        XCTAssertEqual(raw.hex, "#FFFFFFFF")
        let strong = AXPalette.strengthened(theme.dark)
        XCTAssertNotEqual(try color(strong, "color-on-accent").hex, "#FFFFFFFF")
        XCTAssertEqual(try color(theme.dark, "color-on-accent").hex, "#FFFFFFFF")
        // Tokens that already pass are left alone.
        for key in ["color-text-primary", "color-accent", "color-background-card", "color-success"] {
            XCTAssertEqual(try color(strong, key).hex, try color(theme.dark, key).hex, key)
        }
        // And the style the views read is built from the stronger copy.
        let style = AXStyle(mode: theme.dark, isDark: true, scale: 1)
        XCTAssertEqual(style.mode.colors["color-on-accent"], strong.colors["color-on-accent"])
    }

    // MARK: Words from the core

    private func view(_ id: String) throws -> JSONValue {
        let app = try Library.app("template-\(id)")
        guard case .template(let template) = app.screen.body else { throw XCTSkip("no template node") }
        return template.view
    }

    func testChatSpeaksTheCoresWords() throws {
        let model = try view("chat").decode(TChatModel.self)
        XCTAssertEqual(model.words.mention, "Mention")
        XCTAssertEqual(model.words.send, "Send")
        XCTAssertEqual(model.words.you, "You")
        XCTAssertEqual(model.words.word(.running), "Running")
        XCTAssertEqual(model.words.word(.error), "Failed")
        XCTAssertEqual(model.inert, ["mention", "attach", "versions"])
        for word in [model.words.attach, model.words.copy, model.words.share, model.words.closeDocument, model.words.documentActions,
                     model.words.versions, model.words.expanded, model.words.collapsed, model.words.showCalls, model.words.added, model.words.removed] {
            XCTAssertFalse(word.isEmpty)
        }
    }

    func testCalendarSpeaksTheCoresWords() throws {
        let model = try view("calendar").decode(TCalModel.self)
        XCTAssertEqual(model.words.today, "Today")
        XCTAssertEqual(model.words.selected, "Selected")
        XCTAssertEqual(model.words.previousMonth, "Previous month")
        XCTAssertEqual(model.words.nextMonth, "Next month")
    }

    func testShowcaseListsItsInertControls() throws {
        struct Inert: Decodable { let inert: [String] }
        let inert = try view("showcase").decode(Inert.self).inert
        XCTAssertEqual(Set(inert), ["navItems", "navActions", "signIn", "addToCart", "pay", "suggestions", "chatActions", "chatLink", "attach", "voice", "seeAll", "addItem", "rowMenu"])
    }

    func testAModelWithoutTheNewFieldsStillDecodes() throws {
        // An older core sends no words: they are empty, never English invented by the host.
        let json = #"{"value":"2026-04-15","focusDate":"2026-04-15"}"#
        let model = try JSONDecoder().decode(TCalModel.self, from: Data(json.utf8))
        XCTAssertEqual(model.words.today, "")
    }

    // MARK: Pictures

    private var directory: URL? {
        guard let path = ProcessInfo.processInfo.environment["AX_SHOTS"], !path.isEmpty else { return nil }
        return URL(fileURLWithPath: path, isDirectory: true)
    }

    private func png<V: View>(_ view: V, width: CGFloat, height: CGFloat?) throws -> Data {
        let renderer = ImageRenderer(content: view)
        renderer.scale = 2
        renderer.proposedSize = ProposedViewSize(width: width, height: height)
        let image = try XCTUnwrap(renderer.cgImage)
        let data = NSMutableData()
        let destination = try XCTUnwrap(CGImageDestinationCreateWithData(data, UTType.png.identifier as CFString, 1, nil))
        CGImageDestinationAddImage(destination, image, nil)
        XCTAssertTrue(CGImageDestinationFinalize(destination))
        return data as Data
    }

    /// The top `height` points of the screen at phone width: a long screen at the largest text is
    /// taller than an image can be, and what matters is how it begins.
    private func phone(_ id: String, _ theme: ResolvedTheme, _ scheme: ColorScheme, _ typeSize: DynamicTypeSize, width: CGFloat = 393, height: CGFloat = 3000) throws -> some View {
        let app = try Library.app("template-\(id)")
        return ScreenView(app: app, inlineToolbar: true, scrolls: false, fixedWidth: width)
            .frame(width: width)
            .fixedSize(horizontal: false, vertical: true)
            .frame(width: width, height: height, alignment: .top)
            .clipped()
            .axTheme(theme, scheme: scheme, typeSize: typeSize)
            .environment(\.colorScheme, scheme)
            .environment(\.dynamicTypeSize, typeSize)
            .environment(\.axStatic, true)
    }

    /// Every one of the three templates drawn at the largest sizes must lay out and draw. With
    /// `$AX_SHOTS` the pictures are kept to be looked at.
    func testTheThreeTemplatesDrawAtAccessibilitySizes() throws {
        let theme = try Library.theme("theme-astryx")
        let sizes: [(String, DynamicTypeSize)] = [("large", .large), ("xxxl", .xxxLarge), ("ax1", .accessibility1), ("ax3", .accessibility3), ("ax5", .accessibility5)]
        // AX_ONLY narrows a run to the pictures whose name contains it, for quick iteration.
        let only = ProcessInfo.processInfo.environment["AX_ONLY"] ?? ""
        for id in ["chat", "calendar", "showcase"] {
            for (label, size) in sizes {
                for (schemeLabel, scheme) in [("light", ColorScheme.light), ("dark", .dark)] {
                    guard only.isEmpty || "\(id).\(label).\(schemeLabel)".contains(only) else { continue }
                    let data = try png(try phone(id, theme, scheme, size), width: 393, height: 3000)
                    XCTAssertGreaterThan(data.count, 2_000, "\(id) \(label) \(schemeLabel)")
                    if let directory {
                        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
                        try data.write(to: directory.appendingPathComponent("a11y-\(id).\(label).\(schemeLabel).png"))
                    }
                }
            }
        }
    }

    func testTheCalendarGridGivesWayToTheAgendaOnASmallScreen() throws {
        // On a 320 pt screen a day cell would be under 44 pt wide, so the month is a list. It must draw.
        let theme = try Library.theme("theme-astryx")
        let data = try png(try phone("calendar", theme, .light, .large, width: 320, height: 1800), width: 320, height: 1800)
        XCTAssertGreaterThan(data.count, 2_000)
        if let directory {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            try data.write(to: directory.appendingPathComponent("a11y-calendar.narrow.png"))
        }
    }
}
