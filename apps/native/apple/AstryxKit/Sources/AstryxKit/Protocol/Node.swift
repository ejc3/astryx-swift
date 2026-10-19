import Foundation

/// A screen is a tree of these, mirrored from `Node` in core/src/ui.ts and decoded by `kind`.
/// A kind this kit does not know, or a node whose fields do not decode, becomes `.unknown`,
/// which draws as a visible placeholder: one bad node never fails the whole screen.
public indirect enum Node: Decodable, Sendable {
    case stack(StackNode)
    case grid(GridNode)
    case split(SplitNode)
    case card(CardNode)
    case section(SectionNode)
    case heading(HeadingNode)
    case text(TextNode)
    case badge(BadgeNode)
    case token(TokenNode)
    case button(ButtonNode)
    case iconButton(IconButtonNode)
    case textInput(TextInputNode)
    case toggle(SwitchNode)
    case checkbox(CheckboxNode)
    case radio(ChoiceNode)
    case segmented(ChoiceNode)
    case select(ChoiceNode)
    case slider(SliderNode)
    case progress(ProgressNode)
    case avatar(AvatarNode)
    case avatarGroup(AvatarGroupNode)
    case statusDot(StatusDotNode)
    case divider
    case kbd(KbdNode)
    case metric(MetricNode)
    case bars(BarsNode)
    case table(TableNode)
    case list(ListNode)
    case tabs(TabsNode)
    case stepper(StepperNode)
    case banner(BannerNode)
    case empty(EmptyNode)
    case metadata(MetadataNode)
    case pagination(PaginationNode)
    case calendar(CalendarNode)
    case chat(ChatNode)
    case board(BoardNode)
    /// A refactored Astryx template; drawn as a named placeholder until its own view exists.
    case template(TemplateNode)
    /// A kind this kit cannot draw; the associated value says which and why.
    case unknown(String)

    private enum Key: String, CodingKey { case kind }

    public init(from decoder: Decoder) throws {
        let kind = try decoder.container(keyedBy: Key.self).decode(String.self, forKey: .kind)
        do {
            switch kind {
            case "stack": self = .stack(try StackNode(from: decoder))
            case "grid": self = .grid(try GridNode(from: decoder))
            case "split": self = .split(try SplitNode(from: decoder))
            case "card": self = .card(try CardNode(from: decoder))
            case "section": self = .section(try SectionNode(from: decoder))
            case "heading": self = .heading(try HeadingNode(from: decoder))
            case "text": self = .text(try TextNode(from: decoder))
            case "badge": self = .badge(try BadgeNode(from: decoder))
            case "token": self = .token(try TokenNode(from: decoder))
            case "button": self = .button(try ButtonNode(from: decoder))
            case "iconButton": self = .iconButton(try IconButtonNode(from: decoder))
            case "textInput": self = .textInput(try TextInputNode(from: decoder))
            case "switch": self = .toggle(try SwitchNode(from: decoder))
            case "checkbox": self = .checkbox(try CheckboxNode(from: decoder))
            case "radio": self = .radio(try ChoiceNode(from: decoder))
            case "segmented": self = .segmented(try ChoiceNode(from: decoder))
            case "select": self = .select(try ChoiceNode(from: decoder))
            case "slider": self = .slider(try SliderNode(from: decoder))
            case "progress": self = .progress(try ProgressNode(from: decoder))
            case "avatar": self = .avatar(try AvatarNode(from: decoder))
            case "avatarGroup": self = .avatarGroup(try AvatarGroupNode(from: decoder))
            case "statusDot": self = .statusDot(try StatusDotNode(from: decoder))
            case "divider": self = .divider
            case "kbd": self = .kbd(try KbdNode(from: decoder))
            case "metric": self = .metric(try MetricNode(from: decoder))
            case "bars": self = .bars(try BarsNode(from: decoder))
            case "table": self = .table(try TableNode(from: decoder))
            case "list": self = .list(try ListNode(from: decoder))
            case "tabs": self = .tabs(try TabsNode(from: decoder))
            case "stepper": self = .stepper(try StepperNode(from: decoder))
            case "banner": self = .banner(try BannerNode(from: decoder))
            case "empty": self = .empty(try EmptyNode(from: decoder))
            case "metadata": self = .metadata(try MetadataNode(from: decoder))
            case "pagination": self = .pagination(try PaginationNode(from: decoder))
            case "calendar": self = .calendar(try CalendarNode(from: decoder))
            case "chat": self = .chat(try ChatNode(from: decoder))
            case "board": self = .board(try BoardNode(from: decoder))
            case "template": self = .template(try TemplateNode(from: decoder))
            default: self = .unknown(kind)
            }
        } catch {
            self = .unknown("\(kind) (does not decode)")
        }
    }

    /// The `kind` string of ui.ts for this node; the placeholder reports the one it could not draw.
    public var kind: String {
        switch self {
        case .stack: "stack"
        case .grid: "grid"
        case .split: "split"
        case .card: "card"
        case .section: "section"
        case .heading: "heading"
        case .text: "text"
        case .badge: "badge"
        case .token: "token"
        case .button: "button"
        case .iconButton: "iconButton"
        case .textInput: "textInput"
        case .toggle: "switch"
        case .checkbox: "checkbox"
        case .radio: "radio"
        case .segmented: "segmented"
        case .select: "select"
        case .slider: "slider"
        case .progress: "progress"
        case .avatar: "avatar"
        case .avatarGroup: "avatarGroup"
        case .statusDot: "statusDot"
        case .divider: "divider"
        case .kbd: "kbd"
        case .metric: "metric"
        case .bars: "bars"
        case .table: "table"
        case .list: "list"
        case .tabs: "tabs"
        case .stepper: "stepper"
        case .banner: "banner"
        case .empty: "empty"
        case .metadata: "metadata"
        case .pagination: "pagination"
        case .calendar: "calendar"
        case .chat: "chat"
        case .board: "board"
        case .template: "template"
        case .unknown(let why): why
        }
    }

    /// The direct children, for walking a tree.
    public var children: [Node] {
        switch self {
        case .stack(let n): n.children
        case .grid(let n): n.children
        case .split(let n): [n.primary, n.detail]
        case .card(let n): n.children
        case .section(let n): n.children
        default: []
        }
    }
}

// MARK: Layout

public struct StackNode: Decodable, Sendable {
    public enum Axis: String, Decodable, Sendable { case vertical, horizontal }
    public enum Align: String, Decodable, Sendable { case start, center, end, spread }
    public let axis: Axis
    public let gap: Gap
    public let align: Align?
    public let wrap: Bool?
    public let children: [Node]
}

public struct GridNode: Decodable, Sendable {
    public let minColumnWidth: Double
    public let gap: Gap
    public let children: [Node]
}

public struct SplitNode: Decodable, Sendable {
    public let primary: Node
    public let detail: Node
    public let showDetailWhenNarrow: Bool
    public let backId: String?
    public let backLabel: String?
}

public struct CardNode: Decodable, Sendable {
    public let title: String?
    public let subtitle: String?
    public let action: ButtonNode?
    public let children: [Node]
}

public struct SectionNode: Decodable, Sendable {
    public let title: String
    public let description: String?
    public let children: [Node]
}

// MARK: Text and marks

public struct HeadingNode: Decodable, Sendable {
    public let text: String
    public let level: Int
}

public struct TextNode: Decodable, Sendable {
    public enum Style: String, Decodable, Sendable { case body, secondary, caption, emphasis, code }
    public let text: String
    public let style: Style
    public let tone: Tone?

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        text = try c.decode(String.self, forKey: .text)
        style = (try? c.decode(Style.self, forKey: .style)) ?? .body
        tone = try c.decodeIfPresent(Tone.self, forKey: .tone)
    }
    private enum CodingKeys: String, CodingKey { case text, style, tone }
}

public struct BadgeNode: Decodable, Sendable {
    public let text: String
    public let tone: Tone
}

public struct TokenNode: Decodable, Sendable {
    public let text: String
    public let tone: Tone
    public let removeId: String?
}

public struct ButtonNode: Decodable, Sendable {
    public enum Variant: String, Decodable, Sendable { case primary, secondary, ghost, destructive }
    public let id: String
    public let label: String
    public let variant: Variant
    public let icon: Icon?
    public let disabled: Bool?

    private enum CodingKeys: String, CodingKey { case id, label, variant, icon, disabled }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        label = try c.decode(String.self, forKey: .label)
        variant = (try? c.decode(Variant.self, forKey: .variant)) ?? .secondary
        icon = try c.decodeIfPresent(Icon.self, forKey: .icon)
        disabled = try c.decodeIfPresent(Bool.self, forKey: .disabled)
    }
}

public struct IconButtonNode: Decodable, Sendable {
    public let id: String
    public let icon: Icon
    public let label: String
    public let selected: Bool?
}

// MARK: Inputs

public struct TextInputNode: Decodable, Sendable {
    public let id: String
    public let label: String
    public let value: String
    public let placeholder: String
    public let error: String?
    public let hint: String?
    public let secure: Bool?
    public let multiline: Bool?
    public let icon: Icon?
}

public struct SwitchNode: Decodable, Sendable {
    public let id: String
    public let label: String
    public let description: String?
    public let on: Bool
}

public struct CheckboxNode: Decodable, Sendable {
    public let id: String
    public let label: String
    public let checked: Bool
}

/// The radio, segmented and select nodes share one shape.
public struct ChoiceNode: Decodable, Sendable {
    public let id: String
    public let label: String
    public let options: [Option]
    public let value: String
}

public struct SliderNode: Decodable, Sendable {
    public let id: String
    public let label: String
    public let value: Double
    public let min: Double
    public let max: Double
    public let step: Double
    public let valueText: String
}

public struct TabsNode: Decodable, Sendable {
    public struct Tab: Decodable, Sendable {
        public let value: String
        public let label: String
        public let description: String?
        public let count: String?
    }
    public let id: String
    public let tabs: [Tab]
    public let value: String
}

// MARK: Display

public struct ProgressNode: Decodable, Sendable {
    public let label: String
    public let value: Double
    public let valueText: String
    public let tone: Tone
}

public struct AvatarNode: Decodable, Sendable {
    public enum Size: String, Decodable, Sendable { case sm, md, lg }
    public let name: String
    public let initials: String
    public let hue: Double
    public let size: Size
    public let status: Tone?
    /// The status dot's words, for accessibility.
    public let statusLabel: String?

    private enum CodingKeys: String, CodingKey { case name, initials, hue, size, status, statusLabel }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        name = try c.decode(String.self, forKey: .name)
        initials = try c.decode(String.self, forKey: .initials)
        hue = try c.decode(Double.self, forKey: .hue)
        size = (try? c.decode(Size.self, forKey: .size)) ?? .md
        status = try c.decodeIfPresent(Tone.self, forKey: .status)
        statusLabel = try c.decodeIfPresent(String.self, forKey: .statusLabel)
    }
}

public struct AvatarGroupNode: Decodable, Sendable {
    public let people: [Person]
    public let more: String?
}

public struct StatusDotNode: Decodable, Sendable {
    public let tone: Tone
    public let label: String
}

public struct KbdNode: Decodable, Sendable {
    public let keys: [String]
}

public struct MetricNode: Decodable, Sendable {
    public struct Delta: Decodable, Sendable {
        public let text: String
        public let tone: Tone
        public let up: Bool
    }
    public let label: String
    public let value: String
    public let delta: Delta?
    public let trend: [Double]?
}

public struct BarsNode: Decodable, Sendable {
    public struct Bar: Decodable, Sendable {
        public let label: String
        public let value: Double
        public let valueText: String
        public let highlight: Bool
    }
    public let label: String
    public let bars: [Bar]
}

public struct StepperNode: Decodable, Sendable {
    public struct Step: Decodable, Sendable {
        public enum State: String, Decodable, Sendable { case done, current, upcoming }
        public let label: String
        public let state: State
        /// Pressing the step sends `press` with this id, when the core allows going to it.
        public let selectId: String?

        private enum CodingKeys: String, CodingKey { case label, state, selectId }
        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            label = try c.decode(String.self, forKey: .label)
            state = (try? c.decode(State.self, forKey: .state)) ?? .upcoming
            selectId = try c.decodeIfPresent(String.self, forKey: .selectId)
        }
    }
    public let steps: [Step]
}

public struct BannerNode: Decodable, Sendable {
    public let tone: Tone
    public let title: String
    public let text: String
    public let action: ButtonNode?
    public let dismissId: String?
}

public struct EmptyNode: Decodable, Sendable {
    public let icon: Icon
    public let title: String
    public let text: String
    public let action: ButtonNode?
}

public struct MetadataNode: Decodable, Sendable {
    public struct Item: Decodable, Sendable {
        public let label: String
        public let value: String
    }
    public let items: [Item]
}

public struct PaginationNode: Decodable, Sendable {
    public let label: String
    public let previousId: String?
    public let nextId: String?
    /// The step buttons' names for assistive technology; a core without them gives none.
    public let previousLabel: String?
    public let nextLabel: String?
}

// MARK: Collections

public struct Cell: Decodable, Sendable {
    public struct Badge: Decodable, Sendable {
        public let text: String
        public let tone: Tone
    }
    public enum Align: String, Decodable, Sendable { case start, end }
    public let text: String
    public let secondary: String?
    public let badge: Badge?
    public let avatar: Person?
    public let align: Align?
}

public struct TableNode: Decodable, Sendable {
    public struct Column: Decodable, Sendable {
        public enum Sort: String, Decodable, Sendable { case asc, desc, none }
        public let id: String
        public let label: String
        public let align: Cell.Align
        public let sort: Sort?
        public let sortId: String?

        private enum CodingKeys: String, CodingKey { case id, label, align, sort, sortId }
        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            id = try c.decode(String.self, forKey: .id)
            label = try c.decode(String.self, forKey: .label)
            align = (try? c.decode(Cell.Align.self, forKey: .align)) ?? .start
            sort = try? c.decodeIfPresent(Sort.self, forKey: .sort)
            sortId = try c.decodeIfPresent(String.self, forKey: .sortId)
        }
    }
    public struct Row: Decodable, Sendable {
        public let id: String
        public let cells: [Cell]
        public let selected: Bool
        public let selectId: String?
    }
    public let columns: [Column]
    public let rows: [Row]
    public let empty: String
}

public struct ListItem: Decodable, Sendable {
    public enum Leading: Decodable, Sendable {
        case avatar(Person)
        case icon(Icon, Tone)

        private enum CodingKeys: String, CodingKey { case avatar, icon, tone }
        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            if let person = try c.decodeIfPresent(Person.self, forKey: .avatar) {
                self = .avatar(person)
            } else {
                self = .icon(try c.decode(Icon.self, forKey: .icon), try c.decodeIfPresent(Tone.self, forKey: .tone) ?? .neutral)
            }
        }
    }
    public struct Trailing: Decodable, Sendable {
        public let text: String
        public let tone: Tone
    }
    public let id: String
    public let title: String
    public let subtitle: String?
    public let meta: String?
    public let leading: Leading?
    public let trailing: Trailing?
    public let emphasized: Bool
    public let selected: Bool
    public let selectId: String?
}

public struct ListNode: Decodable, Sendable {
    public let items: [ListItem]
    public let empty: String
}

public struct CalendarDay: Decodable, Sendable {
    public let label: String
    public let inMonth: Bool
    public let today: Bool
    public let selected: Bool
    public let dots: [Tone]
    public let selectId: String?
}

public struct CalendarNode: Decodable, Sendable {
    public let title: String
    public let weekdays: [String]
    public let weeks: [[CalendarDay]]
    public let previousId: String
    public let nextId: String
    public let previousLabel: String
    public let nextLabel: String
}

public struct ChatMessage: Decodable, Sendable {
    public let id: String
    public let author: String
    public let initials: String
    public let hue: Double
    public let mine: Bool
    public let text: String
    public let time: String
}

public struct ChatNode: Decodable, Sendable {
    public struct Composer: Decodable, Sendable {
        public let id: String
        public let value: String
        public let placeholder: String
        public let sendId: String
        public let sendLabel: String
        public let canSend: Bool
    }
    public let messages: [ChatMessage]
    public let composer: Composer
}

public struct BoardCard: Decodable, Sendable {
    public struct Tag: Decodable, Sendable {
        public let text: String
        public let tone: Tone
    }
    public let id: String
    public let title: String
    public let tags: [Tag]
    public let assignee: Person
    public let due: String
    public let dueTone: Tone
    public let moveBackId: String?
    public let moveForwardId: String?
    public let moveBackLabel: String
    public let moveForwardLabel: String
}

public struct BoardColumn: Decodable, Sendable {
    public let id: String
    public let title: String
    public let count: String
    public let cards: [BoardCard]
}

public struct BoardNode: Decodable, Sendable {
    public let columns: [BoardColumn]
    /// The board's own width below which its columns stack one above the other (the core's rule,
    /// which the web page follows too). Older cores send none: the columns then never stack.
    public let stackBelow: Double?
}

/// `template`: a screen the core hands over as a typed view model for one Astryx template
/// (core/src/templates/<id>/model.ts). `view` is decoded by that template's own view
/// (Templates/<Id>/), into a Swift mirror of the model's `View` type.
public struct TemplateNode: Decodable, Sendable {
    public let template: String
    public let view: JSONValue
}
