import SwiftUI

// Pieces the checkout, order and settings drawings share (COS = checkout, order, settings):
// form fields with the right keyboards, a menu select, checkboxes, buttons, banners, a collapsible
// and the product tile. They read every color, radius, spacing and size from the theme's tokens.

// MARK: Shared words and sizes

/// The words the three templates share, from each model's `words` (the core's
/// `COMMON_WORDS`): field marks, the keyboard's buttons and a collapsible section's state.
/// A screen puts them in the environment for the parts below.
struct COSWords: Decodable, Sendable, Equatable {
    var optional = ""
    /// Spoken before an error's message.
    var errorPrefix = ""
    var expanded = ""
    var collapsed = ""
    var expandHint = ""
    var collapseHint = ""
    var previous = ""
    var next = ""
    var done = ""
}

private struct COSWordsKey: EnvironmentKey {
    static let defaultValue = COSWords()
}

extension EnvironmentValues {
    var cosWords: COSWords {
        get { self[COSWordsKey.self] }
        set { self[COSWordsKey.self] = newValue }
    }
}

/// The smallest touch target: 44 points on iPhone and iPad (Apple's default), 28 on the Mac
/// where the pointer is precise. Controls draw smaller than this only if they grow their
/// tappable area to it.
let cosTouch: CGFloat = {
    #if os(macOS)
    28
    #else
    44
    #endif
}()

/// The height of a field, select, quantity box or icon button as Astryx draws it: `size-element-md`,
/// 32 points, on every platform. On a touch screen the hit region still reaches 44 points
/// (`cosFieldSlop`), but the drawn control is the web's size (the iPhone review's ruling on X.5).
func cosFieldHeight(_ ax: AXStyle) -> CGFloat { 32 * min(ax.scale, 1.4) }

/// The room a field's hit region reaches past its drawn box above and below, so the touch target
/// is `cosTouch` high (nothing on the Mac, where the pointer is precise).
func cosFieldSlop(_ ax: AXStyle) -> CGFloat { max(0, (cosTouch - cosFieldHeight(ax)) / 2) }

/// The text of a field, select or composer. Astryx's touch rule is `max(1rem, body size)` on a
/// phone (WebKit zooms a page that focuses a smaller field), so on iOS it is at least 16 points.
func cosFieldFont(_ ax: AXStyle) -> Font {
    #if os(iOS)
    .system(size: max(ax.scaled(16), ax.fontSize("font-size-base", 14)), weight: .regular)
    #else
    ax.fontBase
    #endif
}

extension View {
    /// A tap gesture whose region reaches `slop` points past the view above and below, without
    /// changing the room the view takes (the extra is padding taken back).
    func cosTapWithSlop(_ slop: CGFloat, perform action: @escaping () -> Void) -> some View {
        padding(.vertical, slop)
            .contentShape(Rectangle())
            .onTapGesture(perform: action)
            .padding(.vertical, -slop)
    }
}

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
    /// The box's own focus, when the form gave none.
    let own: FocusState<Bool>.Binding

    func body(content: Content) -> some View {
        if let binding {
            content.focused(binding, equals: key)
        } else {
            content.focused(own)
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
    /// The info button's spoken name ("About CVC").
    var infoLabel: String? = nil
    @ViewBuilder var content: Content
    @Environment(\.ax) private var ax
    @Environment(\.cosWords) private var words
    @Environment(\.horizontalSizeClass) private var sizeClass
    @State private var showsInfo = false

    var body: some View {
        VStack(alignment: .leading, spacing: ax.space(1)) {
            HStack(spacing: ax.space(1)) {
                Text(label).font(ax.fontLabel).foregroundStyle(ax.textSecondary)
                    .axLeading(ax, size: ax.fontSize("font-size-base", 14), ratio: ax.bodyLeading)
                if optional {
                    Text(words.optional).font(ax.fontSmall).foregroundStyle(ax.textSecondary)
                }
                if let info {
                    Button {
                        showsInfo = true
                    } label: {
                        Image(systemName: "info.circle")
                            .font(ax.fontBase)
                            .foregroundStyle(ax.iconSecondary)
                            // A 44-point target that takes no more room than the icon: the extra
                            // is padding taken back, and the content shape reaches into it.
                            .frame(minWidth: cosTouch, minHeight: cosTouch)
                            .contentShape(Rectangle())
                            .padding(.vertical, -(cosTouch - 20) / 2)
                            .padding(.horizontal, -(cosTouch - 20) / 2)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(infoLabel ?? label)
                    .accessibilityHint(info)
                    // A popover on the Mac and iPad; on an iPhone it adapts to a small sheet, as
                    // Apple asks (a popover in a compact view is a poor fit).
                    .popover(isPresented: $showsInfo) {
                        COSInfoContent(text: info, showsDone: sizeClass == .compact) { showsInfo = false }
                            .environment(\.ax, ax)
                            .environment(\.cosWords, words)
                            #if os(iOS)
                            .presentationCompactAdaptation(.sheet)
                            #endif
                    }
                }
            }
            .accessibilityElement(children: .contain)
            // Astryx puts the description between the label and the control; an error goes below it.
            if let hint, error == nil {
                Text(hint).font(ax.fontSmall).foregroundStyle(ax.textSecondary)
                    .axLeading(ax, size: ax.fontSize("font-size-sm", 12), ratio: ax.supportingLeading)
                    .fixedSize(horizontal: false, vertical: true)
            }
            content
            if let error {
                COSStatus(tone: .danger, message: error)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// The words of a field's help: in a popover beside the field, or in a short sheet on an iPhone.
private struct COSInfoContent: View {
    let text: String
    let showsDone: Bool
    let dismiss: () -> Void
    @Environment(\.ax) private var ax
    @Environment(\.cosWords) private var words

    var body: some View {
        VStack(alignment: .leading, spacing: ax.space(3)) {
            Text(text)
                .font(ax.fontBase)
                .foregroundStyle(ax.text)
                .fixedSize(horizontal: false, vertical: true)
            if showsDone {
                HStack {
                    Spacer(minLength: 0)
                    COSButton(label: words.done, variant: .secondary, action: dismiss)
                }
            }
        }
        .padding(ax.space(4))
        .frame(maxWidth: showsDone ? .infinity : 280, alignment: .leading)
        #if os(iOS)
        .presentationDetents([.height(showsDone ? 200 : 120), .medium])
        .presentationDragIndicator(.visible)
        #endif
    }
}

/// A status message with its mark: red for an error, green for success, orange for a warning.
struct COSStatus: View {
    let tone: Tone
    let message: String
    @Environment(\.ax) private var ax
    @Environment(\.cosWords) private var words

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: ax.space(1)) {
            Image(systemName: symbol).font(ax.fontSmall)
            Text(message).font(ax.fontSmall).fixedSize(horizontal: false, vertical: true)
        }
        .foregroundStyle(ax.tone(tone).text)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(tone == .danger ? "\(words.errorPrefix) \(message)" : message)
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
    /// The label on the keyboard's Return key: `.next` where another field follows, `.done` on the last.
    var submitLabel: SubmitLabel = .return
    var onSubmit: (() -> Void)? = nil
    @State private var text: String
    @FocusState private var ownFocus: Bool
    @Environment(\.ax) private var ax
    @Environment(\.axStatic) private var isStatic

    init(
        id: String, label: String, value: String, placeholder: String = "", content: COSContent = .plain,
        secure: Bool = false, multiline: Bool = false, maxLength: Int? = nil, icon: String? = nil,
        hasError: Bool = false, focusKey: String? = nil, focus: FocusState<String?>.Binding? = nil,
        submitLabel: SubmitLabel = .return, onSubmit: (() -> Void)? = nil
    ) {
        self.id = id; self.label = label; self.value = value; self.placeholder = placeholder
        self.content = content; self.secure = secure; self.multiline = multiline; self.maxLength = maxLength
        self.icon = icon; self.hasError = hasError; self.focusKey = focusKey; self.focus = focus
        self.submitLabel = submitLabel; self.onSubmit = onSubmit
        _text = State(initialValue: value)
    }

    /// Tapping anywhere in the box (its padding or icon, not only the text line) focuses the field.
    private func focusField() {
        if let focus { focus.wrappedValue = focusKey ?? id } else { ownFocus = true }
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
        .padding(.vertical, multiline ? ax.space(2) : fieldPadding)
        .frame(minHeight: cosFieldHeight(ax))
        .background(RoundedRectangle(cornerRadius: radius, style: .continuous).fill(ax.surface))
        .overlay(
            RoundedRectangle(cornerRadius: radius, style: .continuous)
                .strokeBorder(hasError ? ax.danger : ax.borderStrong, lineWidth: 1)
        )
        .contentShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
        // Drawn 32 high like Astryx's field; a tap within 44 points of it still focuses it.
        .cosTapWithSlop(multiline ? 0 : cosFieldSlop(ax)) { if !isStatic { focusField() } }
        .syncedText(id: id, value: value, text: $text)
        .onChange(of: text) { _, new in
            if let maxLength, new.count > maxLength { text = String(new.prefix(maxLength)) }
        }
    }

    private var radius: CGFloat {
        multiline ? min(ax.radiusElement, ax.radiusContainer) : ax.radiusElement
    }

    /// A single-line box is `cosFieldHeight` high (32), its text centered.
    private var fieldPadding: CGFloat { ax.space(1) }

    @ViewBuilder
    private var field: some View {
        if isStatic {
            let shown = secure ? String(repeating: "\u{2022}", count: text.count) : text
            Text(shown.isEmpty ? placeholder : shown)
                .font(cosFieldFont(ax))
                .foregroundStyle(shown.isEmpty ? ax.textSecondary : ax.text)
                .frame(maxWidth: .infinity, minHeight: multiline ? 60 * min(ax.scale, 1.4) : 0, alignment: .topLeading)
        } else if secure {
            SecureField(label, text: $text, prompt: Text(placeholder).foregroundColor(ax.textSecondary))
                .textFieldStyle(.plain)
                .font(cosFieldFont(ax))
                .foregroundStyle(ax.text)
                .cosContent(content)
                .modifier(COSFocusModifier(binding: focus, key: focusKey ?? id, own: $ownFocus))
                .submitLabel(submitLabel)
                .onSubmit { onSubmit?() }
        } else if multiline {
            TextField(label, text: $text, prompt: Text(placeholder).foregroundColor(ax.textSecondary), axis: .vertical)
                .textFieldStyle(.plain)
                .lineLimit(3...8)
                .font(cosFieldFont(ax))
                .foregroundStyle(ax.text)
                .cosContent(content)
                .modifier(COSFocusModifier(binding: focus, key: focusKey ?? id, own: $ownFocus))
        } else {
            TextField(label, text: $text, prompt: Text(placeholder).foregroundColor(ax.textSecondary))
                .textFieldStyle(.plain)
                .font(cosFieldFont(ax))
                .foregroundStyle(ax.text)
                .cosContent(content)
                .modifier(COSFocusModifier(binding: focus, key: focusKey ?? id, own: $ownFocus))
                .submitLabel(submitLabel)
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
                    .font(cosFieldFont(ax))
                    .foregroundStyle(shown == nil ? ax.textSecondary : ax.text)
                    .lineLimit(1)
                Spacer(minLength: 0)
                Image(systemName: "chevron.up.chevron.down")
                    .font(.system(size: ax.fontSize("font-size-xs", 10), weight: .semibold))
                    .foregroundStyle(ax.iconSecondary)
            }
            .padding(.horizontal, ax.space(3))
            .frame(minHeight: cosFieldHeight(ax))
            .background(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).fill(ax.surface))
            .overlay(
                RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous)
                    .strokeBorder(hasError ? ax.danger : ax.borderStrong, lineWidth: 1)
            )
            .contentShape(Rectangle())
            .axTapTarget(keepLayout: true)
        }
        .menuStyle(.button)
        .buttonStyle(.plain)
        .menuIndicator(.hidden)
        .accessibilityLabel(label)
        .accessibilityValue(shown ?? placeholder)
    }
}

/// A checkbox with its label and description beside it, as Astryx's `CheckboxInput` draws one:
/// the system checkbox on the Mac (a Mac convention, HIG Toggles), a drawn box on a touch screen
/// (Astryx's 24 point box there) and in a picture with no window, centered on the label and its
/// description. The label is secondary text, as Astryx paints it. It calls `change` with the new value.
struct COSCheckbox: View {
    let label: String
    var description: String? = nil
    let isOn: Bool
    let change: (Bool) -> Void
    @Environment(\.ax) private var ax
    @Environment(\.axStatic) private var isStatic

    var body: some View {
        HStack(alignment: boxAlignment, spacing: ax.space(3)) {
            box
            VStack(alignment: .leading, spacing: ax.hair) {
                Text(label).font(ax.fontBase).foregroundStyle(ax.textSecondary)
                    .axLeading(ax, size: ax.fontSize("font-size-base", 14), ratio: ax.bodyLeading)
                if let description {
                    Text(description).font(ax.fontSmall).foregroundStyle(ax.textSecondary)
                        .axLeading(ax, size: ax.fontSize("font-size-sm", 12), ratio: ax.supportingLeading)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
            .onTapGesture { if !isStatic { change(!isOn) } }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .contain)
    }

    /// The box sits on the first line beside the Mac's system checkbox; on a touch screen it is
    /// centered on the label and description, as the web draws it.
    private var boxAlignment: VerticalAlignment {
        #if os(macOS)
        .top
        #else
        .center
        #endif
    }

    @ViewBuilder
    private var box: some View {
        #if os(macOS)
        if isStatic { drawn } else {
            Toggle(label, isOn: Binding(get: { isOn }, set: { change($0) }))
                .labelsHidden()
                .toggleStyle(.checkbox)
                .tint(ax.accent)
                .accessibilityLabel(label)
                .accessibilityHint(description ?? "")
        }
        #else
        drawn
        #endif
    }

    private var drawn: some View {
        #if os(iOS)
        let side = 24 * min(ax.scale, 1.5)
        #else
        let side = 18 * min(ax.scale, 1.5)
        #endif
        let shape = RoundedRectangle(cornerRadius: ax.radiusInner + 1, style: .continuous)
        return Button { change(!isOn) } label: {
            shape.fill(isOn ? ax.accent : ax.surface)
                .overlay(shape.strokeBorder(isOn ? ax.accent : ax.borderStrong, lineWidth: 1.5))
                .overlay {
                    if isOn {
                        Image(systemName: "checkmark")
                            .font(.system(size: side * 0.6, weight: .bold))
                            .foregroundStyle(ax.onAccent)
                    }
                }
                .frame(width: side, height: side)
                .axTapTarget(keepLayout: true)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityHint(description ?? "")
        .axToggleSemantics(isOn: isOn)
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
    @Environment(\.dynamicTypeSize) private var typeSize
    @Environment(\.axFillButtons) private var fillButtons

    var body: some View {
        let wide = fills || fillButtons
        Button(action: action) {
            HStack(spacing: ax.space(2)) {
                if let icon { Image(systemName: icon) }
                // One line until the text is so large that one line cannot hold it.
                // The label's own width inside the button, so a row of buttons that does not
                // fit says so (to ViewThatFits) instead of cutting a label short.
                Text(label).lineLimit(typeSize.isAccessibilitySize ? nil : 1)
                    .fixedSize(horizontal: !typeSize.isAccessibilitySize, vertical: true)
            }
            .frame(maxWidth: wide ? .infinity : nil)
        }
        .buttonStyle(AXButtonStyle(variant: variant, ax: ax, fills: wide))
    }
}

/// A square icon button whose label is its accessibility label.
struct COSIconButton: View {
    let label: String
    let symbol: String
    /// The glyph's point size, where a wide symbol needs less than the usual 16.
    var glyph: CGFloat? = nil
    let action: () -> Void
    @Environment(\.ax) private var ax

    var body: some View {
        // Astryx's 32 point icon button; on a touch screen the hit region reaches 44.
        let side = cosFieldHeight(ax)
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: glyph.map { ax.scaled($0) } ?? ax.fontSize("font-size-lg", 17) * 0.95))
                .foregroundStyle(ax.iconSecondary)
                .frame(width: side, height: side)
                .contentShape(Rectangle())
                .axTapTarget(keepLayout: true)
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
    /// The room under the content while open, for a card that pads its closed trigger less.
    var openBottomInset: CGFloat = 0
    var spokenTitle: String
    @ViewBuilder var title: Title
    @ViewBuilder var content: Content
    @State private var isOpen: Bool
    @Environment(\.ax) private var ax
    @Environment(\.cosWords) private var words

    init(
        startsOpen: Bool = true, openBottomInset: CGFloat = 0, spokenTitle: String,
        @ViewBuilder title: () -> Title, @ViewBuilder content: () -> Content
    ) {
        self.startsOpen = startsOpen
        self.openBottomInset = openBottomInset
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
                .frame(minHeight: cosTouch)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(spokenTitle)
            .accessibilityValue(isOpen ? words.expanded : words.collapsed)
            .accessibilityHint(isOpen ? words.collapseHint : words.expandHint)
            if isOpen { content.padding(.bottom, openBottomInset) }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// A product picture. The models carry one stand-in picture for every product, an SVG data
/// URI the platform cannot draw. This reads the tile's ground and the picture mark's stroke
/// from that SVG and draws the same mark (a rounded square with a sun and a hill), so the tile
/// is what the web shows; an http(s) address, if a model carries one, is loaded.
struct COSThumbnail: View {
    let src: String
    let name: String
    var side: CGFloat = 64
    @Environment(\.ax) private var ax

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous)
        let size = side * min(ax.scale, 1.4)
        Group {
            if src.hasPrefix("http"), let url = URL(string: src) {
                AsyncImage(url: url) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    placeholder(size)
                }
            } else {
                placeholder(size)
            }
        }
        .frame(width: size, height: size)
        .clipShape(shape)
        // Astryx's Thumbnail has a 1 point border.
        .overlay(shape.strokeBorder(ax.border, lineWidth: 1))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(name)
        .accessibilityAddTraits(.isImage)
    }

    /// The colors the stand-in SVG names: a tile ground and a mark stroke.
    private var colors: (ground: Color, stroke: Color) {
        let svg = src.removingPercentEncoding ?? src
        func hex(_ pattern: String) -> Color? {
            guard let range = svg.range(of: pattern, options: .regularExpression) else { return nil }
            let match = String(svg[range])
            guard let hash = match.firstIndex(of: "#") else { return nil }
            return Color(hex: String(match[hash...].prefix(while: { $0 != "\"" && $0 != "'" })))
        }
        return (
            hex("<rect[^>]*fill=[\"']#[0-9a-fA-F]+") ?? ax.muted,
            hex("stroke=[\"']#[0-9a-fA-F]+") ?? ax.color("color-icon-disabled")
        )
    }

    private func placeholder(_ size: CGFloat) -> some View {
        let c = colors
        // The SVG's stroke is 5 in its 400 by 300 space, which a square tile scales by size / 300.
        let line = 5 * size / 300
        return ZStack {
            Rectangle().fill(c.ground)
            COSPictureMark().stroke(c.stroke, style: StrokeStyle(lineWidth: line, lineCap: .round, lineJoin: .round))
                .overlay(COSPictureSun().fill(c.stroke))
        }
    }
}

/// The stand-in's picture mark in its own 400 by 300 space, scaled to fill a tile (the SVG's
/// `xMidYMid slice`): a rounded square with a hill drawn inside it.
private struct COSPictureMark: Shape {
    func path(in rect: CGRect) -> Path {
        let scale = max(rect.width / 400, rect.height / 300)
        let origin = CGPoint(x: rect.midX, y: rect.midY)
        func point(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: origin.x + x * scale, y: origin.y + y * scale) }
        var path = Path()
        path.addRoundedRect(
            in: CGRect(x: origin.x - 44 * scale, y: origin.y - 44 * scale, width: 88 * scale, height: 88 * scale),
            cornerSize: CGSize(width: 16 * scale, height: 16 * scale), style: .continuous
        )
        path.move(to: point(-34, 30))
        for (x, y) in [(-8, 0), (10, 18), (20, 8), (34, 24)] as [(CGFloat, CGFloat)] { path.addLine(to: point(x, y)) }
        return path
    }
}

/// The sun in the picture mark: a dot at (18, -18) in the SVG's space.
private struct COSPictureSun: Shape {
    func path(in rect: CGRect) -> Path {
        let scale = max(rect.width / 400, rect.height / 300)
        let center = CGPoint(x: rect.midX + 18 * scale, y: rect.midY - 18 * scale)
        return Path(ellipseIn: CGRect(x: center.x - 2.5 * scale, y: center.y - 2.5 * scale, width: 5 * scale, height: 5 * scale))
    }
}

/// An avatar for a name: Astryx's neutral Avatar (the templates pass it no hue), a neutral
/// ground with the initials in secondary text.
struct COSAvatar: View {
    let name: String
    var size: AvatarNode.Size = .md
    @Environment(\.ax) private var ax

    private var diameter: CGFloat {
        let base: CGFloat = switch size { case .sm: 24; case .md: 36; case .lg: 48 }
        return base * min(ax.scale, 1.6)
    }

    var body: some View {
        let person = cosPerson(name)
        Text(person.initials)
            .font(.system(size: diameter * 0.38, weight: .regular))
            .foregroundStyle(ax.textSecondary)
            .minimumScaleFactor(0.6)
            .lineLimit(1)
            .frame(width: diameter, height: diameter)
            .background(Circle().fill(ax.color("color-neutral")))
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(name)
    }
}

/// Initials from a name, for people the models give only as names.
func cosPerson(_ name: String) -> (initials: String, hue: Double) {
    let words = name.split(separator: " ").prefix(2)
    let initials = words.compactMap { $0.first.map(String.init) }.joined().uppercased()
    let hue = Double(name.unicodeScalars.reduce(0) { ($0 &* 31 &+ Int($1.value)) % 360 })
    return (initials.isEmpty ? "?" : initials, hue)
}

/// A bulleted separator for a run of facts.
struct COSBullet: View {
    @Environment(\.ax) private var ax
    var body: some View {
        Text("\u{30FB}").font(ax.fontSmall).foregroundStyle(ax.textSecondary).accessibilityHidden(true)
    }
}

/// A badge in Astryx's `green` colour variant: the soft green ground with green ink. (The shared
/// `AXBadge` draws the `success` tone, a solid fill, which is another thing.) Drawn as `AXBadge` is.
struct COSGreenBadge: View {
    let text: String
    @Environment(\.ax) private var ax

    var body: some View {
        Text(text)
            .font(ax.font("font-size-sm", 12, weight: "font-weight-medium").monospacedDigit())
            .foregroundStyle(ax.color("color-text-green"))
            .lineLimit(1)
            .padding(.horizontal, ax.space(2))
            .frame(minHeight: 20 * min(ax.scale, 1.6))
            .background(Capsule().fill(ax.color("color-background-green")))
            .fixedSize()
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
