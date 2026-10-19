import SwiftUI
import UniformTypeIdentifiers

/// Astryx's kanban template (`kanban-board`), drawn natively from the core's view model
/// (core/src/templates/kanban/model.ts, its `View` type).
///
/// A toolbar (title, sprint, tools, Add task) over four columns of cards. The template owns its
/// padding: the toolbar's and the board's are 16, with a hairline under the toolbar. The tools
/// the core has no action for (`inert`) are drawn enabled, as the web draws them. A card moves by
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
    @Environment(\.dynamicTypeSize) private var typeSize
    @State private var drag = KanbanDragState()

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            toolbar
                .padding(ax.space(4))
                .overlay(alignment: .bottom) { InboxHairline() }
            board
                .modifier(KanbanFill())
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
        // A card landing somewhere (dropped, or moved from its menu) is felt as a tap.
        .sensoryFeedback(.impact(weight: .medium), trigger: placement)
    }

    /// Which card sits in which column, in order: it changes when a card moves, however it moved.
    private var placement: [String] {
        model.columns.map { column in column.cards.map(\.id).joined(separator: ",") }
    }

    // MARK: Toolbar

    private var toolbar: some View {
        let heading = HStack(spacing: ax.space(2)) {
            Text(model.title)
                .font(ax.heading(3))
                .foregroundStyle(ax.text)
                .axLeading(ax, size: ax.fontSize("text-heading-3-size", 17), ratio: ax.headingLeading(3))
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
            AXBadge(text: "\(model.total)", tone: .neutral)
                .accessibilityLabel("\(model.total)")
        }
        // Three square icon buttons filled with `color-neutral`, their glyphs in the primary ink.
        let tools = HStack(spacing: ax.space(1)) {
            KanbanToolButton(symbol: "arrow.up.arrow.down", label: model.words.sort)
            KanbanToolButton(symbol: "line.3.horizontal.decrease", label: model.words.filter)
            KanbanToolButton(symbol: "magnifyingglass", label: model.words.search)
        }
        // A strong vertical rule between the sprint selector and the tools.
        let rule = Rectangle().fill(ax.borderStrong).frame(width: 1, height: 20 * min(ax.scale, 1.4)).accessibilityHidden(true)
        let add = Button {
        } label: {
            Label(model.words.addTask, systemImage: "plus")
                .lineLimit(1)
                .fixedSize()
        }
        .buttonStyle(AXButtonStyle(variant: .primary, ax: ax))
        
        // Where the words do not fit beside the sprint and the tools: the plus alone, still
        // named for VoiceOver and a tooltip by the core's word.
        let addIcon = Button {
        } label: {
            Image(systemName: "plus")
                .font(.system(size: ax.fontSize("font-size-lg", 17) * 0.95, weight: .semibold))
                .foregroundStyle(ax.onAccent)
                .frame(width: chromeTarget, height: chromeTarget)
                .background(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).fill(ax.accent))
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        
        .accessibilityLabel(model.words.addTask)
        .help(model.words.addTask)
        // At accessibility sizes nothing sits beside anything: each control has a row to itself,
        // the button as wide as the screen with its words wrapping between words.
        let stacked = VStack(alignment: .leading, spacing: ax.space(3)) {
            heading
            sprintPicker
            tools
            Button {
            } label: {
                Label(model.words.addTask, systemImage: "plus")
            }
            .buttonStyle(AXButtonStyle(variant: .primary, ax: ax, fills: true))
            
        }
        return Group {
            if typeSize.isAccessibilitySize {
                stacked
            } else {
                ViewThatFits(in: .horizontal) {
                    HStack(spacing: ax.space(2)) {
                        heading
                        Spacer(minLength: ax.space(3))
                        sprintPicker
                        rule
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
                    VStack(alignment: .leading, spacing: ax.space(2)) {
                        heading
                        HStack(spacing: ax.space(2)) {
                            sprintPicker
                            Spacer(minLength: 0)
                            tools
                            addIcon
                        }
                    }
                    stacked
                }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(model.words.boardActions)
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
                Picker(model.words.sprint, selection: Binding(
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
            .fixedSize(horizontal: !typeSize.isAccessibilitySize, vertical: true)
            .accessibilityLabel(model.words.sprint)
            .accessibilityValue(current)
        }
    }

    private func sprintLabel(_ text: String) -> some View {
        HStack(spacing: ax.space(2)) {
            Text(text).font(ax.fontLabel).foregroundStyle(ax.text).lineLimit(typeSize.isAccessibilitySize ? nil : 1)
            if typeSize.isAccessibilitySize { Spacer(minLength: 0) }
            Image(systemName: "chevron.up.chevron.down")
                .font(.system(size: ax.fontSize("font-size-xs", 10), weight: .semibold))
                .foregroundStyle(ax.iconSecondary)
        }
        .padding(.horizontal, ax.space(3))
        .frame(minHeight: axControlHeight(ax))
        .frame(minWidth: 200, alignment: .leading)
    }

    // MARK: Board

    /// The web gives every column 300 points and scrolls the board sideways when they do not fit.
    private let columnWidth: CGFloat = 300

    @ViewBuilder
    private var board: some View {
        let gap = ax.space(4)
        let column: CGFloat = width < 600 ? max(width - 2 * ax.space(4) - 24, 220) : columnWidth
        if isStatic {
            columns(width: column, gap: gap)
                .padding(ax.space(4))
                .frame(width: width, alignment: .leading)
                .clipped()
        } else {
            ScrollView(.horizontal, showsIndicators: false) {
                columns(width: column, gap: gap)
                    .padding(ax.space(4))
                    .scrollTargetLayout()
            }
            .scrollTargetBehavior(.viewAligned)
            .scrollClipDisabled()
        }
    }

    /// The columns side by side, each as tall as the board.
    private func columns(width: CGFloat, gap: CGFloat) -> some View {
        HStack(alignment: .top, spacing: gap) {
            ForEach(model.columns) { column in
                KanbanColumnView(column: column, model: model, drag: $drag)
                    .frame(width: width)
                    .frame(maxHeight: .infinity, alignment: .top)
            }
        }
        .modifier(KanbanBoardDrop(drag: $drag))
    }
}

/// The board takes the height the window has left under the toolbar (the web's columns are
/// `height: 100%`); drawn to an image it takes a window's worth.
struct KanbanFill: ViewModifier {
    @Environment(\.axStatic) private var isStatic

    func body(content: Content) -> some View {
        if isStatic {
            content.frame(minHeight: 560, alignment: .top)
        } else {
            content.containerRelativeFrame(.vertical, alignment: .top) { height, _ in max(height - 66, 420) }
        }
    }
}

/// One of the toolbar's square icon buttons: a `color-neutral` ground and a primary-ink glyph.
struct KanbanToolButton: View {
    let symbol: String
    let label: String
    @Environment(\.ax) private var ax
    @State private var hovering = false

    var body: some View {
        let side = max(axMinTarget, 32 * min(ax.scale, 1.4))
        Button {} label: {
            Image(systemName: symbol)
                .font(.system(size: min(ax.fontSize("font-size-base", 14), 24)))
                .foregroundStyle(ax.text)
                .frame(width: side, height: side)
                .background(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).fill(ax.color("color-neutral")).brightness(hovering ? -0.03 : 0))
                .contentShape(Rectangle())
                .axTapTarget(keepLayout: true)
        }
        .buttonStyle(.plain)
        .onHover { hovering = $0 }
        .help(label)
        .accessibilityLabel(label)
    }
}

// MARK: Column

struct KanbanColumnView: View {
    let column: KanbanModel.Column
    let model: KanbanModel
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
        // No edge at rest (a muted card); a drop target gets the accent.
        .overlay(
            RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous)
                .strokeBorder(ax.accent, lineWidth: 2)
                .opacity(target != nil ? 1 : 0)
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
                .accessibilityLabel("\(column.title) \(model.words.status)")
            Text(column.title)
                .font(ax.heading(4))
                .foregroundStyle(ax.text)
                .axLeading(ax, size: ax.fontSize("text-heading-4-size", 14), ratio: ax.headingLeading(4))
                .accessibilityAddTraits(.isHeader)
            Button {
                showingTip.toggle()
            } label: {
                Image(systemName: "info.circle")
                    .font(.system(size: ax.fontSize("font-size-sm", 12)))
                    .foregroundStyle(ax.textSecondary)
                    .frame(minWidth: 24, minHeight: 24)
                    .contentShape(Rectangle())
                    .inboxHitTarget(size: 24)
            }
            .buttonStyle(.plain)
            .help(column.tooltip)
            .accessibilityLabel(column.tooltip)
            // A popover on an iPad or a Mac; on an iPhone the same content is a sheet.
            .popover(isPresented: $showingTip) {
                InboxCompactSheet(title: column.title, done: model.words.done) {
                    Text(column.tooltip)
                        .font(ax.fontSmall)
                        .foregroundStyle(ax.text)
                        .padding(ax.space(3))
                        .frame(maxWidth: 240)
                }
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
                        model: model,
                        column: column.title,
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

    /// Drawn by hand: the system's empty-state view sets its title in a size meant for a whole
    /// screen, too big for a column of 228 points.
    private var empty: some View {
        VStack(spacing: ax.space(2)) {
            emptyMark
                .accessibilityHidden(true)
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

    /// The empty column's glyph. A clipboard with a check has no single SF Symbol, so it is a
    /// clipboard with a check over it.
    @ViewBuilder
    private var emptyMark: some View {
        let size = ax.fontSize("font-size-2xl", 24)
        if column.emptyIcon.name == "clipboard-check" {
            ZStack {
                Image(systemName: "clipboard").font(.system(size: size))
                Image(systemName: "checkmark").font(.system(size: size * 0.4, weight: .semibold)).offset(y: size * 0.08)
            }
            .foregroundStyle(ax.textSecondary)
        } else {
            Image(systemName: KanbanColumnView.symbol(column.emptyIcon.name))
                .font(.system(size: size))
                .foregroundStyle(ax.textSecondary)
        }
    }

    static func symbol(_ name: String) -> String {
        switch name {
        case "inbox": "tray"
        case "arrow-path": "arrow.triangle.2.circlepath"
        case "clipboard-check": "clipboard"
        case "check-circle": "checkmark.circle"
        default: "tray"
        }
    }
}

// MARK: Card

struct KanbanCardView: View {
    let card: KanbanModel.Card
    let model: KanbanModel
    /// The title of the column the card is in, announced with its moves.
    let column: String
    var isDragged = false
    var lineAbove = false
    var lineBelow = false
    var onDragStart: () -> Void = {}
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send

    /// The priority's fill and ink, as Astryx's Badge sets them: error and warning are solid,
    /// teal is its tint, and anything else is the neutral badge.
    private var priorityColors: (fill: Color, ink: Color) {
        switch card.priorityVariant {
        case .error: ax.badge(.danger)
        case .warning: ax.badge(.warning)
        case .teal: (ax.color("color-background-teal"), ax.color("color-text-teal"))
        case .neutral: ax.badge(.neutral)
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
                    .axLeading(ax, size: ax.fontSize("text-heading-4-size", 14), ratio: ax.headingLeading(4))
                    .fixedSize(horizontal: false, vertical: true)
                Text(card.description)
                    .font(ax.fontSmall)
                    .foregroundStyle(ax.textSecondary)
                    .axLeading(ax, size: ax.fontSize("font-size-sm", 12), ratio: ax.supportingLeading)
                    .lineLimit(2)
            }
            Text(card.meta)
                .font(ax.fontSmall)
                .foregroundStyle(ax.textSecondary)
                .axLeading(ax, size: ax.fontSize("font-size-sm", 12), ratio: ax.supportingLeading)
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
            return KanbanCardDrag.provider(for: card.id)
        } preview: {
            preview
        }
        .contextMenu { menuItems }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(card.ref), \(card.priorityLabel), \(card.title)")
        .accessibilityValue("\(card.description) \(card.meta)")
        .accessibilityActions {
            ForEach(card.moveTargets) { target in
                Button(target.label) { move(target) }
            }
        }
    }

    private var priorityBadge: some View {
        let colors = priorityColors
        return Text(card.priorityLabel)
            .font(ax.font("font-size-sm", 12, weight: "font-weight-medium"))
            .foregroundStyle(colors.ink)
            .lineLimit(1)
            .padding(.horizontal, ax.space(2))
            .frame(minHeight: ax.space(5) * min(ax.scale, 1.4))
            .background(Capsule().fill(colors.fill))
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
        Button(model.words.open) {}
        Button(model.words.assignToMe) {}
        Divider()
        ForEach(card.moveTargets) { target in
            Button(target.label) { move(target) }
        }
    }

    /// Moves the card by the menu or by a VoiceOver action, and says where it went.
    private func move(_ target: KanbanModel.MoveTarget) {
        send(.press(id: target.id))
        let to = target.id.split(separator: ":").last.map(String.init) ?? ""
        if let title = model.columns.first(where: { $0.id == to })?.title {
            AccessibilityNotification.Announcement("\(model.words.movedTo) \(title)").post()
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
                .inboxHitTarget(size: 24)
        }
        .menuStyle(.button)
        .buttonStyle(.plain)
        .menuIndicator(.hidden)
        .fixedSize()
        .accessibilityLabel(model.words.workItemActions)
    }
}

// MARK: Dropping

/// A card dragged by this board: its id travels as data of a type of its own, visible to this
/// app only, so text dragged in from elsewhere is never taken for a card.
enum KanbanCardDrag {
    static let type = UTType(exportedAs: "app.astryx.kanban.card")

    static func provider(for id: String) -> NSItemProvider {
        let provider = NSItemProvider()
        provider.registerDataRepresentation(forTypeIdentifier: type.identifier, visibility: .ownProcess) { completion in
            completion(Data(id.utf8), nil)
            return nil
        }
        return provider
    }

    /// The card id a drop carries, once its data has loaded.
    static func card(in info: DropInfo, then use: @escaping @MainActor (String?) -> Void) {
        guard let provider = info.itemProviders(for: [type]).first else {
            Task { @MainActor in use(nil) }
            return
        }
        provider.loadDataRepresentation(forTypeIdentifier: type.identifier) { data, _ in
            let id = data.flatMap { String(data: $0, encoding: .utf8) }
            Task { @MainActor in use(id) }
        }
    }
}

/// Makes a column a drop target. (ImageRenderer draws a drop target as a "not supported" box,
/// so drawn to an image the column is left plain.)
struct KanbanDropZone: ViewModifier {
    let delegate: KanbanDropDelegate
    @Environment(\.axStatic) private var isStatic

    func body(content: Content) -> some View {
        if isStatic { content } else { content.onDrop(of: [KanbanCardDrag.type], delegate: delegate) }
    }
}

/// The board around its columns. A card carried over the gaps between columns, or out of the
/// board, has nowhere to land: the drag is refused there (it flies back), and the drag state is
/// cleared when the pointer leaves, so a drag that is cancelled leaves nothing behind.
struct KanbanBoardDrop: ViewModifier {
    @Binding var drag: KanbanDragState
    @Environment(\.axStatic) private var isStatic

    func body(content: Content) -> some View {
        if isStatic { content } else { content.onDrop(of: [KanbanCardDrag.type], delegate: BoardDelegate(drag: $drag)) }
    }

    @MainActor
    private struct BoardDelegate: DropDelegate {
        @Binding var drag: KanbanDragState

        func validateDrop(info: DropInfo) -> Bool { info.hasItemsConforming(to: [KanbanCardDrag.type]) }
        func dropEntered(info: DropInfo) { drag.target = nil }
        func dropUpdated(info: DropInfo) -> DropProposal? { DropProposal(operation: .cancel) }
        func dropExited(info: DropInfo) { drag = KanbanDragState() }
        func performDrop(info: DropInfo) -> Bool {
            drag = KanbanDragState()
            return false
        }
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

    /// Only a card of this board's own type may land; text from another app may not.
    func validateDrop(info: DropInfo) -> Bool { info.hasItemsConforming(to: [KanbanCardDrag.type]) }

    func dropEntered(info: DropInfo) { update(info) }

    func dropUpdated(info: DropInfo) -> DropProposal? {
        update(info)
        return DropProposal(operation: .move)
    }

    func dropExited(info: DropInfo) {
        if drag.target?.column == column { drag.target = nil }
    }

    func performDrop(info: DropInfo) -> Bool {
        let at = index(at: info.location)
        let column = column
        let fallback = drag.card
        let send = send
        drag = KanbanDragState()
        KanbanCardDrag.card(in: info) { id in
            guard let card = id ?? fallback else { return }
            send(.set(id: kanbanAction("drop:\(card)"), value: .string("\(column):\(at)")))
        }
        return true
    }
}
