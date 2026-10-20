import SwiftUI

/// Astryx's AI chat template, drawn natively from the core's view model
/// (core/src/templates/chat/model.ts, its `View` type).
///
/// Actions (ids as the core's `reduce` takes them, with the `tpl.chat.` prefix):
/// - composer text: `set` `tpl.chat.draft` (a string, as you type)
/// - Return or the send button: `press` `tpl.chat.send`, then `set` `tpl.chat.draft` ""
/// - the Ask / Edit menu: `set` `tpl.chat.mode` ("ask" or "edit")
/// - the artifact card: `press` `tpl.chat.openArtifact:panel` on a wide screen, `...:dialog`
///   on a narrow one (the core says where, `rules.dialogAtMost`, to both drawings)
/// - the panel's close button: `press` `tpl.chat.closeArtifact`
/// - the full-screen document closing: `set` `tpl.chat.dialog` false
struct ChatTemplate: View {
    let view: JSONValue

    var body: some View {
        if let model = try? view.decode(TChatModel.self) {
            TChatScreen(model: model)
        } else {
            AXTemplatePlaceholder(template: "chat")
        }
    }
}

private struct TChatScreen: View {
    let model: TChatModel
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send
    @Environment(\.axWidth) private var width
    /// The panel's width after a drag; nil until the person drags the handle.
    @State private var dragged: CGFloat?
    @State private var dragStart: CGFloat?

    var body: some View {
        let wide = width > model.rules.dialogAtMost
        let panel = wide && model.artifact.panelOpen
        let gap = ax.space(4)
        let panelWidth = clampedPanel(total: width)
        // The chat owns the whole pane, edge to edge (its own padding is inside the scroll view and
        // the composer), and the conversation scrolls above the composer.
        HStack(alignment: .top, spacing: 0) {
            TChatColumn(model: model, open: open)
                .environment(\.axWidth, panel ? width - panelWidth - gap * 2 : width)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            if panel {
                handle
                    .padding(.horizontal, gap)
                TChatArtifactPanel(artifact: model.artifact, close: { send(.press(id: "tpl.chat.closeArtifact")) })
                    .environment(\.axWidth, panelWidth)
                    .frame(width: panelWidth)
                    .padding(.vertical, gap)
                    .padding(.trailing, gap)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .environment(\.tChatWords, model.words)
        .environment(\.tChatRules, model.rules)
        .tChatDialog(isPresented: Binding(
            get: { model.artifact.dialogOpen },
            set: { if !$0 { send(.set(id: "tpl.chat.dialog", value: .bool(false))) } }
        )) {
            TChatArtifactDialog(artifact: model.artifact)
        }
    }

    private func open() {
        send(.press(id: width > model.rules.dialogAtMost ? "tpl.chat.openArtifact:panel" : "tpl.chat.openArtifact:dialog"))
    }

    /// The panel keeps the core's initial width and range (`rules.panel`, the web's too), leaving the chat 320.
    private func clampedPanel(total: CGFloat) -> CGFloat {
        let panel = model.rules.panel
        let wanted = dragged ?? max(panel.min, min(panel.initial, total * 0.5))
        return min(max(wanted, panel.min), min(panel.max, max(total - 320, panel.min)))
    }

    /// The divider between chat and panel: drag it to resize the panel.
    private var handle: some View {
        Rectangle()
            .fill(ax.border)
            .frame(width: 1)
            .overlay(
                Rectangle().fill(Color.clear).frame(width: 14).contentShape(Rectangle())
                    .gesture(
                        DragGesture(minimumDistance: 2)
                            .onChanged { value in
                                let start = dragStart ?? clampedPanel(total: width)
                                dragStart = start
                                dragged = start - value.translation.width
                            }
                            .onEnded { _ in dragStart = nil }
                    )
            )
            .accessibilityHidden(true)
    }
}

/// The conversation and its composer. The messages scroll, anchored to the latest one, and the
/// composer is pinned under them (the stock ChatLayout); drawn to an image, which has no scroll
/// view, the two simply stack.
private struct TChatColumn: View {
    let model: TChatModel
    let open: () -> Void
    @Environment(\.ax) private var ax
    @Environment(\.axWidth) private var width
    @Environment(\.axStatic) private var isStatic

    var body: some View {
        // The conversation is held 32 points in at every width, as the web's ChatLayout holds it;
        // the composer under it keeps its 16.
        let pad = ax.space(8)
        let conversation = TChatConversation(items: model.items, openArtifact: open)
            .padding(.horizontal, pad)
            .padding(.top, pad)
            .environment(\.axWidth, width - 2 * pad)
        let composer = TChatComposer(composer: model.composer)
            .padding(.horizontal, ax.space(4))
            .padding(.bottom, ax.space(3))
            .environment(\.axWidth, width - 2 * ax.space(4))
        if isStatic {
            VStack(alignment: .leading, spacing: ax.space(6)) {
                conversation
                composer
            }
        } else {
            ScrollView {
                conversation
                    // Clear of the composer, which the scroll view leaves its room under.
                    .padding(.bottom, ax.space(6) * 3.5)
            }
            .defaultScrollAnchor(.bottom)
            .safeAreaInset(edge: .bottom, spacing: 0) { composer }
        }
    }
}

// MARK: Composer

/// The composer, as the stock ChatComposer draws it: a raised, rounded surface with the Mention and
/// Attach buttons above the field, and the mode menu and the Send button under it.
private struct TChatComposer: View {
    let composer: TChatModel.Composer
    @State private var text: String
    @FocusState private var focused: Bool
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send
    @Environment(\.axStatic) private var isStatic
    @Environment(\.tChatWords) private var words

    init(composer: TChatModel.Composer) {
        self.composer = composer
        _text = State(initialValue: composer.draft)
    }

    private var canSend: Bool { !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }

    /// The side of the small icon buttons: Astryx's 28, growing with the text. On a touch screen the
    /// hit region still reaches 44 (`axTapTarget`); the drawn control is the web's size.
    private var side: CGFloat { 28 * Swift.min(ax.scale, 1.4) }

    /// The height of the mode menu and the Send circle: Astryx's 32.
    private var control: CGFloat { 32 * Swift.min(ax.scale, 1.4) }

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: ax.radiusContainer + 16, style: .continuous)
        VStack(alignment: .leading, spacing: ax.space(2)) {
            HStack(spacing: ax.space(1)) {
                iconButton("at", label: words.mention)
                iconButton("paperclip", label: words.attach)
            }
            field
            // One row; at the largest text sizes, where it cannot fit, the mode menu gets its own.
            ViewThatFits(in: .horizontal) {
                HStack(spacing: ax.space(2)) {
                    modeMenu
                    Spacer(minLength: ax.space(2))
                    sendButton
                }
                VStack(alignment: .leading, spacing: ax.space(1)) {
                    modeMenu
                    HStack { Spacer(minLength: 0); sendButton }
                }
            }
        }
        .padding(ax.space(3))
        .background(shape.fill(ax.surface))
        .shadow(color: ax.shadow, radius: 0.5, y: 1)
        .shadow(color: ax.shadow, radius: 4, y: 2)
        .overlay(shape.strokeBorder(ax.accent, lineWidth: focused ? 2 : 0))
        .syncedText(id: "tpl.chat.draft", value: composer.draft, text: $text)
        .accessibilityElement(children: .contain)
    }

    @ViewBuilder
    private var field: some View {
        if isStatic {
            Text(text.isEmpty ? composer.placeholder : text)
                .font(cosFieldFont(ax))
                .foregroundStyle(text.isEmpty ? ax.textSecondary : ax.text)
                .padding(.horizontal, ax.space(1))
                .frame(maxWidth: .infinity, minHeight: 22 * min(ax.scale, 1.4), alignment: .topLeading)
        } else {
            TextField(composer.placeholder, text: $text, prompt: Text(composer.placeholder).foregroundColor(ax.textSecondary), axis: .vertical)
                .textFieldStyle(.plain)
                .font(cosFieldFont(ax))
                .foregroundStyle(ax.text)
                .lineLimit(1...6)
                .focused($focused)
                .submitLabel(.send)
                .onSubmit(submit)
                .padding(.horizontal, ax.space(1))
                .frame(minHeight: 22 * min(ax.scale, 1.4))
                .accessibilityLabel(composer.placeholder)
        }
    }

    /// Always the accent circle; with nothing to send it is drawn at half strength, once (the style
    /// is our own so the system does not dim a disabled button a second time).
    private var sendButton: some View {
        Button(action: submit) {
            Image(systemName: "arrow.up")
                .font(.system(size: ax.scaled(16), weight: .medium))
                .foregroundStyle(ax.onAccent)
                .frame(width: control, height: control)
                .background(Circle().fill(ax.accent))
                .opacity(canSend ? 1 : 0.5)
                .contentShape(Circle())
                .axTapTarget(keepLayout: true)
        }
        .buttonStyle(TChatSendStyle())
        .disabled(!canSend)
        .accessibilityLabel(words.send)
    }

    private var modeMenu: some View {
        Menu {
            Picker(composer.modeLabel, selection: Binding(
                get: { composer.mode },
                set: { send(.set(id: "tpl.chat.mode", value: .string($0))) }
            )) {
                ForEach(composer.modes) { mode in Text(mode.label).tag(mode.id) }
            }
            .pickerStyle(.inline)
            .labelsHidden()
        } label: {
            HStack(spacing: ax.space(2)) {
                Text(composer.modeLabel).font(ax.fontLabel)
                // The Mac's pop-up button draws its two chevrons.
                Image(systemName: "chevron.up.chevron.down").font(.system(size: ax.fontSize("font-size-xs", 10), weight: .semibold))
            }
            .foregroundStyle(ax.text)
            .padding(.horizontal, ax.space(3))
            .frame(minHeight: control)
            .contentShape(Rectangle())
            .axTapTarget(keepLayout: true)
        }
        .menuStyle(.button)
        .buttonStyle(.plain)
        .fixedSize()
    }

    /// A ghost icon button with no action of its own, as the web's Mention and Attach: the stock page wires
    /// them to nothing, and they are drawn like any other control.
    private func iconButton(_ symbol: String, label: String) -> some View {
        Button {} label: {
            Image(systemName: symbol)
                .font(.system(size: ax.scaled(16)))
                .foregroundStyle(ax.text)
                .frame(width: side, height: side)
                .contentShape(Rectangle())
                .axTapTarget(keepLayout: true)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }

    private func submit() {
        guard canSend else { return }
        send(.press(id: "tpl.chat.send"))
        text = ""
    }
}

/// A button that draws its label as it is: the plain style dims a disabled button, and the Send
/// circle already carries its own half-strength fill.
private struct TChatSendStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.opacity(configuration.isPressed ? 0.75 : 1)
    }
}

// MARK: Artifact

/// The side panel of a wide screen: the document under a toolbar.
private struct TChatArtifactPanel: View {
    let artifact: TChatModel.Artifact
    let close: () -> Void
    @Environment(\.ax) private var ax
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: ax.space(3)) {
                Image(systemName: "doc.text").foregroundStyle(ax.textSecondary)
                // The document's title is its identity: one line, until the text is so large that
                // a truncated title would say nothing.
                VStack(alignment: .leading, spacing: 0) {
                    Text(artifact.title).font(ax.fontStrong).foregroundStyle(ax.text).lineLimit(typeSize.isAccessibilitySize ? nil : 1)
                    Text(artifact.subtitle).font(ax.fontSmall).foregroundStyle(ax.textSecondary).lineLimit(typeSize.isAccessibilitySize ? nil : 1)
                }
                .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: ax.space(2))
                TChatArtifactActions(artifact: artifact, onClose: close)
            }
            .padding(.horizontal, ax.space(4))
            .padding(.vertical, ax.space(3))
            Rectangle().fill(ax.border).frame(height: 1)
            TChatArtifactBody(artifact: artifact)
                .padding(ax.space(6))
        }
        .background(RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous).fill(ax.card))
        .overlay(RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous).strokeBorder(ax.border, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous))
        .accessibilityElement(children: .contain)
    }
}

/// Version menu, Copy, Share and (on the panel) Close.
struct TChatArtifactActions: View {
    let artifact: TChatModel.Artifact
    var onClose: (() -> Void)?
    @Environment(\.ax) private var ax
    @Environment(\.tChatWords) private var words

    var body: some View {
        HStack(spacing: ax.space(1)) {
            Menu {
                ForEach(artifact.versions, id: \.self) { version in
                    Button(version) {}
                }
            } label: {
                HStack(spacing: ax.space(1)) {
                    Text(versionTag).font(ax.fontLabel)
                    Image(systemName: "chevron.down").font(.system(size: ax.fontSize("font-size-xs", 10), weight: .semibold))
                }
                .foregroundStyle(ax.textSecondary)
                .padding(.horizontal, ax.space(2))
                .frame(minHeight: tChatSide(ax))
                .contentShape(Rectangle())
                .axTapTarget(keepLayout: true)
            }
            .menuStyle(.button)
            .buttonStyle(.plain)
            .fixedSize()
            .accessibilityLabel(words.versions)
            .accessibilityValue(versionTag)
            action("doc.on.doc", label: words.copy) { tChatCopy(artifact.content) }
            ShareLink(item: artifact.content, subject: Text(artifact.title)) {
                glyph("square.and.arrow.up")
            }
            .buttonStyle(.plain)
            .accessibilityLabel(words.share)
            if let onClose {
                action("xmark", label: words.closeDocument, perform: onClose)
            }
        }
    }

    /// "v2": the version the menu button names (the core's).
    private var versionTag: String { artifact.versionTag }

    private func glyph(_ symbol: String) -> some View {
        Image(systemName: symbol)
            .font(.system(size: ax.fontSize("font-size-base", 14)))
            .foregroundStyle(ax.iconSecondary)
            .frame(width: tChatSide(ax), height: tChatSide(ax))
            .contentShape(Rectangle())
            .axTapTarget(keepLayout: true)
    }

    private func action(_ symbol: String, label: String, perform: @escaping () -> Void) -> some View {
        Button(action: perform) { glyph(symbol) }
            .buttonStyle(.plain)
            .accessibilityLabel(label)
    }
}

/// The document itself: its title and Markdown, in a reading column.
struct TChatArtifactBody: View {
    let artifact: TChatModel.Artifact
    @Environment(\.ax) private var ax
    @Environment(\.tChatRules) private var rules

    var body: some View {
        VStack(alignment: .leading, spacing: ax.space(2)) {
            Text(artifact.title)
                .font(ax.heading(1))
                .foregroundStyle(ax.text)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
            TChatMarkdown(text: artifact.content, compact: false)
        }
        .frame(maxWidth: rules?.articleWidth ?? .infinity, alignment: .leading)
        .frame(maxWidth: .infinity, alignment: .center)
    }
}

/// The document as a full-screen dialog (a narrow screen): title bar with a close control
/// and the actions, the document below.
struct TChatArtifactDialog: View {
    let artifact: TChatModel.Artifact
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send
    @Environment(\.axStatic) private var isStatic
    @Environment(\.tChatWords) private var words
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: ax.space(2)) {
                VStack(alignment: .leading, spacing: 0) {
                    Text(artifact.title).font(ax.fontStrong).foregroundStyle(ax.text).lineLimit(2)
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityAddTraits(.isHeader)
                    Text(artifact.subtitle).font(ax.fontSmall).foregroundStyle(ax.textSecondary).lineLimit(typeSize.isAccessibilitySize ? nil : 1)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                overflow
                Button {
                    send(.set(id: "tpl.chat.dialog", value: .bool(false)))
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: ax.fontSize("font-size-base", 14)))
                        .foregroundStyle(ax.iconSecondary)
                        .frame(width: tChatSide(ax), height: tChatSide(ax))
                        .contentShape(Rectangle())
                        .axTapTarget(keepLayout: true)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(words.closeDocument)
            }
            .padding(.horizontal, ax.space(4))
            .padding(.vertical, ax.space(3))
            Rectangle().fill(ax.border).frame(height: 1)
            if isStatic {
                TChatArtifactBody(artifact: artifact).padding(ax.space(4))
                Spacer(minLength: 0)
            } else {
                ScrollView {
                    TChatArtifactBody(artifact: artifact)
                        .padding(ax.space(4))
                }
            }
        }
        .background(ax.card)
        #if os(macOS)
        .frame(minWidth: isStatic ? 0 : 520, minHeight: isStatic ? 0 : 560)
        #endif
    }

    /// Version, Copy and Share folded into one menu, as the web's narrow header does.
    private var overflow: some View {
        Menu {
            Section(words.version) {
                ForEach(artifact.versions, id: \.self) { version in Button(version) {} }
            }
            Button { tChatCopy(artifact.content) } label: { Label(words.copy, systemImage: "doc.on.doc") }
            ShareLink(item: artifact.content, subject: Text(artifact.title)) { Label(words.share, systemImage: "square.and.arrow.up") }
        } label: {
            Image(systemName: "ellipsis")
                .font(.system(size: ax.fontSize("font-size-base", 14), weight: .semibold))
                .foregroundStyle(ax.iconSecondary)
                .frame(width: tChatSide(ax), height: tChatSide(ax))
                .contentShape(Rectangle())
                .axTapTarget(keepLayout: true)
        }
        .menuStyle(.button)
        .buttonStyle(.plain)
        .menuIndicator(.hidden)
        .fixedSize()
        .accessibilityLabel(words.documentActions)
    }
}

private extension View {
    /// A full-screen cover on iPhone and iPad, a sheet on the Mac.
    func tChatDialog<Dialog: View>(isPresented: Binding<Bool>, @ViewBuilder content: @escaping () -> Dialog) -> some View {
        #if os(iOS)
        fullScreenCover(isPresented: isPresented, content: content)
        #else
        sheet(isPresented: isPresented, content: content)
        #endif
    }
}
