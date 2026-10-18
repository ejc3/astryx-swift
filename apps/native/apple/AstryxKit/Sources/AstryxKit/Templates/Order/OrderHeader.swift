import SwiftUI

/// The page header: the way back, the order number, its facts, Restock and Edit, the tabs and
/// the button that shows or hides the side panel.
struct OrderHeader: View {
    let model: OrderModel
    let narrow: Bool
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send
    @Environment(\.axWidth) private var width

    private var panelShown: Bool { narrow ? model.panelDialog : model.sidePanel }

    var body: some View {
        VStack(alignment: .leading, spacing: ax.space(3)) {
            HStack(alignment: .top, spacing: ax.space(4)) {
                VStack(alignment: .leading, spacing: 0) {
                    HStack(spacing: ax.space(1)) {
                        Image(systemName: "arrow.left").font(ax.fontSmall)
                        Text("All orders").font(ax.fontBase)
                    }
                    .foregroundStyle(ax.textSecondary)
                    .padding(.bottom, ax.space(1))
                    .accessibilityElement(children: .combine)
                    Text(model.number)
                        .font(ax.heading(1))
                        .foregroundStyle(ax.text)
                        .lineLimit(1)
                        .accessibilityAddTraits(.isHeader)
                    facts
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                if !narrow {
                    HStack(spacing: ax.space(2)) {
                        COSButton(label: "Restock", variant: .secondary) {}
                        COSButton(label: "Edit", variant: .secondary) {}
                    }
                }
            }
            if narrow {
                HStack(spacing: ax.space(2)) {
                    COSButton(label: "Restock", variant: .secondary, fills: true) {}
                    COSButton(label: "Edit", variant: .secondary, fills: true) {}
                }
            }
            HStack(spacing: ax.space(2)) {
                OrderTabs(tab: model.tab)
                    .environment(\.axWidth, max(width - 36 * min(ax.scale, 1.4) - ax.space(2), 0))
                COSIconButton(
                    label: panelShown ? "Hide panel" : "Show panel",
                    symbol: panelShown ? "sidebar.right" : "sidebar.right"
                ) {
                    send(.press(id: narrow ? "tpl.order.panel:dialog" : "tpl.order.panel:side"))
                }
                .background(
                    RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous)
                        .fill(panelShown ? ax.accentMuted : .clear)
                )
                .accessibilityAddTraits(panelShown ? .isSelected : [])
            }
        }
        .padding(.top, ax.space(1))
    }

    /// Facts wrap onto more lines on a narrow screen rather than collapse behind "+N more".
    private var facts: some View {
        FlowLayout(spacing: ax.space(1), crossAlignment: 0.5) {
            Text("\(model.itemCount) ordered items").font(ax.fontBase).foregroundStyle(ax.text)
            HStack(spacing: ax.space(1)) {
                COSBullet()
                COSAvatar(name: model.customerName, size: .sm)
                Text(model.customerName).font(ax.fontBase).foregroundStyle(ax.text)
            }
            HStack(spacing: ax.space(1)) {
                COSBullet()
                AXBadge(text: model.status, tone: .warning)
            }
            HStack(spacing: ax.space(1)) {
                COSBullet()
                Image(systemName: "calendar").font(ax.fontSmall).foregroundStyle(ax.iconSecondary)
                Text(model.date).font(ax.fontBase).foregroundStyle(ax.text)
            }
            .accessibilityElement(children: .combine)
            .accessibilityLabel("Date \(model.date)")
            HStack(spacing: ax.space(1)) {
                COSBullet()
                Image(systemName: "flag").font(ax.fontSmall).foregroundStyle(ax.iconSecondary)
                Text(model.flag).font(ax.fontBase).foregroundStyle(ax.text)
            }
            .accessibilityElement(children: .combine)
            HStack(spacing: ax.space(1)) {
                COSBullet()
                Text("See all").font(ax.fontBase).foregroundStyle(ax.textSecondary).underline()
            }
        }
    }
}

/// Details, Invoices and Timeline, and a More menu for Customer and Analysis. Choosing sends
/// `set tab`.
struct OrderTabs: View {
    let tab: String
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send

    private let more: [(value: String, label: String)] = [("customer", "Customer"), ("analysis", "Analysis")]

    var body: some View {
        AXHScroll {
            HStack(spacing: ax.space(1)) {
                button("details", "Details")
                button("invoices", "Invoices")
                button("timeline", "Timeline")
                menu
            }
        }
        .overlay(alignment: .bottom) {
            Rectangle().fill(ax.border).frame(height: 1).allowsHitTesting(false)
        }
    }

    private func label(_ text: String, selected: Bool) -> some View {
        Text(text)
            .font(selected ? ax.fontStrong : ax.fontLabel)
            .foregroundStyle(selected ? ax.text : ax.textSecondary)
            .lineLimit(1)
    }

    private func underline(_ selected: Bool) -> some View {
        Rectangle().fill(selected ? ax.accent : .clear).frame(height: 2)
    }

    private func button(_ value: String, _ title: String) -> some View {
        let selected = tab == value
        return Button {
            send(.set(id: "tpl.order.tab", value: .string(value)))
        } label: {
            label(title, selected: selected)
                .padding(.horizontal, ax.space(3))
                .frame(minHeight: 40)
                .overlay(alignment: .bottom) { underline(selected) }
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
    }

    private var menu: some View {
        let selected = more.contains { $0.value == tab }
        return Menu {
            ForEach(more, id: \.value) { item in
                Button {
                    send(.set(id: "tpl.order.tab", value: .string(item.value)))
                } label: {
                    if item.value == tab {
                        Label(item.label, systemImage: "checkmark")
                    } else {
                        Text(item.label)
                    }
                }
            }
        } label: {
            HStack(spacing: ax.space(1)) {
                label("More", selected: selected)
                Image(systemName: "chevron.down")
                    .font(.system(size: ax.fontSize("font-size-xs", 10), weight: .semibold))
                    .foregroundStyle(ax.iconSecondary)
            }
            .padding(.horizontal, ax.space(3))
            .frame(minHeight: 40)
            .overlay(alignment: .bottom) { underline(selected) }
            .contentShape(Rectangle())
        }
        .menuStyle(.button)
        .buttonStyle(.plain)
        .menuIndicator(.hidden)
        .accessibilityLabel("More")
        .accessibilityValue(more.first { $0.value == tab }?.label ?? "")
    }
}
