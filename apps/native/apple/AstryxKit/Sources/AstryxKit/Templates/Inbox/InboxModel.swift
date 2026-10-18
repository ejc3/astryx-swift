import Foundation

/// The inbox template's view model: a mirror of the `View` type of
/// core/src/templates/inbox/model.ts, field for field.
struct InboxModel: Decodable, Equatable {
    var text: Words
    /// "3 unread of 9 conversations", as separate text pieces; joined to read it.
    var subtitle: [String]
    var tab: String
    var tabs: [Tab]
    var rows: [Row]
    /// Every ticked row id, including ones on other tabs.
    var selectedKeys: [String]
    /// Whether the bulk-selection band replaces the tab strip.
    var hasSelection: Bool
    var selectionLabel: [String]
    var bulkActions: [BulkAction]
    var openId: String?
    var mode: Mode
    /// Ids of the controls the core has no action for ("refresh", "archive", "send"...): drawn disabled.
    var inert: [String]
    /// Pixel width of the web's trailing "Received" column (the web's measurement; not used natively).
    var receivedWidth: Double
    var pane: Pane?
    var compose: Compose

    struct Words: Decodable, Equatable {
        var title: String
        var refresh: String
        var compose: String
        var unselectAll: String
        var bullet: String
        var unreadStatus: String
        var unreadSuffix: String
        var hasAttachments: String
        /// Spoken state of a row's tick box.
        var selected: String
        var notSelected: String
        var empty: Empty
        var columns: Columns
        var pane: PaneText
        var composer: Composer

        struct Empty: Decodable, Equatable { var title: String; var description: String; var action: String }
        struct Columns: Decodable, Equatable {
            var conversation: String
            var from: String
            var subject: String
            var tags: String
            var received: String
        }
        struct PaneText: Decodable, Equatable {
            var label: String
            var resizeLabel: String
            var resizeUnit: String
            var back: String
            var close: String
            var closeTooltip: String
            var reply: String
            var replyAll: String
            var previous: String
            var next: String
            var expanded: String
            var collapsed: String
            var expandHint: String
            var collapseHint: String
        }
        struct Composer: Decodable, Equatable {
            var sheetLabel: String
            var toolbarLabel: String
            var heading: String
            var close: String
            var closeTooltip: String
            var recipient: String
            var cc: String
            var bcc: String
            var subject: String
            var body: String
            var bodyPlaceholder: String
            var actionsLabel: String
            var send: String
            var discard: String
            var cancel: String
            var discardTitle: String
            var discardAction: String
            var saveDraft: String
            var keepEditing: String
            var remove: String
            var tools: [Tool]
            struct Tool: Decodable, Equatable { var id: String; var label: String }
        }
    }

    struct Tab: Decodable, Equatable, Identifiable {
        var value: String
        var label: String
        var badge: Int?
        var id: String { value }
    }

    /// A priority or tag chip color: "red", "orange" or "default".
    enum TokenColor: String, Decodable, Equatable {
        case red, orange, `default`
        init(from decoder: Decoder) throws {
            let raw = try decoder.singleValueContainer().decode(String.self)
            self = TokenColor(rawValue: raw) ?? .default
        }
    }

    struct Token: Decodable, Equatable {
        var label: String
        var color: TokenColor
    }

    /// "archive" | "move" | "delete" | "reply". An id this kit does not know keeps its label.
    struct RowAction: Decodable, Equatable, Identifiable {
        var id: String
        var label: String
        var ariaLabel: String
    }

    struct BulkAction: Decodable, Equatable, Identifiable {
        var id: String
        var label: String
    }

    struct Row: Decodable, Equatable, Identifiable {
        var id: String
        var sender: String
        var subject: String
        var preview: String
        var receivedAt: String
        var isUnread: Bool
        var hasAttachments: Bool
        var isOpen: Bool
        /// The unread status gutter's label, or nil for a read thread.
        var status: String?
        var selectionLabel: String
        var priority: Token?
        var tags: [String]
        var actions: [RowAction]
    }

    struct Attachment: Decodable, Equatable, Identifiable {
        var id: String
        var name: String
        var src: String
        var previewAlt: String
        var lightboxAlt: String
    }

    struct Message: Decodable, Equatable, Identifiable {
        var id: String
        var sender: String
        var senderEmail: String
        var receivedFull: String
        var body: [String]
        var attachments: [Attachment]
        /// "2 attachments" as separate text pieces, or [] when there are none.
        var attachmentsLabel: [String]
        /// The open attachment's index when this message's viewer is open.
        var lightboxIndex: Int?
    }

    struct Pane: Decodable, Equatable, Identifiable {
        var id: String
        var subject: String
        var priority: Token?
        var tags: [String]
        var messages: [Message]
        /// Expanded message ids.
        var openMessages: [String]
        var actions: [RowAction]
    }

    struct Mode: Decodable, Equatable {
        var isSingleSurface: Bool
        var isPaneFullWidth: Bool
        var isStacked: Bool
        var isTight: Bool
        var isTouch: Bool
        /// The widths the core holds (0 = not measured yet).
        var measured: Measured
        struct Measured: Decodable, Equatable { var surface: Int; var list: Int }
    }

    struct Person: Codable, Equatable, Identifiable, Hashable {
        var id: String
        var label: String
    }

    struct Compose: Decodable, Equatable {
        var isOpen: Bool
        var recipients: [Person]
        var cc: [Person]
        var bcc: [Person]
        var hasCc: Bool
        var hasBcc: Bool
        var subject: String
        var body: String
        /// Everybody the inbox has heard from, offered as recipients.
        var directory: [Person]
        /// Whether the draft holds typed content that cancelling would lose.
        var isDirty: Bool
    }

    /// Whether the core has no action behind this control, so it is drawn disabled.
    func isInert(_ id: String) -> Bool { inert.contains(id) }
}
