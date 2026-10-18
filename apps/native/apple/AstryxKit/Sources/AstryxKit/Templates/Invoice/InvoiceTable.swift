import SwiftUI

/// The line-item table: a header of sortable, filterable columns and a row per line. A row opens
/// the line's details (the web's hover card) in a popover.
struct InvoiceTable: View {
    let model: InvoiceModel
    @Environment(\.ax) private var ax
    @State private var detail: String?

    var body: some View {
        VStack(spacing: 0) {
            InvoiceHeaderRow(model: model)
            InboxHairline()
            ForEach(model.rows) { row in
                InvoiceLineRow(row: row, isOpen: Binding(
                    get: { detail == row.id },
                    set: { detail = $0 ? row.id : (detail == row.id ? nil : detail) }
                ))
            }
        }
        .accessibilityElement(children: .contain)
    }
}

/// The header cells. A column's title sorts it (ascending, descending, off) and, where the column
/// has a filter, a funnel opens its popover.
struct InvoiceHeaderRow: View {
    let model: InvoiceModel
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send
    @State private var openFilter: String?

    var body: some View {
        HStack(spacing: ax.space(3)) {
            ForEach(InvoiceColumn.all) { column in
                cell(column)
                    .frame(width: column.width, alignment: column.trailing ? .trailing : .leading)
                    .frame(maxWidth: column.width == nil ? .infinity : nil, alignment: column.trailing ? .trailing : .leading)
            }
        }
        .padding(.vertical, ax.space(1))
    }

    /// The sort direction mark; it keeps its room when the column is not sorted so titles do not move.
    private func indicator(_ sort: InvoiceModel.Sort?) -> some View {
        Image(systemName: sort?.direction == .descending ? "chevron.down" : "chevron.up")
            .font(.system(size: ax.fontSize("font-size-xs", 10), weight: .bold))
            .foregroundStyle(ax.text)
            .opacity(sort == nil ? 0 : 1)
            .frame(width: 10)
            .accessibilityHidden(true)
    }

    private func cell(_ column: InvoiceColumn) -> some View {
        let sort = model.sort.first { $0.sortKey == column.key }
        return HStack(spacing: ax.hair) {
            if column.trailing { Spacer(minLength: 0) }
            Button {
                send(.set(id: invoiceAction("sort"), value: .string(InvoiceSort.next(after: model.sort.first, key: column.key))))
            } label: {
                HStack(spacing: ax.hair) {
                    if column.trailing { indicator(sort) }
                    Text(column.title)
                        .font(ax.font("font-size-sm", 12, weight: "font-weight-semibold"))
                        .foregroundStyle(sort == nil ? ax.textSecondary : ax.text)
                        .lineLimit(1)
                    if !column.trailing { indicator(sort) }
                }
                .frame(minHeight: 28)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(column.title)
            .accessibilityValue(sort.map { $0.direction.rawValue } ?? "")
            .accessibilityHint("Sorts the lines by \(column.title)")
            .accessibilityAddTraits(.isButton)

            if let filter = column.filter {
                let active = model.filters[filter] != nil
                Button {
                    openFilter = filter
                } label: {
                    Image(systemName: active ? "line.3.horizontal.decrease.circle.fill" : "line.3.horizontal.decrease")
                        .font(.system(size: ax.fontSize("font-size-sm", 12), weight: .medium))
                        .foregroundStyle(active ? ax.accent : ax.iconSecondary)
                        .frame(width: 26, height: 28)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Filter \(column.title)")
                .accessibilityValue(active ? "active" : "")
                .popover(isPresented: Binding(get: { openFilter == filter }, set: { if !$0 && openFilter == filter { openFilter = nil } })) {
                    VStack(alignment: .leading, spacing: ax.space(2)) {
                        Text(column.title).font(ax.fontLabel).foregroundStyle(ax.text)
                        InvoiceFilterEditor(model: model, filter: filter, title: column.title)
                    }
                    .padding(ax.space(4))
                    .frame(minWidth: 260, idealWidth: 280)
                    .presentationCompactAdaptation(.popover)
                }
            }
            if !column.trailing { Spacer(minLength: 0) }
        }
    }
}

/// One line of the table.
struct InvoiceLineRow: View {
    let row: InvoiceModel.Row
    @Binding var isOpen: Bool
    @Environment(\.ax) private var ax
    @State private var hovering = false

    var body: some View {
        Button {
            isOpen = true
        } label: {
            HStack(spacing: ax.space(3)) {
                Text(row.description)
                    .font(ax.fontBase)
                    .foregroundStyle(ax.text)
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading)
                ForEach(Array(InvoiceColumn.all.dropFirst().enumerated()), id: \.offset) { _, column in
                    Text(value(for: column))
                        .font(column.key == "category" ? ax.fontBase : ax.fontBase.monospacedDigit())
                        .foregroundStyle(column.key == "category" ? ax.textSecondary : ax.text)
                        .lineLimit(1)
                        .frame(width: column.width, alignment: column.trailing ? .trailing : .leading)
                }
            }
            .padding(.vertical, ax.space(2) + 1)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .background(RoundedRectangle(cornerRadius: ax.radiusInner, style: .continuous).fill(hovering ? ax.overlayHover : .clear).padding(.horizontal, -ax.space(2)))
        .onHover { hovering = $0 }
        .popover(isPresented: $isOpen, arrowEdge: .bottom) {
            InvoiceLineDetail(row: row)
                .presentationCompactAdaptation(.popover)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(row.description)
        .accessibilityValue("\(row.category), \(row.card.billing), \(row.card.calculation), \(row.amount)")
        .accessibilityHint("Shows the line's details")
        .accessibilityAddTraits(.isButton)
    }

    private func value(for column: InvoiceColumn) -> String {
        switch column.key {
        case "category": row.category
        case "quantity": row.quantity
        case "unitPrice": row.rate
        default: row.amount
        }
    }
}

/// A line as a small card, for widths the table does not fit.
struct InvoiceCards: View {
    let model: InvoiceModel
    @Environment(\.ax) private var ax
    @State private var detail: String?

    var body: some View {
        VStack(spacing: 0) {
            InboxHairline()
            ForEach(model.rows) { row in
                Button {
                    detail = row.id
                } label: {
                    VStack(alignment: .leading, spacing: ax.hair) {
                        Text(row.description)
                            .font(ax.fontLabel)
                            .foregroundStyle(ax.text)
                            .multilineTextAlignment(.leading)
                            .fixedSize(horizontal: false, vertical: true)
                        Text(row.category).font(ax.fontSmall).foregroundStyle(ax.textSecondary)
                        HStack {
                            Text(row.card.calculation).font(ax.fontSmall.monospacedDigit()).foregroundStyle(ax.textSecondary)
                            Spacer(minLength: ax.space(2))
                            Text(row.amount).font(ax.fontStrong.monospacedDigit()).foregroundStyle(ax.text)
                        }
                    }
                    .padding(.vertical, ax.space(3))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .popover(isPresented: Binding(get: { detail == row.id }, set: { if !$0 && detail == row.id { detail = nil } })) {
                    InvoiceLineDetail(row: row)
                        .presentationCompactAdaptation(.popover)
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(row.description)
                .accessibilityValue("\(row.category), \(row.card.billing), \(row.card.calculation), \(row.amount)")
                .accessibilityAddTraits(.isButton)
                InboxHairline()
            }
        }
    }
}

/// The details of one line (the web's hover card): category, billing, the sum, the amount, its
/// share of the invoice, and a Dispute button.
struct InvoiceLineDetail: View {
    let row: InvoiceModel.Row
    @Environment(\.ax) private var ax

    var body: some View {
        VStack(alignment: .leading, spacing: ax.space(3)) {
            Text(row.description)
                .font(ax.heading(3))
                .foregroundStyle(ax.text)
                .accessibilityAddTraits(.isHeader)
                .fixedSize(horizontal: false, vertical: true)
            VStack(spacing: ax.space(2)) {
                item("Category", row.card.category)
                item("Billing", row.card.billing)
                item("Calculation", row.card.calculation)
                item("Amount", row.card.amount)
                item("Share of invoice", row.card.share)
            }
            Button {
            } label: {
                Text("Dispute this line").frame(maxWidth: .infinity)
            }
            .buttonStyle(AXButtonStyle(variant: .secondary, ax: ax))
        }
        .padding(ax.space(4))
        .frame(width: 300)
    }

    private func item(_ label: String, _ value: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: ax.space(3)) {
            Text(label).font(ax.fontBase).foregroundStyle(ax.textSecondary)
            Spacer(minLength: ax.space(2))
            Text(value).font(ax.fontLabel.monospacedDigit()).foregroundStyle(ax.text).multilineTextAlignment(.trailing)
        }
        .accessibilityElement(children: .combine)
    }
}

// MARK: Filter editors

/// The control of one column filter: text for Description, the categories for Category, a number
/// for Quantity. A value is sent as `set filter:<column>`; clearing it sends `press unfilter:<column>`.
struct InvoiceFilterEditor: View {
    let model: InvoiceModel
    let filter: String
    let title: String
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send
    @Environment(\.axStatic) private var isStatic
    @State private var text = ""
    @State private var sent: [String] = []

    private var current: InvoiceModel.FilterValue? { model.filters[filter] }

    var body: some View {
        VStack(alignment: .leading, spacing: ax.space(2)) {
            if filter == "category" { categoryList } else { field }
            if current != nil {
                Button("Clear filter") { send(.press(id: invoiceAction("unfilter:\(filter)"))) }
                    .buttonStyle(.plain)
                    .font(ax.fontLabel)
                    .foregroundStyle(ax.accent)
                    .frame(minHeight: 28)
            }
        }
        .onAppear { text = current?.text ?? "" }
    }

    private var categoryList: some View {
        VStack(spacing: 0) {
            ForEach(model.categories) { category in
                let selected = current?.text == category.value
                Button {
                    send(.set(id: invoiceAction("filter:category"), value: .string(category.value)))
                } label: {
                    HStack {
                        Text(category.label).font(ax.fontBase).foregroundStyle(ax.text)
                        Spacer(minLength: ax.space(3))
                        if selected { Image(systemName: "checkmark").foregroundStyle(ax.accent).font(.system(size: 13, weight: .semibold)) }
                    }
                    .frame(minHeight: 32)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
            }
        }
    }

    private var field: some View {
        let shape = RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous)
        let prompt = filter == "quantity" ? "Quantity is\u{2026}" : "\(title) contains\u{2026}"
        return Group {
            if isStatic {
                Text(text.isEmpty ? prompt : text).foregroundStyle(text.isEmpty ? ax.textDisabled : ax.text)
                    .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                TextField(title, text: $text, prompt: Text(prompt).foregroundColor(ax.textDisabled))
                    .textFieldStyle(.plain)
                    .foregroundStyle(ax.text)
                    #if os(iOS)
                    .keyboardType(filter == "quantity" ? .decimalPad : .default)
                    #endif
                    .onChange(of: text) { _, new in push(new) }
                    .onChange(of: current?.text ?? "") { _, core in adopt(core) }
            }
        }
        .font(ax.fontBase)
        .padding(.horizontal, ax.space(3))
        .frame(minHeight: 36 * min(ax.scale, 1.4))
        .background(shape.fill(ax.surface))
        .overlay(shape.strokeBorder(ax.borderStrong, lineWidth: 1))
    }

    /// What the user typed goes to the core; an empty box clears the filter.
    private func push(_ new: String) {
        let trimmed = new.trimmingCharacters(in: .whitespaces)
        if filter == "quantity" {
            if trimmed.isEmpty { clear(new) }
            else if let number = Double(trimmed) {
                sent.append(InvoiceModel.FilterValue.number(number).text)
                send(.set(id: invoiceAction("filter:quantity"), value: .number(number)))
            }
        } else if trimmed.isEmpty {
            clear(new)
        } else {
            sent.append(new)
            send(.set(id: invoiceAction("filter:\(filter)"), value: .string(new)))
        }
    }

    private func clear(_ new: String) {
        guard current != nil else { return }
        sent.append("")
        send(.press(id: invoiceAction("unfilter:\(filter)")))
    }

    /// A value the core holds that this box did not send (Clear all, or the chip's remove) replaces the text.
    private func adopt(_ core: String) {
        if let echoed = sent.firstIndex(of: core) {
            sent.removeFirst(echoed + 1)
        } else if core != text.trimmingCharacters(in: .whitespaces) {
            sent.removeAll()
            text = core
        }
    }
}
