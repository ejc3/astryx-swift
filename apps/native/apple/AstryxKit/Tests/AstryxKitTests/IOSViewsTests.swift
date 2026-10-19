import ImageIO
import SwiftUI
import UniformTypeIdentifiers
import XCTest
@testable import AstryxKit

/// The generic views as an iPhone draws them: the table's stacking width, the stepper's
/// collapse, the toolbar's words, the field text floor; and the demo screens at 390 pt for
/// putting next to the web drawing (with `$AX_SHOTS` the pictures are kept).
@MainActor
final class IOSViewsTests: XCTestCase {
    private var directory: URL? {
        guard let path = ProcessInfo.processInfo.environment["AX_SHOTS"], !path.isEmpty else { return nil }
        return URL(fileURLWithPath: path, isDirectory: true)
    }

    private func png<V: View>(_ view: V, width: CGFloat) throws -> Data {
        let renderer = ImageRenderer(content: view)
        renderer.scale = 3
        renderer.proposedSize = ProposedViewSize(width: width, height: nil)
        let image = try XCTUnwrap(renderer.cgImage)
        let data = NSMutableData()
        let destination = try XCTUnwrap(CGImageDestinationCreateWithData(data, UTType.png.identifier as CFString, 1, nil))
        CGImageDestinationAddImage(destination, image, nil)
        XCTAssertTrue(CGImageDestinationFinalize(destination))
        return data as Data
    }

    private func phone(_ app: AppSnapshot, _ theme: ResolvedTheme) -> some View {
        ScreenView(app: app, inlineToolbar: true, scrolls: false, fixedWidth: 390, largeTitle: false)
            .frame(width: 390)
            .fixedSize(horizontal: false, vertical: true)
            .axTheme(theme, scheme: .light, typeSize: .large)
            .environment(\.colorScheme, .light)
            .environment(\.axStatic, true)
    }

    func testTheTableReadsTheCoresStackingWidth() throws {
        let json = #"""
        {"stackBelow":640,"sortLabel":"Sort","empty":"None","columns":[{"id":"a","label":"A","align":"start","sort":"asc","sortId":"t.sort:a"}],
         "rows":[{"id":"r","selected":false,"cells":[{"text":"x"}]}]}
        """#
        let node = try JSONDecoder().decode(TableNode.self, from: Data(json.utf8))
        XCTAssertEqual(node.stackBelow, 640)
        XCTAssertEqual(node.sortLabel, "Sort")
        let older = try JSONDecoder().decode(TableNode.self, from: Data(#"{"empty":"None","columns":[],"rows":[]}"#.utf8))
        XCTAssertNil(older.stackBelow)
    }

    func testTheSteppersCollapsesAtAstryxsStepWidth() {
        // 358 pt over four steps is 89.5 per step, under Astryx's 112; 480 over four is 120.
        XCTAssertTrue(AXStepper.collapses(width: 358, steps: 4))
        XCTAssertFalse(AXStepper.collapses(width: 480, steps: 4))
        XCTAssertFalse(AXStepper.collapses(width: 100, steps: 0))
    }

    func testOnlyAnAddActionStaysAnIconAndLongWordsGoInTheMenu() throws {
        func button(_ label: String, _ icon: String?) throws -> ButtonNode {
            let iconJSON = icon.map { #","icon":"\#($0)""# } ?? ""
            return try JSONDecoder().decode(ButtonNode.self, from: Data(#"{"id":"b","label":"\#(label)","variant":"secondary"\#(iconJSON)}"#.utf8))
        }
        XCTAssertFalse(ToolbarButton.isLong(try button("Today", "calendar")))
        XCTAssertFalse(ToolbarButton.isLong(try button("Mark all read", "check")))
        XCTAssertTrue(ToolbarButton.isLong(try button("Fill with test data", "sparkle")))
        XCTAssertTrue(ToolbarButton.isLong(try button("Add something to the project", "plus")))
    }

    func testFieldTextFollowsAstryxsTouchFloor() throws {
        let theme = try Library.theme("theme-astryx")
        let style = AXStyle(mode: theme.light, isDark: false, scale: 1)
        #if os(iOS)
        XCTAssertEqual(style.fieldFontSize, 16)
        XCTAssertEqual(axCheckSide, 24)
        #else
        XCTAssertEqual(style.fieldFontSize, 14)
        XCTAssertEqual(axCheckSide, 18)
        #endif
        XCTAssertEqual(axFieldHeight(style), 32)
    }

    /// The five screens of group C and the five of group D at 390 pt.
    func testDemoScreensDrawAt390() throws {
        let theme = try Library.theme("theme-astryx")
        let only = ProcessInfo.processInfo.environment["AX_ONLY"] ?? ""
        for name in ["overview", "dashboard", "inbox", "tasks", "people", "calendar", "chat", "checkout", "profile", "settings"] {
            guard only.isEmpty || name.contains(only) else { continue }
            let data = try png(phone(try Library.app("app-\(name)"), theme), width: 390)
            XCTAssertGreaterThan(data.count, 2_000, name)
            if let directory {
                try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
                try data.write(to: directory.appendingPathComponent("phone-\(name).png"))
            }
        }
    }
}
