import SwiftUI

/// The page's three sections, one under another, with room between them and no rules.
struct OrderMain: View {
    let model: OrderModel
    let narrow: Bool
    @Environment(\.ax) private var ax

    var body: some View {
        VStack(alignment: .leading, spacing: ax.space(12)) {
            OrderItems(model: model)
            OrderInvoice(model: model, narrow: narrow)
            OrderTimeline(model: model)
        }
        .frame(maxWidth: 1000, alignment: .topLeading)
    }
}

/// A section's title with its badge and buttons; on a narrow screen the buttons wrap below.
private struct SectionHeader<Badge: View, Buttons: View>: View {
    let title: String
    @ViewBuilder var badge: Badge
    @ViewBuilder var buttons: Buttons
    @Environment(\.ax) private var ax
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        // Title and buttons in a row; else the buttons under the title; at accessibility sizes
        // a column of full-width buttons.
        if typeSize.isAccessibilitySize {
            VStack(alignment: .leading, spacing: ax.space(2)) {
                titleRow
                VStack(spacing: ax.space(2)) { buttons }.environment(\.axFillButtons, true)
            }
        } else {
            ViewThatFits(in: .horizontal) {
                // The title, then the buttons at the far end: one gap between the title and the first
                // button (the buttons' own gap is theirs), so the row keeps to one line where it can.
                HStack(spacing: 0) {
                    titleRow
                    Spacer(minLength: ax.space(2))
                    HStack(spacing: ax.space(2)) { buttons }
                }
                VStack(alignment: .leading, spacing: ax.space(2)) {
                    titleRow
                    HStack(spacing: ax.space(2)) { buttons }
                }
                VStack(alignment: .leading, spacing: ax.space(2)) {
                    titleRow
                    VStack(spacing: ax.space(2)) { buttons }.environment(\.axFillButtons, true)
                }
            }
        }
    }

    private var titleRow: some View {
        HStack(spacing: ax.space(2)) {
            Text(title).font(ax.heading(2)).foregroundStyle(ax.text).accessibilityAddTraits(.isHeader)
                .fixedSize(horizontal: false, vertical: true)
            badge
        }
    }
}

struct OrderItems: View {
    let model: OrderModel
    @Environment(\.ax) private var ax
    @Environment(\.dynamicTypeSize) private var typeSize

    /// The amount is bold, a step heavier than the semibold of a name.
    private var amountFont: Font { ax.font("font-size-base", 14, weight: "font-weight-bold") }
    /// Above and below a row of a spacious list.
    private var rowPad: CGFloat { ax.space(3) + 1 }

    var body: some View {
        VStack(alignment: .leading, spacing: ax.space(4)) {
            SectionHeader(title: model.words.items) {
                AXBadge(text: model.status, tone: .warning)
            } buttons: {
                // Inert in the stock page, which draws them enabled; so do we.
                COSButton(label: model.words.fulfillItem, variant: .ghost) {}
                COSButton(label: model.words.createLabel, variant: .secondary) {}
            }
            // A spacious list: each row has room above and below it.
            VStack(alignment: .leading, spacing: 0) {
                ForEach(Array(model.products.enumerated()), id: \.offset) { _, product in
                    let details = VStack(alignment: .leading, spacing: 0) {
                        Text(product.name).font(ax.fontBase).foregroundStyle(ax.text)
                            .axLeading(ax, size: ax.fontSize("font-size-base", 14), ratio: ax.bodyLeading)
                        ForEach(Array(product.lines.enumerated()), id: \.offset) { _, line in
                            Text(line).font(ax.fontSmall).foregroundStyle(ax.textSecondary)
                                .axLeading(ax, size: ax.fontSize("font-size-sm", 12), ratio: ax.supportingLeading)
                        }
                    }
                    .fixedSize(horizontal: false, vertical: true)
                    if typeSize.isAccessibilitySize {
                        // Name and lines get the whole width under the picture, and the
                        // amount a line of its own, so no word is broken to make room.
                        VStack(alignment: .leading, spacing: ax.space(2)) {
                            COSThumbnail(src: product.image, name: product.name, side: 64)
                            details
                            VStack(alignment: .leading, spacing: 0) {
                                Text(product.amount).font(amountFont).foregroundStyle(ax.text)
                                Text(COSPart.join(product.unit)).font(ax.fontSmall).foregroundStyle(ax.textSecondary)
                            }
                            .fixedSize(horizontal: false, vertical: true)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, rowPad)
                        .accessibilityElement(children: .combine)
                    } else {
                        HStack(alignment: .top, spacing: ax.space(3)) {
                            COSThumbnail(src: product.image, name: product.name, side: 64)
                            details
                            Spacer(minLength: ax.space(2))
                            // The amount and the unit price are centered on the row, as the web's are.
                            VStack(alignment: .trailing, spacing: 0) {
                                Text(product.amount).font(amountFont).foregroundStyle(ax.text)
                                Text(COSPart.join(product.unit)).font(ax.fontSmall).foregroundStyle(ax.textSecondary)
                            }
                            .lineLimit(1)
                            .frame(maxHeight: .infinity, alignment: .center)
                        }
                        .padding(.vertical, rowPad)
                        .accessibilityElement(children: .combine)
                    }
                }
            }
            // The list sits 4 points in from the section, as the web's spacious list does.
            .padding(.horizontal, ax.space(1))
        }
    }
}

struct OrderInvoice: View {
    let model: OrderModel
    let narrow: Bool
    @Environment(\.ax) private var ax

    var body: some View {
        VStack(alignment: .leading, spacing: ax.space(4)) {
            SectionHeader(title: model.words.invoice) {
                AXBadge(text: model.words.paid, tone: .success)
            } buttons: {
                // Refund moves money out and cannot be undone: if it is ever enabled it needs a
                // destructive confirmation (`.confirmationDialog`, destructive Refund, Cancel) first.
                COSButton(label: model.words.refund, variant: .ghost) {}
                COSButton(label: model.words.sendInvoice, variant: .secondary) {}
            }
            // A MetadataList: the label column is as wide as its longest label, the note takes
            // the room, the amount sits at the end.
            Grid(alignment: .leading, horizontalSpacing: ax.space(3), verticalSpacing: ax.space(3) + 2) {
                ForEach(Array(model.summary.enumerated()), id: \.offset) { _, row in
                    line(label: row.label, note: row.note.map(COSPart.join), amount: row.amount, strong: row.strong)
                }
            }
            AXDivider()
            Grid(alignment: .leading, horizontalSpacing: ax.space(3)) {
                line(label: model.paidBy.label, note: model.paidBy.note, amount: model.paidBy.amount, strong: false)
            }
        }
    }

    /// A MetadataList row: the label, then the note taking the room, then the amount.
    private func line(label: String, note: String?, amount: String, strong: Bool) -> some View {
        GridRow(alignment: .firstTextBaseline) {
            Text(label)
                .font(ax.fontBase)
                .foregroundStyle(ax.textSecondary)
                .axLeading(ax, size: ax.fontSize("font-size-base", 14), ratio: ax.bodyLeading)
                .fixedSize(horizontal: true, vertical: false)
                .gridColumnAlignment(.leading)
            Text(note ?? "")
                .font(ax.fontBase)
                .foregroundStyle(ax.text)
                .axLeading(ax, size: ax.fontSize("font-size-base", 14), ratio: ax.bodyLeading)
                .frame(maxWidth: .infinity, alignment: .leading)
            Text(amount)
                .font(strong ? ax.fontStrong : ax.fontBase)
                .foregroundStyle(ax.text)
                .axLeading(ax, size: ax.fontSize("font-size-base", 14), ratio: ax.bodyLeading)
                .fixedSize(horizontal: true, vertical: false)
                .gridColumnAlignment(.trailing)
        }
    }
}

struct OrderTimeline: View {
    let model: OrderModel
    @Environment(\.ax) private var ax

    var body: some View {
        VStack(alignment: .leading, spacing: ax.space(4)) {
            HStack {
                Text(model.words.timeline).font(ax.heading(2)).foregroundStyle(ax.text).accessibilityAddTraits(.isHeader)
                Spacer(minLength: 0)
                COSIconButton(label: model.words.filters, symbol: "line.3.horizontal.decrease") {}
            }
            VStack(alignment: .leading, spacing: ax.space(4)) {
                ForEach(Array(model.activity.enumerated()), id: \.offset) { _, item in
                    HStack(alignment: .top, spacing: ax.space(3)) {
                        COSAvatar(name: item.user, size: .md)
                        VStack(alignment: .leading, spacing: ax.space(2)) {
                            note(item)
                            footer(item)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
            }
        }
    }

    private func note(_ item: OrderModel.Activity) -> some View {
        VStack(alignment: .leading, spacing: ax.space(1)) {
            Text(item.user).font(ax.fontStrong).foregroundStyle(ax.text)
                .axLeading(ax, size: ax.fontSize("font-size-base", 14), ratio: ax.bodyLeading)
            Text(item.text).font(ax.fontBase).foregroundStyle(ax.text)
                .axLeading(ax, size: ax.fontSize("font-size-base", 14), ratio: ax.bodyLeading)
            if let changes = item.changes {
                VStack(alignment: .leading, spacing: ax.space(1)) {
                    ForEach(Array(changes.enumerated()), id: \.offset) { _, change in
                        HStack(alignment: .firstTextBaseline, spacing: ax.space(2)) {
                            Image(systemName: "square.and.pencil").font(ax.fontSmall).foregroundStyle(ax.iconSecondary)
                            Text(change).font(ax.fontSmall).foregroundStyle(ax.textSecondary)
                                .axLeading(ax, size: ax.fontSize("font-size-sm", 12), ratio: ax.supportingLeading)
                        }
                    }
                }
            }
        }
        .fixedSize(horizontal: false, vertical: true)
        .padding(ax.space(3))
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous).fill(ax.muted))
        .accessibilityElement(children: .combine)
    }

    /// A text link with a 44-point target (the extra is taken back from the layout, so the line
    /// does not grow). The stock page's Like and Reply do nothing and are drawn enabled.
    private func inertLink(_ title: String) -> some View {
        Button {} label: {
            Text(title).font(ax.fontSmall)
                .frame(minWidth: cosTouch, minHeight: cosTouch)
                .contentShape(Rectangle())
                .padding(.vertical, -(cosTouch - 16) / 2)
        }
        .buttonStyle(.plain)
        .foregroundStyle(ax.textSecondary)
    }

    private func footer(_ item: OrderModel.Activity) -> some View {
        FlowLayout(spacing: ax.space(2), crossAlignment: 0.5) {
            HStack(spacing: ax.space(1)) {
                Image(systemName: "hand.thumbsup").font(ax.fontXSmall)
                Image(systemName: "heart").font(ax.fontXSmall)
                if let reactions = item.reactions { Text("\(reactions)").font(ax.fontSmall.monospacedDigit()) }
            }
            .foregroundStyle(ax.textSecondary)
            .accessibilityElement(children: .combine)
            .accessibilityLabel(item.reactionsLabel)
            inertLink(model.words.like)
            COSBullet()
            inertLink(model.words.reply)
            COSBullet()
            Text(item.time).font(ax.fontSmall).foregroundStyle(ax.textSecondary)
        }
    }
}

/// The side panel's three collapsible groups: notes, the customer and the fraud analysis.
struct OrderPanelContent: View {
    let model: OrderModel
    @Environment(\.ax) private var ax

    var body: some View {
        VStack(alignment: .leading, spacing: ax.space(4)) {
            COSCollapsible(spokenTitle: model.words.notes) {
                Text(model.words.notes).font(ax.heading(4)).foregroundStyle(ax.text).accessibilityAddTraits(.isHeader)
            } content: {
                (Text(model.notes + " ").foregroundStyle(ax.text) + Text(model.words.showMore).foregroundStyle(ax.textSecondary).underline())
                    .font(ax.fontBase)
                    .fixedSize(horizontal: false, vertical: true)
            }
            COSCollapsible(spokenTitle: model.words.customer) {
                Text(model.words.customer).font(ax.heading(4)).foregroundStyle(ax.text).accessibilityAddTraits(.isHeader)
            } content: {
                VStack(alignment: .leading, spacing: ax.space(2)) {
                    ForEach(Array(model.customer.enumerated()), id: \.offset) { _, field in
                        HStack(alignment: .firstTextBaseline, spacing: ax.space(3)) {
                            Text(field.label).font(ax.fontBase).foregroundStyle(ax.textSecondary)
                                .frame(width: 92 * min(ax.scale, 1.5), alignment: .leading)
                            Text(field.value).font(ax.fontBase).foregroundStyle(ax.text)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityElement(children: .combine)
                    }
                }
            }
            COSCollapsible(spokenTitle: model.words.fraudAnalysis) {
                Text(model.words.fraudAnalysis).font(ax.heading(4)).foregroundStyle(ax.text).accessibilityAddTraits(.isHeader)
            } content: {
                VStack(alignment: .leading, spacing: ax.space(1)) {
                    risk
                    Text(model.fraud.recommendation).font(ax.fontBase).foregroundStyle(ax.text)
                    Text(model.fraud.detail).font(ax.fontBase).foregroundStyle(ax.text)
                }
                .fixedSize(horizontal: false, vertical: true)
            }
        }
        .environment(\.cosWords, model.words.common)
    }

    /// The risk level as a bar, filled in the success color.
    private var risk: some View {
        let fraction = min(max(model.fraud.risk / 100, 0), 1)
        return Capsule()
            .fill(ax.track.opacity(0.55))
            .frame(height: 8)
            .overlay(alignment: .leading) {
                GeometryReader { geo in
                    Capsule().fill(ax.tone(.success).solid).frame(width: geo.size.width * fraction)
                }
            }
            .padding(.vertical, ax.space(1))
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(model.words.riskLevel)
            .accessibilityValue(model.fraud.riskValue)
    }
}
