import SwiftUI

/// The page header: the way back, the order number, its facts, Restock and Edit, the tabs and
/// the button that shows or hides the side panel.
struct OrderHeader: View {
    let model: OrderModel
    let narrow: Bool
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send
    @Environment(\.axWidth) private var width
    @Environment(\.dynamicTypeSize) private var typeSize

    /// Restock and Edit under the title instead of beside it, and then one above the other
    /// at accessibility sizes.
    private var stacked: Bool { narrow || typeSize.isAccessibilitySize }

    private var panelShown: Bool { narrow ? model.panelDialog : model.sidePanel }

    var body: some View {
        VStack(alignment: .leading, spacing: ax.space(3)) {
            HStack(alignment: .top, spacing: ax.space(4)) {
                VStack(alignment: .leading, spacing: 0) {
                    // The stock link goes nowhere: drawn as the web draws it, a secondary-colour link.
                    Button {} label: {
                        HStack(spacing: ax.space(1)) {
                            Image(systemName: "arrow.left").font(ax.fontSmall)
                            Text(model.words.allOrders).font(ax.fontBase)
                        }
                        .frame(minHeight: cosTouch, alignment: .leading)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(ax.textSecondary)
                    .padding(.vertical, -(cosTouch - 20) / 2)
                    .padding(.bottom, ax.space(1))
                    Text(model.number)
                        .font(ax.heading(1))
                        .foregroundStyle(ax.text)
                        .lineLimit(typeSize.isAccessibilitySize ? nil : 1)
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityAddTraits(.isHeader)
                    facts
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                if !stacked {
                    HStack(spacing: ax.space(2)) { restock; edit }
                }
            }
            if stacked {
                if typeSize.isAccessibilitySize {
                    VStack(spacing: ax.space(2)) { restock; edit }.environment(\.axFillButtons, true)
                } else {
                    HStack(spacing: ax.space(2)) { restock; edit }
                }
            }
            HStack(spacing: ax.space(2)) {
                OrderTabs(model: model)
                    .environment(\.axWidth, max(width - max(cosTouch, 36 * min(ax.scale, 1.4)) - ax.space(2), 0))
                COSIconButton(
                    label: panelShown ? model.words.hidePanel : model.words.showPanel,
                    symbol: "rectangle.split.3x1"
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
    }

    // Restock and Edit do nothing in the stock page, which draws them enabled; so do we.
    private var restock: some View {
        COSButton(label: model.words.restock, variant: .secondary, fills: stacked) {}
    }

    private var edit: some View {
        COSButton(label: model.words.edit, variant: .secondary, fills: stacked) {}
    }

    /// Facts wrap onto more lines on a narrow screen rather than collapse behind "+N more".
    private var facts: some View {
        FlowLayout(spacing: ax.space(1), crossAlignment: 0.5) {
            Text(model.itemsLabel).font(ax.fontBase).foregroundStyle(ax.text)
                .axLeading(ax, size: ax.fontSize("font-size-base", 14), ratio: ax.bodyLeading)
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
            .accessibilityLabel("\(model.words.date) \(model.date)")
            HStack(spacing: ax.space(1)) {
                COSBullet()
                Image(systemName: "flag").font(ax.fontSmall).foregroundStyle(ax.iconSecondary)
                Text(model.flag).font(ax.fontBase).foregroundStyle(ax.text)
            }
            .accessibilityElement(children: .combine)
            HStack(spacing: ax.space(1)) {
                COSBullet()
                Button {} label: {
                    Text(model.words.seeAll).font(ax.fontBase)
                        .frame(minHeight: cosTouch)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .foregroundStyle(ax.textSecondary)
                .padding(.vertical, -(cosTouch - 20) / 2)
            }
        }
    }
}

/// The first tabs in a row and a More menu for the rest, as Astryx's full-bleed TabList draws
/// them: the labels flush with the content edge and the selected one underlined as wide as its
/// word. The hairline under the tabs is the header's own divider, edge to edge. Choosing sends
/// `set tab`.
struct OrderTabs: View {
    let model: OrderModel
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send

    private var tab: String { model.tab }
    private var more: [OrderModel.Tab] { model.tabs.filter(\.more) }

    var body: some View {
        AXHScroll {
            HStack(spacing: ax.space(7)) {
                ForEach(model.tabs.filter { !$0.more }, id: \.value) { button($0.value, $0.label) }
                menu
            }
        }
    }

    private func label(_ text: String, selected: Bool) -> some View {
        Text(text)
            .font(selected ? ax.fontStrong : ax.fontBase)
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
                .frame(minHeight: max(cosTouch, 40))
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
                label(model.words.more, selected: selected)
                Image(systemName: "chevron.down")
                    .font(.system(size: ax.fontSize("font-size-xs", 10), weight: .semibold))
                    .foregroundStyle(ax.iconSecondary)
            }
            .frame(minHeight: max(cosTouch, 40))
            .overlay(alignment: .bottom) { underline(selected) }
            .contentShape(Rectangle())
        }
        .menuStyle(.button)
        .buttonStyle(.plain)
        .menuIndicator(.hidden)
        .accessibilityLabel(model.words.more)
        .accessibilityValue(more.first { $0.value == tab }?.label ?? "")
    }
}
