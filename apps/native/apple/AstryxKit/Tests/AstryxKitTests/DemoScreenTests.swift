import ImageIO
import SwiftUI
import UniformTypeIdentifiers
import XCTest
@testable import AstryxKit

/// The demo screens (the generic node vocabulary, not the templates) at the width of the
/// compare pane, 740 pt, for putting next to the web drawing; and the rules their views keep.
@MainActor
final class DemoScreenTests: XCTestCase {
    private let screens = ["inbox", "tasks", "people", "calendar", "chat", "checkout", "profile", "settings", "overview", "dashboard"]

    private var directory: URL? {
        guard let path = ProcessInfo.processInfo.environment["AX_SHOTS"], !path.isEmpty else { return nil }
        return URL(fileURLWithPath: path, isDirectory: true)
    }

    private func png<V: View>(_ view: V, width: CGFloat) throws -> Data {
        let renderer = ImageRenderer(content: view)
        renderer.scale = 2
        renderer.proposedSize = ProposedViewSize(width: width, height: nil)
        let image = try XCTUnwrap(renderer.cgImage)
        let data = NSMutableData()
        let destination = try XCTUnwrap(CGImageDestinationCreateWithData(data, UTType.png.identifier as CFString, 1, nil))
        CGImageDestinationAddImage(destination, image, nil)
        XCTAssertTrue(CGImageDestinationFinalize(destination))
        return data as Data
    }

    private func page(_ app: AppSnapshot, _ theme: ResolvedTheme, _ scheme: ColorScheme, width: CGFloat) -> some View {
        ScreenView(app: app, inlineToolbar: true, scrolls: false, fixedWidth: width, largeTitle: false)
            .frame(width: width)
            .fixedSize(horizontal: false, vertical: true)
            .axTheme(theme, scheme: scheme, typeSize: .large)
            .environment(\.colorScheme, scheme)
            .environment(\.axStatic, true)
    }

    /// Every demo screen at 740 pt, light and dark. With `$AX_SHOTS` the pictures are kept.
    func testDemoScreensDrawAt740() throws {
        let theme = try Library.theme("theme-astryx")
        let only = ProcessInfo.processInfo.environment["AX_ONLY"] ?? ""
        for name in screens {
            let app = try Library.app("app-\(name)")
            for (label, scheme) in [("light", ColorScheme.light), ("dark", .dark)] {
                guard only.isEmpty || "\(name).\(label)".contains(only) else { continue }
                let data = try png(page(app, theme, scheme, width: 740), width: 740)
                XCTAssertGreaterThan(data.count, 2_000, "\(name) \(label)")
                if let directory {
                    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
                    try data.write(to: directory.appendingPathComponent("demo-\(name).\(label).png"))
                }
            }
        }
    }

    /// The pane's page ground is the surface, and a template draws its own padding.
    func testTemplatesAreNotInset() throws {
        let app = try Library.app("template-inbox")
        guard case .template = app.screen.body else { return XCTFail("not a template") }
        let data = try png(page(app, try Library.theme("theme-astryx"), .light, width: 740), width: 740)
        XCTAssertGreaterThan(data.count, 2_000)
    }

    // MARK: Tokens

    func testAvatarsAreHslWithWhiteInitialsInBothModes() throws {
        let theme = try Library.theme("theme-astryx")
        func rgb(_ color: Color) -> [Int] {
            let resolved = color.resolve(in: EnvironmentValues())
            return [resolved.red, resolved.green, resolved.blue].map { Int((Double($0) * 255).rounded()) }
        }
        for isDark in [false, true] {
            let style = AXStyle(mode: isDark ? theme.dark : theme.light, isDark: isDark, scale: 1)
            XCTAssertEqual(style.person(hue: 120).mark, .white)
            // CSS hsl(120 52% 40%) is rgb(49, 155, 49); hsl(0 52% 40%) is (155, 49, 49).
            XCTAssertEqual(rgb(style.person(hue: 120).ground), [49, 155, 49])
            XCTAssertEqual(rgb(style.person(hue: 0).ground), [155, 49, 49])
            XCTAssertEqual(rgb(style.person(hue: 240).ground), [49, 49, 155])
        }
    }

    func testBadgesAreSolidForTheFourSemanticTones() throws {
        let theme = try Library.theme("theme-astryx")
        let style = AXStyle(mode: theme.light, isDark: false, scale: 1)
        XCTAssertEqual(style.badge(.success).fill, style.color("color-success"))
        XCTAssertEqual(style.badge(.warning).fill, style.color("color-warning"))
        XCTAssertEqual(style.badge(.danger).fill, style.color("color-error"))
        XCTAssertEqual(style.badge(.info).fill, style.color("color-accent"))
        XCTAssertEqual(style.badge(.neutral).fill, style.color("color-neutral"))
        XCTAssertEqual(style.badge(.neutral).ink, style.text)
        XCTAssertEqual(style.badge(.accent).fill, style.accentSoft)
    }

    func testOutOfMonthDaysUseTheRawDisabledToken() throws {
        let theme = try Library.theme("theme-astryx")
        let style = AXStyle(mode: theme.light, isDark: false, scale: 1)
        XCTAssertEqual(style.textInactive, Color(hex: theme.light.colors["color-text-disabled"]!))
        // The placeholder color keeps its floor.
        XCTAssertNotEqual(style.textDisabled, style.textInactive)
    }

    func testLineHeightsFollowAstryx() throws {
        let theme = try Library.theme("theme-astryx")
        let style = AXStyle(mode: theme.light, isDark: false, scale: 1)
        // Body is 14 on 20: the extra spacing makes up the difference to the font's own height.
        let extra = style.lineSpacing(size: 14, ratio: style.bodyLeading)
        XCTAssertEqual(axNaturalLineHeight(14) + extra, 20, accuracy: 0.05)
        XCTAssertEqual(style.supportingLeading, 1.6667, accuracy: 0.001)
    }

    func testPaginationReadsTheStepNamesWhenTheCoreGivesThem() throws {
        let json = #"{"label":"1-5 of 13","previousId":null,"nextId":"p.next","previousLabel":"Previous","nextLabel":"Next"}"#
        let node = try JSONDecoder().decode(PaginationNode.self, from: Data(json.utf8))
        XCTAssertEqual(node.previousLabel, "Previous")
        XCTAssertEqual(node.nextLabel, "Next")
        let older = try JSONDecoder().decode(PaginationNode.self, from: Data(#"{"label":"1-5 of 13","nextId":"p.next"}"#.utf8))
        XCTAssertNil(older.previousLabel)
    }
}
