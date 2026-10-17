import XCTest
@testable import AstryxKit

/// The Codable mirrors of ui.ts against the fixtures the core wrote.
final class ProtocolTests: XCTestCase {
    func testThereAreFourteenAppFixturesAndFourThemes() throws {
        XCTAssertEqual(try Library.names(prefix: "app-").count, 14)
        XCTAssertEqual(try Library.names(prefix: "theme-").count, 4)
    }

    func testEveryAppFixtureDecodes() throws {
        for name in try Library.names(prefix: "app-") {
            let app = try Library.app(name)
            XCTAssertEqual(app.protocolVersion, 1, name)
            XCTAssertFalse(app.nav.isEmpty, name)
            XCTAssertEqual(app.screen.id, app.current, name)
        }
    }

    func testEveryThemeFixtureDecodes() throws {
        for name in try Library.names(prefix: "theme-") {
            let theme = try Library.theme(name)
            for mode in [theme.light, theme.dark] {
                XCTAssertEqual(mode.colors.count, 153, name)
                XCTAssertEqual(mode.sizes.count, 62, name)
            }
        }
    }

    /// No node of any fixture falls to the placeholder, so every kind in them has a view.
    func testNoFixtureNodeIsAPlaceholder() throws {
        var kinds = Set<String>()
        for name in try Library.names(prefix: "app-") {
            let app = try Library.app(name)
            for node in Library.walk(app.screen.body) {
                if case .unknown(let why) = node { XCTFail("\(name): placeholder for \(why)") }
                kinds.insert(node.kind)
            }
        }
        // The fixtures between them use most of the vocabulary.
        XCTAssertGreaterThanOrEqual(kinds.count, 30, "\(kinds.sorted())")
    }

    func testUnknownKindsAndBrokenNodesDecodeToAPlaceholder() throws {
        let json = """
        {"kind":"stack","axis":"vertical","gap":"md","children":[
          {"kind":"hologram","x":1},
          {"kind":"badge","text":"no tone field"},
          {"kind":"text","text":"fine","style":"body"}]}
        """
        let node = try JSONDecoder().decode(Node.self, from: Data(json.utf8))
        let children = node.children
        XCTAssertEqual(children.count, 3)
        if case .unknown(let why) = children[0] { XCTAssertEqual(why, "hologram") } else { XCTFail() }
        if case .unknown(let why) = children[1] { XCTAssertTrue(why.hasPrefix("badge")) } else { XCTFail() }
        if case .text = children[2] {} else { XCTFail("the good sibling still decodes") }
    }

    func testEveryIconOfTheContractMapsToASymbol() {
        let icons = [
            "home", "chart", "inbox", "check", "people", "gear", "cart", "calendar", "chat", "person",
            "star", "star-fill", "archive", "trash", "search", "plus", "chevron-left", "chevron-right",
            "arrow-up", "arrow-down", "bell", "lock", "mail", "sparkle", "grid", "filter", "send",
            "clock", "flag", "bolt", "heart", "info", "warning", "close", "undo", "card", "truck",
        ]
        XCTAssertEqual(icons.count, 37)
        for icon in icons {
            XCTAssertNotNil(Icon.symbols[icon], icon)
        }
        XCTAssertEqual(Set(Icon.symbols.keys), Set(icons), "no stray mappings")
    }

    func testActionsEncodeAsTheContractShapes() {
        XCTAssertEqual(Action.press(id: "inbox.select:m3").json, #"{"id":"inbox.select:m3","type":"press"}"#)
        XCTAssertEqual(Action.navigate(screen: "tasks").json, #"{"screen":"tasks","type":"navigate"}"#)
        XCTAssertEqual(Action.dismissToast.json, #"{"type":"dismissToast"}"#)
        XCTAssertEqual(Action.tick.json, #"{"type":"tick"}"#)
        XCTAssertEqual(Action.set(id: "a", value: .bool(true)).json, #"{"id":"a","type":"set","value":true}"#)
        XCTAssertEqual(Action.set(id: "a", value: .string("x/y")).json, #"{"id":"a","type":"set","value":"x/y"}"#)
        XCTAssertEqual(Action.set(id: "a", value: .number(60)).json, #"{"id":"a","type":"set","value":60}"#)
    }

    func testTheNewSnapshotFieldsDecode() throws {
        let dashboard = try Library.app("app-dashboard")
        XCTAssertEqual(dashboard.appName, "Astryx Swift")
        XCTAssertEqual(dashboard.theme.setId, "settings.theme")
        XCTAssertEqual(dashboard.theme.label, "Theme")
        let surface = try XCTUnwrap(dashboard.surface)
        XCTAssertEqual(surface.id, "app.surface")
        XCTAssertEqual(surface.options.map(\.value), ["native", "web", "stock", "compare", "all"])
        XCTAssertNotNil(surface.stockLabel)
        // An avatar's status words reach the node.
        let overview = try Library.app("app-overview")
        let labels = Library.walk(overview.screen.body).flatMap { node -> [String] in
            if case .avatar(let a) = node, let l = a.statusLabel { return [l] }
            return []
        }
        XCTAssertFalse(labels.isEmpty)
        // A stepper step may carry a selectId.
        let json = #"{"kind":"stepper","steps":[{"label":"A","state":"done","selectId":"x.step:0"},{"label":"B","state":"current"}]}"#
        guard case .stepper(let stepper) = try JSONDecoder().decode(Node.self, from: Data(json.utf8)) else { return XCTFail() }
        XCTAssertEqual(stepper.steps.map(\.selectId), ["x.step:0", nil])
    }

    func testSurfaceModesFallBackWhenTooNarrow() {
        XCTAssertEqual(SurfaceMode("compare").effective(width: 1099), .native)
        XCTAssertEqual(SurfaceMode("compare").effective(width: 1100), .compare)
        XCTAssertEqual(SurfaceMode("all").effective(width: 1599), .native)
        XCTAssertEqual(SurfaceMode("all").effective(width: 1600), .all)
        XCTAssertEqual(SurfaceMode("web").effective(width: 390), .web)
        XCTAssertEqual(SurfaceMode("nonsense").effective(width: 390), .native)
    }

    func testHexColors() {
        XCTAssertEqual(Color(hex: "#0064E0FF").description, Color(.sRGB, red: 0, green: 100.0 / 255, blue: 224.0 / 255, opacity: 1).description)
        XCTAssertEqual(Color(hex: "nonsense"), Color.clear)
    }
}

import SwiftUI
