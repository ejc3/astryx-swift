import SwiftUI
import XCTest
@testable import AstryxKit

/// The invoice, calendar and chat templates measured against the web's drawing: what the core
/// now says (the tool-call header, the delivered word, the code header, the weekday names), what
/// the syntax highlighter paints and, on the Mac, the three screens drawn in a real window at the
/// pane's 740 points to `$AX_SHOTS` to look at next to the web.
@MainActor
final class TemplatesInvoiceCalendarChatCompareTests: XCTestCase {
    private func view(_ id: String) throws -> JSONValue {
        let app = try Library.app("template-\(id)")
        guard case .template(let template) = app.screen.body else { throw XCTSkip("no template node") }
        return template.view
    }

    // MARK: Words from the core

    func testChatToolGroupsCarryTheirHeaders() throws {
        let model = try view("chat").decode(TChatModel.self)
        var labels: [String] = []
        for case .message(let message) in model.items {
            for case .tools(_, let label, _) in message.parts { labels.append(label) }
        }
        XCTAssertEqual(labels, ["3 tool calls", "1 tool call", "3 tool calls", "1 tool call"])
        XCTAssertEqual(model.words.delivered, "Delivered")
    }

    func testChatCodeBlocksCarryTheirHeaderLine() throws {
        let model = try view("chat").decode(TChatModel.self)
        var headers: [String] = []
        for case .message(let message) in model.items {
            for case .bubble(let bubble) in message.parts {
                if case .code(_, let header, _) = bubble.content { headers.append(header) }
            }
        }
        XCTAssertEqual(headers, ["middleware.ts \u{2014} typescript", "middleware.test.ts \u{2014} typescript"])
    }

    func testTheCalendarAlwaysDrawsSixWeeks() {
        for (year, month) in [(2026, 2), (2026, 4), (2026, 8), (2027, 2)] {
            let weeks = TCalendarMath.weeks(of: TCalDate(year: year, month: month, day: 1))
            XCTAssertEqual(weeks.count, 6, "\(year)-\(month)")
            XCTAssertTrue(weeks.allSatisfy { $0.count == 7 })
        }
    }

    // MARK: Syntax

    /// The colors the highlighter gave each word of a line, by the token that painted them.
    private func tokens(_ code: String) throws -> [String: [String]] {
        let theme = try Library.theme("theme-astryx")
        let ax = AXStyle(mode: theme.light, isDark: false, scale: 1)
        let painted = TChatSyntax.highlight(code, ax: ax)
        var out: [String: [String]] = [:]
        let keys = ["color-syntax-keyword", "color-syntax-function", "color-syntax-type", "color-syntax-string", "color-syntax-number", "color-syntax-comment", "color-syntax-operator", "color-syntax-punctuation"]
        for run in painted.runs {
            guard let color = run.foregroundColor else { continue }
            for key in keys where ax.color(key) == color {
                out[key, default: []].append(String(painted[run.range].characters))
            }
        }
        return out
    }

    func testTheHighlighterPaintsFunctionsTypesAndPunctuationAsTheWebDoes() throws {
        let painted = try tokens("async function authMiddleware(req: Request) { return new Response('x', { status: 401 }); }")
        XCTAssertEqual(painted["color-syntax-keyword"], ["async", "function", "return", "new"])
        // As Astryx's tokenizer orders its rules, a capitalized name before a parenthesis is a call.
        XCTAssertEqual(painted["color-syntax-function"], ["authMiddleware", "Response"])
        XCTAssertEqual(painted["color-syntax-type"], ["Request"])
        XCTAssertEqual(painted["color-syntax-string"], ["'x'"])
        XCTAssertEqual(painted["color-syntax-number"], ["401"])
        XCTAssertNotNil(painted["color-syntax-punctuation"])
        // The test names are calls, not keywords.
        let calls = try tokens("describe('a', () => { expect(x).toBe(1); it('b', async () => {}); });")
        XCTAssertEqual(calls["color-syntax-function"], ["describe", "expect", "toBe", "it"])
        XCTAssertEqual(calls["color-syntax-keyword"], ["async"])
    }

    func testTheHighlighterKeepsEveryCharacter() throws {
        let code = "// note\nconst a = `x${y}`; // end\n"
        let theme = try Library.theme("theme-astryx")
        let ax = AXStyle(mode: theme.light, isDark: false, scale: 1)
        XCTAssertEqual(String(TChatSyntax.highlight(code, ax: ax).characters), code)
    }
}

#if os(macOS)
import AppKit

/// The three screens in a real window, 740 points wide as the pane is, so the system's table,
/// scroll view and menus are the real ones. `$AX_SHOTS` keeps the pictures; the table's measures go
/// to `compare.txt` beside them.
@MainActor
extension TemplatesInvoiceCalendarChatCompareTests {
    private var shots: URL? {
        guard let path = ProcessInfo.processInfo.environment["AX_SHOTS"], !path.isEmpty else { return nil }
        return URL(fileURLWithPath: path, isDirectory: true)
    }

    private func tables(in view: NSView) -> [NSTableView] {
        var found: [NSTableView] = []
        if let table = view as? NSTableView { found.append(table) }
        for sub in view.subviews { found += tables(in: sub) }
        return found
    }

    private func live<V: View>(_ content: V, width: CGFloat = 740, height: CGFloat, name: String, log: inout [String]) throws {
        let theme = try Library.theme("theme-astryx")
        let ax = AXStyle(mode: theme.light, isDark: false, scale: 1)
        let root = content
            .environment(\.axWidth, width)
            .frame(width: width, height: height, alignment: .top)
            .background(ax.surface)
            .axTheme(theme, scheme: .light, typeSize: .large)
            .environment(\.colorScheme, .light)
        let host = NSHostingView(rootView: root)
        host.frame = CGRect(x: 0, y: 0, width: width, height: height)
        let window = NSWindow(contentRect: host.frame, styleMask: [.titled], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false
        window.appearance = NSAppearance(named: .aqua)
        window.contentView = host
        window.makeKeyAndOrderFront(nil)
        RunLoop.main.run(until: Date().addingTimeInterval(1.5))
        host.layoutSubtreeIfNeeded()
        for table in tables(in: host) {
            let rows = table.numberOfRows
            let first = rows > 0 ? table.rect(ofRow: 0).height : 0
            log.append("\(name): rows=\(rows) rowHeight=\(first) header=\(table.headerView?.frame.height ?? -1) scrollFrame=\(table.enclosingScrollView?.frame.size ?? .zero) content=\(table.frame.size) columns=\(table.tableColumns.map { Int($0.width) })")
        }
        defer { window.contentView = nil; window.close() }
        guard let directory = shots, let rep = host.bitmapImageRepForCachingDisplay(in: host.bounds) else { return }
        host.cacheDisplay(in: host.bounds, to: rep)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        if let data = rep.representation(using: .png, properties: [:]) { try data.write(to: directory.appendingPathComponent("\(name).png")) }
    }

    func testLiveScreensAtThePaneWidth() throws {
        guard shots != nil else { throw XCTSkip("AX_SHOTS is not set") }
        var log: [String] = []
        let invoice = try view("invoice")
        try live(InvoiceTemplate(view: invoice), height: 1000, name: "cmp.invoice", log: &log)
        let calendar = try view("calendar")
        try live(CalendarTemplate(view: calendar), height: 420, name: "cmp.calendar", log: &log)
        let chat = try view("chat")
        try live(ChatTemplate(view: chat), height: 950, name: "cmp.chat", log: &log)
        // Tall enough for the whole conversation, to set beside the stock page in a tall window.
        try live(ChatTemplate(view: chat), height: 2900, name: "cmp.chat.tall", log: &log)
        if let directory = shots {
            try log.joined(separator: "\n").write(to: directory.appendingPathComponent("compare.txt"), atomically: true, encoding: .utf8)
        }
    }
}
#endif
