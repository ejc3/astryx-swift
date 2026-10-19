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

    /// On a phone the list is the page's one scroll: the masthead and the tab strip are its first
    /// rows, so a single list scrolls under the navigation bar and the home indicator, instead of
    /// a list scrolling inside a page that scrolls.
    private var listIsThePage: Bool {
        // The page no longer scrolls (RootView lets the inbox size itself to the window), so the
        // masthead stays put above the one scrolling list, as the web's pinned header does.
        false
    }

    var body: some View {
        // The template owns its padding: the header's is 16, and the list runs flat on the page
        // under it, as in the web's layout (no card, no border).
        VStack(alignment: .leading, spacing: 0) {
            if !listIsThePage {
                masthead
                    .padding(ax.space(4))
            }
            surface
                .modifier(InboxFill(wholePage: listIsThePage))
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
        // The web's order, now that the page has no H1: the subtitle and Refresh on one row,
        // Compose under them; else (and at accessibility sizes at once) a column of full-width buttons.
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
                    // Wide (the web's desktop header): the subtitle, then Refresh and Compose at the end.
                    HStack(spacing: ax.space(3)) {
                        subtitle.axOneLine()
                        Spacer(minLength: ax.space(4))
                        refresh(fills: false).axOneLine()
                        compose(fills: false).axOneLine()
                    }
                    // A phone (the web's narrow header): Compose goes under the subtitle row.
                    VStack(alignment: .leading, spacing: ax.space(3)) {
                        HStack(spacing: ax.space(3)) { subtitle.axOneLine(); Spacer(minLength: ax.space(2)); refresh(fills: false).axOneLine() }
                        compose(fills: false).axOneLine()
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
            InboxListColumn(model: model, layout: layout, header: listIsThePage ? AnyView(masthead.padding(ax.space(4))) : nil)
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
    /// The list carries the masthead too and so takes the window's whole height (a phone).
    var wholePage = false
    @Environment(\.axStatic) private var isStatic

    func body(content: Content) -> some View {
        if wholePage {
            content.containerRelativeFrame(.vertical, alignment: .top) { height, _ in max(height, 460) }
        } else if isStatic {
            content.frame(minHeight: 560, alignment: .top)
        } else {
            // The window's height under the masthead: the page itself does not scroll.
            content.frame(maxHeight: .infinity, alignment: .top)
        }
    }
}
