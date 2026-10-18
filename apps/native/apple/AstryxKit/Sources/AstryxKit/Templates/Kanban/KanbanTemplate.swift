import SwiftUI
import UniformTypeIdentifiers

/// Astryx's kanban template (`kanban-board`), drawn natively from the core's view model
/// (core/src/templates/kanban/model.ts, its `View` type).
///
/// A toolbar (title, sprint, tools, Add task) over four columns of cards. A card moves by
/// dragging it into a column (the core gets `drop:<card>` with `"<column>:<index>"`), by its
/// menu's "Move to ..." entries (`move:<card>:<column>`), or by a VoiceOver action.
struct KanbanTemplate: View {
    let view: JSONValue

    var body: some View {
        switch decoded {
        case .success(let model): KanbanScreen(model: model)
        case .failure(let error): AXTemplatePlaceholder(template: "kanban: \(error)")
        }
    }

    private var decoded: Result<KanbanModel, Error> {
        Result { try view.decode(KanbanModel.self) }
    }
}

/// The action id of the kanban template: `tpl.kanban.<what>`.
func kanbanAction(_ what: String) -> String { "tpl.kanban.\(what)" }

/// Where a dragged card would land: a column and an index among the cards that stay in it.
struct KanbanTarget: Equatable {
    var column: String
    var index: Int
}

/// What is being dragged, and where it would drop, shared by the columns of one board.
struct KanbanDragState: Equatable {
    var card: String?
    var target: KanbanTarget?
}

struct KanbanScreen: View {
    let model: KanbanModel
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send
    @Environment(\.axStatic) private var isStatic
    @Environment(\.axWidth) private var width
    @State private var drag = KanbanDragState()

    var body: some View {
        VStack(alignment: .leading, spacing: ax.space(4)) {
            toolbar
            board
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
    }

    // MARK: Toolbar

    private var toolbar: some View {
        let heading = HStack(spacing: ax.space(2)) {
            Text(model.title)
                .font(ax.heading(3))
                .foregroundStyle(ax.text)
                .accessibilityAddTraits(.isHeader)
            AXBadge(text: "\(model.total)", tone: .neutral)
                .accessibilityLabel("\(model.total)")
        }
        let tools = HStack(spacing: ax.hair) {
            InboxIconButton(symbol: "arrow.up.arrow.down", label: "Sort")
            InboxIconButton(symbol: "line.3.horizontal.decrease", label: "Filter")
            InboxIconButton(symbol: "magnifyingglass", label: "Search")
        }
        let add = Button {
        } label: {
            Label("Add task", systemImage: "plus")
        }
        .buttonStyle(AXButtonStyle(variant: .primary, ax: ax))
        return ViewThatFits(in: .horizontal) {
            HStack(spacing: ax.space(2)) {
                heading
                Spacer(minLength: ax.space(3))
                sprintPicker
                tools
                add
            }
            VStack(alignment: .leading, spacing: ax.space(2)) {
                heading
                HStack(spacing: ax.space(2)) {
                    sprintPicker
                    Spacer(minLength: 0)
                    tools
                    add
                }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Board actions")
    }

    /// The sprint selector: a menu of the core's options, sending `set sprint <value>`.
    @ViewBuilder
    private var sprintPicker: some View {
        let current = model.sprintOptions.first { $0.value == model.sprint }?.label ?? model.sprint
        let shape = RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous)
        if isStatic {
            sprintLabel(current)
                .background(shape.fill(ax.surface))
                .overlay(shape.strokeBorder(ax.borderStrong, lineWidth: 1))
        } else {
            Menu {
                Picker("Sprint", selection: Binding(
                    get: { model.sprint },
                    set: { send(.set(id: kanbanAction("sprint"), value: .string($0))) }
                )) {
                    ForEach(model.sprintOptions) { Text($0.label).tag($0.value) }
                }
                .pickerStyle(.inline)
                .labelsHidden()
            } label: {
                sprintLabel(current)
                    .background(shape.fill(ax.surface))
                    .overlay(shape.strokeBorder(ax.borderStrong, lineWidth: 1))
                    .contentShape(shape)
            }
            .menuStyle(.button)
            .buttonStyle(.plain)
            .menuIndicator(.hidden)
            .fixedSize()
            .accessibilityLabel("Sprint")
            .accessibilityValue(current)
        }
    }

    private func sprintLabel(_ text: String) -> some View {
        HStack(spacing: ax.space(2)) {
            Text(text).font(ax.fontLabel).foregroundStyle(ax.text).lineLimit(1)
            Image(systemName: "chevron.up.chevron.down")
                .font(.system(size: ax.fontSize("font-size-xs", 10), weight: .semibold))
                .foregroundStyle(ax.iconSecondary)
        }
        .padding(.horizontal, ax.space(3))
        .frame(minHeight: 36 * min(ax.scale, 1.4))
        .frame(minWidth: 130, alignment: .leading)
    }

    // MARK: Board

    private let minimumColumn: CGFloat = 228

    @ViewBuilder
    private var board: some View {
        let gap = ax.space(4)
        let count = CGFloat(model.columns.count)
        if width >= count * minimumColumn + (count - 1) * gap {
            // Room for every column: they share the width.
            columns(width: nil, gap: gap)
        } else {
            let column: CGFloat = width < 600 ? max(width - 56, 220) : 300
            if isStatic {
                columns(width: column, gap: gap)
                    .frame(width: width, alignment: .leading)
                    .clipped()
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    columns(width: column, gap: gap)
                        .scrollTargetLayout()
                }
                .scrollTargetBehavior(.viewAligned)
                .scrollClipDisabled()
            }
        }
    }

    /// The columns side by side, as tall as the tallest.
    private func columns(width: CGFloat?, gap: CGFloat) -> some View {
        HStack(alignment: .top, spacing: gap) {
            ForEach(model.columns) { column in
                KanbanColumnView(column: column, drag: $drag)
                    .frame(width: width)
                    .frame(maxWidth: width == nil ? .infinity : nil, maxHeight: .infinity, alignment: .top)
            }
        }
        .fixedSize(horizontal: false, vertical: true)
    }
}

// MARK: Column

struct KanbanColumnView: View {
    let column: KanbanModel.Column
    @Binding var drag: KanbanDragState
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send
    @State private var midY: [String: CGFloat] = [:]
    @State private var showingTip = false

    private var tone: Tone {
        switch column.variant {
        case .neutral: .neutral
        case .accent: .accent
        case .warning: .warning
        case .success: .success
        }
    }

    /// The target of the drag that is over this column, if any.
    private var target: KanbanTarget? {
        drag.target?.column == column.id ? drag.target : nil
    }

    /// The cards that stay in the column when the dragged one is taken out.
    private var remaining: [KanbanModel.Card] { column.cards.filter { $0.id != drag.card } }

    var body: some View {
        VStack(spacing: 0) {
            header
            InboxHairline()
            cards
        }
        .frame(maxWidth: .infinity, minHeight: 360, maxHeight: .infinity, alignment: .top)
        .background(RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous).fill(ax.muted))
        .overlay(
            RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous)
                .strokeBorder(target != nil ? ax.accent : ax.border, lineWidth: target != nil ? 2 : 1)
        )
        .modifier(KanbanDropZone(delegate: KanbanDropDelegate(
            column: column.id,
            remaining: remaining.map(\.id),
            midY: midY,
            drag: $drag,
            send: send
        )))
        .accessibilityElement(children: .contain)
        .accessibilityLabel("\(column.title), \(column.count)")
    }

    private var header: some View {
        HStack(spacing: ax.space(2)) {
            Circle()
                .fill(ax.tone(tone).solid)
                .frame(width: 8, height: 8)
                .accessibilityLabel("\(column.title) status")
            Text(column.title)
                .font(ax.heading(4))
                .foregroundStyle(ax.text)
                .accessibilityAddTraits(.isHeader)
            Button {
                showingTip.toggle()
            } label: {
                Image(systemName: "info.circle")
                    .font(.system(size: ax.fontSize("font-size-sm", 12)))
                    .foregroundStyle(ax.textSecondary)
                    .frame(minWidth: 24, minHeight: 24)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .help(column.tooltip)
            .accessibilityLabel(column.tooltip)
            .popover(isPresented: $showingTip) {
                Text(column.tooltip)
                    .font(ax.fontSmall)
                    .foregroundStyle(ax.text)
                    .padding(ax.space(3))
                    .frame(maxWidth: 240)
                    .presentationCompactAdaptation(.popover)
            }
            Spacer(minLength: 0)
            Text("\(column.count)")
                .font(ax.fontSmall.monospacedDigit())
                .foregroundStyle(ax.textSecondary)
        }
        .padding(ax.space(3))
    }

    @ViewBuilder
    private var cards: some View {
        if column.cards.isEmpty {
            empty
        } else {
            let space = self.space
            VStack(spacing: ax.space(2)) {
                ForEach(column.cards) { card in
                    KanbanCardView(
                        card: card,
                        isDragged: drag.card == card.id && drag.target != nil,
                        lineAbove: lineAbove(card),
                        lineBelow: lineBelow(card),
                        onDragStart: { drag.card = card.id }
                    )
                    .onGeometryChange(for: CGFloat.self) { $0.frame(in: .named(space)).midY } action: { midY[card.id] = $0 }
                }
            }
            .padding(ax.space(2))
            .coordinateSpace(name: space)
        }
    }

    private var space: String { "kanban-column-\(column.id)" }

    private func lineAbove(_ card: KanbanModel.Card) -> Bool {
        guard let target, card.id != drag.card, target.index < remaining.count else { return false }
        return remaining[target.index].id == card.id
    }

    private func lineBelow(_ card: KanbanModel.Card) -> Bool {
        guard let target, target.index >= remaining.count else { return false }
        return remaining.last?.id == card.id
    }

    private var empty: some View {
        VStack(spacing: ax.space(2)) {
            Image(systemName: KanbanColumnView.symbol(column.emptyIcon.name))
                .font(.system(size: ax.fontSize("font-size-2xl", 24)))
                .foregroundStyle(ax.textSecondary)
            Text(column.emptyTitle).font(ax.fontStrong).foregroundStyle(ax.text)
            Text(column.emptyDescription)
                .font(ax.fontSmall)
                .foregroundStyle(ax.textSecondary)
                .multilineTextAlignment(.center)
        }
        .padding(.vertical, ax.space(10))
        .padding(.horizontal, ax.space(4))
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
    }

    static func symbol(_ name: String) -> String {
        switch name {
        case "inbox": "tray"
        case "arrow-path": "arrow.triangle.2.circlepath"
        case "clipboard-check": "checklist"
        case "check-circle": "checkmark.circle"
        default: "tray"
        }
    }
}

// MARK: Card

struct KanbanCardView: View {
    let card: KanbanModel.Card
    var isDragged = false
    var lineAbove = false
    var lineBelow = false
    var onDragStart: () -> Void = {}
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send

    private var priorityColors: ToneColors {
        switch card.priorityVariant {
        case .error: ax.tone(.danger)
        case .warning: ax.tone(.warning)
        case .teal:
            ToneColors(
                text: ax.color("color-text-teal"), solid: ax.color("color-icon-teal"),
                muted: ax.color("color-background-teal"), border: ax.color("color-border-teal"),
                onSolid: ax.color("color-on-accent")
            )
        case .neutral: ax.tone(.neutral)
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: ax.space(2)) {
            HStack(alignment: .top, spacing: ax.space(1)) {
                FlowLayout(spacing: ax.space(1), crossAlignment: 0.5) {
                    AXBadge(text: card.ref, tone: .neutral)
                    priorityBadge
                }
                Spacer(minLength: 0)
                menu
            }
            VStack(alignment: .leading, spacing: ax.space(1)) {
                Text(card.title)
                    .font(ax.heading(4))
                    .foregroundStyle(ax.text)
                    .fixedSize(horizontal: false, vertical: true)
                Text(card.description)
                    .font(ax.fontSmall)
                    .foregroundStyle(ax.textSecondary)
                    .lineLimit(2)
            }
            Text(card.meta)
                .font(ax.fontSmall)
                .foregroundStyle(ax.textSecondary)
        }
        .padding(ax.space(3))
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous).fill(ax.card))
        .overlay(RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous).strokeBorder(ax.border, lineWidth: 1))
        .overlay(alignment: .top) { insertionLine.opacity(lineAbove ? 1 : 0).offset(y: -(ax.space(1) + 1)) }
        .overlay(alignment: .bottom) { insertionLine.opacity(lineBelow ? 1 : 0).offset(y: ax.space(1) + 1) }
        .opacity(isDragged ? 0.35 : 1)
        .contentShape(RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous))
        .onDrag {
            onDragStart()
            return NSItemProvider(object: card.id as NSString)
        } preview: {
            preview
        }
        .contextMenu { menuItems }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(card.ref), \(card.priorityLabel), \(card.title)")
        .accessibilityValue("\(card.description) \(card.meta)")
        .accessibilityActions {
            ForEach(card.moveTargets) { target in
                Button(target.label) { send(.press(id: target.id)) }
            }
        }
    }

    private var priorityBadge: some View {
        let colors = priorityColors
        return Text(card.priorityLabel)
            .font(ax.font("font-size-xs", 10, weight: "font-weight-semibold"))
            .foregroundStyle(colors.text)
            .lineLimit(1)
            .padding(.horizontal, ax.space(2))
            .padding(.vertical, ax.hair)
            .background(Capsule().fill(colors.muted))
    }

    private var insertionLine: some View {
        Capsule().fill(ax.accent).frame(height: 3).padding(.horizontal, ax.space(1))
    }

    /// The card as it is carried while dragged.
    private var preview: some View {
        VStack(alignment: .leading, spacing: ax.space(1)) {
            Text(card.title).font(ax.heading(4)).foregroundStyle(ax.text).lineLimit(2)
            Text(card.meta).font(ax.fontSmall).foregroundStyle(ax.textSecondary)
        }
        .padding(ax.space(3))
        .frame(width: 240, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous).fill(ax.card))
        .overlay(RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous).strokeBorder(ax.borderStrong, lineWidth: 1))
    }

    @ViewBuilder
    private var menuItems: some View {
        Button("Open") {}
        Button("Assign to me") {}
        Divider()
        ForEach(card.moveTargets) { target in
            Button(target.label) { send(.press(id: target.id)) }
        }
    }

    private var menu: some View {
        Menu {
            menuItems
        } label: {
            Image(systemName: "ellipsis")
                .font(.system(size: ax.fontSize("font-size-base", 14)))
                .foregroundStyle(ax.iconSecondary)
                .frame(width: 28, height: 24)
                .contentShape(Rectangle())
        }
        .menuStyle(.button)
        .buttonStyle(.plain)
        .menuIndicator(.hidden)
        .fixedSize()
        .accessibilityLabel("Work item actions")
    }
}

// MARK: Dropping

/// Makes a column a drop target. (ImageRenderer draws a drop target as a "not supported" box,
/// so drawn to an image the column is left plain.)
struct KanbanDropZone: ViewModifier {
    let delegate: KanbanDropDelegate
    @Environment(\.axStatic) private var isStatic

    func body(content: Content) -> some View {
        if isStatic { content } else { content.onDrop(of: [.plainText], delegate: delegate) }
    }
}

/// Resolves the pointer to a column and an index among the cards that stay, shows where the card
/// would land, and on release sends the core the drop.
@MainActor
struct KanbanDropDelegate: DropDelegate {
    let column: String
    /// The ids of the column's cards without the dragged one, in order.
    let remaining: [String]
    let midY: [String: CGFloat]
    @Binding var drag: KanbanDragState
    let send: AXSender

    private func index(at point: CGPoint) -> Int {
        var index = remaining.count
        for (i, id) in remaining.enumerated() {
            if let mid = midY[id], point.y < mid { index = i; break }
        }
        return index
    }

    private func update(_ info: DropInfo) {
        let target = KanbanTarget(column: column, index: index(at: info.location))
        if drag.target != target { drag.target = target }
    }

    func validateDrop(info: DropInfo) -> Bool { drag.card != nil }

    func dropEntered(info: DropInfo) { update(info) }

    func dropUpdated(info: DropInfo) -> DropProposal? {
        update(info)
        return DropProposal(operation: .move)
    }

    func dropExited(info: DropInfo) {
        if drag.target?.column == column { drag.target = nil }
    }

    func performDrop(info: DropInfo) -> Bool {
        guard let card = drag.card else { return false }
        let at = index(at: info.location)
        send(.set(id: kanbanAction("drop:\(card)"), value: .string("\(column):\(at)")))
        drag = KanbanDragState()
        return true
    }
}
