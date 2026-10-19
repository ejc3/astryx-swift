import Foundation

/// What the host sends back, encoded exactly as the `Action` of core/src/ui.ts.
public enum Action: Encodable, Sendable, Equatable {
    case navigate(screen: String)
    case press(id: String)
    case set(id: String, value: Value)
    case dismissToast
    /// The host's clock moved (once a minute), so times like "12m" stay true.
    case tick

    public enum Value: Encodable, Sendable, Equatable {
        case string(String)
        case number(Double)
        case bool(Bool)

        public func encode(to encoder: Encoder) throws {
            var c = encoder.singleValueContainer()
            switch self {
            case .string(let v): try c.encode(v)
            case .number(let v): try c.encode(v)
            case .bool(let v): try c.encode(v)
            }
        }
    }

    private enum CodingKeys: String, CodingKey { case type, screen, id, value }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .navigate(let screen):
            try c.encode("navigate", forKey: .type)
            try c.encode(screen, forKey: .screen)
        case .press(let id):
            try c.encode("press", forKey: .type)
            try c.encode(id, forKey: .id)
        case .set(let id, let value):
            try c.encode("set", forKey: .type)
            try c.encode(id, forKey: .id)
            try c.encode(value, forKey: .value)
        case .dismissToast:
            try c.encode("dismissToast", forKey: .type)
        case .tick:
            try c.encode("tick", forKey: .type)
        }
    }

    /// The JSON the host's `send` closure receives.
    public var json: String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        guard let data = try? encoder.encode(self) else { return "{}" }
        return String(decoding: data, as: UTF8.self)
    }
}
