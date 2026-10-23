import SwiftUI

/// What a row or thread action does here. Archive and Delete press the core's action for the
/// thread (Delete asks first: the model's `confirm` draws the question) unless the model lists
/// them as `inert` (stock Astryx: they are drawn enabled as the web draws them, and do nothing).
/// Move to folder is a menu of the model's `moveTargets` (`InboxIconMenu`), not a single action.
/// "Reply" on a row opens that thread and starts the reply, both actions the core has.
@MainActor
func inboxPerform(_ action: String, row id: String, send: AXSender, inert: [String]) {
    switch action {
    case "reply":
        send(.press(id: inboxAction("open:\(id)")))
        send(.press(id: inboxAction("reply")))
    case "archive", "delete":
        guard !inert.contains(action) else { return }
        send(.press(id: inboxAction("\(action):\(id)")))
    default:
        return
    }
}

/// Makes `thread` the core's open thread before an action that works on the core's open thread
/// (Reply, Reply all, expanding a message). A thread this drawing opens only because there is
/// room (the person chose none) is not the core's until it is chosen; one the person already
/// chose is, and nothing is sent.
@MainActor
func inboxAdopt(_ thread: String, in model: InboxModel, send: AXSender) {
    guard model.choice.openIdExplicit != thread else { return }
    send(.press(id: inboxAction("open:\(thread)")))
}

/// The buttons of a row's context menu and accessibility actions; the ones the core cannot do are disabled.
struct InboxRowMenu: View {
    let row: InboxModel.Row
    let actions: [InboxModel.RowAction]
    let inert: [String]
    @Environment(\.axSend) private var send

    var body: some View {
        ForEach(actions) { action in
            if action.id == "move" && !inert.contains("move") {
                Menu {
                    ForEach(row.moveTargets) { target in
                        Button(target.label) { send(.press(id: target.id)) }
                    }
                } label: {
                    Label(action.label, systemImage: inboxSymbol(action.id))
                }
            } else {
                Button(role: action.id == "delete" ? .destructive : nil) {
                    inboxPerform(action.id, row: row.id, send: send, inert: inert)
                } label: {
                    Label(action.label, systemImage: inboxSymbol(action.id))
                }
            }
        }
    }
}

// MARK: Row

/// One conversation. Stacked (a narrow list) it reads sender, time, subject, preview and tokens
/// in a column of lines, as a phone mail list does; wide it is a table row: a checkbox, the unread
/// dot, From, Subject and preview, Tags and Received.
struct InboxRowView: View {
    let row: InboxModel.Row
    let layout: InboxLayout
    let isOpen: Bool
    let words: InboxModel.Words
    let inert: [String]
    let selected: Bool
    let showTags: Bool
    let onToggle: () -> Void
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send
    @State private var hovering = false

    private let fromWidth = InboxColumns.from
    private let tagsWidth = InboxColumns.tags
    private let receivedWidth = InboxColumns.received

    private var showsHoverActions: Bool { hovering && !layout.isTouch && !layout.isStacked }

    var body: some View {
        // The unread dot sits in a gutter left of the checkbox (the web's row-status column).
        HStack(alignment: .center, spacing: ax.space(3)) {
            Circle()
                .fill(row.status == nil ? Color.clear : ax.accent)
                .frame(width: InboxColumns.dot, height: InboxColumns.dot)
                .accessibilityHidden(true)
            if !layout.isStacked {
                InboxCheckbox(checked: selected, label: row.selectionLabel, selected: words.selected, notSelected: words.notSelected, action: onToggle)
            }
            Button {
                send(.press(id: inboxAction("open:\(row.id)")))
            } label: {
                Group { if layout.isStacked { stacked } else { wide } }
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(accessibilityLabel)
            .accessibilityValue(row.preview)
            .accessibilityAddTraits(isOpen ? .isSelected : [])
        }
        .padding(.horizontal, ax.space(4))
        .padding(.vertical, ax.space(2))
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(background)
        .overlay(alignment: .trailing) { hoverActions.padding(.trailing, ax.space(4)) }
        .onHover { hovering = $0 }
        .contextMenu { InboxRowMenu(row: row, actions: layout.actions(of: row), inert: inert) }
    }

    /// On a pointer that hovers, the row's actions take the timestamp's place under the cursor.
    @ViewBuilder
    private var hoverActions: some View {
        if showsHoverActions {
            HStack(spacing: ax.hair) {
                ForEach(layout.actions(of: row)) { action in
                    if action.id == "move" && !inert.contains("move") {
                        InboxIconMenu(symbol: inboxSymbol(action.id), label: action.ariaLabel, help: action.label, targets: row.moveTargets)
                    } else {
                        InboxIconButton(symbol: inboxSymbol(action.id), label: action.ariaLabel, help: action.label) {
                            inboxPerform(action.id, row: row.id, send: send, inert: inert)
                        }
                    }
                }
            }
            .frame(width: receivedWidth, alignment: .trailing)
        }
    }

    private var background: Color {
        if isOpen { return ax.accentMuted }
        if selected { return ax.accentMuted.opacity(0.55) }
        return hovering ? ax.overlayHover : .clear
    }

    private var accessibilityLabel: String {
        [row.status, row.sender, row.subject, row.receivedAt, row.hasAttachments ? words.hasAttachments : nil]
            .compactMap { $0 }.joined(separator: ", ")
    }

    private var weight: String { row.isUnread ? "font-weight-semibold" : "font-weight-normal" }

    /// The core's stacked mode (`inbox.tsx`): the sender (semibold while unread) over the subject
    /// (secondary, regular, one line) on the left, the time at the end. No preview, no chips.
    private var stacked: some View {
        HStack(alignment: .center, spacing: ax.space(2)) {
            VStack(alignment: .leading, spacing: ax.hair) {
                Text(row.sender)
                    .font(ax.font("font-size-base", 14, weight: weight))
                    .foregroundStyle(ax.text)
                    .lineLimit(1)
                Text(row.subject)
                    .font(ax.fontBase)
                    .foregroundStyle(ax.textSecondary)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            HStack(spacing: ax.space(1)) {
                if row.hasAttachments {
                    Image(systemName: "paperclip").font(ax.fontSmall).foregroundStyle(ax.iconSecondary)
                }
                Text(row.receivedAt)
                    .font(ax.font("font-size-base", 14, weight: weight).monospacedDigit())
                    .foregroundStyle(ax.textSecondary)
                    .lineLimit(1)
            }
            .fixedSize()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
    private var wide: some View {
        HStack(spacing: ax.space(3)) {
            HStack(spacing: ax.space(2)) {
                InboxAvatar(name: row.sender, initials: InboxPeople.initials(row.sender))
                Text(row.sender)
                    .font(ax.font("font-size-base", 14, weight: weight))
                    .foregroundStyle(ax.text)
                    .lineLimit(1)
            }
            .frame(width: fromWidth, alignment: .leading)

            HStack(spacing: ax.space(2)) {
                Text(row.subject)
                    .font(ax.font("font-size-base", 14, weight: weight))
                    .foregroundStyle(ax.text)
                    .lineLimit(1)
                    .layoutPriority(1)
                // The preview takes only the room the subject leaves.
                Text("\(words.previewSeparator) \(row.preview)")
                    .font(ax.fontBase)
                    .foregroundStyle(ax.textSecondary)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            if showTags {
                InboxClippedChips(priority: row.priority, tags: row.tags, width: tagsWidth, overflowMark: words.overflowMark)
            }

            received
        }
    }

    /// The timestamp, hidden while the hover actions are over it.
    private var received: some View {
        HStack(spacing: ax.space(1)) {
            if row.hasAttachments {
                Image(systemName: "paperclip").font(ax.fontSmall).foregroundStyle(ax.iconSecondary)
            }
            Text(row.receivedAt)
                .font(ax.font("font-size-base", 14, weight: weight).monospacedDigit())
                .foregroundStyle(ax.textSecondary)
                .lineLimit(1)
        }
        .opacity(showsHoverActions ? 0 : 1)
        .frame(width: receivedWidth, alignment: .trailing)
    }
}

// MARK: Column

/// The list half: the tab strip (or the bulk band that replaces it), the column header of a wide
/// list, and the rows, in a List on a device and a plain stack when drawn to an image.
struct InboxListColumn: View {
    let model: InboxModel
    let layout: InboxLayout
    /// The page's masthead, when the list is the page's one scroll (a phone): it then scrolls
    /// with the rows, as the first rows of the list, instead of sitting above a list that
    /// scrolls inside the page.
    var header: AnyView? = nil
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send
    @Environment(\.axStatic) private var isStatic
    @Environment(\.axWidth) private var width
    /// Where the tab strip's content ends, in the strip's own space, while it is drawn.
    @State private var tabsEnd: CGFloat = 0

    private var selected: Set<String> { Set(model.selectedKeys) }

    /// The masthead and the strip scroll with the rows: only on a device, with rows to scroll.
    private var integrated: Bool { header != nil && !isStatic && !model.rows.isEmpty }

    var body: some View {
        VStack(spacing: 0) {
            if integrated {
                rows
            } else {
                if let header { header }
                if layout.hasSelection { bulkBand } else { tabStrip }
                if model.rows.isEmpty {
                    empty
                } else {
                    if !layout.isStacked { columnHeader }
                    rows
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }

    // MARK: Selection

    private func setSelection(_ keys: [String]) {
        send(.set(id: inboxAction("selection"), value: .string(keys.joined(separator: ","))))
    }

    private func toggle(_ id: String) {
        var keys = model.selectedKeys
        if let at = keys.firstIndex(of: id) { keys.remove(at: at) } else { keys.append(id) }
        setSelection(keys)
    }

    private var allVisibleSelected: Bool {
        !model.rows.isEmpty && model.rows.allSatisfy { selected.contains($0.id) }
    }

    private func toggleAll() {
        let visible = Set(model.rows.map(\.id))
        if allVisibleSelected {
            setSelection(model.selectedKeys.filter { !visible.contains($0) })
        } else {
            setSelection(model.selectedKeys + model.rows.map(\.id).filter { !selected.contains($0) })
        }
    }

    // MARK: Tabs and band

    private var tabStrip: some View {
        let space = "inboxTabs"
        return AXHScroll {
            HStack(spacing: ax.space(1)) {
                ForEach(model.tabs) { tab in
                    Button {
                        send(.set(id: inboxAction("tab"), value: .string(tab.value)))
                    } label: {
                        HStack(spacing: ax.space(2)) {
                            Text(tab.label)
                                .font(ax.font("font-size-base", 14, weight: tab.value == model.tab ? "font-weight-semibold" : "font-weight-medium"))
                                .foregroundStyle(tab.value == model.tab ? ax.text : ax.textSecondary)
                                .lineLimit(1)
                            if let badge = tab.badge {
                                AXBadge(text: "\(badge)", tone: .neutral)
                                    .accessibilityLabel("\(badge)\(model.text.unreadSuffix)")
                            }
                        }
                        // The 2 pt bar sits under the label and the badge, not the tab's padding.
                        .frame(minHeight: max(38 * min(ax.scale, 1.4), InboxTarget.side))
                        .overlay(alignment: .bottom) {
                            Rectangle().fill(tab.value == model.tab ? ax.accent : .clear).frame(height: 2)
                        }
                        .padding(.horizontal, ax.space(3))
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(tab.value == model.tab ? [.isButton, .isSelected] : .isButton)
                }
            }
            .padding(.horizontal, ax.space(1))
            .onGeometryChange(for: CGFloat.self) { $0.frame(in: .named(space)).maxX } action: { tabsEnd = $0 }
        }
        .coordinateSpace(name: space)
        // A strip that runs past the edge fades out there, as the web's scroller does.
        .mask(alignment: .trailing) {
            if tabsEnd > width + 1 {
                HStack(spacing: 0) {
                    Rectangle()
                    LinearGradient(colors: [.black, .clear], startPoint: .leading, endPoint: .trailing).frame(width: ax.space(8))
                }
            } else {
                Rectangle()
            }
        }
        .overlay(alignment: .bottom) { InboxHairline() }
    }

    private var bulkBand: some View {
        let label = model.selectionLabel.joined()
        return ViewThatFits(in: .horizontal) {
            bulkBandContent(label: label, vertical: false)
            bulkBandContent(label: label, vertical: true)
        }
        .padding(ax.space(2))
        .background(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).fill(ax.muted))
        .padding(.horizontal, ax.space(2))
        .padding(.vertical, ax.space(1))
    }

    @ViewBuilder
    private func bulkBandContent(label: String, vertical: Bool) -> some View {
        let actions = HStack(spacing: ax.space(1)) {
            ForEach(model.bulkActions) { action in
                let label = Label(action.label, systemImage: inboxSymbol(action.id))
                    .font(ax.fontLabel)
                    .foregroundStyle(ax.text)
                    .padding(.horizontal, ax.space(2))
                    .frame(minHeight: InboxTarget.side)
                    .contentShape(Rectangle())
                if action.id == "move" && !model.isInert("move") {
                    // Move to folder: a menu of the folders the ticked rows can go to.
                    Menu {
                        ForEach(model.bulkMoveTargets) { target in
                            Button(target.label) { send(.press(id: target.id)) }
                        }
                    } label: { label }
                    .menuStyle(.button)
                    .menuIndicator(.hidden)
                    .buttonStyle(.plain)
                    .fixedSize()
                } else {
                    // Archive and Delete work on the ticked rows (Delete asks first); stock leaves them inert.
                    Button {
                        guard (action.id == "archive" || action.id == "delete") && !model.isInert(action.id) else { return }
                        send(.press(id: inboxAction("\(action.id)Selected")))
                    } label: { label }
                    .buttonStyle(.plain)
                }
            }
        }
        let summary = HStack(spacing: ax.space(3)) {
            Text(label).font(ax.fontBase).foregroundStyle(ax.text)
            Text(model.text.bullet).font(ax.fontSmall).foregroundStyle(ax.textSecondary).accessibilityHidden(true)
            Button(model.text.unselectAll) {
                send(.press(id: inboxAction("unselectAll")))
            }
            .buttonStyle(.plain)
            .font(ax.fontLabel)
            .foregroundStyle(ax.accent)
            .frame(minHeight: InboxTarget.side)
        }
        if vertical {
            VStack(alignment: .leading, spacing: ax.space(2)) { actions; summary }.frame(maxWidth: .infinity, alignment: .leading)
        } else {
            HStack(spacing: ax.space(3)) { actions; Spacer(minLength: ax.space(3)); summary }
        }
    }

    // MARK: Header, rows, empty state

    private var columnHeader: some View {
        let cols = model.text.columns
        return HStack(spacing: ax.space(3)) {
            // The same columns as a row: the dot's gutter, the checkbox, then From over the avatar.
            Color.clear.frame(width: InboxColumns.dot, height: 1)
            InboxCheckbox(checked: allVisibleSelected, label: cols.conversation, selected: model.text.selected, notSelected: model.text.notSelected, action: toggleAll)
            Text(cols.from).frame(width: InboxColumns.from, alignment: .leading)
            Text(cols.subject).frame(maxWidth: .infinity, alignment: .leading)
            if !layout.isTight { Text(cols.tags).frame(width: InboxColumns.tags, alignment: .leading) }
            Text(cols.received).frame(width: InboxColumns.received, alignment: .trailing)
        }
        .font(ax.font("font-size-base", 14, weight: "font-weight-semibold"))
        .foregroundStyle(ax.textSecondary)
        .padding(.horizontal, ax.space(4))
        .padding(.vertical, ax.space(1))
        .overlay(alignment: .bottom) { InboxHairline() }
        .accessibilityElement(children: .contain)
    }

    private func rowView(_ row: InboxModel.Row) -> some View {
        InboxRowView(
            row: row,
            layout: layout,
            isOpen: row.id == layout.openId,
            words: model.text,
            inert: model.inert,
            selected: selected.contains(row.id),
            showTags: !layout.isTight,
            onToggle: { toggle(row.id) }
        )
    }

    /// The open thread as the list's selection: arrow keys move it, as in Mail, and a row's
    /// button opens its thread the same way.
    private var openSelection: Binding<String?> {
        Binding(
            get: { layout.openId },
            set: { id in
                guard let id, id != layout.openId else { return }
                send(.press(id: inboxAction("open:\(id)")))
            }
        )
    }

    @ViewBuilder
    private var rows: some View {
        if isStatic {
            VStack(spacing: 0) {
                ForEach(model.rows) { rowView($0) }
            }
        } else {
            List(selection: openSelection) {
                if integrated {
                    Group {
                        if let header { header }
                        if layout.hasSelection { bulkBand } else { tabStrip }
                    }
                    .listRowInsets(EdgeInsets())
                    .listRowSeparator(.hidden)
                    .listRowBackground(Color.clear)
                }
                ForEach(model.rows) { row in
                    rowView(row)
                        .tag(row.id)
                        .listRowInsets(EdgeInsets())
                        .listRowSeparator(.hidden)
                        .listRowBackground(Color.clear)
                        .modifier(InboxTrailingSwipe(row: row, actions: layout.actions(of: row).filter { $0.id != "reply" }, inert: model.inert))
                        .swipeActions(edge: .leading, allowsFullSwipe: true) {
                            ForEach(layout.actions(of: row).filter { $0.id == "reply" }) { action in
                                Button {
                                    inboxPerform(action.id, row: row.id, send: send, inert: model.inert)
                                } label: {
                                    Label(action.label, systemImage: inboxSymbol(action.id))
                                }
                                .tint(ax.accent)
                            }
                        }
                }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            // The selected row is the open thread: the same soft accent the row paints itself.
            .tint(ax.accentMuted)
        }
    }

    private var empty: some View {
        ContentUnavailableView {
            Label(model.text.empty.title, systemImage: "tray")
        } description: {
            Text(model.text.empty.description)
        } actions: {
            Button(model.text.empty.action) {
                send(.set(id: inboxAction("tab"), value: .string("inbox")))
            }
            .buttonStyle(AXButtonStyle(variant: .secondary, ax: ax))
        }
        .padding(ax.space(4))
        .frame(maxWidth: .infinity)
    }
}

/// A row's trailing swipe, only when some action on it does something.
struct InboxTrailingSwipe: ViewModifier {
    let row: InboxModel.Row
    let actions: [InboxModel.RowAction]
    let inert: [String]
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send

    func body(content: Content) -> some View {
        if actions.isEmpty {
            content
        } else {
            content.swipeActions(edge: .trailing, allowsFullSwipe: false) {
                ForEach(actions) { action in
                    if action.id == "move" && !inert.contains("move") {
                        Menu {
                            ForEach(row.moveTargets) { target in
                                Button(target.label) { send(.press(id: target.id)) }
                            }
                        } label: {
                            Label(action.label, systemImage: inboxSymbol(action.id))
                        }
                        .tint(ax.iconSecondary)
                    } else {
                        Button(role: action.id == "delete" ? .destructive : nil) {
                            inboxPerform(action.id, row: row.id, send: send, inert: inert)
                        } label: {
                            Label(action.label, systemImage: inboxSymbol(action.id))
                        }
                        .tint(action.id == "delete" ? ax.danger : (action.id == "move" ? ax.iconSecondary : ax.accent))
                    }
                }
            }
        }
    }
}
