import Foundation
import XCTest
@testable import AstryxKit

/// The fixtures core/scripts/fixtures.ts writes, copied into the test bundle.
enum Library {
    static var directory: URL {
        Bundle.module.url(forResource: "Fixtures", withExtension: nil)!
    }

    /// Fixture names without extension, e.g. `app-inbox`.
    static func names(prefix: String) throws -> [String] {
        try FileManager.default.contentsOfDirectory(atPath: directory.path)
            .filter { $0.hasPrefix(prefix) && $0.hasSuffix(".json") }
            .map { String($0.dropLast(".json".count)) }
            .sorted()
    }

    static func data(_ name: String) throws -> Data {
        try Data(contentsOf: directory.appendingPathComponent(name + ".json"))
    }

    static func app(_ name: String) throws -> AppSnapshot {
        try JSONDecoder().decode(AppSnapshot.self, from: data(name))
    }

    /// A fixture with its `surface.value` replaced, to draw it in another layout.
    static func app(_ name: String, surface: String) throws -> AppSnapshot {
        var json = try XCTUnwrap(JSONSerialization.jsonObject(with: data(name)) as? [String: Any])
        var choice = try XCTUnwrap(json["surface"] as? [String: Any])
        choice["value"] = surface
        json["surface"] = choice
        return try JSONDecoder().decode(AppSnapshot.self, from: JSONSerialization.data(withJSONObject: json))
    }

    static func theme(_ name: String) throws -> ResolvedTheme {
        try JSONDecoder().decode(ResolvedTheme.self, from: data(name))
    }

    /// Every node of a tree, the node itself first. Nodes held by buttons-in-cards and the
    /// toolbar are not `Node`s, so they are not in it.
    static func walk(_ node: Node) -> [Node] {
        [node] + node.children.flatMap(walk)
    }
}
