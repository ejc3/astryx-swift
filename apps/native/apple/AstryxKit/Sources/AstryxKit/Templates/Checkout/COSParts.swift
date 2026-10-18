import SwiftUI

// Pieces the checkout, order and settings drawings share (COS = checkout, order, settings):
// form fields with the right keyboards, a menu select, switches, buttons, banners, a collapsible
// and the product tile. They read every color, radius, spacing and size from the theme's tokens.

// MARK: Text entry

/// What a text field is for, so the platform can offer the right keyboard, autofill and
/// capitalization. Only iOS has these; on the Mac a field is a field.
enum COSContent {
    case plain, email, fullName, givenName, familyName, street, street2, city, postalCode
    case cardNumber, cardExpiry, cardCode, username, password, newPassword, code, integer
}

extension View {
    @ViewBuilder
    func cosContent(_ content: COSContent) -> some View {
        #if os(iOS)
        switch content {
        case .plain:
            self
        case .email:
            self.keyboardType(.emailAddress).textContentType(.emailAddress)
                .textInputAutocapitalization(.never).autocorrectionDisabled()
        case .fullName:
            self.textContentType(.name).textInputAutocapitalization(.words)
        case .givenName:
            self.textContentType(.givenName).textInputAutocapitalization(.words)
        case .familyName:
            self.textContentType(.familyName).textInputAutocapitalization(.words)
        case .street:
            self.textContentType(.streetAddressLine1).textInputAutocapitalization(.words)
        case .street2:
            self.textContentType(.streetAddressLine2).textInputAutocapitalization(.words)
        case .city:
            self.textContentType(.addressCity).textInputAutocapitalization(.words)
        case .postalCode:
            self.textContentType(.postalCode).textInputAutocapitalization(.characters).autocorrectionDisabled()
        case .cardNumber:
            self.keyboardType(.numberPad).textContentType(.creditCardNumber).autocorrectionDisabled()
        case .cardExpiry:
            self.keyboardType(.numbersAndPunctuation).textContentType(.creditCardExpiration).autocorrectionDisabled()
        case .cardCode:
            self.keyboardType(.numberPad).textContentType(.creditCardSecurityCode).autocorrectionDisabled()
        case .username:
            self.textContentType(.username).textInputAutocapitalization(.never).autocorrectionDisabled()
        case .password:
            self.textContentType(.password).textInputAutocapitalization(.never).autocorrectionDisabled()
        case .newPassword:
            self.textContentType(.newPassword).textInputAutocapitalization(.never).autocorrectionDisabled()
        case .code:
            self.textInputAutocapitalization(.characters).autocorrectionDisabled()
        case .integer:
            self.keyboardType(.numberPad)
        }
        #else
        self
        #endif
    }
}

/// Moves keyboard focus to a field of a form by key, when the form gave a focus binding.
private struct COSFocusModifier: ViewModifier {
    let binding: FocusState<String?>.Binding?
    let key: String

    func body(content: Content) -> some View {
        if let binding {
            content.focused(binding, equals: key)
        } else {
            content
        }
    }
}

/// A label above a control with an "Optional" mark, a hint or error below, and (for a label
/// with a tooltip in the web page) an info button that opens the tooltip's words in a popover.
struct COSField<Content: View>: View {
    let label: String
    var optional = false
    var hint: String? = nil
    var error: String? = nil
    var info: String? = nil
    @ViewBuilder var content: Content
    @Environment(\.ax) private var ax
    @State private var showsInfo = false

    var body: some View {
        VStack(alignment: .leading, spacing: ax.space(1)) {
            HStack(spacing: ax.space(1)) {
                Text(label).font(ax.fontLabel).foregroundStyle(ax.text)
                if optional {
                    Text("Optional").font(ax.fontSmall).foregroundStyle(ax.textSecondary)
                }
                if let info {
                    Button {
                        showsInfo = true
                    } label: {
                        Image(systemName: "info.circle")
                            .font(ax.fontBase)
                            .foregroundStyle(ax.iconSecondary)
                            .frame(minWidth: 24, minHeight: 24)
                            .contentShape(Rectangle())
                            .padding(.vertical, -5)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("About \(label)")
                    .accessibilityHint(info)
                    .popover(isPresented: $showsInfo) {
                        Text(info)
                            .font(ax.fontBase)
                            .foregroundStyle(ax.text)
                            .padding(ax.space(4))
                            .frame(maxWidth: 280, alignment: .leading)
                            .fixedSize(horizontal: false, vertical: true)
                            #if os(iOS)
                            .presentationCompactAdaptation(.popover)
                            #endif
                    }
                }
            }
            .accessibilityElement(children: .contain)
            content
            if let error {
                COSStatus(tone: .danger, message: error)
            } else if let hint {
                Text(hint).font(ax.fontSmall).foregroundStyle(ax.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// A status message with its mark: red for an error, green for success, orange for a warning.
struct COSStatus: View {
    let tone: Tone
    let message: String
    @Environment(\.ax) private var ax

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: ax.space(1)) {
            Image(systemName: symbol).font(ax.fontSmall)
            Text(message).font(ax.fontSmall).fixedSize(horizontal: false, vertical: true)
        }
        .foregroundStyle(ax.tone(tone).text)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(tone == .danger ? "Error: \(message)" : message)
    }

    private var symbol: String {
        switch tone {
        case .danger: "exclamationmark.circle.fill"
        case .success: "checkmark.circle.fill"
        case .warning: "exclamationmark.triangle.fill"
        default: "info.circle.fill"
        }
    }
}

/// A text box on the theme's surface. It shows the model's value and sends `set` with the
/// full action id as you type; typing is kept in local state (`syncedText`) so it is never
/// laggy and the model wins when it changes the value itself.
struct COSTextBox: View {
    let id: String
    let label: String
    let value: String
    var placeholder = ""
    var content: COSContent = .plain
    var secure = false
    var multiline = false
    var maxLength: Int? = nil
    var icon: String? = nil
    var hasError = false
    var focusKey: String? = nil
    var focus: FocusState<String?>.Binding? = nil
    var onSubmit: (() -> Void)? = nil
    @State private var text: String
    @Environment(\.ax) private var ax
    @Environment(\.axStatic) private var isStatic

    init(
        id: String, label: String, value: String, placeholder: String = "", content: COSContent = .plain,
        secure: Bool = false, multiline: Bool = false, maxLength: Int? = nil, icon: String? = nil,
        hasError: Bool = false, focusKey: String? = nil, focus: FocusState<String?>.Binding? = nil,
        onSubmit: (() -> Void)? = nil
    ) {
        self.id = id; self.label = label; self.value = value; self.placeholder = placeholder
        self.content = content; self.secure = secure; self.multiline = multiline; self.maxLength = maxLength
        self.icon = icon; self.hasError = hasError; self.focusKey = focusKey; self.focus = focus
        self.onSubmit = onSubmit
        _text = State(initialValue: value)
    }

    var body: some View {
        HStack(alignment: multiline ? .top : .center, spacing: ax.space(2)) {
            if let icon {
                Image(systemName: icon).foregroundStyle(ax.iconSecondary)
                    .padding(.top, multiline ? ax.space(1) : 0)
                    .accessibilityHidden(true)
            }
            field
        }
        .padding(.horizontal, ax.space(3))
        .padding(.vertical, multiline ? ax.space(2) : ax.space(2) + 2)
        .frame(minHeight: 36 * min(ax.scale, 1.4))
        .background(RoundedRectangle(cornerRadius: radius, style: .continuous).fill(ax.surface))
        .overlay(
            RoundedRectangle(cornerRadius: radius, style: .continuous)
                .strokeBorder(hasError ? ax.danger : ax.borderStrong, lineWidth: 1)
        )
        .syncedText(id: id, value: value, text: $text)
        .onChange(of: text) { _, new in
            if let maxLength, new.count > maxLength { text = String(new.prefix(maxLength)) }
        }
    }

    private var radius: CGFloat {
        multiline ? min(ax.radiusElement, ax.radiusContainer) : ax.radiusElement
    }

    @ViewBuilder
    private var field: some View {
        if isStatic {
            let shown = secure ? String(repeating: "\u{2022}", count: text.count) : text
            Text(shown.isEmpty ? placeholder : shown)
                .font(ax.fontBase)
                .foregroundStyle(shown.isEmpty ? ax.textDisabled : ax.text)
                .frame(maxWidth: .infinity, minHeight: multiline ? 60 * min(ax.scale, 1.4) : 0, alignment: .topLeading)
        } else if secure {
            SecureField(label, text: $text, prompt: Text(placeholder).foregroundColor(ax.textDisabled))
                .textFieldStyle(.plain)
                .font(ax.fontBase)
                .foregroundStyle(ax.text)
                .cosContent(content)
                .modifier(COSFocusModifier(binding: focus, key: focusKey ?? id))
                .onSubmit { onSubmit?() }
        } else if multiline {
            TextField(label, text: $text, prompt: Text(placeholder).foregroundColor(ax.textDisabled), axis: .vertical)
                .textFieldStyle(.plain)
                .lineLimit(3...8)
                .font(ax.fontBase)
                .foregroundStyle(ax.text)
                .cosContent(content)
                .modifier(COSFocusModifier(binding: focus, key: focusKey ?? id))
        } else {
            TextField(label, text: $text, prompt: Text(placeholder).foregroundColor(ax.textDisabled))
                .textFieldStyle(.plain)
                .font(ax.fontBase)
                .foregroundStyle(ax.text)
                .cosContent(content)
                .modifier(COSFocusModifier(binding: focus, key: focusKey ?? id))
                .onSubmit { onSubmit?() }
        }
    }
}

// MARK: Choosing

/// A menu select: the box shows the chosen label (or the placeholder) and opens the platform's
/// own menu. It calls `choose` with the option's value.
struct COSSelect: View {
    struct Choice: Hashable { let value: String; let label: String }
    let label: String
    let choices: [Choice]
    let value: String
    var placeholder = ""
    var hasError = false
    let choose: (String) -> Void
    @Environment(\.ax) private var ax

    var body: some View {
        let shown = choices.first { $0.value == value }?.label
        Menu {
            ForEach(choices, id: \.value) { choice in
                Button {
                    choose(choice.value)
                } label: {
                    if choice.value == value {
                        Label(choice.label, systemImage: "checkmark")
                    } else {
                        Text(choice.label)
                    }
                }
            }
        } label: {
            HStack(spacing: ax.space(2)) {
                Text(shown ?? placeholder)
                    .font(ax.fontBase)
                    .foregroundStyle(shown == nil ? ax.textDisabled : ax.text)
                    .lineLimit(1)
                Spacer(minLength: 0)
                Image(systemName: "chevron.up.chevron.down")
                    .font(.system(size: ax.fontSize("font-size-xs", 10), weight: .semibold))
                    .foregroundStyle(ax.iconSecondary)
            }
            .padding(.horizontal, ax.space(3))
            .frame(minHeight: 36 * min(ax.scale, 1.4))
            .background(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).fill(ax.surface))
            .overlay(
                RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous)
                    .strokeBorder(hasError ? ax.danger : ax.borderStrong, lineWidth: 1)
            )
            .contentShape(Rectangle())
        }
        .menuStyle(.button)
        .buttonStyle(.plain)
        .menuIndicator(.hidden)
        .accessibilityLabel(label)
        .accessibilityValue(shown ?? placeholder)
    }
}

/// A switch with its label and description. It calls `change` with the new value.
struct COSSwitch: View {
    let label: String
    var description: String? = nil
    let isOn: Bool
    let change: (Bool) -> Void
    @Environment(\.ax) private var ax
    @Environment(\.axStatic) private var isStatic

    var body: some View {
        if isStatic {
            HStack(alignment: .center, spacing: ax.space(3)) {
                text
                Spacer(minLength: ax.space(3))
                StaticSwitch(on: isOn)
            }
        } else {
            Toggle(isOn: Binding(get: { isOn }, set: { change($0) })) { text }
                .toggleStyle(.switch)
                .tint(ax.accent)
        }
    }

    private var text: some View {
        VStack(alignment: .leading, spacing: ax.hair) {
            Text(label).font(ax.fontLabel).foregroundStyle(ax.text)
            if let description {
                Text(description).font(ax.fontSmall).foregroundStyle(ax.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: Actions and marks

/// A button in the theme's primary, secondary or ghost style.
struct COSButton: View {
    let label: String
    var variant: ButtonNode.Variant = .secondary
    var icon: String? = nil
    var fills = false
    let action: () -> Void
    @Environment(\.ax) private var ax

    var body: some View {
        Button(action: action) {
            HStack(spacing: ax.space(2)) {
                if let icon { Image(systemName: icon) }
                Text(label).lineLimit(1)
            }
            .frame(maxWidth: fills ? .infinity : nil)
        }
        .buttonStyle(AXButtonStyle(variant: variant, ax: ax))
    }
}

/// A square icon button whose label is its accessibility label.
struct COSIconButton: View {
    let label: String
    let symbol: String
    let action: () -> Void
    @Environment(\.ax) private var ax

    var body: some View {
        let side = 36 * min(ax.scale, 1.4)
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: ax.fontSize("font-size-lg", 17) * 0.95))
                .foregroundStyle(ax.iconSecondary)
                .frame(width: side, height: side)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
}

/// A message on a tinted ground with an icon, a title and (optionally) a description.
struct COSBanner: View {
    let tone: Tone
    let symbol: String
    let title: String
    var description: String? = nil
    @Environment(\.ax) private var ax

    var body: some View {
        let colors = ax.tone(tone)
        HStack(alignment: .top, spacing: ax.space(3)) {
            Image(systemName: symbol)
                .font(ax.fontBase)
                .foregroundStyle(colors.text)
                .padding(.top, 1)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: ax.hair) {
                Text(title).font(ax.fontStrong).foregroundStyle(ax.text)
                if let description {
                    Text(description).font(ax.fontBase).foregroundStyle(ax.textSecondary)
                }
            }
            .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .padding(ax.space(3))
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).fill(colors.muted))
        .overlay(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).strokeBorder(colors.border, lineWidth: 1))
        .accessibilityElement(children: .combine)
    }
}

/// A row that opens and closes: a title line with a chevron, then the content. Open at first
/// unless `startsOpen` says otherwise.
struct COSCollapsible<Title: View, Content: View>: View {
    var startsOpen = true
    var spokenTitle: String
    @ViewBuilder var title: Title
    @ViewBuilder var content: Content
    @State private var isOpen: Bool
    @Environment(\.ax) private var ax

    init(startsOpen: Bool = true, spokenTitle: String, @ViewBuilder title: () -> Title, @ViewBuilder content: () -> Content) {
        self.startsOpen = startsOpen
        self.spokenTitle = spokenTitle
        self.title = title()
        self.content = content()
        _isOpen = State(initialValue: startsOpen)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: ax.space(3)) {
            Button {
                withAnimation(.snappy(duration: 0.2)) { isOpen.toggle() }
            } label: {
                HStack(spacing: ax.space(2)) {
                    title
                    Spacer(minLength: ax.space(2))
                    Image(systemName: "chevron.right")
                        .font(.system(size: ax.fontSize("font-size-sm", 12), weight: .semibold))
                        .foregroundStyle(ax.iconSecondary)
                        .rotationEffect(.degrees(isOpen ? 90 : 0))
                }
                .frame(minHeight: 28)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(spokenTitle)
            .accessibilityValue(isOpen ? "Expanded" : "Collapsed")
            .accessibilityHint(isOpen ? "Collapses this section" : "Expands this section")
            if isOpen { content }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// A product picture. The models carry one stand-in picture for every product, an SVG data
/// URI the platform cannot draw, so this draws the same stand-in (a tile with a picture
/// mark) from tokens; an http(s) address, if a model carries one, is loaded.
struct COSThumbnail: View {
    let src: String
    let name: String
    var side: CGFloat = 56
    @Environment(\.ax) private var ax

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous)
        let size = side * min(ax.scale, 1.4)
        Group {
            if src.hasPrefix("http"), let url = URL(string: src) {
                AsyncImage(url: url) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    placeholder
                }
            } else {
                placeholder
            }
        }
        .frame(width: size, height: size)
        .background(ax.muted)
        .clipShape(shape)
        .overlay(shape.strokeBorder(ax.border, lineWidth: 1))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(name)
        .accessibilityAddTraits(.isImage)
    }

    private var placeholder: some View {
        Image(systemName: "photo")
            .font(.system(size: side * 0.38 * min(ax.scale, 1.4), weight: .light))
            .foregroundStyle(ax.textDisabled)
    }
}

/// Initials and a stable hue from a name, for people the models give only as names.
func cosPerson(_ name: String) -> (initials: String, hue: Double) {
    let words = name.split(separator: " ").prefix(2)
    let initials = words.compactMap { $0.first.map(String.init) }.joined().uppercased()
    let hue = Double(name.unicodeScalars.reduce(0) { ($0 &* 31 &+ Int($1.value)) % 360 })
    return (initials.isEmpty ? "?" : initials, hue)
}

/// An avatar for a name.
struct COSAvatar: View {
    let name: String
    var size: AvatarNode.Size = .md

    var body: some View {
        let person = cosPerson(name)
        AXAvatar(name: name, initials: person.initials, hue: person.hue, size: size)
    }
}

/// A bulleted separator for a run of facts.
struct COSBullet: View {
    @Environment(\.ax) private var ax
    var body: some View {
        Text("\u{30FB}").font(ax.fontSmall).foregroundStyle(ax.textSecondary).accessibilityHidden(true)
    }
}

/// A string or a number, as the models give "parts" of a line that the page draws one after another.
enum COSPart: Decodable, Sendable, Equatable {
    case text(String)
    case number(Double)

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let s = try? c.decode(String.self) { self = .text(s) } else { self = .number(try c.decode(Double.self)) }
    }

    var string: String {
        switch self {
        case .text(let s): s
        case .number(let n): n == n.rounded() && abs(n) < 1e15 ? String(Int(n)) : String(n)
        }
    }

    static func join(_ parts: [COSPart]) -> String { parts.map(\.string).joined() }
}
