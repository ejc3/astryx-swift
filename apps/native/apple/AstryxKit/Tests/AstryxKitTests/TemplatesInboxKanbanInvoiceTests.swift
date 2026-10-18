import ImageIO
import SwiftUI
import UniformTypeIdentifiers
import XCTest
@testable import AstryxKit

/// The inbox, kanban and invoice templates: each fixture decodes into its typed model, and each
/// is drawn to PNGs (phone width and a Mac window, light and dark) with `ImageRenderer`, which
/// draws no List, ScrollView, TextField or Picker, so the screens are drawn with `axStatic`.
/// The core only reports measurements once a host has sent them, so the renders that need the
/// layout a measured host gets (a phone, a window) apply the core's own rules to the fixture's JSON.
@MainActor
final class TemplatesInboxKanbanInvoiceTests: XCTestCase {
    private var directory: URL? {
        guard let path = ProcessInfo.processInfo.environment["AX_SHOTS"], !path.isEmpty else { return nil }
        return URL(fileURLWithPath: path, isDirectory: true)
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
        let pane = try XCTUnwrap(inbox.pane)
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

    // MARK: Layout the core would choose for a measured host

    /// The core's `derive` for the inbox (core/src/templates/inbox/model.ts): single surface below
    /// 900, stacked rows below 560, tighter columns below 900. `thread` keeps a thread open on a
    /// single surface; `closed` closes it; `selected` ticks rows.
    private func measured(surface: Double, list: Double, thread: Bool = false, closed: Bool = false, selected: [String] = []) -> (inout JSON) -> Void {
        { view in
            let single = surface < 900
            let stacked = list < 560
            let tight = list < 900
            var mode = view["mode"] as? JSON ?? [:]
            mode["isSingleSurface"] = single
            mode["isPaneFullWidth"] = single && thread
            mode["isStacked"] = stacked
            mode["isTight"] = tight
            view["mode"] = mode
            let closePane = closed || (single && !thread)
            if closePane {
                view["openId"] = NSNull()
                view["pane"] = NSNull()
            }
            if var rows = view["rows"] as? [JSON] {
                for i in rows.indices {
                    if closePane { rows[i]["isOpen"] = false }
                    if let actions = rows[i]["actions"] as? [JSON], stacked {
                        rows[i]["actions"] = actions.filter { ["archive", "delete"].contains($0["id"] as? String ?? "") }
                    }
                }
                view["rows"] = rows
            }
            if !selected.isEmpty && !stacked {
                view["selectedKeys"] = selected
                view["hasSelection"] = true
                view["selectionLabel"] = ["\(selected.count)", " ", selected.count == 1 ? "conversation" : "conversations", " ", "selected"]
            }
        }
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
        try both("inbox", tag: "astryx",
                 phonePatch: measured(surface: 361, list: 359),
                 macPatch: measured(surface: 991, list: 991 - 2 - 661 - 9))
        try both("inbox", tag: "thread",
                 phonePatch: measured(surface: 361, list: 359, thread: true),
                 macPatch: measured(surface: 991, list: 991 - 2 - 661 - 9),
                 tall: 1500)
        try both("inbox", tag: "closed",
                 phonePatch: measured(surface: 361, list: 359),
                 macPatch: measured(surface: 991, list: 989, closed: true, selected: ["c-02", "c-04"]))

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
            try write(try png(piece(InboxComposeForm(compose: compose, words: inbox.text.composer), theme, scheme, width: 560), width: 560, height: nil), "inbox.compose.\(label)")
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
