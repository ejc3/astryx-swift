import SwiftUI

/// Shared pieces of the accessibility work: hit targets, checkbox semantics, Reduce Motion and
/// Differentiate Without Color.

/// The smallest hit region the HIG allows for a control (Buttons, Accessibility: 44 x 44 pt).
let axMinTarget: CGFloat = 44

/// Places `content` at its own size and adds a clear hit area of at least 44 x 44 pt around its
/// center, without changing the size the layout gives it. The control stays as compact as the
/// design draws it; the taps around it still reach it.
private struct AXTapLayout: Layout {
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        subviews.first?.sizeThatFits(proposal) ?? .zero
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        guard let content = subviews.first else { return }
        let center = CGPoint(x: bounds.midX, y: bounds.midY)
        content.place(at: center, anchor: .center, proposal: ProposedViewSize(bounds.size))
        if subviews.count > 1 {
            let hit = ProposedViewSize(width: Swift.max(bounds.width, axMinTarget), height: Swift.max(bounds.height, axMinTarget))
            subviews[1].place(at: center, anchor: .center, proposal: hit)
        }
    }
}

private struct AXTapTarget: ViewModifier {
    let keepLayout: Bool

    func body(content: Content) -> some View {
        if keepLayout {
            AXTapLayout {
                content
                Color.clear.contentShape(Rectangle())
            }
        } else {
            content
                .frame(minWidth: axMinTarget, minHeight: axMinTarget)
                .contentShape(Rectangle())
        }
    }
}

extension View {
    /// A hit region of at least 44 x 44 pt. Put it on the label inside a `Button`, not on the
    /// button itself. With `keepLayout` the drawn control keeps the room the design gives it
    /// (the region reaches past it into the gaps); without, the control takes 44 x 44.
    func axTapTarget(keepLayout: Bool = false) -> some View {
        modifier(AXTapTarget(keepLayout: keepLayout))
    }

    /// A checkbox or switch-like control, announced as a toggle with its state as the value (the
    /// system speaks "1" and "0" in the person's language, the same as a `Toggle`).
    func axToggleSemantics(isOn: Bool) -> some View {
        accessibilityAddTraits(.isToggle)
            .accessibilityValue(isOn ? "1" : "0")
    }
}

/// A status dot that does not rely on its color: under Differentiate Without Color the dot
/// becomes a glyph whose shape says the tone (check, warning triangle, cross, info, dot).
struct AXToneMark: View {
    let tone: Tone
    var diameter: CGFloat = 8
    @Environment(\.ax) private var ax
    @Environment(\.accessibilityDifferentiateWithoutColor) private var differentiate

    var body: some View {
        if differentiate {
            Image(systemName: symbol)
                .font(.system(size: diameter * 1.5, weight: .bold))
                .foregroundStyle(ax.tone(tone).solid)
                .frame(width: diameter * 1.5, height: diameter * 1.5)
                .accessibilityHidden(true)
        } else {
            Circle().fill(ax.tone(tone).solid).frame(width: diameter, height: diameter)
                .accessibilityHidden(true)
        }
    }

    private var symbol: String {
        switch tone {
        case .success: "checkmark.circle.fill"
        case .warning: "exclamationmark.triangle.fill"
        case .danger: "xmark.octagon.fill"
        case .info: "info.circle.fill"
        case .accent: "diamond.fill"
        case .neutral: "circle.fill"
        }
    }
}

/// A small dot that is a circle, or under Differentiate Without Color a shape that says the tone
/// (circle, square, triangle, diamond), for marks too small to hold a glyph (calendar events).
struct AXToneDot: View {
    let tone: Tone
    var diameter: CGFloat = 5
    @Environment(\.ax) private var ax
    @Environment(\.accessibilityDifferentiateWithoutColor) private var differentiate

    var body: some View {
        let color = ax.tone(tone).solid
        Group {
            if differentiate {
                switch tone {
                case .success: Rectangle().fill(color)
                case .warning: AXTriangle().fill(color)
                case .danger: Rectangle().fill(color).rotationEffect(.degrees(45)).scaleEffect(0.8)
                case .info: AXTriangle().fill(color).rotationEffect(.degrees(180))
                case .accent, .neutral: Circle().fill(color)
                }
            } else {
                Circle().fill(color)
            }
        }
        .frame(width: differentiate ? diameter + 2 : diameter, height: differentiate ? diameter + 2 : diameter)
        .accessibilityHidden(true)
    }
}

private struct AXTriangle: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.midX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
        path.closeSubpath()
        return path
    }
}

// MARK: Rows that stack

extension View {
    /// The view at its one-line width, so that `ViewThatFits` can tell whether a row of them
    /// fits (a flexible `Text` would otherwise squeeze into any width and report a fit).
    func axOneLine() -> some View {
        fixedSize(horizontal: true, vertical: false)
    }

    /// A control in a stacked column: the full width, its label wrapping between words
    /// (never inside one) and growing in height rather than being cut.
    func axStackedFill() -> some View {
        frame(maxWidth: .infinity)
            .fixedSize(horizontal: false, vertical: true)
    }
}

/// A row of controls that becomes a column when they cannot sit side by side: at once at
/// accessibility text sizes (the HIG: stack instead of truncate), and at any size when the
/// row is wider than the screen. Build the row with `axOneLine()` on what must not wrap and
/// the column with `axStackedFill()` on its buttons.
struct AXAdaptiveRow<Row: View, Column: View>: View {
    @Environment(\.dynamicTypeSize) private var typeSize
    private let row: Row
    private let column: Column

    init(@ViewBuilder row: () -> Row, @ViewBuilder column: () -> Column) {
        self.row = row()
        self.column = column()
    }

    var body: some View {
        if typeSize.isAccessibilitySize {
            column
        } else {
            ViewThatFits(in: .horizontal) {
                row
                column
            }
        }
    }
}
