import SwiftUI
import XCTest
@testable import AstryxKit

/// The inbox and chat templates with saved data on (docs/SYNC.md): Archive, Delete, Move to
/// folder and Send start working in the inbox, and Send in the chat. The fixtures `saved-inbox`
/// and `saved-chat` are the core's views after a read, a reply, a new message, a move, a Delete
/// asking and two chat messages; `template-inbox` and `template-chat` are the first views.
@MainActor
final class TemplatesInboxChatSavedTests: XCTestCase {
    private func view(_ name: String, patch: (inout [String: Any]) -> Void = { _ in }) throws -> JSONValue {
        var root = try XCTUnwrap(JSONSerialization.jsonObject(with: Library.data(name)) as? [String: Any])
        var screen = try XCTUnwrap(root["screen"] as? [String: Any])
        var body = try XCTUnwrap(screen["body"] as? [String: Any])
        var view = try XCTUnwrap(body["view"] as? [String: Any])
        patch(&view)
        body["view"] = view
        screen["body"] = body
        root["screen"] = screen
        let app = try JSONDecoder().decode(AppSnapshot.self, from: JSONSerialization.data(withJSONObject: root))
        guard case .template(let node) = app.screen.body else {
            XCTFail("the screen is not a template")
            return .null
        }
        return node.view
    }

    private func inbox(_ name: String, patch: (inout [String: Any]) -> Void = { _ in }) throws -> InboxModel {
        try view(name, patch: patch).decode(InboxModel.self)
    }

    /// The actions a closure was asked to send, in order.
    private final class Sent: @unchecked Sendable {
        var presses: [String] = []
    }

    private func sender(_ sent: Sent) -> AXSender {
        AXSender { action in
            if case .press(let id) = action { sent.presses.append(id) }
        }
    }

    // MARK: Inbox

    func testSavingOnMakesArchiveMoveDeleteAndSendWork() throws {
        let model = try inbox("template-inbox")
        for id in ["archive", "move", "delete", "send"] { XCTAssertFalse(model.isInert(id), id) }
        for id in ["refresh", "attach", "link", "image", "emoji"] { XCTAssertTrue(model.isInert(id), id) }
        XCTAssertNil(model.confirm)
        XCTAssertFalse(model.compose.canSend)
        XCTAssertEqual(model.bulkMoveTargets.map(\.label), ["Inbox", "Escalations", "Waiting", "Resolved"])
        XCTAssertEqual(model.bulkMoveTargets.last?.id, "tpl.inbox.moveSelected:resolved")
        let first = try XCTUnwrap(model.rows.first)
        XCTAssertEqual(first.moveTargets.map(\.label), ["Inbox", "Waiting", "Resolved"], "all folders but the thread's own")
        XCTAssertEqual(first.moveTargets.first?.id, "tpl.inbox.move:c-01:inbox")
        XCTAssertEqual(try XCTUnwrap(model.panes.first).moveTargets, first.moveTargets)
    }

    func testStockKeepsTheFourControlsInert() throws {
        let stock = try inbox("template-inbox") { $0["inert"] = ["refresh", "archive", "move", "delete", "send", "attach", "link", "image", "emoji"] }
        for id in ["archive", "move", "delete", "send"] { XCTAssertTrue(stock.isInert(id), id) }
    }

    func testArchiveAndDeletePressTheCoresActionsUnlessInert() {
        let sent = Sent()
        inboxPerform("archive", row: "c-02", send: sender(sent), inert: ["refresh"])
        inboxPerform("delete", row: "c-02", send: sender(sent), inert: ["refresh"])
        XCTAssertEqual(sent.presses, ["tpl.inbox.archive:c-02", "tpl.inbox.delete:c-02"])
        // Stock: the controls are drawn and do nothing.
        let none = Sent()
        for action in ["archive", "delete", "move"] { inboxPerform(action, row: "c-02", send: sender(none), inert: ["archive", "delete", "move"]) }
        XCTAssertEqual(none.presses, [])
        // Reply still opens the thread and starts the reply.
        let reply = Sent()
        inboxPerform("reply", row: "c-02", send: sender(reply), inert: ["archive"])
        XCTAssertEqual(reply.presses, ["tpl.inbox.open:c-02", "tpl.inbox.reply"])
    }

    func testTheSavedViewDecodes() throws {
        let model = try inbox("saved-inbox")
        XCTAssertEqual(model.subtitle.joined(), "2 unread of 10 conversations")
        let confirm = try XCTUnwrap(model.confirm)
        XCTAssertEqual(confirm.title, "Delete this conversation?")
        XCTAssertEqual(confirm.actionLabel, "Delete")
        XCTAssertEqual(confirm.actionId, "tpl.inbox.deleteConfirm")
        XCTAssertEqual(confirm.cancelId, "tpl.inbox.deleteCancel")
        // The new message is the top row, from its recipient, and a read thread lost its dot.
        let top = try XCTUnwrap(model.rows.first)
        XCTAssertEqual(top.sender, "Sam Rivera")
        XCTAssertEqual(top.subject, "Lunch on Friday?")
        XCTAssertFalse(top.isUnread)
        XCTAssertEqual(model.rows.first { $0.id == "c-03" }?.isUnread, false)
        // The sent reply is the last message of its thread.
        let thread = try XCTUnwrap(model.panes.first { $0.id == "c-03" })
        XCTAssertEqual(thread.messages.last?.sender, "You")
        XCTAssertEqual(thread.messages.last?.body, ["Thanks, looking into it."])
        // The moved thread is no longer on Waiting.
        XCTAssertEqual(model.rows.first { $0.id == "c-05" }?.moveTargets.map(\.label), ["Inbox", "Escalations", "Waiting"])
    }

    func testTheSavedScreensDraw() throws {
        let model = try inbox("saved-inbox")
        let theme = try Library.theme("theme-astryx")
        let ax = AXStyle(mode: theme.light, isDark: false, scale: 1)
        let screen = InboxScreen(model: model)
            .environment(\.ax, ax)
            .environment(\.axStatic, true)
            .environment(\.axWidth, 1100)
            .frame(width: 1100)
        let renderer = ImageRenderer(content: screen)
        renderer.scale = 1
        XCTAssertNotNil(renderer.cgImage)
        let compose = InboxComposeForm(compose: model.compose, words: model.text.composer, inert: model.inert)
            .environment(\.ax, ax)
            .environment(\.axStatic, true)
            .frame(width: 560)
        XCTAssertNotNil(ImageRenderer(content: compose).cgImage)
    }

    // MARK: Chat

    func testSentMessagesAreItemsLikeTheSamples() throws {
        let model = try view("saved-chat").decode(TChatModel.self)
        XCTAssertEqual(model.items.count, 12)
        XCTAssertEqual(model.composer.draft, "")
        for item in model.items.suffix(2) {
            guard case .message(let message) = item else { return XCTFail("a sent message is a message item") }
            XCTAssertEqual(message.sender, .user)
            XCTAssertEqual(message.files, [])
            guard case .bubble(let bubble) = try XCTUnwrap(message.parts.first) else { return XCTFail("one bubble") }
            XCTAssertEqual(bubble.status, "delivered")
            XCTAssertEqual(bubble.time?.label, "9:30 AM")
            XCTAssertEqual(bubble.time?.at, "2026-10-13T09:30:00")
        }
        guard case .message(let last) = try XCTUnwrap(model.items.last), case .bubble(let bubble) = try XCTUnwrap(last.parts.first), case .text(let text) = bubble.content else { return XCTFail("text") }
        XCTAssertEqual(text, "Rename the flag to silent_refresh_v2.")
        // The first view has none.
        XCTAssertEqual(try view("template-chat").decode(TChatModel.self).items.count, 10)
    }
}
