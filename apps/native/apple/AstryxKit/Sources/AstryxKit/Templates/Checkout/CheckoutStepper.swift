import SwiftUI

/// The step indicator: a bar for each step with its icon and name under it, each a button that
/// jumps to its step (`goto:<i>`; the core refuses to skip past a step with problems). A step
/// with problems shows the error mark in place of its own icon.
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
                            VStack(alignment: .leading, spacing: ax.space(1)) {
                                bar(index, step)
                                caption(index, step, wraps: true)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .contentShape(Rectangle())
                            .axTapTarget(keepLayout: true)
                        }
                        .buttonStyle(.plain)
                        .modifier(StepAccessibility(model: model, index: index, step: step))
                    }
                }
            } else {
                // Astryx's form: a bar for each step, the step's icon and name in one row under it.
                HStack(alignment: .top, spacing: ax.space(1)) {
                    ForEach(Array(model.steps.enumerated()), id: \.offset) { index, step in
                        Button { actions.press("goto:\(index)") } label: {
                            VStack(alignment: .leading, spacing: ax.space(2)) {
                                bar(index, step)
                                caption(index, step, wraps: false)
                                    .padding(.horizontal, ax.space(2))
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .contentShape(Rectangle())
                            .axTapTarget(keepLayout: true)
                        }
                        .buttonStyle(.plain)
                        .modifier(StepAccessibility(model: model, index: index, step: step))
                    }
                }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(model.words.progress)
    }

    /// The step's bar: filled with the accent up to and including the current step, red when the
    /// step has problems.
    private func bar(_ index: Int, _ step: CheckoutModel.Step) -> some View {
        Capsule()
            .fill(step.hasError ? ax.tone(.danger).solid : (index <= model.step ? ax.accent : ax.border))
            .frame(height: ax.space(1))
    }

    private func caption(_ index: Int, _ step: CheckoutModel.Step, wraps: Bool) -> some View {
        HStack(spacing: ax.space(2)) {
            Image(systemName: symbol(step))
                .font(.system(size: ax.fontSize("font-size-base", 14), weight: .regular))
                .foregroundStyle(color(index, step))
            Text(step.label)
                .font(label(index))
                .foregroundStyle(color(index, step))
                .lineLimit(wraps ? nil : 1)
                .minimumScaleFactor(wraps ? 1 : 0.8)
        }
        .frame(minHeight: ax.space(5))
    }

    private func label(_ index: Int) -> Font {
        index == model.step ? ax.fontStrong : ax.fontBase
    }

    private func color(_ index: Int, _ step: CheckoutModel.Step) -> Color {
        if step.hasError { return ax.tone(.danger).text }
        return index == model.step ? ax.text : ax.textSecondary
    }

    private func symbol(_ step: CheckoutModel.Step) -> String {
        if step.hasError { return "exclamationmark.circle" }
        switch step.icon {
        case "pin": return "mappin.and.ellipse"
        case "truck": return "box.truck"
        case "card": return "creditcard"
        default: return "cart"
        }
    }
}

/// "Shipping, step 2 of 4, current step, has problems" and the button/selected traits.
private struct StepAccessibility: ViewModifier {
    let model: CheckoutModel
    let index: Int
    let step: CheckoutModel.Step

    func body(content: Content) -> some View {
        content
            .accessibilityLabel(step.spoken)
            .accessibilityValue(step.state)
            .accessibilityAddTraits(index == model.step ? [.isButton, .isSelected] : .isButton)
    }
}
