import SwiftUI

/// What a row or thread action does here. The web draws the archive, move and delete controls
/// but wires nothing to them (the core has no such actions), so natively they are drawn and
/// send nothing too. "Reply" on a row opens that thread and starts the reply, both actions
/// the core has.
@MainActor
func inboxPerform(_ action: String, row id: String, send: AXSender) {
    guard action == "reply" else { return }
    send(.press(id: inboxAction("open:\(id)")))
    send(.press(id: inboxAction("reply")))
}

/// The buttons of a row's swipe, context menu and accessibility actions.
struct InboxRowMenu: View {
    let row: InboxModel.Row
    @Environment(\.axSend) private var send

    var body: some View {
        ForEach(row.actions) { action in
            Button(role: action.id == "delete" ? .destructive : nil) {
                inboxPerform(action.id, row: row.id, send: send)
            } label: {
                Label(action.label, systemImage: inboxSymbol(action.id))
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
    let mode: InboxModel.Mode
    let selected: Bool
    let showTags: Bool
    let onToggle: () -> Void
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send
    @State private var hovering = false

    private let fromWidth: CGFloat = 190
    private let tagsWidth: CGFloat = 190
    private let receivedWidth: CGFloat = 118

    var body: some View {
        HStack(alignment: mode.isStacked ? .top : .center, spacing: ax.space(3)) {
            if !mode.isStacked {
                InboxCheckbox(checked: selected, label: row.selectionLabel, action: onToggle)
            }
            Circle()
                .fill(row.status == nil ? Color.clear : ax.accent)
                .frame(width: 8, height: 8)
                .padding(.top, mode.isStacked ? ax.space(2) : 0)
                .accessibilityHidden(true)
            Group {
                if mode.isStacked { stacked } else { wide }
            }
            .contentShape(Rectangle())
            .onTapGesture { send(.press(id: inboxAction("open:\(row.id)"))) }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(accessibilityLabel)
            .accessibilityValue(row.preview)
            .accessibilityAddTraits(row.isOpen ? [.isButton, .isSelected] : .isButton)
        }
        .padding(.horizontal, ax.space(4))
        .padding(.vertical, mode.isStacked ? ax.space(3) : ax.space(2))
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(background)
        .overlay(alignment: .bottom) { InboxHairline() }
        .onHover { hovering = $0 }
        .contextMenu { InboxRowMenu(row: row) }
    }

    private var background: Color {
        if row.isOpen { return ax.accentMuted }
        if selected { return ax.accentMuted.opacity(0.55) }
        return hovering ? ax.overlayHover : .clear
    }

    private var accessibilityLabel: String {
        [row.status, row.sender, row.subject, row.receivedAt, row.hasAttachments ? "attachment" : nil]
            .compactMap { $0 }.joined(separator: ", ")
    }

    private var weight: String { row.isUnread ? "font-weight-semibold" : "font-weight-normal" }

    private var stacked: some View {
        VStack(alignment: .leading, spacing: ax.hair) {
            HStack(alignment: .firstTextBaseline, spacing: ax.space(2)) {
                Text(row.sender)
                    .font(ax.font("font-size-base", 14, weight: weight))
                    .foregroundStyle(ax.text)
                    .lineLimit(1)
                Spacer(minLength: ax.space(2))
                if row.hasAttachments {
                    Image(systemName: "paperclip").font(ax.fontSmall).foregroundStyle(ax.iconSecondary)
                }
                Text(row.receivedAt)
                    .font(ax.font("font-size-sm", 12, weight: weight).monospacedDigit())
                    .foregroundStyle(ax.textSecondary)
                    .lineLimit(1)
            }
            Text(row.subject)
                .font(ax.font("font-size-base", 14, weight: "font-weight-medium"))
                .foregroundStyle(ax.text)
                .lineLimit(1)
            Text(row.preview)
                .font(ax.fontSmall)
                .foregroundStyle(ax.textSecondary)
                .lineLimit(2)
            if row.priority != nil || !row.tags.isEmpty {
                InboxChips(priority: row.priority, tags: row.tags).padding(.top, ax.space(1))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var wide: some View {
        HStack(spacing: ax.space(3)) {
            HStack(spacing: ax.space(2)) {
                AXAvatar(name: row.sender, initials: InboxPeople.initials(row.sender), hue: InboxPeople.hue(row.sender), size: .sm)
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
                Text("\u{2014} \(row.preview)")
                    .font(ax.fontBase)
                    .foregroundStyle(ax.textSecondary)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            if showTags {
                InboxClippedChips(priority: row.priority, tags: row.tags, width: tagsWidth)
            }

            received
        }
    }

    /// The timestamp; on a pointer that hovers, the row's actions take its place under the cursor.
    private var received: some View {
        ZStack(alignment: .trailing) {
            HStack(spacing: ax.space(1)) {
                if row.hasAttachments {
                    Image(systemName: "paperclip").font(ax.fontSmall).foregroundStyle(ax.iconSecondary)
                }
                Text(row.receivedAt)
                    .font(ax.font("font-size-base", 14, weight: weight).monospacedDigit())
                    .foregroundStyle(ax.textSecondary)
                    .lineLimit(1)
            }
            .opacity(hovering && !mode.isTouch ? 0 : 1)
            if hovering && !mode.isTouch {
                HStack(spacing: ax.hair) {
                    ForEach(row.actions) { action in
                        InboxIconButton(symbol: inboxSymbol(action.id), label: action.ariaLabel, help: action.label) {
                            inboxPerform(action.id, row: row.id, send: send)
                        }
                    }
                }
            }
        }
        .frame(width: receivedWidth, alignment: .trailing)
    }
}

// MARK: Column

/// The list half: the tab strip (or the bulk band that replaces it), the column header of a wide
/// list, and the rows, in a List on a device and a plain stack when drawn to an image.
struct InboxListColumn: View {
    let model: InboxModel
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send
    @Environment(\.axStatic) private var isStatic

    private var selected: Set<String> { Set(model.selectedKeys) }

    var body: some View {
        VStack(spacing: 0) {
            if model.hasSelection { bulkBand } else { tabStrip }
            if model.rows.isEmpty {
                empty
            } else {
                if !model.mode.isStacked { columnHeader }
                rows
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
        AXHScroll {
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
                        .padding(.horizontal, ax.space(3))
                        .frame(minHeight: 38 * min(ax.scale, 1.4))
                        .overlay(alignment: .bottom) {
                            Rectangle().fill(tab.value == model.tab ? ax.accent : .clear).frame(height: 2)
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(tab.value == model.tab ? [.isButton, .isSelected] : .isButton)
                }
            }
            .padding(.horizontal, ax.space(1))
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
                Button {
                } label: {
                    Label(action.label, systemImage: inboxSymbol(action.id))
                        .font(ax.fontLabel)
                        .foregroundStyle(ax.text)
                        .padding(.horizontal, ax.space(2))
                        .frame(minHeight: 28)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
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
            .frame(minHeight: 28)
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
            InboxCheckbox(checked: allVisibleSelected, label: cols.conversation, action: toggleAll)
            Color.clear.frame(width: 8, height: 1)
            Text(cols.from).frame(width: 190, alignment: .leading)
            Text(cols.subject).frame(maxWidth: .infinity, alignment: .leading)
            if !model.mode.isTight { Text(cols.tags).frame(width: 190, alignment: .leading) }
            Text(cols.received).frame(width: 118, alignment: .trailing)
        }
        .font(ax.font("font-size-sm", 12, weight: "font-weight-medium"))
        .foregroundStyle(ax.textSecondary)
        .padding(.horizontal, ax.space(4))
        .padding(.vertical, ax.hair)
        .overlay(alignment: .bottom) { InboxHairline() }
        .accessibilityElement(children: .contain)
    }

    private func rowView(_ row: InboxModel.Row) -> some View {
        InboxRowView(
            row: row,
            mode: model.mode,
            selected: selected.contains(row.id),
            showTags: !model.mode.isTight,
            onToggle: { toggle(row.id) }
        )
    }

    @ViewBuilder
    private var rows: some View {
        if isStatic {
            VStack(spacing: 0) {
                ForEach(model.rows) { rowView($0) }
            }
        } else {
            List {
                ForEach(model.rows) { row in
                    rowView(row)
                        .listRowInsets(EdgeInsets())
                        .listRowSeparator(.hidden)
                        .listRowBackground(Color.clear)
                        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                            ForEach(row.actions.filter { $0.id == "archive" || $0.id == "delete" || $0.id == "move" }) { action in
                                Button(role: action.id == "delete" ? .destructive : nil) {
                                    inboxPerform(action.id, row: row.id, send: send)
                                } label: {
                                    Label(action.label, systemImage: inboxSymbol(action.id))
                                }
                                .tint(action.id == "delete" ? ax.danger : (action.id == "move" ? ax.iconSecondary : ax.accent))
                            }
                        }
                        .swipeActions(edge: .leading, allowsFullSwipe: true) {
                            ForEach(row.actions.filter { $0.id == "reply" }) { action in
                                Button {
                                    inboxPerform(action.id, row: row.id, send: send)
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
        }
    }

    private var empty: some View {
        VStack(spacing: ax.space(3)) {
            Image(systemName: "tray")
                .font(.system(size: ax.fontSize("font-size-2xl", 24)))
                .foregroundStyle(ax.iconSecondary)
                .frame(width: 56 * min(ax.scale, 1.5), height: 56 * min(ax.scale, 1.5))
                .background(Circle().fill(ax.muted))
            VStack(spacing: ax.hair) {
                Text(model.text.empty.title).font(ax.fontStrong).foregroundStyle(ax.text)
                Text(model.text.empty.description).font(ax.fontBase).foregroundStyle(ax.textSecondary)
                    .multilineTextAlignment(.center)
            }
            Button(model.text.empty.action) {
                send(.set(id: inboxAction("tab"), value: .string("inbox")))
            }
            .buttonStyle(AXButtonStyle(variant: .secondary, ax: ax))
        }
        .padding(ax.space(8))
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .contain)
    }
}
