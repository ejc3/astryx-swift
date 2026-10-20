import SwiftUI

/// Astryx's detail-page template (an order), drawn natively from the core's view model
/// (core/src/templates/order/model.ts, its `View` type): a header with the order's facts and
/// tabs, then the items, invoice and timeline, with a side panel of notes, customer and fraud
/// analysis. Where the window has no room for the panel beside the page, it opens as a sheet.
struct OrderTemplate: View {
    let view: JSONValue

    var body: some View {
        if let model = try? view.decode(OrderModel.self) {
            OrderScreen(model: model)
        } else {
            AXTemplatePlaceholder(template: "order")
        }
    }
}

struct OrderScreen: View {
    let model: OrderModel
    @Environment(\.ax) private var ax
    @Environment(\.axWidth) private var width
    @Environment(\.axSend) private var send
    @Environment(\.axStatic) private var isStatic

    /// The template owns its outer padding, as the web page's header and content do (16).
    private var pad: CGFloat { ax.space(4) }
    /// Narrow when the page and the panel cannot sit side by side (the core's threshold for a measured pane).
    private var narrow: Bool { width < model.rules.paneNarrowBelow }

    var body: some View {
        Group {
            if isStatic {
                VStack(alignment: .leading, spacing: 0) {
                    header
                    content
                }
            } else {
                // Beside the panel the header stays at the top while the page scrolls under it, as the
                // web's does; at phone width the web lets it scroll away, and so does this.
                LazyVStack(alignment: .leading, spacing: 0, pinnedViews: narrow ? [] : [.sectionHeaders]) {
                    Section {
                        content
                    } header: {
                        header
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .environment(\.cosWords, model.words.common)
        .sheet(isPresented: Binding(
            get: { narrow && model.panelDialog },
            set: { open in
                if open != model.panelDialog { send(.set(id: "tpl.order.panelDialog", value: .bool(open))) }
            }
        )) {
            OrderPanelSheet(model: model)
                .environment(\.ax, ax)
                .environment(\.axSend, send)
                .environment(\.cosWords, model.words.common)
        }
    }

    /// The header and the full-width rule under it, on the page's ground so the page scrolls under it.
    private var header: some View {
        VStack(alignment: .leading, spacing: 0) {
            OrderHeader(model: model, narrow: narrow)
                .environment(\.axWidth, max(width - 2 * pad, 0))
                .padding([.horizontal, .top], pad)
            AXDivider()
        }
        .background(ax.surface)
    }

    @ViewBuilder
    private var content: some View {
        if narrow {
            OrderMain(model: model, narrow: true)
                .padding(pad)
                .environment(\.axWidth, max(width - 2 * pad, 0))
        } else {
            HStack(alignment: .top, spacing: 0) {
                OrderMain(model: model, narrow: false)
                    .padding(pad)
                    .frame(maxWidth: .infinity, alignment: .topLeading)
                if model.sidePanel {
                    Rectangle().fill(ax.border).frame(width: 1)
                    OrderPanelContent(model: model)
                        .padding(pad)
                        .frame(width: model.rules.panelWidth + 2 * pad, alignment: .topLeading)
                }
            }
        }
    }
}

/// The panel as a system sheet: a navigation stack with the title "Order details" and a Done
/// button, medium and large detents, and the system's grabber and material (no custom background).
private struct OrderPanelSheet: View {
    let model: OrderModel
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send

    var body: some View {
        NavigationStack {
            ScrollView {
                OrderPanelContent(model: model)
                    .padding(ax.space(4))
                    .frame(maxWidth: .infinity, alignment: .topLeading)
            }
            .navigationTitle(model.words.panelTitle)
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button(model.words.common.done) {
                        send(.set(id: "tpl.order.panelDialog", value: .bool(false)))
                    }
                }
            }
        }
        .tint(ax.accent)
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        #if os(macOS)
        .frame(minWidth: 420, minHeight: 480)
        #endif
    }
}
