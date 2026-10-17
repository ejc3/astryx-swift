import SwiftUI

// Stand-ins for the controls ImageRenderer cannot draw. They are used only when
// `\.axStatic` is set (tests that render a screen to a PNG); they paint the same tokens.

struct StaticSwitch: View {
    let on: Bool
    @Environment(\.ax) private var ax

    var body: some View {
        Capsule()
            .fill(on ? ax.accent : ax.track)
            .frame(width: 38, height: 22)
            .overlay(alignment: on ? .trailing : .leading) {
                Circle().fill(.white).padding(2).frame(width: 22, height: 22)
            }
    }
}

struct StaticSegmented: View {
    let options: [Option]
    let value: String
    @Environment(\.ax) private var ax

    var body: some View {
        HStack(spacing: 2) {
            ForEach(options, id: \.value) { option in
                Text(option.label)
                    .font(ax.fontLabel)
                    .foregroundStyle(ax.text)
                    .lineLimit(1)
                    .padding(.horizontal, ax.space(3))
                    .frame(minHeight: 28)
                    .background(
                        RoundedRectangle(cornerRadius: ax.radiusElement - 2, style: .continuous)
                            .fill(option.value == value ? ax.surface : .clear)
                            .shadow(color: option.value == value ? ax.shadow : .clear, radius: 1, y: 1)
                    )
            }
        }
        .padding(2)
        .background(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).fill(ax.muted))
    }
}

struct StaticSlider: View {
    let fraction: Double
    @Environment(\.ax) private var ax

    var body: some View {
        Capsule().fill(ax.track.opacity(0.6)).frame(height: 4)
            .overlay(alignment: .leading) {
                GeometryReader { geo in
                    Capsule().fill(ax.accent).frame(width: geo.size.width * min(max(fraction, 0), 1))
                    Circle().fill(.white).frame(width: 20, height: 20)
                        .shadow(color: ax.shadow, radius: 2, y: 1)
                        .position(x: geo.size.width * min(max(fraction, 0), 1), y: geo.size.height / 2)
                }
            }
            .frame(height: 20)
    }
}

/// A horizontal scroller, or its content laid out and clipped when drawing without a window.
struct AXHScroll<Content: View>: View {
    @ViewBuilder var content: Content
    @Environment(\.axStatic) private var isStatic

    var body: some View {
        if isStatic {
            content.frame(maxWidth: .infinity, alignment: .leading).clipped()
        } else {
            ScrollView(.horizontal, showsIndicators: false) { content }
        }
    }
}
