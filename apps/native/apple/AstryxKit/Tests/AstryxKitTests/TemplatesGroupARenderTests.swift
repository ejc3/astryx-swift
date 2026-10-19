import ImageIO
import SwiftUI
import UniformTypeIdentifiers
import XCTest
@testable import AstryxKit

/// The showcase, dashboard, inbox and kanban templates drawn at the Mac pane's width (740 points)
/// with `ImageRenderer`, as the template alone: it owns its own padding, so nothing but the page's
/// ground is put around it. Pictures go to AX_SHOTS (as `groupA-<template>.<mode>.png`).
@MainActor
final class TemplatesGroupARenderTests: XCTestCase {
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

    private func page(_ name: String, width: CGFloat, theme: ResolvedTheme, scheme: ColorScheme) throws -> some View {
        let app = try Library.app(name)
        return ZStack(alignment: .top) {
            Color.white
            NodeView(node: app.screen.body)
                .environment(\.axWidth, width)
                .frame(width: width)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(width: width)
        .fixedSize(horizontal: false, vertical: true)
        .axTheme(theme, scheme: scheme, typeSize: .large)
        .environment(\.colorScheme, scheme)
        .environment(\.axStatic, true)
    }

    func testRendersTheGroupAtThePaneWidth() throws {
        guard let directory else { throw XCTSkip("AX_SHOTS is not set") }
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let astryx = try Library.theme("theme-astryx")
        let only = ProcessInfo.processInfo.environment["AX_ONLY"] ?? ""
        for id in ["showcase", "dashboard", "inbox", "kanban"] {
            for (label, scheme) in [("light", ColorScheme.light), ("dark", .dark)] {
                for width in [740.0, 393.0] {
                    let name = "groupA-\(id).\(Int(width)).\(label)"
                    guard only.isEmpty || name.contains(only) else { continue }
                    let data = try png(try page("template-\(id)", width: width, theme: astryx, scheme: scheme), width: width)
                    try data.write(to: directory.appendingPathComponent(name + ".png"))
                    XCTAssertGreaterThan(data.count, 2_000, name)
                }
            }
        }
    }
}
