import Foundation

/// The color roles Astryx's components take. An unknown name draws as neutral.
public enum Tone: String, Codable, Sendable, CaseIterable {
    case neutral, accent, success, warning, danger, info

    public init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = Tone(rawValue: raw) ?? .neutral
    }
}

/// The spacing between children of a stack or grid. An unknown name draws as medium.
public enum Gap: String, Codable, Sendable, CaseIterable {
    case xs, sm, md, lg

    public init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = Gap(rawValue: raw) ?? .md
    }
}

/// A named icon. Each host maps a name to its own glyph; this one maps it to an SF Symbol.
/// A name this kit does not know draws as a plain circle rather than failing the screen.
public struct Icon: Codable, Sendable, Hashable, RawRepresentable {
    public let rawValue: String
    public init(rawValue: String) { self.rawValue = rawValue }
    public init(from decoder: Decoder) throws {
        rawValue = try decoder.singleValueContainer().decode(String.self)
    }
    public func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        try c.encode(rawValue)
    }

    /// Every name in `ICONS` of core/src/ui.ts, with its SF Symbol.
    public static let symbols: [String: String] = [
        "home": "house", "chart": "chart.bar", "inbox": "tray", "check": "checkmark",
        "people": "person.2", "gear": "gearshape", "cart": "cart", "calendar": "calendar",
        "chat": "bubble.left", "person": "person", "star": "star",
        "star-fill": "star.fill", "archive": "archivebox", "trash": "trash",
        "search": "magnifyingglass", "plus": "plus", "chevron-left": "chevron.left",
        "chevron-right": "chevron.right", "arrow-up": "arrow.up", "arrow-down": "arrow.down",
        "bell": "bell", "lock": "lock", "mail": "envelope", "sparkle": "sparkles",
        "grid": "square.grid.2x2", "filter": "line.3.horizontal.decrease", "send": "paperplane",
        "clock": "clock", "flag": "flag", "bolt": "bolt", "heart": "heart", "info": "info.circle",
        "warning": "exclamationmark.triangle", "close": "xmark", "undo": "arrow.uturn.backward",
        "card": "creditcard", "truck": "box.truck",
    ]

    public var symbol: String { Icon.symbols[rawValue] ?? "circle" }
}

/// One choice of a radio group, segmented control, select or tab list.
public struct Option: Codable, Sendable, Hashable {
    public let value: String
    public let label: String
    public let description: String?
}

/// A person's mark: initials on a tint chosen by `hue` (degrees).
public struct Person: Codable, Sendable, Hashable {
    public let initials: String
    public let hue: Double
}
