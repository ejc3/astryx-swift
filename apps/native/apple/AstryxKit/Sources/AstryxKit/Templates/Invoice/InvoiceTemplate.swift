import SwiftUI

/// Astryx's invoice template (`table-page`), drawn natively from the core's view model
/// (core/src/templates/invoice/model.ts, its `View` type).
///
/// A masthead (title, facts), a billing-basis switch and search, the line-item table with
/// sortable columns and per-column filters, the totals and, when the figures are partial, a banner.
struct InvoiceTemplate: View {
    let view: JSONValue

    var body: some View {
        switch decoded {
        case .success(let model): InvoiceScreen(model: model)
        case .failure(let error): AXTemplatePlaceholder(template: "invoice: \(error)")
        }
    }

    private var decoded: Result<InvoiceModel, Error> {
        Result { try view.decode(InvoiceModel.self) }
    }
}

/// The action id of the invoice template: `tpl.invoice.<what>`.
func invoiceAction(_ what: String) -> String { "tpl.invoice.\(what)" }

/// A column of the table: the words the web draws in its header (they are not in the model).
struct InvoiceColumn: Identifiable {
    var key: String
    var title: String
    /// The filter this column offers, named after the filter's column key.
    var filter: String?
    var width: CGFloat?
    var trailing: Bool

    var id: String { key }

    static let all: [InvoiceColumn] = [
        InvoiceColumn(key: "description", title: "Description", filter: "description", width: nil, trailing: false),
        InvoiceColumn(key: "category", title: "Category", filter: "category", width: 150, trailing: false),
        InvoiceColumn(key: "quantity", title: "Qty", filter: "quantity", width: 72, trailing: true),
        InvoiceColumn(key: "unitPrice", title: "Rate", filter: nil, width: 104, trailing: true),
        InvoiceColumn(key: "amount", title: "Amount", filter: nil, width: 132, trailing: true),
    ]
}

struct InvoiceScreen: View {
    let model: InvoiceModel
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send
    @Environment(\.axStatic) private var isStatic
    @Environment(\.axWidth) private var width
    @State private var query: String
    @State private var showingFilters = false

    init(model: InvoiceModel) {
        self.model = model
        _query = State(initialValue: model.query)
    }

    /// Below this the table cannot hold its five columns and each line becomes a small card.
    static let tableFrom: CGFloat = 640
    private var isTable: Bool { width >= Self.tableFrom }

    var body: some View {
        VStack(alignment: .leading, spacing: ax.space(6)) {
            masthead
            controls
            if !model.filters.isEmpty { activeFilters }
            lines
            if let banner = model.banner { bannerView(banner) }
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
    }

    // MARK: Masthead

    private var masthead: some View {
        VStack(alignment: .leading, spacing: ax.space(5)) {
            HStack(alignment: .center, spacing: ax.space(3)) {
                Text(model.title)
                    .font(ax.heading(1))
                    .foregroundStyle(ax.text)
                    .accessibilityAddTraits(.isHeader)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Button {
                } label: {
                    Label("Download PDF", systemImage: "arrow.down.to.line")
                }
                .buttonStyle(AXButtonStyle(variant: .secondary, ax: ax))
            }
            details
        }
    }

    /// The invoice facts, label over value, in as many columns as fit.
    private var details: some View {
        let columns = width >= 760 ? 3 : 2
        let rows = stride(from: 0, to: model.details.count, by: columns).map { start in
            Array(model.details[start..<min(start + columns, model.details.count)])
        }
        return Grid(alignment: .topLeading, horizontalSpacing: ax.space(6), verticalSpacing: ax.space(4)) {
            ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                GridRow {
                    ForEach(Array(row.enumerated()), id: \.offset) { _, detail in
                        VStack(alignment: .leading, spacing: ax.hair) {
                            Text(detail.label).font(ax.fontSmall).foregroundStyle(ax.textSecondary)
                            Text(detail.value).font(ax.fontLabel).foregroundStyle(ax.text)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .accessibilityElement(children: .combine)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: Controls

    private var controls: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: ax.space(3)) {
                basisSwitch
                Spacer(minLength: ax.space(3))
                searchBox.frame(width: 300)
            }
            VStack(alignment: .leading, spacing: ax.space(3)) {
                basisSwitch
                searchBox
                if !isTable { sortAndFilter }
            }
        }
    }

    @ViewBuilder
    private var basisSwitch: some View {
        if isStatic {
            StaticSegmented(
                options: model.basisFilters.map { Option(value: $0.value, label: $0.label, description: nil) },
                value: model.basis
            )
        } else {
            Picker("Filter by billing basis", selection: Binding(
                get: { model.basis },
                set: { send(.set(id: invoiceAction("basis"), value: .string($0))) }
            )) {
                ForEach(model.basisFilters) { Text($0.label).tag($0.value) }
            }
            .pickerStyle(.segmented)
            .labelsHidden()
            .fixedSize()
            .accessibilityLabel("Filter by billing basis")
        }
    }

    private var searchBox: some View {
        HStack(spacing: ax.space(2)) {
            Image(systemName: "magnifyingglass").foregroundStyle(ax.iconSecondary)
            if isStatic {
                Text(query.isEmpty ? "Search\u{2026}" : query)
                    .font(ax.fontBase)
                    .foregroundStyle(query.isEmpty ? ax.textDisabled : ax.text)
                    .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                TextField("Search line items", text: $query, prompt: Text("Search\u{2026}").foregroundColor(ax.textDisabled))
                    .textFieldStyle(.plain)
                    .font(ax.fontBase)
                    .foregroundStyle(ax.text)
                    #if os(iOS)
                    .submitLabel(.search)
                    #endif
            }
            if !query.isEmpty && !isStatic {
                Button {
                    query = ""
                } label: {
                    Image(systemName: "xmark.circle.fill").foregroundStyle(ax.iconSecondary)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Clear search")
            }
        }
        .padding(.horizontal, ax.space(3))
        .frame(minHeight: 36 * min(ax.scale, 1.4))
        .background(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).fill(ax.surface))
        .overlay(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).strokeBorder(ax.borderStrong, lineWidth: 1))
        .syncedText(id: invoiceAction("query"), value: model.query, text: $query)
    }

    /// On a phone, where the header cells are not there: a Sort menu and the filters in a popover.
    private var sortAndFilter: some View {
        HStack(spacing: ax.space(2)) {
            Menu {
                ForEach(InvoiceColumn.all) { column in
                    Button {
                        send(.set(id: invoiceAction("sort"), value: .string(InvoiceSort.next(after: model.sort.first, key: column.key))))
                    } label: {
                        if let sort = model.sort.first, sort.sortKey == column.key {
                            Label(column.title, systemImage: sort.direction == .ascending ? "chevron.up" : "chevron.down")
                        } else {
                            Text(column.title)
                        }
                    }
                }
                if !model.sort.isEmpty {
                    Divider()
                    Button("None") { send(.set(id: invoiceAction("sort"), value: .string(""))) }
                }
            } label: {
                Label(sortTitle, systemImage: "arrow.up.arrow.down")
                    .font(ax.fontLabel)
                    .foregroundStyle(ax.text)
                    .padding(.horizontal, ax.space(3))
                    .frame(minHeight: 36 * min(ax.scale, 1.4))
                    .overlay(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).strokeBorder(ax.borderStrong, lineWidth: 1))
                    .contentShape(Rectangle())
            }
            .menuStyle(.button)
            .buttonStyle(.plain)
            .menuIndicator(.hidden)
            .fixedSize()
            .accessibilityLabel("Sort")

            Button {
                showingFilters = true
            } label: {
                Label("Filter", systemImage: model.filters.isEmpty ? "line.3.horizontal.decrease" : "line.3.horizontal.decrease.circle.fill")
                    .font(ax.fontLabel)
                    .foregroundStyle(model.filters.isEmpty ? ax.text : ax.accent)
                    .padding(.horizontal, ax.space(3))
                    .frame(minHeight: 36 * min(ax.scale, 1.4))
                    .overlay(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).strokeBorder(ax.borderStrong, lineWidth: 1))
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .popover(isPresented: $showingFilters) {
                ScrollView {
                    VStack(alignment: .leading, spacing: ax.space(4)) {
                        ForEach(InvoiceColumn.all.filter { $0.filter != nil }) { column in
                            VStack(alignment: .leading, spacing: ax.space(1)) {
                                Text(column.title).font(ax.fontLabel).foregroundStyle(ax.text)
                                InvoiceFilterEditor(model: model, filter: column.filter ?? "", title: column.title)
                            }
                        }
                    }
                    .padding(ax.space(4))
                }
                .frame(minWidth: 280, idealWidth: 320, maxHeight: 460)
                .presentationCompactAdaptation(.popover)
            }
            .accessibilityLabel("Filter")
            .accessibilityValue(model.filters.isEmpty ? "" : "active")
            Spacer(minLength: 0)
        }
    }

    private var sortTitle: String {
        guard let sort = model.sort.first,
              let column = InvoiceColumn.all.first(where: { $0.key == sort.sortKey }) else { return "Sort" }
        return column.title
    }

    // MARK: Active filters

    private var activeFilters: some View {
        let columns = InvoiceColumn.all.compactMap { column -> (String, String, String)? in
            guard let key = column.filter, let value = model.filters[key] else { return nil }
            let shown = key == "category" ? (model.categories.first { $0.value == value.text }?.label ?? value.text) : value.text
            return (key, column.title, shown)
        }
        return FlowLayout(spacing: ax.space(2), crossAlignment: 0.5) {
            ForEach(columns, id: \.0) { key, title, value in
                HStack(spacing: ax.space(1)) {
                    Text("\(title): \(value)")
                        .font(ax.font("font-size-sm", 12, weight: "font-weight-medium"))
                        .foregroundStyle(ax.tone(.accent).text)
                        .lineLimit(1)
                    Button {
                        send(.press(id: invoiceAction("unfilter:\(key)")))
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: ax.fontSize("font-size-2xs", 8), weight: .bold))
                            .foregroundStyle(ax.tone(.accent).text)
                            .padding(ax.space(1))
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Remove filter \(title)")
                }
                .padding(.leading, ax.space(2))
                .padding(.trailing, ax.space(1))
                .padding(.vertical, ax.hair)
                .background(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).fill(ax.accentMuted))
                .accessibilityElement(children: .contain)
            }
        }
    }

    // MARK: Table, totals, empty state

    @ViewBuilder
    private var lines: some View {
        if let empty = model.empty {
            emptyState(empty)
        } else {
            VStack(alignment: .leading, spacing: ax.space(4)) {
                if isTable {
                    InvoiceTable(model: model)
                } else {
                    InvoiceCards(model: model)
                }
                totals
            }
        }
    }

    private func emptyState(_ empty: InvoiceModel.Notice) -> some View {
        VStack(spacing: ax.space(3)) {
            Image(systemName: "doc.text.magnifyingglass")
                .font(.system(size: ax.fontSize("font-size-2xl", 24)))
                .foregroundStyle(ax.iconSecondary)
                .frame(width: 56 * min(ax.scale, 1.5), height: 56 * min(ax.scale, 1.5))
                .background(Circle().fill(ax.muted))
            VStack(spacing: ax.hair) {
                Text(empty.title).font(ax.fontStrong).foregroundStyle(ax.text)
                Text(empty.description).font(ax.fontBase).foregroundStyle(ax.textSecondary)
                    .multilineTextAlignment(.center)
            }
            Button("Clear filters") { send(.press(id: invoiceAction("clear"))) }
                .buttonStyle(AXButtonStyle(variant: .secondary, ax: ax))
        }
        .padding(ax.space(8))
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .contain)
    }

    /// The arithmetic about the table: rules and right-aligned figures on the Amount column.
    private var totals: some View {
        VStack(spacing: ax.space(3)) {
            InboxHairline()
            ForEach(Array(model.totals.enumerated()), id: \.offset) { index, total in
                totalRow(total)
                if index == model.totals.count - 2 || index == model.totals.count - 1 { InboxHairline() }
            }
        }
        .accessibilityElement(children: .contain)
    }

    private func totalRow(_ total: InvoiceModel.Total) -> some View {
        let strong = total.emphasis == .strong
        let weight = strong ? "font-weight-semibold" : "font-weight-normal"
        let label = Text(total.label)
            .font(ax.font("font-size-base", 14, weight: weight))
            .foregroundStyle(total.emphasis == .muted ? ax.textSecondary : ax.text)
        let value = Text(total.value)
            .font(ax.font("font-size-base", 14, weight: weight).monospacedDigit())
            .foregroundStyle(ax.text)
        return HStack(spacing: ax.space(6)) {
            if isTable {
                Spacer(minLength: 0)
                label
                value.frame(width: 132, alignment: .trailing)
            } else {
                label
                Spacer(minLength: ax.space(3))
                value
            }
        }
        .accessibilityElement(children: .combine)
    }

    // MARK: Banner

    private func bannerView(_ banner: InvoiceModel.Notice) -> some View {
        let colors = ax.tone(.warning)
        let button = Button("Clear all filters") { send(.press(id: invoiceAction("clear"))) }
            .buttonStyle(AXButtonStyle(variant: .secondary, ax: ax))
        return ViewThatFits(in: .horizontal) {
            HStack(alignment: .center, spacing: ax.space(3)) {
                bannerText(banner, colors: colors)
                button
            }
            VStack(alignment: .leading, spacing: ax.space(3)) {
                bannerText(banner, colors: colors)
                button
            }
        }
        .padding(ax.space(3))
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous).fill(colors.muted))
        .overlay(RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous).strokeBorder(colors.border.opacity(0.6), lineWidth: 1))
        .accessibilityElement(children: .contain)
    }

    private func bannerText(_ banner: InvoiceModel.Notice, colors: ToneColors) -> some View {
        HStack(alignment: .top, spacing: ax.space(3)) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: ax.fontSize("font-size-lg", 17)))
                .foregroundStyle(colors.text)
            VStack(alignment: .leading, spacing: ax.space(1)) {
                Text(banner.title).font(ax.fontStrong).foregroundStyle(colors.text)
                Text(banner.description).font(ax.fontBase).foregroundStyle(ax.text)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

/// Which way a column sorts next: ascending, then descending, then not at all.
enum InvoiceSort {
    static func next(after current: InvoiceModel.Sort?, key: String) -> String {
        guard let current, current.sortKey == key else { return "\(key):ascending" }
        return current.direction == .ascending ? "\(key):descending" : ""
    }
}
