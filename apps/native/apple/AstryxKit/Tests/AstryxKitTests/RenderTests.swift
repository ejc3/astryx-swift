import ImageIO
import SwiftUI
import UniformTypeIdentifiers
import XCTest
@testable import AstryxKit

/// Draws every app fixture to a PNG with `ImageRenderer`, with no window. ImageRenderer draws a
/// TextField, Toggle, Picker, Slider, ScrollView or List as an empty box, so the screens are
/// drawn with `axStatic`, which swaps those for plain stand-ins; the native controls
/// themselves are judged by the iOS Simulator build.
@MainActor
final class RenderTests: XCTestCase {
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

    /// The screen alone, at phone width and as tall as it is.
    private func phone(_ app: AppSnapshot, _ theme: ResolvedTheme, _ scheme: ColorScheme) -> some View {
        ScreenView(app: app, inlineToolbar: true, scrolls: false, fixedWidth: 393)
            .frame(width: 393)
            .fixedSize(horizontal: false, vertical: true)
            .axTheme(theme, scheme: scheme, typeSize: .large)
            .environment(\.colorScheme, scheme)
            .environment(\.axStatic, true)
    }

    /// Sidebar and screen in a 1280 by 800 window.
    private func mac(_ app: AppSnapshot, _ theme: ResolvedTheme, _ scheme: ColorScheme) -> some View {
        HStack(spacing: 0) {
            StaticSidebar(app: app).frame(width: 240, height: 800)
            Rectangle().fill(Color.gray.opacity(0.25)).frame(width: 1)
            ScreenView(app: app, inlineToolbar: true, scrolls: false, fixedWidth: 1039)
                .frame(width: 1039, height: 800, alignment: .top)
                .clipped()
        }
        .frame(width: 1280, height: 800)
        .clipped()
        .axTheme(theme, scheme: scheme, typeSize: .large)
        .environment(\.colorScheme, scheme)
        .environment(\.axStatic, true)
    }

    /// The side-by-side layouts, with colored placeholders for the host's web views.
    private func surfaces(_ app: AppSnapshot, _ theme: ResolvedTheme, mode: SurfaceMode, width: CGFloat, height: CGFloat) -> some View {
        VStack(spacing: 0) {
            HStack {
                Spacer()
                SurfacePicker(surface: app.surface!, width: width)
            }
            .padding(8)
            .background(Color.gray.opacity(0.15))
            SurfaceLayout(
                app: app,
                mode: mode,
                web: AnyView(Color.blue.opacity(0.18).overlay(Text("web view").foregroundStyle(.secondary))),
                stock: AnyView(Color.orange.opacity(0.18).overlay(Text("stock view").foregroundStyle(.secondary)))
            )
        }
        .frame(width: width, height: height)
        .clipped()
        .axTheme(theme, scheme: .light, typeSize: .large)
        .environment(\.colorScheme, .light)
        .environment(\.axStatic, true)
    }

    func testRendersEveryFixture() throws {
        guard let directory else { throw XCTSkip("AX_SHOTS is not set") }
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        var written = 0
        func write(_ data: Data, _ name: String) throws {
            try data.write(to: directory.appendingPathComponent(name + ".png"))
            XCTAssertGreaterThan(data.count, 2_000, name)
            written += 1
        }
        let astryx = try Library.theme("theme-astryx")
        for name in try Library.names(prefix: "app-") {
            let app = try Library.app(name)
            let short = String(name.dropFirst("app-".count))
            for (label, scheme) in [("light", ColorScheme.light), ("dark", .dark)] {
                try write(try png(phone(app, astryx, scheme), width: 393, height: nil), "\(short).astryx.phone.\(label)")
                try write(try png(mac(app, astryx, scheme), width: 1280, height: 800), "\(short).astryx.mac.\(label)")
            }
        }
        for themeName in ["ocean", "grape"] {
            let theme = try Library.theme("theme-\(themeName)")
            for screen in ["dashboard", "settings"] {
                let app = try Library.app("app-\(screen)")
                for (label, scheme) in [("light", ColorScheme.light), ("dark", .dark)] {
                    try write(try png(phone(app, theme, scheme), width: 393, height: nil), "\(screen).\(themeName).phone.\(label)")
                    try write(try png(mac(app, theme, scheme), width: 1280, height: 800), "\(screen).\(themeName).mac.\(label)")
                }
            }
        }
        for (mode, width, height) in [("compare", 1600.0, 900.0), ("all", 2000.0, 900.0)] {
            let app = try Library.app("app-dashboard", surface: mode)
            let image = try png(surfaces(app, astryx, mode: SurfaceMode(mode), width: width, height: height), width: width, height: height)
            try write(image, "dashboard.astryx.\(mode)")
        }
        XCTAssertEqual(written, 14 * 4 + 2 * 2 * 4 + 2)
    }
}
