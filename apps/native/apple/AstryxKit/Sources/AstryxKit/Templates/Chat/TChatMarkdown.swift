import SwiftUI

/// The block structure of the Markdown the chat template carries: headings, paragraphs,
/// ordered and bulleted lists and pipe tables, with inline bold, italic and code. It is the
/// subset the model's own text uses, not a general Markdown engine.
enum TChatBlock {
    case heading(level: Int, text: String)
    case paragraph(String)
    case ordered([String])
    case bullets([String])
    case table(header: [String], rows: [[String]])

    static func parse(_ source: String) -> [TChatBlock] {
        var blocks: [TChatBlock] = []
        var paragraph: [String] = []
        let lines = source.replacingOccurrences(of: "\r\n", with: "\n").components(separatedBy: "\n")

        func flush() {
            if !paragraph.isEmpty { blocks.append(.paragraph(paragraph.joined(separator: " "))) }
            paragraph = []
        }
        func orderedItem(_ line: String) -> String? {
            guard let dot = line.firstIndex(of: "."), dot != line.startIndex,
                  line[line.startIndex..<dot].allSatisfy(\.isNumber),
                  line[line.index(after: dot)...].hasPrefix(" ") else { return nil }
            return String(line[line.index(after: dot)...]).trimmingCharacters(in: .whitespaces)
        }
        func bulletItem(_ line: String) -> String? {
            for mark in ["- ", "* ", "+ "] where line.hasPrefix(mark) {
                return String(line.dropFirst(2)).trimmingCharacters(in: .whitespaces)
            }
            return nil
        }
        func cells(_ line: String) -> [String] {
            var trimmed = line.trimmingCharacters(in: .whitespaces)
            if trimmed.hasPrefix("|") { trimmed.removeFirst() }
            if trimmed.hasSuffix("|") { trimmed.removeLast() }
            return trimmed.components(separatedBy: "|").map { $0.trimmingCharacters(in: .whitespaces) }
        }
        func isSeparator(_ line: String) -> Bool {
            let t = line.trimmingCharacters(in: .whitespaces)
            return t.contains("-") && t.allSatisfy { "|-: ".contains($0) }
        }

        var index = 0
        while index < lines.count {
            let line = lines[index].trimmingCharacters(in: .whitespaces)
            if line.isEmpty {
                flush()
            } else if line.hasPrefix("#") {
                flush()
                let level = line.prefix(while: { $0 == "#" }).count
                blocks.append(.heading(level: min(level, 6), text: String(line.dropFirst(level)).trimmingCharacters(in: .whitespaces)))
            } else if line.hasPrefix("|"), index + 1 < lines.count, isSeparator(lines[index + 1]) {
                flush()
                let header = cells(line)
                var rows: [[String]] = []
                index += 2
                while index < lines.count, lines[index].trimmingCharacters(in: .whitespaces).hasPrefix("|") {
                    rows.append(cells(lines[index]))
                    index += 1
                }
                blocks.append(.table(header: header, rows: rows))
                continue
            } else if let first = orderedItem(line) {
                flush()
                var items = [first]
                while index + 1 < lines.count, let next = orderedItem(lines[index + 1].trimmingCharacters(in: .whitespaces)) {
                    items.append(next)
                    index += 1
                }
                blocks.append(.ordered(items))
            } else if let first = bulletItem(line) {
                flush()
                var items = [first]
                while index + 1 < lines.count, let next = bulletItem(lines[index + 1].trimmingCharacters(in: .whitespaces)) {
                    items.append(next)
                    index += 1
                }
                blocks.append(.bullets(items))
            } else {
                paragraph.append(line)
            }
            index += 1
        }
        flush()
        return blocks
    }
}

/// Markdown drawn with the theme's type: `compact` for a chat bubble, regular for a document.
struct TChatMarkdown: View {
    let text: String
    var compact = true
    @Environment(\.ax) private var ax

    var body: some View {
        VStack(alignment: .leading, spacing: compact ? ax.space(2) : ax.space(3)) {
            ForEach(Array(TChatBlock.parse(text).enumerated()), id: \.offset) { _, block in
                blockView(block)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var bodyFont: Font { compact ? ax.fontBase : ax.font("font-size-base", 14).leading(.loose) }

    @ViewBuilder
    private func blockView(_ block: TChatBlock) -> some View {
        switch block {
        case .heading(let level, let text):
            // `##` is a document's section title; in a bubble it is just a stronger line.
            let rank = compact ? min(level + 2, 6) : min(level + 1, 6)
            Text(inline(text))
                .font(ax.heading(rank))
                .foregroundStyle(ax.text)
                .padding(.top, compact ? 0 : ax.space(3))
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
        case .paragraph(let text):
            Text(inline(text))
                .font(bodyFont)
                .foregroundStyle(ax.text)
                .fixedSize(horizontal: false, vertical: true)
        case .ordered(let items):
            list(items, markers: items.indices.map { "\($0 + 1)." })
        case .bullets(let items):
            list(items, markers: items.map { _ in "\u{2022}" })
        case .table(let header, let rows):
            TChatTable(header: header, rows: rows)
        }
    }

    private func list(_ items: [String], markers: [String]) -> some View {
        VStack(alignment: .leading, spacing: ax.space(1)) {
            ForEach(Array(items.enumerated()), id: \.offset) { index, item in
                HStack(alignment: .firstTextBaseline, spacing: ax.space(2)) {
                    Text(markers[index])
                        .font(bodyFont.monospacedDigit())
                        .foregroundStyle(ax.textSecondary)
                        .frame(minWidth: 18, alignment: .trailing)
                    Text(inline(item))
                        .font(bodyFont)
                        .foregroundStyle(ax.text)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }

    /// Inline Markdown (bold, italic, `code`) as styled text; code gets the theme's ground.
    private func inline(_ source: String) -> AttributedString { TChatMarkdown.inline(source, ax: ax) }

    static func inline(_ source: String, ax: AXStyle) -> AttributedString {
        var out = (try? AttributedString(markdown: source, options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace))) ?? AttributedString(source)
        for run in out.runs {
            if let intent = run.inlinePresentationIntent, intent.contains(.code) {
                out[run.range].font = ax.font("font-size-sm", 12.5, design: .monospaced)
                out[run.range].backgroundColor = ax.muted
            }
        }
        return out
    }
}

/// A pipe table: a header row and rows with hairlines between, as the web's Markdown table.
private struct TChatTable: View {
    let header: [String]
    let rows: [[String]]
    @Environment(\.ax) private var ax

    var body: some View {
        VStack(spacing: 0) {
            row(header, strong: true)
            ForEach(Array(rows.enumerated()), id: \.offset) { _, cells in
                Rectangle().fill(ax.border).frame(height: 1)
                row(cells, strong: false)
            }
        }
        .overlay(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).strokeBorder(ax.border, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous))
        .accessibilityElement(children: .contain)
    }

    private func row(_ cells: [String], strong: Bool) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: ax.space(3)) {
            ForEach(Array(cells.enumerated()), id: \.offset) { index, cell in
                Text(TChatMarkdown.inline(cell, ax: ax))
                    .font(strong ? ax.fontStrong : ax.fontBase)
                    .foregroundStyle(strong ? ax.text : ax.text)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: index == 0 ? .infinity : nil, alignment: .leading)
            }
        }
        .padding(.horizontal, ax.space(3))
        .padding(.vertical, ax.space(2))
        .background(strong ? ax.muted.opacity(0.6) : Color.clear)
        .accessibilityElement(children: .combine)
    }
}
