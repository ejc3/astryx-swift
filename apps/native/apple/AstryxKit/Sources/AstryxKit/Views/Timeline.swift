import SwiftUI

/// `timeline`: dated entries on a rail, as the web draws them (web/src/render/timeline.tsx): a dot
/// per entry in its tone, the date, the title, a quotation exactly as the core gives it, and words.
/// The emphasized entry sits on a tinted ground with its quotation larger.
struct AXTimeline: View {
    let node: TimelineNode
    @Environment(\.ax) private var ax

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(node.entries.enumerated()), id: \.offset) { index, entry in
                AXTimelineEntry(entry: entry, outcomeLabel: node.outcomeLabel, last: index == node.entries.count - 1)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .contain)
        .accessibilityLabel(node.label)
    }
}

private struct AXTimelineEntry: View {
    let entry: TimelineNode.Entry
    let outcomeLabel: String?
    let last: Bool
    @Environment(\.ax) private var ax

    var body: some View {
        let dot: CGFloat = 12
        HStack(alignment: .top, spacing: ax.space(4)) {
            Circle()
                .fill(ax.fillTone(entry.tone))
                .frame(width: dot, height: dot)
                .padding(.top, entry.emphasized ? ax.space(4) + 2 : 4)
                .frame(width: 14)
                .accessibilityHidden(true)
            content
                .padding(.bottom, last ? 0 : ax.space(5))
        }
        .background(alignment: .topLeading) {
            // The rail, from below this entry's dot to the next entry.
            if !last {
                Rectangle().fill(ax.border).frame(width: 2)
                    .padding(.top, 18).padding(.leading, 6)
                    .frame(maxHeight: .infinity, alignment: .top)
                    .accessibilityHidden(true)
            }
        }
    }

    /// The text's measure (the web's 72ch): the highlighted entry's card and "What changed" stop there.
    static let measure: CGFloat = 620

    private var content: some View {
        let inner = VStack(alignment: .leading, spacing: ax.space(1)) {
            HStack(spacing: ax.space(2)) {
                Text(entry.when).font(ax.fontSmall.monospacedDigit()).foregroundStyle(ax.textSecondary)
                if let badge = entry.badge { AXBadge(text: badge, tone: entry.tone) }
            }
            Text(entry.title)
                .font(entry.emphasized ? ax.font("font-size-lg", 17, weight: "font-weight-semibold") : ax.fontStrong)
                .foregroundStyle(ax.text)
                .accessibilityAddTraits(.isHeader)
            if let quote = entry.quote {
                // Astryx's Blockquote: a rule at the start, secondary text, body size (larger when emphasized).
                Text(quote)
                    .font(entry.emphasized ? ax.font("font-size-lg", 17) : ax.fontBase)
                    .foregroundStyle(ax.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.leading, ax.space(4))
                    .overlay(alignment: .leading) { Rectangle().fill(ax.borderStrong).frame(width: ax.hair) }
                    .frame(maxWidth: Self.measure, alignment: .leading)
            }
            if let text = entry.text {
                Text(text).font(ax.fontBase).foregroundStyle(ax.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: Self.measure, alignment: .leading)
            }
            if let outcome = entry.outcome {
                // Astryx's muted Card.
                VStack(alignment: .leading, spacing: ax.hair) {
                    if let outcomeLabel { Text(outcomeLabel).font(ax.fontStrong).foregroundStyle(ax.text) }
                    Text(outcome).font(ax.fontBase).foregroundStyle(ax.text).fixedSize(horizontal: false, vertical: true)
                }
                .padding(ax.space(3))
                .frame(maxWidth: Self.measure, alignment: .leading)
                .background(RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous).fill(ax.muted))
                .padding(.top, ax.space(1))
            }
        }
        return Group {
            if entry.emphasized {
                // Astryx's Card on the soft accent.
                inner
                    .padding(ax.space(4))
                    .frame(maxWidth: Self.measure, alignment: .leading)
                    .background(RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous).fill(ax.accentSoft))
                    .overlay(RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous).strokeBorder(ax.border, lineWidth: 1))
            } else {
                inner.frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        // The title is the entry's heading; the rest are its own elements, so the Headings rotor reads titles only.
        .accessibilityElement(children: .contain)
    }
}
