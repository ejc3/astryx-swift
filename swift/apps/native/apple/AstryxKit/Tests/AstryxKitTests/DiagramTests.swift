import ImageIO
import SwiftUI
import UniformTypeIdentifiers
import XCTest
@testable import AstryxKit

/// "How it works" and "How this was built": the diagram and timeline decode, the Swift port of the
/// core's routing gives the core's routes, and both screens draw (pictures kept with `$AX_SHOTS`).
@MainActor
final class DiagramTests: XCTestCase {
    private var directory: URL? {
        guard let path = ProcessInfo.processInfo.environment["AX_SHOTS"], !path.isEmpty else { return nil }
        return URL(fileURLWithPath: path, isDirectory: true)
    }

    private func diagram(_ name: String) throws -> DiagramNode {
        guard case .diagram(let d) = try Library.app(name).screen.body else { throw XCTSkip("\(name) is not a diagram") }
        return d
    }

    func testTheDiagramDecodesWithEveryBoxAndEdge() throws {
        let d = try diagram("app-architecture")
        XCTAssertEqual(d.boxes.count, 22)
        XCTAssertEqual(d.edges.count, 31)
        XCTAssertEqual(d.edges.filter(\.toGroup).map(\.id), ["hermes-core", "components-drawings"])
        XCTAssertEqual(d.boxes.filter(\.shared).map(\.id), ["templates", "view", "tokens", "saved", "zero"])
        XCTAssertNil(d.panel)
        let ids = Set(d.boxes.map(\.id))
        let groupIds = Set(d.groups.map(\.id))
        for e in d.edges { XCTAssertTrue(ids.contains(e.from) && (e.toGroup ? groupIds.contains(e.to) : ids.contains(e.to)), e.id) }
        XCTAssertTrue(d.boxes.allSatisfy { $0.state == .normal })
    }

    func testASelectionDecodesWithItsPanel() throws {
        let d = try diagram("app-architecture-selected")
        XCTAssertEqual(d.selected, "axclient")
        let panel = try XCTUnwrap(d.panel)
        XCTAssertEqual(panel.title, "AXClient")
        XCTAssertFalse(panel.links.isEmpty)
        XCTAssertEqual(d.boxes.first { $0.id == "axclient" }?.state, .selected)
        XCTAssertTrue(d.edges.contains { $0.state == .dimmed })
    }

    func testTheTimelineDecodes() throws {
        let app = try Library.app("app-story")
        let timelines = Library.walk(app.screen.body).compactMap { node -> TimelineNode? in
            if case .timeline(let t) = node { return t }
            return nil
        }
        XCTAssertEqual(timelines.count, 2)
        let birth = try XCTUnwrap(timelines[0].entries.first { $0.emphasized })
        XCTAssertEqual(birth.when, "Oct 17, 9:52 am PT")
        XCTAssertNotNil(birth.quote)
    }

    /// The ports of `routeEdge` and `placeLabels` against what core/scripts/fixtures.ts computed with the core's.
    func testRoutingAndLabelsMatchTheCore() throws {
        struct Case: Decodable {
            struct Frame: Decodable { let x: Double; let y: Double; let width: Double; let height: Double }
            struct P: Decodable { let x: Double; let y: Double }
            struct Label: Decodable { let id: String; let width: Double; let height: Double }
            struct Placed: Decodable { let id: String; let x: Double; let y: Double; let fits: Bool }
            let layout: String
            let selected: String?
            let grid: Frame
            let frames: [String: Frame]
            let groupFrames: [String: Frame]
            let routes: [String: [P]]
            let labels: [Label]
            let bounds: Frame
            let placed: [Placed]
        }
        let cases = try JSONDecoder().decode([Case].self, from: Library.data("diagram-routes"))
        XCTAssertEqual(cases.count, 6)
        var checked = 0
        for c in cases {
            let d = try diagram(c.selected == nil ? "app-architecture" : "app-architecture-selected")
            let layout = DiagramNode.Layout(rawValue: c.layout)!
            let rect = { (f: Case.Frame) in CGRect(x: f.x, y: f.y, width: f.width, height: f.height) }
            var routes: [(id: String, points: [CGPoint])] = []
            for edge in d.edges where edge.isDrawn(layout) {
                let target = edge.toGroup ? c.groupFrames[edge.to]! : c.frames[edge.to]!
                let ours = DiagramRouting.route(from: rect(c.frames[edge.from]!), to: rect(target), edge.route(layout), grid: rect(c.grid))
                let theirs = try XCTUnwrap(c.routes[edge.id], "\(c.layout) \(edge.id)")
                XCTAssertEqual(ours.count, theirs.count, "\(c.layout) \(edge.id)")
                for (p, q) in zip(ours, theirs) {
                    XCTAssertEqual(p.x, q.x, accuracy: 0.001, "\(c.layout) \(edge.id)")
                    XCTAssertEqual(p.y, q.y, accuracy: 0.001, "\(c.layout) \(edge.id)")
                }
                routes.append((edge.id, ours))
                checked += 1
            }
            let placed = DiagramRouting.placeLabels(
                routes: routes,
                labels: c.labels.map { (id: $0.id, size: CGSize(width: $0.width, height: $0.height)) },
                boxes: c.frames.values.map(rect),
                bounds: rect(c.bounds)
            )
            XCTAssertEqual(placed.count, c.placed.count, c.layout)
            for (p, q) in zip(placed, c.placed) {
                XCTAssertEqual(p.id, q.id)
                XCTAssertEqual(p.fits, q.fits, "\(c.layout) \(p.id)")
                XCTAssertEqual(p.center.x, q.x, accuracy: 0.001, "\(c.layout) \(p.id)")
                XCTAssertEqual(p.center.y, q.y, accuracy: 0.001, "\(c.layout) \(p.id)")
            }
        }
        XCTAssertGreaterThan(checked, 60)
    }

    func testEveryBoxIsAnAccessibleElementInFlowOrder() throws {
        let d = try diagram("app-architecture")
        for b in d.boxes {
            XCTAssertTrue(b.accessibilityLabel.hasPrefix(b.title), b.id)
            XCTAssertTrue(b.selectId.hasSuffix(":\(b.id)"), b.id)
        }
        XCTAssertEqual(d.boxes.first?.id, "cli")
    }

    // MARK: Pictures

    private func png<V: View>(_ view: V, width: CGFloat) throws -> Data {
        let renderer = ImageRenderer(content: view)
        renderer.scale = 2
        renderer.proposedSize = ProposedViewSize(width: width, height: nil)
        var image = try XCTUnwrap(renderer.cgImage)
        // A page taller than ImageIO writes at 2x (a long screen at phone width) is kept at 1x.
        if image.height > 16_000 {
            renderer.scale = 1
            image = try XCTUnwrap(renderer.cgImage)
        }
        let data = NSMutableData()
        let destination = try XCTUnwrap(CGImageDestinationCreateWithData(data, UTType.png.identifier as CFString, 1, nil))
        CGImageDestinationAddImage(destination, image, nil)
        XCTAssertTrue(CGImageDestinationFinalize(destination))
        return data as Data
    }

    private func page(_ app: AppSnapshot, _ scheme: ColorScheme, width: CGFloat, typeSize: DynamicTypeSize = .large) throws -> some View {
        ScreenView(app: app, inlineToolbar: true, scrolls: false, fixedWidth: width, largeTitle: false)
            .frame(width: width)
            .fixedSize(horizontal: false, vertical: true)
            .environment(\.dynamicTypeSize, typeSize)
            .axTheme(try Library.theme("theme-astryx"), scheme: scheme, typeSize: typeSize)
            .environment(\.colorScheme, scheme)
            .environment(\.axStatic, true)
    }

    /// The Mac's default window (1500 by 920): a 240 sidebar, the 1000 detail column with the page's
    /// 24 gutter, and the 260 inspector, empty or with the selected box. The page must fit the
    /// content height (920 less the 52 toolbar) with the whole diagram, sync band included.
    func testTheDiagramFitsTheMacDefaultWindowBesideTheInspector() throws {
        let only = ProcessInfo.processInfo.environment["AX_ONLY"] ?? ""
        for name in ["architecture", "architecture-selected"] {
            let app = try Library.app("app-\(name)")
            guard case .diagram(let d) = app.screen.body else { return XCTFail() }
            for (label, scheme) in [("light", ColorScheme.light), ("dark", .dark)] {
                let shot = "\(name).macwindow.\(label)"
                guard only.isEmpty || shot.contains(only) else { continue }
                let theme = try Library.theme("theme-astryx")
                let page = ScreenView(app: app, inlineToolbar: true, scrolls: false, fixedWidth: 1000, largeTitle: false)
                    .frame(width: 1000)
                    .fixedSize(horizontal: false, vertical: true)
                    .environment(\.axPanelElsewhere, true)
                let inspector = Group {
                    if let panel = d.panel { AXDiagramPanel(panel: panel, showsClose: false) } else { DiagramEmpty(node: d) }
                }
                .padding(20)
                .frame(width: 260, alignment: .topLeading)
                .frame(maxHeight: .infinity, alignment: .top)
                .background(Color(white: scheme == .dark ? 0.12 : 0.97))
                let window = HStack(alignment: .top, spacing: 0) {
                    StaticSidebar(app: app).frame(width: 240)
                    page
                    Rectangle().fill(Color.gray.opacity(0.3)).frame(width: 1)
                    inspector
                }
                .axTheme(theme, scheme: scheme, typeSize: .large)
                .environment(\.colorScheme, scheme)
                .environment(\.axStatic, true)
                // The page height as drawn (the header the toolbar would hold is drawn inline here: about 60).
                let pageHeight = try XCTUnwrap(ImageRenderer(content: page.axTheme(theme, scheme: scheme, typeSize: .large).environment(\.axStatic, true)).cgImage).height
                XCTAssertLessThanOrEqual(CGFloat(pageHeight) - 60, 868, "\(shot): the page is \(pageHeight) tall")
                let data = try png(window.frame(height: 868 + 60, alignment: .top).clipped(), width: 1501)
                if let directory {
                    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
                    try data.write(to: directory.appendingPathComponent("\(shot).png"))
                }
            }
        }
    }

    /// The Mac's detail column at the default window (1500 wide, a 240 sidebar) and an iPhone's
    /// width, light and dark, with and without a selection.
    func testDrawsBothScreensAtMacAndPhoneWidths() throws {
        let only = ProcessInfo.processInfo.environment["AX_ONLY"] ?? ""
        // The single column at an accessibility text size, on a phone.
        for name in ["architecture", "architecture-selected"] where only.isEmpty || name.contains(only) {
            let data = try png(try page(try Library.app("app-\(name)"), .light, width: 393, typeSize: .accessibility3), width: 393)
            XCTAssertGreaterThan(data.count, 20_000)
            if let directory {
                try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
                try data.write(to: directory.appendingPathComponent("\(name).phone.ax3.png"))
            }
        }
        for name in ["architecture", "architecture-selected", "story"] {
            let app = try Library.app("app-\(name)")
            for (size, width) in [("mac", CGFloat(1260)), ("phone", 393)] {
                for (label, scheme) in [("light", ColorScheme.light), ("dark", .dark)] {
                    let shot = "\(name).\(size).\(label)"
                    guard only.isEmpty || shot.contains(only) else { continue }
                    let data = try png(try page(app, scheme, width: width), width: width)
                    XCTAssertGreaterThan(data.count, 20_000, shot)
                    if let directory {
                        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
                        try data.write(to: directory.appendingPathComponent("\(shot).png"))
                    }
                }
            }
        }
    }
}
