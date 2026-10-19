import ImageIO
import SwiftUI
import UniformTypeIdentifiers
import XCTest
@testable import AstryxKit

/// The dashboard, chat, calendar and showcase templates: each fixture decodes into its
/// Swift model, the small pieces of logic they hold are right, and every template is drawn to
/// a PNG (into `$AX_SHOTS` when set) at phone width and Mac size, light and dark.
@MainActor
final class TemplatesDashboardChatTests: XCTestCase {
    private let ids = ["dashboard", "chat", "calendar", "showcase"]

    private func node(_ id: String) throws -> (app: AppSnapshot, template: TemplateNode) {
        let app = try Library.app("template-\(id)")
        guard case .template(let template) = app.screen.body else {
            XCTFail("template-\(id) does not hold a template node")
            throw XCTSkip("no template node")
        }
        XCTAssertEqual(template.template, id)
        return (app, template)
    }

    // MARK: Models

    func testDashboardDecodes() throws {
        let model = try node("dashboard").template.view.decode(DashModel.self)
        XCTAssertEqual(model.activeUsers.points.count, 96)
        XCTAssertEqual(model.activeUsers.series.map(\.name), ["All Users", "Desktop", "Mobile"])
        XCTAssertEqual(model.activeUsers.xDomain, [0, 23])
        XCTAssertEqual(model.metrics.count, 4)
        XCTAssertEqual(model.metrics[0].sparkline.count, 30)
        XCTAssertEqual(model.demographics.cards.map(\.title), ["Region", "Role"])
        XCTAssertEqual(model.demographics.cards[0].segments[0].share, "38.00")
        XCTAssertEqual(model.engagement.pages.rows.count, 10)
        XCTAssertEqual(model.engagement.events.rows.count, 10)
        XCTAssertEqual(DashTableData(model.engagement.events).extraHeaders, ["Users", "New Users"])
    }

    func testChatDecodes() throws {
        let model = try node("chat").template.view.decode(TChatModel.self)
        XCTAssertEqual(model.items.count, 10)
        var messages = 0, tools = 0, artifacts = 0
        for case .message(let message) in model.items {
            messages += 1
            for part in message.parts {
                if case .tools = part { tools += 1 }
                if case .bubble(let bubble) = part, case .artifact = bubble.content { artifacts += 1 }
            }
        }
        XCTAssertEqual(messages, 8)
        XCTAssertEqual(tools, 4)
        XCTAssertEqual(artifacts, 1)
        XCTAssertEqual(model.composer.modes.map(\.id), ["ask", "edit"])
        XCTAssertTrue(model.artifact.panelOpen)
        XCTAssertFalse(model.artifact.dialogOpen)
        XCTAssertEqual(model.artifact.versions, ["v2 (current)", "v1"])
    }

    func testCalendarDecodesAndCountsWeeks() throws {
        let model = try node("calendar").template.view.decode(TCalModel.self)
        XCTAssertEqual(model.value, "2026-04-15")
        let focus = try XCTUnwrap(TCalDate(iso: model.focusDate))
        // April 2026 starts on a Wednesday: Mar 29 (Sunday) to May 9 (Saturday). The stock Calendar
        // always draws six weeks, so the sixth is the first week of May.
        let weeks = TCalendarMath.weeks(of: focus.firstOfMonth)
        XCTAssertEqual(weeks.count, 6)
        XCTAssertEqual(weeks[0][0].date.iso, "2026-03-29")
        XCTAssertFalse(weeks[0][0].inMonth)
        XCTAssertEqual(weeks[0][3].date.iso, "2026-04-01")
        XCTAssertTrue(weeks[0][3].inMonth)
        XCTAssertEqual(weeks[4][6].date.iso, "2026-05-02")
        XCTAssertEqual(weeks[5][6].date.iso, "2026-05-09")
        XCTAssertEqual(model.words.weekdays, ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"])
        XCTAssertEqual(TCalendarMath.shift(focus, months: -4).iso, "2025-12-01")
        XCTAssertEqual(TCalendarMath.shift(TCalDate(year: 2026, month: 1, day: 31), months: 1).iso, "2026-02-01")
        XCTAssertNil(TCalDate(iso: "April"))
    }

    func testShowcaseDecodes() throws {
        let model = try node("showcase").template.view.decode(ShowModel.self)
        XCTAssertEqual(model.nav.items.map(\.label), ["Shop", "New In", "Stories", "Help"])
        XCTAssertEqual(model.products.count, 3)
        XCTAssertEqual(model.checkout.shipping.options.map(\.price), ["$12.00", "$16.00", "$24.00"])
        XCTAssertEqual(model.checkout.payment.options.filter(\.isSelected).map(\.value), ["card"])
        XCTAssertEqual(model.chat.messages.count, 5)
        XCTAssertEqual(model.revenue.items.count, 5)
        XCTAssertEqual(model.inventory.rows.count, 6)
        XCTAssertEqual(model.inventory.banner, "2 items are running low")
        XCTAssertEqual(model.inventory.rowMenu.count, 5)
        guard case .assistant(_, let details?) = model.chat.messages[4] else { return XCTFail("the last line carries details") }
        XCTAssertEqual(details.count, 4)
    }

    func testMarkdownBlocks() throws {
        let blocks = TChatBlock.parse("""
        ## Title

        Some **bold** text
        on two lines.

        1. one
        2. two

        - a
        - b

        | A | B |
        |---|---|
        | 1 | 2 |
        """)
        XCTAssertEqual(blocks.count, 5)
        guard case .heading(let level, let text) = blocks[0] else { return XCTFail() }
        XCTAssertEqual(level, 2)
        XCTAssertEqual(text, "Title")
        guard case .paragraph(let paragraph) = blocks[1] else { return XCTFail() }
        XCTAssertEqual(paragraph, "Some **bold** text on two lines.")
        guard case .ordered(let ordered) = blocks[2], case .bullets(let bullets) = blocks[3], case .table(let header, let rows) = blocks[4] else { return XCTFail() }
        XCTAssertEqual(ordered, ["one", "two"])
        XCTAssertEqual(bullets, ["a", "b"])
        XCTAssertEqual(header, ["A", "B"])
        XCTAssertEqual(rows, [["1", "2"]])
    }

    func testChatArtifactMarkdownHasTheDocumentsStructure() throws {
        let model = try node("chat").template.view.decode(TChatModel.self)
        let blocks = TChatBlock.parse(model.artifact.content)
        let headings = blocks.compactMap { block -> String? in
            if case .heading(_, let text) = block { return text }
            return nil
        }
        XCTAssertEqual(headings, ["Overview", "The Problem", "The Fix", "Testing", "Rollout & Monitoring"])
        XCTAssertEqual(blocks.filter { if case .table = $0 { true } else { false } }.count, 1)
    }

    // MARK: Actions

    func testActionJSONForTheIdsTheTemplatesSend() {
        XCTAssertEqual(Action.press(id: "tpl.dashboard.reload").json, #"{"id":"tpl.dashboard.reload","type":"press"}"#)
        XCTAssertEqual(Action.set(id: "tpl.calendar.select", value: .string("2026-04-20")).json, #"{"id":"tpl.calendar.select","type":"set","value":"2026-04-20"}"#)
        XCTAssertEqual(Action.set(id: "tpl.chat.dialog", value: .bool(false)).json, #"{"id":"tpl.chat.dialog","type":"set","value":false}"#)
    }

    // MARK: Pictures

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

    /// The whole screen at the Mac's content width, as tall as it is, to see below the fold.
    private func macTall(_ app: AppSnapshot, _ theme: ResolvedTheme, _ scheme: ColorScheme) -> some View {
        ScreenView(app: app, inlineToolbar: true, scrolls: false, fixedWidth: 1039)
            .frame(width: 1039)
            .fixedSize(horizontal: false, vertical: true)
            .axTheme(theme, scheme: scheme, typeSize: .large)
            .environment(\.colorScheme, scheme)
            .environment(\.axStatic, true)
    }

    func testRendersEveryTemplate() throws {
        guard let path = ProcessInfo.processInfo.environment["AX_SHOTS"], !path.isEmpty else { throw XCTSkip("AX_SHOTS is not set") }
        let directory = URL(fileURLWithPath: path, isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let only = ProcessInfo.processInfo.environment["AX_ONLY"] ?? ""
        func write(_ make: @autoclosure () throws -> Data, _ name: String) throws {
            guard only.isEmpty || name.contains(only) else { return }
            let data = try make()
            try data.write(to: directory.appendingPathComponent(name + ".png"))
            XCTAssertGreaterThan(data.count, 2_000, name)
        }
        let theme = try Library.theme("theme-astryx")
        for id in ids {
            let app = try node(id).app
            for (label, scheme) in [("light", ColorScheme.light), ("dark", .dark)] {
                try write(try png(phone(app, theme, scheme), width: 393, height: nil), "template-\(id).phone.\(label)")
                try write(try png(mac(app, theme, scheme), width: 1280, height: 800), "template-\(id).mac.\(label)")
                try write(try png(macTall(app, theme, scheme), width: 1039, height: nil), "template-\(id).mactall.\(label)")
            }
        }
        // The chat's document, which a narrow screen shows as a dialog, and its panel form.
        let model = try node("chat").template.view.decode(TChatModel.self)
        for (label, scheme) in [("light", ColorScheme.light), ("dark", .dark)] {
            let dialog = TChatArtifactDialog(artifact: model.artifact)
                .frame(width: 393)
                .fixedSize(horizontal: false, vertical: true)
                .axTheme(theme, scheme: scheme, typeSize: .large)
                .environment(\.colorScheme, scheme)
                .environment(\.axStatic, true)
                .environment(\.axWidth, 393)
            try write(try png(dialog, width: 393, height: nil), "template-chat.dialog.\(label)")
            let body = TChatArtifactBody(artifact: model.artifact)
                .padding(16)
                .frame(width: 393)
                .fixedSize(horizontal: false, vertical: true)
                .background(Color.white)
                .axTheme(theme, scheme: scheme, typeSize: .large)
                .environment(\.colorScheme, scheme)
                .environment(\.axStatic, true)
            try write(try png(body, width: 393, height: nil), "template-chat.docbody.\(label)")
        }
        // Large text, to see the layouts that adapt to it.
        let app = try node("dashboard").app
        let big = ScreenView(app: app, inlineToolbar: true, scrolls: false, fixedWidth: 393)
            .frame(width: 393)
            .fixedSize(horizontal: false, vertical: true)
            .axTheme(theme, scheme: .light, typeSize: .accessibility1)
            .environment(\.colorScheme, .light)
            .environment(\.axStatic, true)
        try write(try png(big, width: 393, height: nil), "template-dashboard.phone.large-text")
    }
}
