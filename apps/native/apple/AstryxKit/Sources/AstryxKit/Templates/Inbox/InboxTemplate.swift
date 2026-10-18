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
    @State private var sentSurface = -1
    @State private var sentList = -1
    @State private var sentTouch: Bool?

    private let listMin: CGFloat = 300
    private let paneMin: CGFloat = 440
    private let handleWidth: CGFloat = 9

    // MARK: Layout facts

    private var sideBySide: Bool { !model.mode.isSingleSurface && model.pane != nil }
    private var inner: CGFloat { max(width - 2, 0) }

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
        .onChange(of: width, initial: true) { report() }
        .onChange(of: listWidth, initial: true) { report() }
        .sheet(isPresented: Binding(
            get: { model.compose.isOpen },
            set: { send(.set(id: inboxAction("composeOpen"), value: .bool($0))) }
        )) {
            InboxComposeForm(compose: model.compose, words: model.text.composer)
                #if os(macOS)
                .frame(minWidth: 560, minHeight: 520)
                #endif
        }
    }

    /// The page tells the core what it has measured; the core decides what that means.
    private func report() {
        let surface = Int(width.rounded())
        if surface != sentSurface {
            sentSurface = surface
            send(.set(id: inboxAction("surface"), value: .number(Double(surface))))
        }
        let list = Int(listWidth.rounded())
        if list != sentList {
            sentList = list
            send(.set(id: inboxAction("list"), value: .number(Double(list))))
        }
        if sentTouch != isTouchDevice {
            sentTouch = isTouchDevice
            if model.mode.isTouch != isTouchDevice {
                send(.set(id: inboxAction("touch"), value: .bool(isTouchDevice)))
            }
        }
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
        if model.mode.isPaneFullWidth, let pane = model.pane {
            InboxPaneView(model: model, pane: pane, fullWidth: true)
                .environment(\.axWidth, inner)
        } else if sideBySide, let pane = model.pane {
            HStack(spacing: 0) {
                InboxListColumn(model: model)
                    .environment(\.axWidth, listWidth)
                    .frame(width: listWidth)
                handle
                InboxPaneView(model: model, pane: pane, fullWidth: false)
                    .environment(\.axWidth, paneWidth)
                    .frame(width: paneWidth)
                    .background(ax.card)
            }
        } else {
            InboxListColumn(model: model)
                .environment(\.axWidth, inner)
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
            .accessibilityValue("\(Int(paneWidth)) points")
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
