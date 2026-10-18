import SwiftUI

/// The page's three sections, one under another, separated by hairlines.
struct OrderMain: View {
    let model: OrderModel
    let narrow: Bool
    @Environment(\.ax) private var ax

    var body: some View {
        VStack(alignment: .leading, spacing: ax.space(5)) {
            OrderItems(model: model)
            AXDivider()
            OrderInvoice(model: model, narrow: narrow)
            AXDivider()
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

    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: ax.space(2)) {
                titleRow
                Spacer(minLength: ax.space(2))
                buttons
            }
            VStack(alignment: .leading, spacing: ax.space(2)) {
                titleRow
                HStack(spacing: ax.space(2)) { buttons }
            }
        }
    }

    private var titleRow: some View {
        HStack(spacing: ax.space(2)) {
            Text(title).font(ax.heading(2)).foregroundStyle(ax.text).accessibilityAddTraits(.isHeader)
            badge
        }
    }
}

struct OrderItems: View {
    let model: OrderModel
    @Environment(\.ax) private var ax

    var body: some View {
        VStack(alignment: .leading, spacing: ax.space(4)) {
            SectionHeader(title: model.words.items) {
                AXBadge(text: model.status, tone: .warning)
            } buttons: {
                COSButton(label: model.words.fulfillItem, variant: .ghost) {}
                    .disabled(model.isInert("fulfill"))
                COSButton(label: model.words.createLabel, variant: .secondary) {}
                    .disabled(model.isInert("label"))
            }
            VStack(alignment: .leading, spacing: ax.space(4)) {
                ForEach(Array(model.products.enumerated()), id: \.offset) { _, product in
                    HStack(alignment: .top, spacing: ax.space(3)) {
                        COSThumbnail(src: product.image, name: product.name, side: 56)
                        VStack(alignment: .leading, spacing: 0) {
                            Text(product.name).font(ax.fontLabel).foregroundStyle(ax.text)
                            ForEach(Array(product.lines.enumerated()), id: \.offset) { _, line in
                                Text(line).font(ax.fontSmall).foregroundStyle(ax.textSecondary)
                            }
                        }
                        .fixedSize(horizontal: false, vertical: true)
                        Spacer(minLength: ax.space(2))
                        VStack(alignment: .trailing, spacing: 0) {
                            Text(product.amount).font(ax.fontStrong).foregroundStyle(ax.text)
                            Text(COSPart.join(product.unit)).font(ax.fontSmall).foregroundStyle(ax.textSecondary)
                        }
                        .lineLimit(1)
                    }
                    .accessibilityElement(children: .combine)
                }
            }
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
                    .disabled(model.isInert("refund"))
                COSButton(label: model.words.sendInvoice, variant: .secondary) {}
                    .disabled(model.isInert("invoice"))
            }
            VStack(alignment: .leading, spacing: ax.space(2)) {
                ForEach(Array(model.summary.enumerated()), id: \.offset) { _, row in
                    line(label: row.label, note: row.note.map(COSPart.join), amount: row.amount, strong: row.strong)
                }
            }
            AXDivider()
            line(label: model.paidBy.label, note: model.paidBy.note, amount: model.paidBy.amount, strong: false)
        }
    }

    /// A MetadataList row: the label, then the note taking the room, then the amount.
    private func line(label: String, note: String?, amount: String, strong: Bool) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: ax.space(3)) {
            Text(label)
                .font(ax.fontBase)
                .foregroundStyle(ax.textSecondary)
                .frame(width: (narrow ? 84 : 150) * min(ax.scale, 1.5), alignment: .leading)
            Text(note ?? "")
                .font(ax.fontBase)
                .foregroundStyle(ax.text)
                .frame(maxWidth: .infinity, alignment: .leading)
            Text(amount)
                .font(strong ? ax.fontStrong : ax.fontBase)
                .foregroundStyle(ax.text)
        }
        .fixedSize(horizontal: false, vertical: true)
        .accessibilityElement(children: .combine)
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
                    .disabled(model.isInert("filters"))
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
            Text(item.text).font(ax.fontBase).foregroundStyle(ax.text)
            if let changes = item.changes {
                VStack(alignment: .leading, spacing: ax.space(1)) {
                    ForEach(Array(changes.enumerated()), id: \.offset) { _, change in
                        HStack(alignment: .firstTextBaseline, spacing: ax.space(2)) {
                            Image(systemName: "square.and.pencil").font(ax.fontSmall).foregroundStyle(ax.iconSecondary)
                            Text(change).font(ax.fontSmall).foregroundStyle(ax.textSecondary)
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
    /// does not grow). The stock page's Like and Reply do nothing, so they are drawn disabled.
    private func inertLink(_ title: String, control: String) -> some View {
        Button {} label: {
            Text(title).font(ax.fontSmall)
                .frame(minWidth: cosTouch, minHeight: cosTouch)
                .contentShape(Rectangle())
                .padding(.vertical, -(cosTouch - 16) / 2)
        }
        .buttonStyle(.plain)
        .foregroundStyle(ax.textSecondary)
        .disabled(model.isInert(control))
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
            inertLink(model.words.like, control: "like")
            COSBullet()
            inertLink(model.words.reply, control: "reply")
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
