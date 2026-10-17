import XCTest
@testable import AstryxKit

@MainActor
final class ModelTests: XCTestCase {
    func testReceiveFillsTheStores() throws {
        let model = AppModel(send: { _ in })
        XCTAssertNil(model.app)
        XCTAssertNil(model.theme)
        model.receive(store: "app", snapshotJSON: String(decoding: try Library.data("app-inbox"), as: UTF8.self))
        model.receive(store: "theme", snapshotJSON: String(decoding: try Library.data("theme-ocean"), as: UTF8.self))
        XCTAssertEqual(model.app?.current, "inbox")
        XCTAssertEqual(model.theme?.id, "ocean")
    }

    func testAnUndecodableSnapshotKeepsTheLastGoodScreen() throws {
        let model = AppModel.fixture(app: try Library.data("app-inbox"), theme: try Library.data("theme-astryx"))
        model.receive(store: "app", snapshotJSON: "{ not json")
        model.receive(store: "elsewhere", snapshotJSON: "{}")
        XCTAssertEqual(model.app?.current, "inbox")
    }

    func testActionsReachTheHostAsJSON() throws {
        var sent: [String] = []
        let model = AppModel(send: { sent.append($0) })
        model.perform(.press(id: "inbox.select:m3"))
        model.perform(.dismissToast)
        XCTAssertEqual(sent, [#"{"id":"inbox.select:m3","type":"press"}"#, #"{"type":"dismissToast"}"#])
    }

    func testFixtureModelFillsBoth() throws {
        let model = AppModel.fixture(app: try Library.data("app-tasks"), theme: try Library.data("theme-grape"))
        XCTAssertEqual(model.app?.screen.id, "tasks")
        XCTAssertEqual(model.theme?.label, "Grape")
    }

    func testTheClockTicksWhileRunningAndStopsWhenStopped() async throws {
        var sent: [String] = []
        let model = AppModel(send: { sent.append($0) }, tickEvery: .milliseconds(20))
        try await Task.sleep(for: .milliseconds(200))
        XCTAssertGreaterThanOrEqual(sent.count, 2)
        XCTAssertTrue(sent.allSatisfy { $0 == #"{"type":"tick"}"# })
        model.stopTicking()
        try await Task.sleep(for: .milliseconds(60))
        let count = sent.count
        try await Task.sleep(for: .milliseconds(100))
        XCTAssertEqual(sent.count, count, "stopped")
        model.startTicking()
        try await Task.sleep(for: .milliseconds(100))
        XCTAssertGreaterThan(sent.count, count, "resumed")
        model.stopTicking()
    }

    func testTheFixtureModelNeverTicks() async throws {
        let model = AppModel.fixture(app: try Library.data("app-tasks"), theme: try Library.data("theme-astryx"))
        model.startTicking()
        XCTAssertNotNil(model.app)
    }
}
