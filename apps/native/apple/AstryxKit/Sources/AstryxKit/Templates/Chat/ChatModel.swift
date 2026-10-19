import SwiftUI

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
    case code(title: String, header: String, code: String)
    case artifact(label: String, title: String, caption: String)

    private enum Keys: String, CodingKey { case kind, text, tokens, title, header, code, label, caption }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: Keys.self)
        switch try c.decode(String.self, forKey: .kind) {
        case "text": self = .text(try c.decode(String.self, forKey: .text))
        case "mention": self = .mention(text: try c.decode(String.self, forKey: .text), tokens: try c.decode([TChatToken].self, forKey: .tokens))
        case "markdown": self = .markdown(try c.decode(String.self, forKey: .text))
        case "code":
            let title = try c.decode(String.self, forKey: .title)
            // The core's header line ("middleware.ts - typescript"); a core without one gives the title alone.
            self = .code(title: title, header: try c.decodeIfPresent(String.self, forKey: .header) ?? title, code: try c.decode(String.self, forKey: .code))
        case "artifact": self = .artifact(label: try c.decode(String.self, forKey: .label), title: try c.decode(String.self, forKey: .title), caption: try c.decode(String.self, forKey: .caption))
        case let other:
            throw DecodingError.dataCorruptedError(forKey: .kind, in: c, debugDescription: "unknown bubble content \(other)")
        }
    }
}

enum TChatPart: Decodable {
    case bubble(Bubble)
    case tools(expanded: Bool, label: String, calls: [TChatToolCall])
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

    private enum Keys: String, CodingKey { case kind, expanded, label, calls, time, footer }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: Keys.self)
        switch try c.decode(String.self, forKey: .kind) {
        case "bubble": self = .bubble(try Bubble(from: decoder))
        case "tools":
            self = .tools(
                expanded: try c.decode(Bool.self, forKey: .expanded),
                label: try c.decodeIfPresent(String.self, forKey: .label) ?? "",
                calls: try c.decode([TChatToolCall].self, forKey: .calls)
            )
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

/// The words the native drawing speaks and labels controls with (view.words in the core). A
/// model from an older core has none; they are then empty rather than invented here.
struct TChatWords: Decodable {
    struct Status: Decodable {
        var pending = ""
        var running = ""
        var complete = ""
        var error = ""
    }
    var mention = ""
    var attach = ""
    var send = ""
    var copy = ""
    var share = ""
    var closeDocument = ""
    var documentActions = ""
    var versions = ""
    var you = ""
    var expanded = ""
    var collapsed = ""
    var showCalls = ""
    var status = Status()
    var added = ""
    var removed = ""
    /// The word beside a delivered message's time ("Delivered").
    var delivered = ""

    static let empty = TChatWords()

    func word(_ status: TChatToolCall.Status) -> String {
        switch status {
        case .pending: self.status.pending
        case .running: self.status.running
        case .complete: self.status.complete
        case .error: self.status.error
        }
    }
}

private struct TChatWordsKey: EnvironmentKey { static let defaultValue = TChatWords.empty }

extension EnvironmentValues {
    var tChatWords: TChatWords {
        get { self[TChatWordsKey.self] }
        set { self[TChatWordsKey.self] = newValue }
    }
}

/// The hit side of a chat icon control: its drawn size, but never under 44 pt.
func tChatSide(_ ax: AXStyle) -> CGFloat { Swift.max(axMinTarget, 32 * Swift.min(ax.scale, 1.4)) }

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
    /// Controls the stock page draws but wires to nothing ("mention", "attach", "versions"); drawn enabled, like the web's.
    let inert: Set<String>
    let words: TChatWords
    let items: [TChatItem]
    let composer: Composer
    let artifact: Artifact

    private enum Keys: String, CodingKey { case inert, words, items, composer, artifact }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: Keys.self)
        inert = Set(try c.decodeIfPresent([String].self, forKey: .inert) ?? [])
        words = try c.decodeIfPresent(TChatWords.self, forKey: .words) ?? .empty
        items = try c.decode([TChatItem].self, forKey: .items)
        composer = try c.decode(Composer.self, forKey: .composer)
        artifact = try c.decode(Artifact.self, forKey: .artifact)
    }
}
