import SwiftUI

/// Astryx's inbox template (`table-inbox`), drawn natively from the core's view model
/// (core/src/templates/inbox/model.ts, its `View` type).
///
/// A mail list with a reading pane. The core decides the layout from the widths this view
/// reports (`surface`, `list`, `touch`): side by side, or the list and the thread one at a time.
struct InboxTemplate: View {
    let view: JSONValue

    var body: some View {
        switch decoded {
        case .success(let model): InboxScreen(model: model)
        case .failure(let error): AXTemplatePlaceholder(template: "inbox: \(error)")
        }
    }

    private var decoded: Result<InboxModel, Error> {
        Result { try view.decode(InboxModel.self) }
    }
}

/// The screen: the masthead, then the list and the open conversation in one bordered surface.
struct InboxScreen: View {
    let model: InboxModel
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send
    @Environment(\.axStatic) private var isStatic
    @Environment(\.axWidth) private var width

    /// The pane's width once the handle has moved it; until then two thirds of the surface.
    @State private var movedPane: CGFloat?
    @State private var paneAtDragStart: CGFloat?
    /// How many times in a row this view has had to tell the core its widths again because
    /// something else (the web drawing shares the core's state) reported different ones.
    @State private var corrections = 0

    private let listMin: CGFloat = 300
    private let paneMin: CGFloat = 440
    private let handleWidth: CGFloat = 9

    // MARK: Layout facts

    private var inner: CGFloat { max(width - 2, 0) }

    /// Whether the list and the pane both fit at their smallest. The core decides the mode from
    /// the widths it was last told; this view still never draws the two where they do not fit.
    private var fits: Bool { inner >= listMin + paneMin + handleWidth }
    private var sideBySide: Bool { !model.mode.isSingleSurface && model.pane != nil && fits }
    /// The open thread alone: the core's single surface, or the core thinks there is room and there is not.
    private var paneAlone: Bool { model.pane != nil && (model.mode.isPaneFullWidth || (!model.mode.isSingleSurface && !fits)) }

    private var paneWidth: CGFloat {
        let widest = max(paneMin, inner - listMin - handleWidth)
        let wanted = movedPane ?? (inner * 2 / 3).rounded()
        return min(max(wanted, paneMin), widest)
    }

    private var listWidth: CGFloat { sideBySide ? max(inner - paneWidth - handleWidth, 0) : inner }

    private var isTouchDevice: Bool {
        #if os(iOS)
        true
        #else
        false
        #endif
    }

    var body: some View {
        VStack(alignment: .leading, spacing: ax.space(3)) {
            masthead
            surface
                .modifier(InboxFill())
                .background(RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous).fill(ax.card))
                .clipShape(RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous).strokeBorder(ax.border, lineWidth: 1))
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .onChange(of: width, initial: true) { corrections = 0; report() }
        .onChange(of: listWidth, initial: true) { corrections = 0; report() }
        .onChange(of: model.mode.measured) { report() }
        .onChange(of: model.mode.isTouch) { report() }
        .sheet(isPresented: Binding(
            get: { model.compose.isOpen },
            set: { send(.set(id: inboxAction("composeOpen"), value: .bool($0))) }
        )) {
            InboxComposeForm(compose: model.compose, words: model.text.composer, inert: model.inert)
                #if os(macOS)
                .frame(minWidth: 560, minHeight: 520)
                #endif
        }
    }

    /// The page tells the core what it has measured; the core decides what that means. The core
    /// echoes the widths it holds, so a width that differs (another drawing reported last) is
    /// sent again, a few times at most per size.
    private func report() {
        guard corrections < 4 else { return }
        let held = model.mode.measured
        let surface = Int(width.rounded())
        let list = Int(listWidth.rounded())
        var sent = false
        if held.surface != surface {
            send(.set(id: inboxAction("surface"), value: .number(Double(surface))))
            sent = true
        }
        if held.list != list {
            send(.set(id: inboxAction("list"), value: .number(Double(list))))
            sent = true
        }
        if model.mode.isTouch != isTouchDevice {
            send(.set(id: inboxAction("touch"), value: .bool(isTouchDevice)))
            sent = true
        }
        guard sent else { corrections = 0; return }
        corrections += 1
    }

    // MARK: Masthead

    private var masthead: some View {
        let subtitle = Text(model.subtitle.joined())
            .font(ax.fontBase)
            .foregroundStyle(ax.textSecondary)
        let refresh = Button {
        } label: {
            Label(model.text.refresh, systemImage: "arrow.clockwise")
        }
        .buttonStyle(AXButtonStyle(variant: .ghost, ax: ax))
        .disabled(model.isInert("refresh"))
        let compose = Button {
            send(.press(id: inboxAction("compose")))
        } label: {
            Label(model.text.compose, systemImage: "square.and.pencil")
        }
        .buttonStyle(AXButtonStyle(variant: .primary, ax: ax))
        return ViewThatFits(in: .horizontal) {
            HStack(spacing: ax.space(3)) { subtitle; Spacer(minLength: ax.space(2)); refresh; compose }
            VStack(alignment: .leading, spacing: ax.space(2)) {
                subtitle
                HStack(spacing: ax.space(2)) { refresh; compose }
            }
        }
        .accessibilityElement(children: .contain)
    }

    // MARK: Surface

    @ViewBuilder
    private var surface: some View {
        if paneAlone, let pane = model.pane {
            InboxPaneView(model: model, pane: pane, fullWidth: true)
                .environment(\.axWidth, inner)
                .clipped()
        } else if sideBySide, let pane = model.pane {
            HStack(spacing: 0) {
                InboxListColumn(model: model)
                    .environment(\.axWidth, listWidth)
                    .frame(width: listWidth)
                    .clipped()
                handle
                InboxPaneView(model: model, pane: pane, fullWidth: false)
                    .environment(\.axWidth, paneWidth)
                    .frame(width: paneWidth)
                    .clipped()
                    .background(ax.card)
            }
        } else {
            InboxListColumn(model: model)
                .environment(\.axWidth, inner)
                .clipped()
        }
    }

    /// The movable boundary between the list and the pane.
    private var handle: some View {
        Rectangle()
            .fill(Color.clear)
            .frame(width: handleWidth)
            .overlay(Rectangle().fill(ax.border).frame(width: 1))
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 1)
                    .onChanged { drag in
                        let start = paneAtDragStart ?? paneWidth
                        paneAtDragStart = start
                        movedPane = start - drag.translation.width
                    }
                    .onEnded { _ in paneAtDragStart = nil }
            )
            #if os(macOS)
            .onHover { inside in
                if inside { NSCursor.resizeLeftRight.push() } else { NSCursor.pop() }
            }
            #endif
            .accessibilityElement()
            .accessibilityLabel(model.text.pane.resizeLabel)
            .accessibilityValue("\(Int(paneWidth)) \(model.text.pane.resizeUnit)")
            .accessibilityAdjustableAction { direction in
                movedPane = paneWidth + (direction == .increment ? 40 : -40)
            }
    }
}

/// The surface fills the window's height when it scrolls inside itself; drawn to an image it
/// takes the room its content needs, at least a window's worth.
struct InboxFill: ViewModifier {
    @Environment(\.axStatic) private var isStatic

    func body(content: Content) -> some View {
        if isStatic {
            content.frame(minHeight: 560, alignment: .top)
        } else {
            content.containerRelativeFrame(.vertical, alignment: .top) { height, _ in max(height - 170, 460) }
        }
    }
}
