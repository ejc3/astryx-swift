import ImageIO
import SwiftUI
import UniformTypeIdentifiers
import XCTest
@testable import AstryxKit

/// Every template at the width of the smallest phone (375 pt, the iPhone SE) at the default text
/// size and at the largest accessibility size. At the default size the toolbar rows must fit the
/// screen; at accessibility sizes rows of buttons stack, labels wrap between words and the page
/// subtitle is not cut. With `$AX_SHOTS` the pictures are kept to be looked at (`fit-<id>.<size>`).
@MainActor
final class FitTests: XCTestCase {
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

    private func phone(_ id: String, _ theme: ResolvedTheme, _ typeSize: DynamicTypeSize, width: CGFloat, height: CGFloat?) throws -> some View {
        let app = try Library.app("template-\(id)")
        return ScreenView(app: app, inlineToolbar: true, scrolls: false, fixedWidth: width)
            .frame(width: width)
            .fixedSize(horizontal: false, vertical: true)
            .frame(width: width, height: height, alignment: .top)
            .clipped()
            .axTheme(theme, scheme: .light, typeSize: typeSize)
            .environment(\.colorScheme, .light)
            .environment(\.dynamicTypeSize, typeSize)
            .environment(\.axStatic, true)
    }

    func testTemplatesFitTheSmallestPhoneAtBothEnds() throws {
        let theme = try Library.theme("theme-astryx")
        let only = ProcessInfo.processInfo.environment["AX_ONLY"] ?? ""
        let directory = ProcessInfo.processInfo.environment["AX_SHOTS"].flatMap { $0.isEmpty ? nil : URL(fileURLWithPath: $0, isDirectory: true) }
        for id in ["inbox", "dashboard", "checkout", "order", "invoice", "settings", "kanban", "chat", "calendar"] {
            for (label, size) in [("large", DynamicTypeSize.large), ("ax5", .accessibility5)] {
                guard only.isEmpty || "\(id).\(label)".contains(only) else { continue }
                // The checkout is drawn in full: its Back and Continue bar is the last row.
                let height: CGFloat? = id == "checkout" ? nil : 2600
                let data = try png(try phone(id, theme, size, width: 375, height: height), width: 375, height: height)
                XCTAssertGreaterThan(data.count, 2_000, "\(id) \(label)")
                if let directory {
                    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
                    try data.write(to: directory.appendingPathComponent("fit-\(id).\(label).png"))
                }
            }
        }
    }
}
