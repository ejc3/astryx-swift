import Foundation

/// The chat template's view model: a Swift mirror of `ChatView` in
/// core/src/templates/chat/model.ts. The unions of that file (`kind`) are enums here, and
/// a `kind` this kit does not know fails the decode, which shows the placeholder.

struct TChatStamp: Decodable {
    /// An ISO instant without zone, "2026-04-29T10:15:00".
    let at: String
    /// "10:15 AM".
    let label: String
}

struct TChatToken: Decodable {
    let value: String
    let label: String
    let variant: String
}

struct TChatToolCall: Decodable {
    enum Status: String, Decodable { case pending, running, complete, error }
    let name: String
    let target: String
    let status: Status
    let duration: String?
    let node: String?
    let additions: Double?
    let deletions: Double?
}

enum TChatContent: Decodable {
    case text(String)
    case mention(text: String, tokens: [TChatToken])
    case markdown(String)
    case code(title: String, language: String, code: String)
    case artifact(label: String, title: String, caption: String)

    private enum Keys: String, CodingKey { case kind, text, tokens, title, language, code, label, caption }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: Keys.self)
        switch try c.decode(String.self, forKey: .kind) {
        case "text": self = .text(try c.decode(String.self, forKey: .text))
        case "mention": self = .mention(text: try c.decode(String.self, forKey: .text), tokens: try c.decode([TChatToken].self, forKey: .tokens))
        case "markdown": self = .markdown(try c.decode(String.self, forKey: .text))
        case "code": self = .code(title: try c.decode(String.self, forKey: .title), language: try c.decode(String.self, forKey: .language), code: try c.decode(String.self, forKey: .code))
        case "artifact": self = .artifact(label: try c.decode(String.self, forKey: .label), title: try c.decode(String.self, forKey: .title), caption: try c.decode(String.self, forKey: .caption))
        case let other:
            throw DecodingError.dataCorruptedError(forKey: .kind, in: c, debugDescription: "unknown bubble content \(other)")
        }
    }
}

enum TChatPart: Decodable {
    case bubble(Bubble)
    case tools(expanded: Bool, calls: [TChatToolCall])
    case meta(time: TChatStamp, footer: String?)

    struct Bubble: Decodable {
        /// "ghost": no bubble ground (an assistant's own words).
        let variant: String?
        /// "first" or "last" in a run of bubbles.
        let group: String?
        let width: String?
        let time: TChatStamp?
        let status: String?
        let content: TChatContent

        var isGhost: Bool { variant == "ghost" }
    }

    private enum Keys: String, CodingKey { case kind, expanded, calls, time, footer }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: Keys.self)
        switch try c.decode(String.self, forKey: .kind) {
        case "bubble": self = .bubble(try Bubble(from: decoder))
        case "tools": self = .tools(expanded: try c.decode(Bool.self, forKey: .expanded), calls: try c.decode([TChatToolCall].self, forKey: .calls))
        case "meta": self = .meta(time: try c.decode(TChatStamp.self, forKey: .time), footer: try c.decodeIfPresent(String.self, forKey: .footer))
        case let other:
            throw DecodingError.dataCorruptedError(forKey: .kind, in: c, debugDescription: "unknown part \(other)")
        }
    }
}

enum TChatItem: Decodable {
    case divider(String)
    case status(String)
    case message(TChatMessage)

    private enum Keys: String, CodingKey { case kind, text }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: Keys.self)
        switch try c.decode(String.self, forKey: .kind) {
        case "divider": self = .divider(try c.decode(String.self, forKey: .text))
        case "status": self = .status(try c.decode(String.self, forKey: .text))
        case "message": self = .message(try TChatMessage(from: decoder))
        case let other:
            throw DecodingError.dataCorruptedError(forKey: .kind, in: c, debugDescription: "unknown item \(other)")
        }
    }
}

struct TChatMessage: Decodable, Identifiable {
    enum Sender: String, Decodable { case user, assistant }
    let id: String
    let sender: Sender
    /// The assistant's avatar name.
    let avatar: String?
    let files: [String]
    let parts: [TChatPart]
}

struct TChatModel: Decodable {
    struct Composer: Decodable {
        struct Mode: Decodable, Identifiable {
            let id: String
            let label: String
        }
        let draft: String
        let placeholder: String
        let mode: String
        let modeLabel: String
        let modes: [Mode]
    }
    struct Artifact: Decodable {
        let title: String
        let subtitle: String
        let content: String
        let versions: [String]
        let panelOpen: Bool
        let dialogOpen: Bool
    }
    let items: [TChatItem]
    let composer: Composer
    let artifact: Artifact
}
