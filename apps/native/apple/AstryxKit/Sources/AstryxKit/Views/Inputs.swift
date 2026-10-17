import SwiftUI

/// A label above a control, with the core's hint or error below it.
struct AXField<Content: View>: View {
    let label: String
    var hint: String? = nil
    var error: String? = nil
    @ViewBuilder var content: Content
    @Environment(\.ax) private var ax

    var body: some View {
        VStack(alignment: .leading, spacing: ax.space(1)) {
            if !label.isEmpty {
                Text(label).font(ax.fontLabel).foregroundStyle(ax.text)
            }
            content
            if let error {
                Text(error).font(ax.fontSmall).foregroundStyle(ax.tone(.danger).text)
            } else if let hint {
                Text(hint).font(ax.fontSmall).foregroundStyle(ax.textSecondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// The text a field shows while the user is typing, reconciled with the snapshot's value.
///
/// Typing is kept in local state so it is never laggy. Each change is sent; when the core's
/// snapshot echoes one of the values already sent it is ignored, and when it holds any other
/// value (the core changed it) the snapshot wins.
struct SyncedText: ViewModifier {
    let id: String
    let value: String
    @Binding var text: String
    @State private var pending: [String] = []
    @State private var adopted: String?
    @Environment(\.axSend) private var send

    func body(content: Content) -> some View {
        content
            .onChange(of: value) { _, new in
                if let index = pending.firstIndex(of: new) {
                    pending.removeFirst(index + 1)
                } else if new != text {
                    pending.removeAll()
                    adopted = new
                    text = new
                }
            }
            .onChange(of: text) { _, new in
                if adopted == new { adopted = nil; return }
                if new == value && pending.isEmpty { return }
                pending.append(new)
                send(.set(id: id, value: .string(new)))
            }
    }
}

extension View {
    func syncedText(id: String, value: String, text: Binding<String>) -> some View {
        modifier(SyncedText(id: id, value: value, text: text))
    }
}

/// `textInput`: a TextField, SecureField or TextEditor on the theme's surface. It shows the
/// snapshot's value and sends `set` as you type.
struct AXTextInput: View {
    let node: TextInputNode
    @State private var text: String
    @Environment(\.ax) private var ax
    @Environment(\.axStatic) private var isStatic

    init(node: TextInputNode) {
        self.node = node
        _text = State(initialValue: node.value)
    }

    var body: some View {
        AXField(label: node.label, hint: node.hint, error: node.error) {
            HStack(alignment: node.multiline == true ? .top : .center, spacing: ax.space(2)) {
                if let icon = node.icon {
                    Image(systemName: icon.symbol)
                        .foregroundStyle(ax.iconSecondary)
                        .padding(.top, node.multiline == true ? ax.space(1) : 0)
                }
                field
            }
            .padding(.horizontal, ax.space(3))
            .padding(.vertical, node.multiline == true ? ax.space(2) : ax.space(2) + 2)
            .frame(minHeight: 36 * min(ax.scale, 1.4))
            .background(RoundedRectangle(cornerRadius: radius, style: .continuous).fill(ax.surface))
            .overlay(
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .strokeBorder(node.error == nil ? ax.borderStrong : ax.danger, lineWidth: 1)
            )
        }
        .syncedText(id: node.id, value: node.value, text: $text)
    }

    /// A tall field keeps a corner that fits it even where the theme's element radius is a pill.
    private var radius: CGFloat {
        node.multiline == true ? min(ax.radiusElement, ax.radiusContainer) : ax.radiusElement
    }

    @ViewBuilder
    private var field: some View {
        if isStatic {
            let shown = node.secure == true ? String(repeating: "\u{2022}", count: text.count) : text
            Text(shown.isEmpty ? node.placeholder : shown)
                .font(ax.fontBase)
                .foregroundStyle(shown.isEmpty ? ax.textDisabled : ax.text)
                .frame(maxWidth: .infinity, minHeight: node.multiline == true ? 72 * min(ax.scale, 1.4) : 0, alignment: .topLeading)
        } else if node.multiline == true {
            TextEditor(text: $text)
                .scrollContentBackground(.hidden)
                .font(ax.fontBase)
                .foregroundStyle(ax.text)
                .frame(minHeight: 72 * min(ax.scale, 1.4))
                .overlay(alignment: .topLeading) {
                    if text.isEmpty {
                        Text(node.placeholder)
                            .font(ax.fontBase)
                            .foregroundStyle(ax.textDisabled)
                            .padding(.leading, 5)
                            .allowsHitTesting(false)
                    }
                }
                .accessibilityLabel(node.label)
        } else if node.secure == true {
            SecureField(node.label, text: $text, prompt: Text(node.placeholder).foregroundColor(ax.textDisabled))
                .textFieldStyle(.plain)
                .font(ax.fontBase)
                .foregroundStyle(ax.text)
        } else {
            TextField(node.label, text: $text, prompt: Text(node.placeholder).foregroundColor(ax.textDisabled))
                .textFieldStyle(.plain)
                .font(ax.fontBase)
                .foregroundStyle(ax.text)
        }
    }
}

/// `switch`: a native Toggle tinted with the accent. It sends `set` with the new Bool.
struct AXSwitch: View {
    let node: SwitchNode
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send
    @Environment(\.axStatic) private var isStatic

    var body: some View {
        if isStatic {
            HStack {
                VStack(alignment: .leading, spacing: ax.hair) {
                    Text(node.label).font(ax.fontLabel).foregroundStyle(ax.text)
                    if let description = node.description {
                        Text(description).font(ax.fontSmall).foregroundStyle(ax.textSecondary)
                    }
                }
                Spacer(minLength: ax.space(3))
                StaticSwitch(on: node.on)
            }
        } else {
            toggle
        }
    }

    private var toggle: some View {
        Toggle(isOn: Binding(
            get: { node.on },
            set: { send(.set(id: node.id, value: .bool($0))) }
        )) {
            VStack(alignment: .leading, spacing: ax.hair) {
                Text(node.label).font(ax.fontLabel).foregroundStyle(ax.text)
                if let description = node.description {
                    Text(description).font(ax.fontSmall).foregroundStyle(ax.textSecondary)
                }
            }
        }
        .toggleStyle(.switch)
        .tint(ax.accent)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// The box of a checkbox, drawn with the tokens (the platforms have no shared checkbox).
struct AXCheckmark: View {
    let checked: Bool
    @Environment(\.ax) private var ax

    var body: some View {
        let side = 18 * min(ax.scale, 1.5)
        RoundedRectangle(cornerRadius: ax.radiusInner + 1, style: .continuous)
            .fill(checked ? ax.accent : ax.surface)
            .overlay(
                RoundedRectangle(cornerRadius: ax.radiusInner + 1, style: .continuous)
                    .strokeBorder(checked ? ax.accent : ax.borderStrong, lineWidth: 1.5)
            )
            .overlay {
                if checked {
                    Image(systemName: "checkmark")
                        .font(.system(size: side * 0.6, weight: .bold))
                        .foregroundStyle(ax.onAccent)
                }
            }
            .frame(width: side, height: side)
    }
}

/// `checkbox`: sends `set` with the new Bool.
struct AXCheckbox: View {
    let node: CheckboxNode
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send

    var body: some View {
        Button {
            send(.set(id: node.id, value: .bool(!node.checked)))
        } label: {
            HStack(spacing: ax.space(2)) {
                AXCheckmark(checked: node.checked)
                Text(node.label).font(ax.fontBase).foregroundStyle(ax.text)
                Spacer(minLength: 0)
            }
            .frame(minHeight: 32)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(node.checked ? [.isSelected, .isButton] : .isButton)
    }
}

/// `radio`: a group of options drawn as rows. Choosing one sends `set` with its value.
struct AXRadio: View {
    let node: ChoiceNode
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send

    var body: some View {
        AXField(label: node.label) {
            VStack(alignment: .leading, spacing: ax.space(1)) {
                ForEach(node.options, id: \.value) { option in
                    let selected = option.value == node.value
                    Button {
                        send(.set(id: node.id, value: .string(option.value)))
                    } label: {
                        HStack(alignment: .top, spacing: ax.space(3)) {
                            Circle()
                                .strokeBorder(selected ? ax.accent : ax.borderStrong, lineWidth: selected ? 5 : 1.5)
                                .background(Circle().fill(ax.surface))
                                .frame(width: 18 * min(ax.scale, 1.5), height: 18 * min(ax.scale, 1.5))
                                .padding(.top, 1)
                            VStack(alignment: .leading, spacing: ax.hair) {
                                Text(option.label).font(ax.fontLabel).foregroundStyle(ax.text)
                                if let description = option.description {
                                    Text(description).font(ax.fontSmall).foregroundStyle(ax.textSecondary)
                                        .multilineTextAlignment(.leading)
                                }
                            }
                            Spacer(minLength: 0)
                        }
                        .padding(.vertical, ax.space(1))
                        .frame(minHeight: 32)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityElement(children: .combine)
                    .accessibilityAddTraits(selected ? [.isSelected, .isButton] : .isButton)
                }
            }
        }
    }
}

/// `segmented`: a native segmented Picker. It sends `set` with the chosen value.
struct AXSegmented: View {
    let node: ChoiceNode
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send
    @Environment(\.axStatic) private var isStatic

    var body: some View {
        AXField(label: node.label) {
            if isStatic {
                StaticSegmented(options: node.options, value: node.value)
            } else {
            Picker(node.label, selection: Binding(
                get: { node.value },
                set: { send(.set(id: node.id, value: .string($0))) }
            )) {
                ForEach(node.options, id: \.value) { option in
                    Text(option.label).tag(option.value)
                }
            }
            .pickerStyle(.segmented)
            .labelsHidden()
            .tint(ax.accent)
            }
        }
    }
}

/// `select`: a Menu whose button shows the chosen option. It sends `set` with the new value.
struct AXSelect: View {
    let node: ChoiceNode
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send

    var body: some View {
        AXField(label: node.label) {
            Menu {
                ForEach(node.options, id: \.value) { option in
                    Button {
                        send(.set(id: node.id, value: .string(option.value)))
                    } label: {
                        if option.value == node.value {
                            Label(option.label, systemImage: "checkmark")
                        } else {
                            Text(option.label)
                        }
                    }
                }
            } label: {
                HStack(spacing: ax.space(2)) {
                    Text(node.options.first { $0.value == node.value }?.label ?? node.value)
                        .font(ax.fontBase)
                        .foregroundStyle(ax.text)
                    Spacer(minLength: 0)
                    Image(systemName: "chevron.up.chevron.down")
                        .font(.system(size: ax.fontSize("font-size-xs", 10), weight: .semibold))
                        .foregroundStyle(ax.iconSecondary)
                }
                .padding(.horizontal, ax.space(3))
                .frame(minHeight: 36 * min(ax.scale, 1.4))
                .background(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).fill(ax.surface))
                .overlay(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).strokeBorder(ax.borderStrong, lineWidth: 1))
                .contentShape(Rectangle())
            }
            .menuStyle(.button)
            .buttonStyle(.plain)
            .menuIndicator(.hidden)
            .accessibilityLabel(node.label)
        }
    }
}

/// `slider`: a native Slider with the core's value text. It sends `set` with the new Double.
struct AXSlider: View {
    let node: SliderNode
    @State private var value: Double
    @State private var dragging = false
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send
    @Environment(\.axStatic) private var isStatic

    init(node: SliderNode) {
        self.node = node
        _value = State(initialValue: node.value)
    }

    var body: some View {
        AXField(label: "") {
            VStack(alignment: .leading, spacing: ax.space(1)) {
                HStack {
                    Text(node.label).font(ax.fontLabel).foregroundStyle(ax.text)
                    Spacer(minLength: ax.space(2))
                    Text(node.valueText).font(ax.fontBase.monospacedDigit()).foregroundStyle(ax.textSecondary)
                }
                if isStatic {
                    StaticSlider(fraction: (node.value - node.min) / max(node.max - node.min, 1))
                } else {
                Slider(value: $value, in: node.min...max(node.max, node.min + node.step), step: node.step > 0 ? node.step : 1) { editing in
                    dragging = editing
                }
                .tint(ax.accent)
                .accessibilityLabel(node.label)
                .accessibilityValue(node.valueText)
                }
            }
        }
        .onChange(of: value) { _, new in
            if new != node.value { send(.set(id: node.id, value: .number(new))) }
        }
        .onChange(of: node.value) { _, new in
            if !dragging, new != value { value = new }
        }
    }
}

/// `tabs`: a row of tabs with an accent underline on the chosen one. Sends `set`.
struct AXTabs: View {
    let node: TabsNode
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send

    var body: some View {
        AXHScroll {
            HStack(spacing: ax.space(1)) {
                ForEach(node.tabs, id: \.value) { tab in
                    let selected = tab.value == node.value
                    Button {
                        send(.set(id: node.id, value: .string(tab.value)))
                    } label: {
                        HStack(spacing: ax.space(2)) {
                            Text(tab.label)
                                .font(selected ? ax.fontStrong : ax.fontLabel)
                                .foregroundStyle(selected ? ax.text : ax.textSecondary)
                            if let count = tab.count {
                                Text(count)
                                    .font(ax.font("font-size-xs", 10, weight: "font-weight-semibold").monospacedDigit())
                                    .foregroundStyle(selected ? ax.tone(.accent).text : ax.textSecondary)
                                    .padding(.horizontal, ax.space(half: 1))
                                    .padding(.vertical, 1)
                                    .background(Capsule().fill(selected ? ax.accentMuted : ax.muted))
                            }
                        }
                        .padding(.horizontal, ax.space(3))
                        .frame(minHeight: 36)
                        .overlay(alignment: .bottom) {
                            Rectangle().fill(selected ? ax.accent : .clear).frame(height: 2)
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(selected ? [.isSelected, .isButton] : .isButton)
                }
            }
        }
        .overlay(alignment: .bottom) {
            Rectangle().fill(ax.border).frame(height: 1).allowsHitTesting(false)
        }
    }
}
