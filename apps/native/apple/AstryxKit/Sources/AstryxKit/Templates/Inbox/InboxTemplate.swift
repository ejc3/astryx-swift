import SwiftUI

/// Astryx's inbox template (`table-inbox`), drawn natively from the core's view model
/// (core/src/templates/inbox/model.ts, its `View` type).
///
/// A mail list with a reading pane. Layout is this drawing's own: it measures its width, applies
/// the core's breakpoints (`mode.rules`) to it, and shows the list beside the open thread or one
/// at a time (`InboxLayout`). The web page, which draws the same state at another width, lays
/// itself out separately; the two share only content (the open thread, drafts, ticked rows).
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

/// The screen: the masthead, then the list and the open conversation on the page.
struct InboxScreen: View {
    let model: InboxModel
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send
    @Environment(\.axStatic) private var isStatic
    @Environment(\.axWidth) private var width
    @Environment(\.dynamicTypeSize) private var typeSize

    /// The pane's width once the handle has moved it; until then two thirds of the surface.
    @State private var movedPane: CGFloat?
    @State private var paneAtDragStart: CGFloat?

    private let listMin: CGFloat = 300
    private let paneMin: CGFloat = 440
    private let handleWidth: CGFloat = 9

    // MARK: Layout facts

    /// The surface is flat on the page (no card around it), so it has the whole width.
    private var inner: CGFloat { max(width, 0) }

    /// The layout facts that follow from the surface's width alone: single surface or not, and
    /// which thread is open here.
    private var surfaceLayout: InboxLayout { InboxLayout(model, surfaceWidth: Double(width), isTouch: isTouchDevice) }

    /// The thread this drawing shows.
    private var pane: InboxModel.Pane? { surfaceLayout.pane(in: model) }

    /// Whether the list and the pane both fit at their smallest; this view never draws the two
    /// where they do not fit, whatever the breakpoints say.
    private var fits: Bool { inner >= listMin + paneMin + handleWidth }
    private var sideBySide: Bool { !surfaceLayout.isSingleSurface && pane != nil && fits }
    /// The open thread alone: a single surface, or too little room for both.
    private var paneAlone: Bool { pane != nil && !sideBySide }

    private var paneWidth: CGFloat {
        let widest = max(paneMin, inner - listMin - handleWidth)
        let wanted = movedPane ?? (inner * 2 / 3).rounded()
        return min(max(wanted, paneMin), widest)
    }

    private var listWidth: CGFloat { sideBySide ? max(inner - paneWidth - handleWidth, 0) : inner }

    /// The full layout: the surface's facts, and the list's (stacked and tight rows, the bulk band) from the list's width.
    private var layout: InboxLayout { surfaceLayout.listed(model, listWidth: Double(listWidth)) }

    private var isTouchDevice: Bool {
        #if os(iOS)
        true
        #else
        false
        #endif
    }

    var body: some View {
        // The template owns its padding: the header's is 16, and the list runs flat on the page
        // under it, as in the web's layout (no card, no border).
        VStack(alignment: .leading, spacing: 0) {
            masthead
                .padding(ax.space(4))
            surface
                .modifier(InboxFill())
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
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

    // MARK: Masthead

    private var masthead: some View {
        let subtitle = Text(model.subtitle.joined())
            .font(ax.fontSmall)
            .foregroundStyle(ax.textSecondary)
            .axLeading(ax, size: ax.fontSize("font-size-sm", 12), ratio: ax.supportingLeading)
        func refresh(fills: Bool) -> some View {
            Button {
            } label: {
                Label(model.text.refresh, systemImage: "arrow.triangle.2.circlepath")
            }
            .buttonStyle(AXButtonStyle(variant: .ghost, ax: ax, fills: fills))
        }
        func compose(fills: Bool) -> some View {
            Button {
                send(.press(id: inboxAction("compose")))
            } label: {
                Label(model.text.compose, systemImage: "square.and.pencil")
            }
            .buttonStyle(AXButtonStyle(variant: .primary, ax: ax, fills: fills))
        }
        // The subtitle and the two buttons in a row; else the buttons under the subtitle; else
        // (and at accessibility sizes at once) a column of full-width buttons.
        let stacked = VStack(alignment: .leading, spacing: ax.space(2)) {
            subtitle
            refresh(fills: true)
            compose(fills: true)
        }
        return Group {
            if typeSize.isAccessibilitySize {
                stacked
            } else {
                ViewThatFits(in: .horizontal) {
                    HStack(spacing: ax.space(3)) { subtitle.axOneLine(); Spacer(minLength: ax.space(2)); refresh(fills: false).axOneLine(); compose(fills: false).axOneLine() }
                    VStack(alignment: .leading, spacing: ax.space(2)) {
                        subtitle
                        HStack(spacing: ax.space(2)) { refresh(fills: false).axOneLine(); compose(fills: false).axOneLine() }
                    }
                    stacked
                }
            }
        }
        .accessibilityElement(children: .contain)
    }

    // MARK: Surface

    @ViewBuilder
    private var surface: some View {
        if paneAlone, let pane {
            InboxPaneView(model: model, pane: pane, fullWidth: true)
                .environment(\.axWidth, inner)
                .clipped()
        } else if sideBySide, let pane {
            HStack(spacing: 0) {
                InboxListColumn(model: model, layout: layout)
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
            InboxListColumn(model: model, layout: layout)
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

/// The surface fills the window's height under the header when it scrolls inside itself; drawn to
/// an image it takes the room its content needs, at least a window's worth.
struct InboxFill: ViewModifier {
    @Environment(\.axStatic) private var isStatic

    func body(content: Content) -> some View {
        if isStatic {
            content.frame(minHeight: 560, alignment: .top)
        } else {
            content.containerRelativeFrame(.vertical, alignment: .top) { height, _ in max(height - 70, 460) }
        }
    }
}
