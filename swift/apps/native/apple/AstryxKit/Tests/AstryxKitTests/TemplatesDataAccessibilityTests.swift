import Accessibility
import SwiftUI
import XCTest
@testable import AstryxKit

/// The words and accessibility the four data templates (inbox, kanban, invoice, dashboard) take
/// from their core view models: every label, the controls the core cannot do, the audio graphs.
@MainActor
final class TemplatesDataAccessibilityTests: XCTestCase {
    private func view(_ id: String) throws -> JSONValue {
        let app = try Library.app("template-\(id)")
        guard case .template(let node) = app.screen.body else {
            XCTFail("template-\(id) does not hold a template node")
            return .null
        }
        return node.view
    }

    func testInboxWordsAndInertControls() throws {
        let model = try view("inbox").decode(InboxModel.self)
        XCTAssertEqual(model.text.pane.previous, "Previous")
        XCTAssertEqual(model.text.pane.expanded, "expanded")
        XCTAssertEqual(model.text.composer.discardAction, "Discard Draft")
        XCTAssertEqual(model.text.composer.remove, "Remove")
        XCTAssertEqual(model.text.selected, "selected")
        // With saving on, Archive, Move to folder, Delete and Send work (docs/SYNC.md); the rest stay inert.
        for id in ["refresh", "attach", "link", "image", "emoji"] { XCTAssertTrue(model.isInert(id), id) }
        for id in ["archive", "move", "delete", "send"] { XCTAssertFalse(model.isInert(id), id) }
        XCTAssertFalse(model.isInert("reply"))
        XCTAssertEqual([model.mode.rules.singleSurfaceBelow, model.mode.rules.stackRowsBelow, model.mode.rules.tightenColumnsBelow], [900, 560, 900])
        XCTAssertFalse(model.compose.isDirty)
    }

    func testKanbanWordsAndInertControls() throws {
        let model = try view("kanban").decode(KanbanModel.self)
        XCTAssertEqual(model.words.addTask, "Add task")
        XCTAssertEqual(model.words.movedTo, "Moved to")
        // With saving on, Add task opens the new-task sheet (docs/SYNC.md); Assign to me stays inert.
        XCTAssertFalse(model.isInert("addTask"))
        XCTAssertTrue(model.isInert("assignToMe"))
        XCTAssertEqual([model.words.newTask, model.words.create, model.words.cancel], ["New task", "Create", "Cancel"])
        XCTAssertNil(model.adding)
        XCTAssertFalse(model.isInert("sprint"))
    }

    func testKanbanCardsDragAsTheirOwnType() {
        let provider = KanbanCardDrag.provider(for: "t1")
        XCTAssertTrue(provider.hasItemConformingToTypeIdentifier(KanbanCardDrag.type.identifier))
        XCTAssertFalse(provider.hasItemConformingToTypeIdentifier("public.utf8-plain-text"))
    }

    func testInvoiceColumnsAndWordsComeFromTheModel() throws {
        let model = try view("invoice").decode(InvoiceModel.self)
        let columns = InvoiceColumn.all(model)
        XCTAssertEqual(columns.map(\.title), ["Description", "Category", "Qty", "Rate", "Amount"])
        XCTAssertEqual(columns.map(\.filter), ["description", "category", "quantity", nil, nil])
        XCTAssertEqual(columns.map(\.trailing), [false, false, true, true, true])
        XCTAssertEqual(columns.map(\.width), [nil, 150, 72, 104, 132])
        XCTAssertEqual(model.spoken(.ascending), "ascending")
        XCTAssertEqual(model.spoken(.descending), "descending")
        XCTAssertTrue(model.isInert("downloadPdf"))
        XCTAssertTrue(model.isInert("dispute"))
        XCTAssertEqual(model.words.detail.share, "Share of invoice")
    }

    func testDashboardSaysWhichWayAMetricMovedAndWhetherThatIsGood() throws {
        let model = try view("dashboard").decode(DashModel.self)
        XCTAssertEqual(model.metrics.map(\.direction), ["up", "up", "down", "down"])
        XCTAssertEqual(model.metrics.map(\.favorable), [true, true, false, true])
        XCTAssertEqual(model.metrics[3].changeSpoken, "down 8.7%, better")
        XCTAssertTrue(model.inert.contains("viewMore"))
        XCTAssertTrue(model.inert.contains("tableLink"))
    }

    func testTheLineChartHasAnAudioGraph() throws {
        let model = try view("dashboard").decode(DashModel.self)
        let descriptor = DashLineDescriptor(chart: model.activeUsers, words: model.words).makeChartDescriptor()
        XCTAssertEqual(descriptor.title, "Active users")
        XCTAssertTrue(descriptor.summary?.hasPrefix("All Users starts at 116") == true)
        XCTAssertEqual(descriptor.series.map(\.name), ["All Users", "Desktop", "Mobile"])
        XCTAssertEqual(descriptor.series[0].dataPoints.count, 96)
        XCTAssertEqual(descriptor.series[0].dataPoints[0].label, "Apr 1 14:00")
        let x = try XCTUnwrap(descriptor.xAxis as? AXNumericDataAxisDescriptor)
        XCTAssertEqual(x.title, "Time")
        XCTAssertEqual(x.valueDescriptionProvider(0), "Apr 1 14:00")
        let y = try XCTUnwrap(descriptor.yAxis)
        XCTAssertEqual(y.title, "Active users")
    }

    func testSparklinesAndBarsHaveAudioGraphs() throws {
        let model = try view("dashboard").decode(DashModel.self)
        let spark = DashSparklineDescriptor(metric: model.metrics[0], words: model.words).makeChartDescriptor()
        XCTAssertEqual(spark.title, "Monthly Visitors")
        XCTAssertEqual(spark.series[0].dataPoints.count, 30)
        XCTAssertTrue(spark.summary?.hasPrefix("Trend starts at 48") == true)
        let bar = DashBarDescriptor(card: model.demographics.cards[0], words: model.words).makeChartDescriptor()
        XCTAssertEqual(bar.title, "Region")
        XCTAssertEqual(bar.series[0].dataPoints.map(\.label), ["NORAM, 38.00%", "EMEA, 28.00%", "APAC, 22.00%", "LATAM, 8.00%", "Other, 4.00%"])
        XCTAssertTrue(bar.xAxis is AXCategoricalDataAxisDescriptor)
    }

    func testSeriesDifferByMoreThanHue() {
        // With Differentiate Without Color on, each series has a pattern of its own; otherwise every line is solid, as on the web.
        XCTAssertEqual(Set((0..<3).map { DashSeriesLook.dash($0, differentiate: true).description }).count, 3)
        XCTAssertTrue((0..<3).allSatisfy { DashSeriesLook.dash($0, differentiate: false).isEmpty })
    }

    func testTargetsAreBigEnoughForTheirPlatform() {
        #if os(iOS)
        XCTAssertEqual(InboxTarget.side, 44)
        XCTAssertEqual(InboxTarget.grow(from: 16), 14)
        #else
        XCTAssertEqual(InboxTarget.side, 28)
        XCTAssertEqual(InboxTarget.grow(from: 16), 6)
        #endif
        XCTAssertEqual(InboxTarget.grow(from: 60), 0)
    }
}

#if os(macOS)
import AppKit

/// The live screens, not the static drawing: a real window on the Mac, so a List, a Table, a
/// search field and a sheet are the system's own. Pictures go to `$AX_SHOTS`; what the table and
/// the list measured goes to `live.txt` beside them.
@MainActor
extension TemplatesDataAccessibilityTests {
    private var shots: URL? {
        guard let path = ProcessInfo.processInfo.environment["AX_SHOTS"], !path.isEmpty else { return nil }
        return URL(fileURLWithPath: path, isDirectory: true)
    }

    private func patched(_ name: String, _ patch: (inout [String: Any]) -> Void = { _ in }) throws -> JSONValue {
        var root = try XCTUnwrap(JSONSerialization.jsonObject(with: Library.data(name)) as? [String: Any])
        var screen = try XCTUnwrap(root["screen"] as? [String: Any])
        var body = try XCTUnwrap(screen["body"] as? [String: Any])
        var view = try XCTUnwrap(body["view"] as? [String: Any])
        patch(&view)
        body["view"] = view
        screen["body"] = body
        root["screen"] = screen
        let app = try JSONDecoder().decode(AppSnapshot.self, from: JSONSerialization.data(withJSONObject: root))
        guard case .template(let node) = app.screen.body else { throw XCTSkip("not a template") }
        return node.view
    }

    private func tables(in view: NSView) -> [NSTableView] {
        var found: [NSTableView] = []
        if let table = view as? NSTableView { found.append(table) }
        for sub in view.subviews { found += tables(in: sub) }
        return found
    }

    private func live<V: View>(_ content: V, width: CGFloat, height: CGFloat, name: String, scheme: ColorScheme = .light, log: inout [String]) throws {
        let theme = try Library.theme("theme-astryx")
        let root = content
            .environment(\.axWidth, width - 48)
            .padding(24)
            .frame(width: width, height: height, alignment: .top)
            .background(Color.gray.opacity(0.08))
            .axTheme(theme, scheme: scheme, typeSize: .large)
            .environment(\.colorScheme, scheme)
        let host = NSHostingView(rootView: root)
        host.frame = CGRect(x: 0, y: 0, width: width, height: height)
        let window = NSWindow(contentRect: host.frame, styleMask: [.titled], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false
        window.contentView = host
        window.makeKeyAndOrderFront(nil)
        RunLoop.main.run(until: Date().addingTimeInterval(1.5))
        host.layoutSubtreeIfNeeded()
        for table in tables(in: host) {
            let rows = table.numberOfRows
            let first = rows > 0 ? table.rect(ofRow: 0).height : 0
            log.append("\(name): table rows=\(rows) rowHeight=\(first) header=\(table.headerView?.frame.height ?? -1) frame=\(table.enclosingScrollView?.frame.size ?? .zero) content=\(table.frame.size)")
        }
        defer { window.contentView = nil; window.close() }
        guard let directory = shots, let rep = host.bitmapImageRepForCachingDisplay(in: host.bounds) else { return }
        host.cacheDisplay(in: host.bounds, to: rep)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        if let data = rep.representation(using: .png, properties: [:]) { try data.write(to: directory.appendingPathComponent("\(name).png")) }
    }

    func testLiveScreens() throws {
        guard shots != nil else { throw XCTSkip("AX_SHOTS is not set") }
        var log: [String] = []
        // The list is stacked here because the window's own width leaves it 340 points beside the thread.
        let inbox = try patched("template-inbox").decode(InboxModel.self)
        try live(InboxScreen(model: inbox), width: 1100, height: 720, name: "live.inbox.mac", log: &log)
        let invoice = try patched("template-invoice").decode(InvoiceModel.self)
        try live(InvoiceScreen(model: invoice), width: 1000, height: 900, name: "live.invoice.mac", log: &log)
        let kanban = try patched("template-kanban").decode(KanbanModel.self)
        try live(KanbanScreen(model: kanban), width: 1100, height: 600, name: "live.kanban.mac", log: &log)
        let compose = InboxComposeForm(compose: inbox.compose, words: inbox.text.composer, inert: inbox.inert)
        try live(compose.frame(width: 560, height: 520), width: 600, height: 560, name: "live.compose.mac", log: &log)
        if let directory = shots {
            try log.joined(separator: "\n").write(to: directory.appendingPathComponent("live.txt"), atomically: true, encoding: .utf8)
        }
    }
}
#endif
