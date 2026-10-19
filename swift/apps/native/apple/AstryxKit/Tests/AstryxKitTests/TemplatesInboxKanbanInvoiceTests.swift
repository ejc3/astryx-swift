import ImageIO
import SwiftUI
import UniformTypeIdentifiers
import XCTest
@testable import AstryxKit

/// The inbox, kanban and invoice templates: each fixture decodes into its typed model, and each
/// is drawn to PNGs (phone width and a Mac window, light and dark) with `ImageRenderer`, which
/// draws no List, ScrollView, TextField or Picker, so the screens are drawn with `axStatic`.
/// The inbox lays itself out from its own width, so the renders need no measurements patched in;
/// a thread the person opened or closed, and ticked rows, are content and are patched into the JSON.
@MainActor
final class TemplatesInboxKanbanInvoiceTests: XCTestCase {
    private var directory: URL? {
        guard let path = ProcessInfo.processInfo.environment["AX_SHOTS"], !path.isEmpty else { return nil }
        return URL(fileURLWithPath: path, isDirectory: true)
    }

    // MARK: Phone rules

    /// The invoice facts follow `MetadataList columns="multi"` (`auto-fill, minmax(280px, 1fr)`,
    /// gap 16): one column on a 390 pt phone (358 of content), two on the Mac pane, three on a
    /// wide window.
    func testInvoiceFactsFollowTheWebsAutoFillGrid() {
        XCTAssertEqual(InvoiceScreen.factColumns(contentWidth: 358, gap: 16), 1)
        XCTAssertEqual(InvoiceScreen.factColumns(contentWidth: 575, gap: 16), 1)
        XCTAssertEqual(InvoiceScreen.factColumns(contentWidth: 576, gap: 16), 2)
        XCTAssertEqual(InvoiceScreen.factColumns(contentWidth: 708, gap: 16), 2)
        XCTAssertEqual(InvoiceScreen.factColumns(contentWidth: 872, gap: 16), 3)
    }

    /// Astryx's touch rules for a field and its marks: 16 pt text and 24 pt boxes on an iPhone,
    /// the body size and 18 pt on the Mac.
    func testTouchRulesForFieldsAndMarks() throws {
        let theme = try Library.theme("theme-astryx")
        let ax = AXStyle(mode: theme.light, isDark: false, scale: 1)
        #if os(iOS)
        XCTAssertEqual(showMarkSide(ax), 24)
        #else
        XCTAssertEqual(showMarkSide(ax), 18)
        #endif
        XCTAssertEqual(showFieldHeight(ax), 36)
    }

    // MARK: Fixtures

    private typealias JSON = [String: Any]

    /// The fixture as JSON, with the template's view model changed by `patch`.
    private func appData(_ name: String, patch: (inout JSON) -> Void = { _ in }) throws -> Data {
        var root = try XCTUnwrap(JSONSerialization.jsonObject(with: Library.data(name)) as? JSON)
        var screen = try XCTUnwrap(root["screen"] as? JSON)
        var body = try XCTUnwrap(screen["body"] as? JSON)
        var view = try XCTUnwrap(body["view"] as? JSON)
        patch(&view)
        body["view"] = view
        screen["body"] = body
        root["screen"] = screen
        return try JSONSerialization.data(withJSONObject: root)
    }

    private func app(_ name: String, patch: (inout JSON) -> Void = { _ in }) throws -> AppSnapshot {
        try JSONDecoder().decode(AppSnapshot.self, from: appData(name, patch: patch))
    }

    private func templateView(_ app: AppSnapshot) throws -> JSONValue {
        guard case .template(let node) = app.screen.body else {
            XCTFail("the screen is not a template")
            return .null
        }
        return node.view
    }

    // MARK: Decoding

    func testFixturesDecode() throws {
        let inbox = try templateView(try app("template-inbox")).decode(InboxModel.self)
        XCTAssertEqual(inbox.rows.count, 9)
        XCTAssertEqual(inbox.tabs.map(\.value), ["inbox", "escalations", "waiting", "resolved"])
        XCTAssertEqual(inbox.subtitle.joined(), "3 unread of 9 conversations")
        XCTAssertEqual(inbox.panes.map(\.id), inbox.rows.map(\.id))
        XCTAssertEqual(inbox.choice, .init(openIdExplicit: nil, isClosed: false, firstVisibleId: "c-01"))
        XCTAssertEqual(inbox.rows.first?.actionsWide.count, 4)
        XCTAssertEqual(inbox.rows.first?.actionsStacked.map(\.id), ["archive", "delete"])
        let pane = try XCTUnwrap(inbox.panes.first)
        XCTAssertEqual(pane.messages.count, 3)
        XCTAssertEqual(pane.openMessages, [pane.id])
        XCTAssertEqual(pane.messages.last?.attachments.count, 1)
        XCTAssertEqual(pane.messages.last?.attachmentsLabel.joined(), "1 attachment")
        XCTAssertEqual(inbox.rows.first?.priority?.color, .red)
        XCTAssertEqual(inbox.text.composer.tools.count, 4)
        XCTAssertFalse(inbox.compose.directory.isEmpty)

        let kanban = try templateView(try app("template-kanban")).decode(KanbanModel.self)
        XCTAssertEqual(kanban.title, "Sprint Board")
        XCTAssertEqual(kanban.columns.map(\.id), ["todo", "in-progress", "in-review", "done"])
        XCTAssertEqual(kanban.columns.map(\.count), [2, 2, 0, 3])
        XCTAssertEqual(kanban.total, 7)
        XCTAssertEqual(kanban.columns[0].cards.first?.moveTargets.count, 3)
        XCTAssertEqual(kanban.columns[0].cards.first?.moveTargets.first?.id, "tpl.kanban.move:t1:in-progress")
        XCTAssertEqual(kanban.sprintOptions.count, 3)

        let invoice = try templateView(try app("template-invoice")).decode(InvoiceModel.self)
        XCTAssertEqual(invoice.rows.count, 19)
        XCTAssertEqual(invoice.details.count, 6)
        XCTAssertEqual(invoice.totals.map(\.label), ["Subtotal", "Tax (8.75%)", "Total due"])
        XCTAssertEqual(invoice.totals.last?.emphasis, .strong)
        XCTAssertNil(invoice.banner)
        XCTAssertNil(invoice.empty)
        XCTAssertTrue(invoice.filters.isEmpty)
    }

    /// A model with every optional present decodes too: filters of both kinds, a sort, a banner.
    func testInvoiceFiltersDecode() throws {
        let filtered = try app("template-invoice") { view in
            view["filters"] = ["description": "design", "category": "design", "quantity": 12]
            view["sort"] = [["sortKey": "amount", "direction": "descending"]]
            view["banner"] = ["title": "Filtered view", "description": "Showing 3 of 19 lines."]
        }
        let model = try templateView(filtered).decode(InvoiceModel.self)
        XCTAssertEqual(model.filters["quantity"], .number(12))
        XCTAssertEqual(model.filters["description"], .text("design"))
        XCTAssertEqual(model.filters["quantity"]?.text, "12")
        XCTAssertEqual(model.sort.first?.direction, .descending)
        XCTAssertEqual(model.banner?.title, "Filtered view")
    }

    func testInvoiceSortCycles() {
        XCTAssertEqual(InvoiceSort.next(after: nil, key: "amount"), "amount:ascending")
        XCTAssertEqual(InvoiceSort.next(after: .init(sortKey: "amount", direction: .ascending), key: "amount"), "amount:descending")
        XCTAssertEqual(InvoiceSort.next(after: .init(sortKey: "amount", direction: .descending), key: "amount"), "")
        XCTAssertEqual(InvoiceSort.next(after: .init(sortKey: "amount", direction: .descending), key: "description"), "description:ascending")
    }

    func testInboxActionIds() {
        XCTAssertEqual(inboxAction("open:c-01"), "tpl.inbox.open:c-01")
        XCTAssertEqual(kanbanAction("drop:t1"), "tpl.kanban.drop:t1")
        XCTAssertEqual(invoiceAction("unfilter:category"), "tpl.invoice.unfilter:category")
    }

    // MARK: Content the person chose

    /// The person opened a thread (it stays open at any width), closed it, and/or ticked rows:
    /// content, which the core holds and every drawing shows. The layout is not patched; the
    /// inbox works that out from its own width.
    private func chosen(open: String? = nil, closed: Bool = false, selected: [String] = []) -> (inout JSON) -> Void {
        { view in
            if var choice = view["choice"] as? JSON {
                choice["openIdExplicit"] = open ?? NSNull()
                choice["isClosed"] = closed
                view["choice"] = choice
            }
            if !selected.isEmpty {
                view["selectedKeys"] = selected
                view["hasSelectedRows"] = true
                view["selectionLabel"] = ["\(selected.count)", " ", selected.count == 1 ? "conversation" : "conversations", " ", "selected"]
            }
        }
    }

    /// What the web page, drawing the same state at its own width, leaves in the shared view:
    /// its measurements and everything the core decided from them. The inbox must not read it.
    private func measuredByTheWebPage(surface: Int, list: Int) -> (inout JSON) -> Void {
        { view in
            let single = surface < 900
            var mode = view["mode"] as? JSON ?? [:]
            mode["isSingleSurface"] = single
            mode["isPaneFullWidth"] = single
            mode["isStacked"] = list < 560
            mode["isTight"] = list < 900
            mode["isTouch"] = single
            mode["measured"] = ["surface": surface, "list": list]
            view["mode"] = mode
            view["hasSelection"] = list >= 560
            view["receivedWidth"] = single ? 1.0 : 2.0
            if single {
                view["openId"] = NSNull()
                view["pane"] = NSNull()
            }
            if var rows = view["rows"] as? [JSON] {
                for i in rows.indices {
                    rows[i]["isOpen"] = !single && i == 0
                    rows[i]["actions"] = list < 560 ? rows[i]["actionsStacked"] as Any : rows[i]["actionsWide"] as Any
                }
                view["rows"] = rows
            }
        }
    }

    // MARK: The native layout

    private func layout(_ model: InboxModel, width: Double, touch: Bool = false) -> InboxLayout {
        let surface = InboxLayout(model, surfaceWidth: width, isTouch: touch)
        // The list is as wide as the surface when it is alone, and 340 or so beside a thread.
        let list = surface.isSingleSurface || surface.openId == nil ? width - 2 : width - 2 - 661 - 9
        return surface.listed(model, listWidth: list)
    }

    func testInboxLayoutFollowsTheNativeWidthOnly() throws {
        let model = try templateView(try app("template-inbox")).decode(InboxModel.self)
        // 375: one surface at a time, nothing open by default, stacked rows, no selection band.
        let phone = layout(model, width: 375)
        XCTAssertEqual([phone.isSingleSurface, phone.isStacked, phone.isTight], [true, true, true])
        XCTAssertNil(phone.openId)
        XCTAssertNil(phone.pane(in: model))
        // 768 is still a single surface (below 900).
        let tablet = layout(model, width: 768)
        XCTAssertEqual([tablet.isSingleSurface, tablet.isStacked, tablet.isTight], [true, false, true])
        // 1280: list beside the top thread; the list is the room the thread leaves.
        let desk = layout(model, width: 1280)
        XCTAssertEqual([desk.isSingleSurface, desk.isStacked, desk.isTight], [false, false, true], "the list beside the thread is 600 wide: rows not stacked, the tags column dropped")
        XCTAssertEqual(desk.openId, "c-01")
        XCTAssertEqual(desk.pane(in: model)?.id, "c-01")
        XCTAssertEqual(layout(model, width: 1039).isStacked, true)
        // The breakpoints are the core's, applied to the width: 899 and 900.
        XCTAssertTrue(layout(model, width: 899).isSingleSurface)
        XCTAssertFalse(layout(model, width: 900).isSingleSurface)
        // Touch is the platform's and picks no layout.
        XCTAssertEqual(layout(model, width: 1280, touch: true).isTouch, true)
        XCTAssertEqual(layout(model, width: 1280, touch: true).openId, desk.openId)
    }

    func testInboxLayoutIgnoresWhatTheWebPageMeasured() throws {
        // The web page drew the same state at 390 wide, or at 1440 wide, and the core holds its
        // measurements (and its decisions from them). The native layout is the same either way.
        let asPhone = try app("template-inbox", patch: measuredByTheWebPage(surface: 390, list: 388))
        let asDesk = try app("template-inbox", patch: measuredByTheWebPage(surface: 1440, list: 480))
        let phoneModel = try templateView(asPhone).decode(InboxModel.self)
        let deskModel = try templateView(asDesk).decode(InboxModel.self)
        for width in [375.0, 768, 1039, 1280] {
            XCTAssertEqual(layout(phoneModel, width: width), layout(deskModel, width: width), "\(width)")
        }
        XCTAssertEqual(phoneModel.rows.map(\.actionsWide), deskModel.rows.map(\.actionsWide))
        XCTAssertEqual(phoneModel.panes, deskModel.panes)
        XCTAssertEqual(layout(phoneModel, width: 1280).openId, "c-01", "the top thread opens at 1280 even where the web page was single-surface")
        XCTAssertNil(layout(deskModel, width: 375).openId, "nothing opens at 375 even where the web page had a thread open")
        // No other part of the screen takes anything but those from the model.
        XCTAssertEqual(layout(phoneModel, width: 1280).actions(of: phoneModel.rows[0]).count, 4)
        XCTAssertEqual(layout(deskModel, width: 375).actions(of: deskModel.rows[0]).map(\.id), ["archive", "delete"])
    }

    func testInboxOpensWhatThePersonChoseAndNothingWhenTheyClosedIt() throws {
        let opened = try templateView(try app("template-inbox", patch: chosen(open: "c-03"))).decode(InboxModel.self)
        XCTAssertEqual(layout(opened, width: 375).openId, "c-03", "an opened thread opens on a phone")
        XCTAssertEqual(layout(opened, width: 1280).openId, "c-03")
        XCTAssertEqual(layout(opened, width: 375).pane(in: opened)?.id, "c-03")
        let closed = try templateView(try app("template-inbox", patch: chosen(closed: true))).decode(InboxModel.self)
        XCTAssertNil(layout(closed, width: 1280).openId, "a closed thread stays closed where there is room")
        XCTAssertNil(layout(closed, width: 375).openId)
    }

    func testInboxBulkBandNeedsTickedRowsAndRowsThatAreNotStacked() throws {
        let ticked = try templateView(try app("template-inbox", patch: chosen(closed: true, selected: ["c-02"]))).decode(InboxModel.self)
        XCTAssertTrue(layout(ticked, width: 1280).hasSelection)
        XCTAssertFalse(layout(ticked, width: 375).hasSelection)
        let none = try templateView(try app("template-inbox")).decode(InboxModel.self)
        XCTAssertFalse(layout(none, width: 1280).hasSelection)
    }

    @MainActor
    func testInboxAdoptsAThreadOnlyWhenItIsNotAlreadyTheChosenOne() throws {
        final class Sent: @unchecked Sendable { var items: [String] = [] }
        let box = Sent()
        let send = AXSender { box.items.append($0.json) }
        let fresh = try templateView(try app("template-inbox")).decode(InboxModel.self)
        inboxAdopt("c-01", in: fresh, send: send)
        XCTAssertEqual(box.items, [#"{"id":"tpl.inbox.open:c-01","type":"press"}"#])
        box.items = []
        let opened = try templateView(try app("template-inbox", patch: chosen(open: "c-01"))).decode(InboxModel.self)
        inboxAdopt("c-01", in: opened, send: send)
        XCTAssertEqual(box.items, [])
        inboxAdopt("c-02", in: opened, send: send)
        XCTAssertEqual(box.items, [#"{"id":"tpl.inbox.open:c-02","type":"press"}"#])
    }

    // MARK: Rendering

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

    private func phone(_ app: AppSnapshot, _ theme: ResolvedTheme, _ scheme: ColorScheme) -> some View {
        ScreenView(app: app, inlineToolbar: true, scrolls: false, fixedWidth: 393)
            .frame(width: 393)
            .fixedSize(horizontal: false, vertical: true)
            .axTheme(theme, scheme: scheme, typeSize: .large)
            .environment(\.colorScheme, scheme)
            .environment(\.axStatic, true)
    }

    private func mac(_ app: AppSnapshot, _ theme: ResolvedTheme, _ scheme: ColorScheme, height: CGFloat = 800) -> some View {
        HStack(spacing: 0) {
            StaticSidebar(app: app).frame(width: 240, height: height)
            Rectangle().fill(Color.gray.opacity(0.25)).frame(width: 1)
            ScreenView(app: app, inlineToolbar: true, scrolls: false, fixedWidth: 1039)
                .frame(width: 1039, height: height, alignment: .top)
                .clipped()
        }
        .frame(width: 1280, height: height)
        .clipped()
        .axTheme(theme, scheme: scheme, typeSize: .large)
        .environment(\.colorScheme, scheme)
        .environment(\.axStatic, true)
    }

    /// A single view in the theme, on the page ground, for the pieces that live in sheets.
    private func piece<V: View>(_ view: V, _ theme: ResolvedTheme, _ scheme: ColorScheme, width: CGFloat) -> some View {
        view
            .frame(width: width)
            .fixedSize(horizontal: false, vertical: true)
            .background(Color.gray.opacity(0.1))
            .axTheme(theme, scheme: scheme, typeSize: .large)
            .environment(\.colorScheme, scheme)
            .environment(\.axStatic, true)
    }

    /// The inbox screen alone at 375, 768 and 1280 points: the layout is the screen's own at each
    /// width, from the same fixture. 375 with a thread opened shows the thread alone.
    func testRendersInboxAtItsOwnWidths() throws {
        guard let directory else { throw XCTSkip("AX_SHOTS is not set") }
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let theme = try Library.theme("theme-astryx")
        let plain = try templateView(try app("template-inbox")).decode(InboxModel.self)
        let opened = try templateView(try app("template-inbox", patch: chosen(open: "c-02"))).decode(InboxModel.self)
        let cases: [(String, InboxModel, CGFloat)] = [("w375", plain, 375), ("w768", plain, 768), ("w1280", plain, 1280), ("w375.thread", opened, 375), ("w768.thread", opened, 768)]
        for (name, model, width) in cases {
            let screen = InboxScreen(model: model)
                .environment(\.axWidth, width - 32)
                .padding(16)
                .frame(width: width)
                .fixedSize(horizontal: false, vertical: true)
                .axTheme(theme, scheme: .light, typeSize: .large)
                .environment(\.colorScheme, .light)
                .environment(\.axStatic, true)
            let data = try png(screen, width: width, height: nil)
            try data.write(to: directory.appendingPathComponent("inbox.\(name).png"))
            XCTAssertGreaterThan(data.count, 2_000, name)
        }
    }

    func testRendersTemplates() throws {
        guard let directory else { throw XCTSkip("AX_SHOTS is not set") }
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let only = ProcessInfo.processInfo.environment["AX_ONLY"] ?? ""
        let theme = try Library.theme("theme-astryx")
        var written = 0

        func write(_ make: @autoclosure () throws -> Data, _ name: String) throws {
            guard only.isEmpty || name.contains(only) else { return }
            let data = try make()
            try data.write(to: directory.appendingPathComponent(name + ".png"))
            XCTAssertGreaterThan(data.count, 2_000, name)
            written += 1
        }

        /// One fixture on a phone and in a Mac window, light and dark; `patch` per size.
        func both(_ name: String, tag: String, phonePatch: @escaping (inout JSON) -> Void = { _ in }, macPatch: @escaping (inout JSON) -> Void = { _ in }, tall: CGFloat? = nil) throws {
            let phoneApp = try app("template-\(name)", patch: phonePatch)
            let macApp = try app("template-\(name)", patch: macPatch)
            for (label, scheme) in [("light", ColorScheme.light), ("dark", .dark)] {
                try write(try png(phone(phoneApp, theme, scheme), width: 393, height: nil), "\(name).\(tag).phone.\(label)")
                try write(try png(mac(macApp, theme, scheme, height: tall ?? 800), width: 1280, height: tall ?? 800), "\(name).\(tag).mac.\(label)")
            }
        }

        // Inbox: a phone gets the list alone, a window gets the list beside the open thread.
        try both("inbox", tag: "astryx")
        try both("inbox", tag: "thread", phonePatch: chosen(open: "c-01"), tall: 1500)
        try both("inbox", tag: "closed", macPatch: chosen(closed: true, selected: ["c-02", "c-04"]))

        // Kanban: four columns in a window, a paged board on a phone; and one with an empty column.
        try both("kanban", tag: "astryx")
        try both("kanban", tag: "empty", phonePatch: { view in KanbanFixtures.emptying("done", &view) }, macPatch: { view in KanbanFixtures.emptying("todo", &view) })

        // Invoice: the table in a window, small cards on a phone; filtered, and with no match.
        try both("invoice", tag: "astryx", tall: 1500)
        try both("invoice", tag: "filtered", phonePatch: InvoiceFixtures.filtered, macPatch: InvoiceFixtures.filtered, tall: 1000)
        try both("invoice", tag: "none", phonePatch: InvoiceFixtures.none, macPatch: InvoiceFixtures.none)

        // The compose sheet, which the window renders do not show (a sheet).
        let inbox = try templateView(try app("template-inbox")).decode(InboxModel.self)
        var compose = inbox.compose
        compose.isOpen = true
        compose.recipients = [.init(id: "priya.raman@northwind.example", label: "Priya Raman")]
        compose.cc = [.init(id: "m.feld@harbourpoint.example", label: "Marcus Feld")]
        compose.hasCc = true
        compose.subject = "Re: Checkout returns 502 for EU customers"
        compose.body = "Thanks for the detail. We are looking at the EU gateway now."
        for (label, scheme) in [("light", ColorScheme.light), ("dark", .dark)] {
            try write(try png(piece(InboxComposeForm(compose: compose, words: inbox.text.composer, inert: inbox.inert), theme, scheme, width: 560), width: 560, height: nil), "inbox.compose.\(label)")
        }

        // inbox x3, kanban x2, invoice x3 (each four pictures), and the compose sheet in two schemes
        if only.isEmpty { XCTAssertEqual(written, 8 * 4 + 2) }
    }
}

/// Patches of the kanban fixture.
private enum KanbanFixtures {
    /// The column with no cards (its count 0), as after its cards were moved elsewhere.
    static func emptying(_ column: String, _ view: inout [String: Any]) {
        guard var columns = view["columns"] as? [[String: Any]] else { return }
        for i in columns.indices where columns[i]["id"] as? String == column {
            columns[i]["cards"] = [[String: Any]]()
            columns[i]["count"] = 0
        }
        view["columns"] = columns
    }
}

/// Patches of the invoice fixture.
private enum InvoiceFixtures {
    /// What the core sends with a category filter and a sort on: fewer rows, chips, a banner.
    static func filtered(_ view: inout [String: Any]) {
        let rows = (view["rows"] as? [[String: Any]] ?? []).prefix(4)
        view["rows"] = Array(rows)
        view["filters"] = ["category": "design", "quantity": 12] as [String: Any]
        view["sort"] = [["sortKey": "amount", "direction": "descending"]]
        view["query"] = "design"
        view["basis"] = "hourly"
        view["banner"] = [
            "title": "Filtered view \u{2014} these totals are partial",
            "description": "Showing 4 of 19 lines. The subtotal, tax, and total due above cover only the lines currently visible.",
        ]
    }

    /// No row survives.
    static func none(_ view: inout [String: Any]) {
        view["rows"] = [[String: Any]]()
        view["filters"] = ["description": "zzz"]
        view["empty"] = ["title": "No matching line items", "description": "No line on this invoice matches the current filters."]
        view["banner"] = NSNull()
    }
}
