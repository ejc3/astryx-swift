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

/// The window is narrow when the page and the 320-point panel cannot sit side by side.
let orderNarrowWidth: CGFloat = 760

struct OrderScreen: View {
    let model: OrderModel
    @Environment(\.ax) private var ax
    @Environment(\.axWidth) private var width
    @Environment(\.axSend) private var send

    private var narrow: Bool { width < orderNarrowWidth }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            OrderHeader(model: model, narrow: narrow)
            AXDivider()
            if narrow {
                OrderMain(model: model, narrow: true)
                    .padding(.top, ax.space(4))
            } else {
                HStack(alignment: .top, spacing: 0) {
                    OrderMain(model: model, narrow: false)
                        .padding(.top, ax.space(4))
                        .padding(.trailing, model.sidePanel ? ax.space(4) : 0)
                        .frame(maxWidth: .infinity, alignment: .topLeading)
                    if model.sidePanel {
                        Rectangle().fill(ax.border).frame(width: 1)
                        OrderPanelContent(model: model)
                            .padding(.top, ax.space(4))
                            .padding(.leading, ax.space(4))
                            .frame(width: 320 + ax.space(4), alignment: .topLeading)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .sheet(isPresented: Binding(
            get: { narrow && model.panelDialog },
            set: { open in
                if open != model.panelDialog { send(.set(id: "tpl.order.panelDialog", value: .bool(open))) }
            }
        )) {
            OrderPanelSheet(model: model)
                .environment(\.ax, ax)
                .environment(\.axSend, send)
        }
    }
}

/// The panel as a sheet: "Order details" with its Done button, over the panel's content.
private struct OrderPanelSheet: View {
    let model: OrderModel
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Order details")
                    .font(ax.heading(3))
                    .foregroundStyle(ax.text)
                    .accessibilityAddTraits(.isHeader)
                Spacer()
                COSButton(label: "Done", variant: .ghost) {
                    send(.set(id: "tpl.order.panelDialog", value: .bool(false)))
                }
            }
            .padding(.horizontal, ax.space(4))
            .padding(.vertical, ax.space(2))
            AXDivider()
            ScrollView {
                OrderPanelContent(model: model)
                    .padding(ax.space(4))
                    .frame(maxWidth: .infinity, alignment: .topLeading)
            }
        }
        .background(ax.page)
        #if os(macOS)
        .frame(minWidth: 420, minHeight: 480)
        #endif
    }
}
