import SwiftUI

/// The step indicator: four numbered stops joined by a line, each a button that jumps to its
/// step (`goto:<i>`; the core refuses to skip past a step with problems). A step with problems
/// shows the error mark in place of its own icon.
struct CheckoutStepper: View {
    let model: CheckoutModel
    let actions: CheckoutSender
    @Environment(\.ax) private var ax
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        Group {
            if typeSize.isAccessibilitySize {
                VStack(alignment: .leading, spacing: ax.space(2)) {
                    ForEach(Array(model.steps.enumerated()), id: \.offset) { index, step in
                        Button { actions.press("goto:\(index)") } label: {
                            HStack(spacing: ax.space(3)) {
                                stop(index, step)
                                Text(step.label).font(label(index)).foregroundStyle(color(index, step))
                                Spacer(minLength: 0)
                            }
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .modifier(StepAccessibility(model: model, index: index, step: step))
                    }
                }
            } else {
                HStack(alignment: .top, spacing: 0) {
                    ForEach(Array(model.steps.enumerated()), id: \.offset) { index, step in
                        Button { actions.press("goto:\(index)") } label: {
                            VStack(spacing: ax.space(1) + 2) {
                                ZStack {
                                    HStack(spacing: 0) {
                                        line(filled: index <= model.step).opacity(index == 0 ? 0 : 1)
                                        line(filled: index < model.step).opacity(index == model.steps.count - 1 ? 0 : 1)
                                    }
                                    stop(index, step)
                                }
                                Text(step.label)
                                    .font(label(index))
                                    .foregroundStyle(color(index, step))
                                    .lineLimit(1)
                                    .minimumScaleFactor(0.8)
                            }
                            .frame(maxWidth: .infinity)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .modifier(StepAccessibility(model: model, index: index, step: step))
                    }
                }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Checkout progress")
    }

    private func line(filled: Bool) -> some View {
        Rectangle().fill(filled ? ax.accent : ax.border).frame(height: 2).frame(maxWidth: .infinity)
    }

    private func label(_ index: Int) -> Font {
        index == model.step ? ax.font("font-size-sm", 12, weight: "font-weight-semibold") : ax.fontSmall
    }

    private func color(_ index: Int, _ step: CheckoutModel.Step) -> Color {
        if step.hasError { return ax.tone(.danger).text }
        return index == model.step ? ax.text : ax.textSecondary
    }

    private func symbol(_ step: CheckoutModel.Step) -> String {
        if step.hasError { return "exclamationmark.circle.fill" }
        switch step.icon {
        case "pin": return "mappin.and.ellipse"
        case "truck": return "box.truck"
        case "card": return "creditcard"
        default: return "cart"
        }
    }

    /// The circle of one step: solid for the current step, tinted for those behind it, quiet
    /// for those ahead, red when it has problems.
    private func stop(_ index: Int, _ step: CheckoutModel.Step) -> some View {
        let side = 34 * min(ax.scale, 1.4)
        let current = index == model.step
        let ground: Color
        let mark: Color
        if step.hasError {
            ground = ax.tone(.danger).muted; mark = ax.tone(.danger).text
        } else if current {
            ground = ax.accent; mark = ax.onAccent
        } else if index < model.step {
            ground = ax.accentMuted; mark = ax.tone(.accent).text
        } else {
            ground = ax.muted; mark = ax.iconSecondary
        }
        return Image(systemName: symbol(step))
            .font(.system(size: side * 0.44, weight: .medium))
            .foregroundStyle(mark)
            .frame(width: side, height: side)
            .background(Circle().fill(ground))
            .overlay(Circle().strokeBorder(step.hasError ? ax.tone(.danger).border : (current ? ax.accent : ax.border), lineWidth: 1))
            .background(Circle().fill(ax.page).padding(-3))
    }
}

/// "Shipping, step 2 of 4, current step, has problems" and the button/selected traits.
private struct StepAccessibility: ViewModifier {
    let model: CheckoutModel
    let index: Int
    let step: CheckoutModel.Step

    func body(content: Content) -> some View {
        content
            .accessibilityLabel("\(step.label), step \(index + 1) of \(model.steps.count)")
            .accessibilityValue(
                [index == model.step ? "Current step" : nil, step.hasError ? "Has problems" : nil]
                    .compactMap { $0 }.joined(separator: ", ")
            )
            .accessibilityAddTraits(index == model.step ? [.isButton, .isSelected] : .isButton)
    }
}
