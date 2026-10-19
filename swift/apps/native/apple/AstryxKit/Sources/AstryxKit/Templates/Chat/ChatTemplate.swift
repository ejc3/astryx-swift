import SwiftUI

/// Astryx's AI chat template, drawn natively from the core's view model
/// (core/src/templates/chat/model.ts, its `View` type).
///
/// Actions (ids as the core's `reduce` takes them, with the `tpl.chat.` prefix):
/// - composer text: `set` `tpl.chat.draft` (a string, as you type)
/// - Return or the send button: `press` `tpl.chat.send`, then `set` `tpl.chat.draft` ""
/// - the Ask / Edit menu: `set` `tpl.chat.mode` ("ask" or "edit")
/// - the artifact card: `press` `tpl.chat.openArtifact:panel` on a wide screen, `...:dialog`
///   on a narrow one (the web decides at 767 points, so this does too)
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

/// The widest a screen can be and still use the document dialog instead of the side panel.
private let tChatNarrowMax: CGFloat = 767

private struct TChatScreen: View {
    let model: TChatModel
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send
    @Environment(\.axWidth) private var width
    /// The panel's width after a drag; nil until the person drags the handle.
    @State private var dragged: CGFloat?
    @State private var dragStart: CGFloat?

    var body: some View {
        let wide = width > tChatNarrowMax
        let panel = wide && model.artifact.panelOpen
        let gap = ax.space(4)
        let panelWidth = clampedPanel(total: width)
        HStack(alignment: .top, spacing: 0) {
            VStack(alignment: .leading, spacing: ax.space(6)) {
                TChatConversation(items: model.items, openArtifact: open)
                TChatComposer(composer: model.composer, inert: model.inert)
            }
            .environment(\.axWidth, panel ? width - panelWidth - gap * 2 : width)
            .frame(maxWidth: .infinity, alignment: .topLeading)
            if panel {
                handle
                    .padding(.horizontal, gap)
                TChatArtifactPanel(artifact: model.artifact, close: { send(.press(id: "tpl.chat.closeArtifact")) })
                    .environment(\.axWidth, panelWidth)
                    .frame(width: panelWidth)
            }
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .environment(\.tChatWords, model.words)
        .environment(\.tChatInert, model.inert)
        .tChatDialog(isPresented: Binding(
            get: { model.artifact.dialogOpen },
            set: { if !$0 { send(.set(id: "tpl.chat.dialog", value: .bool(false))) } }
        )) {
            TChatArtifactDialog(artifact: model.artifact)
        }
    }

    private func open() {
        send(.press(id: width > tChatNarrowMax ? "tpl.chat.openArtifact:panel" : "tpl.chat.openArtifact:dialog"))
    }

    /// The panel keeps the web's 640 default and 480 to 960 range, leaving the chat 320.
    private func clampedPanel(total: CGFloat) -> CGFloat {
        let wanted = dragged ?? max(480, min(640, total * 0.5))
        return min(max(wanted, 480), min(960, max(total - 320, 480)))
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

// MARK: Composer

private struct TChatComposer: View {
    let composer: TChatModel.Composer
    let inert: Set<String>
    @State private var text: String
    @FocusState private var focused: Bool
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send
    @Environment(\.axStatic) private var isStatic
    @Environment(\.tChatWords) private var words

    init(composer: TChatModel.Composer, inert: Set<String>) {
        self.composer = composer
        self.inert = inert
        _text = State(initialValue: composer.draft)
    }

    private var canSend: Bool { !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: ax.radiusContainer + 6, style: .continuous)
        VStack(alignment: .leading, spacing: ax.space(2)) {
            field
            // One row; at the largest text sizes, where it cannot fit, the mode menu gets its own.
            ViewThatFits(in: .horizontal) {
                HStack(spacing: ax.space(1)) {
                    iconButton("at", label: words.mention, id: "mention")
                    iconButton("paperclip", label: words.attach, id: "attach")
                    Spacer(minLength: ax.space(2))
                    modeMenu
                    sendButton
                }
                VStack(alignment: .leading, spacing: ax.space(1)) {
                    modeMenu
                    HStack(spacing: ax.space(1)) {
                        iconButton("at", label: words.mention, id: "mention")
                        iconButton("paperclip", label: words.attach, id: "attach")
                        Spacer(minLength: ax.space(2))
                        sendButton
                    }
                }
            }
        }
        .padding(ax.space(3))
        .background(shape.fill(ax.surface))
        .overlay(shape.strokeBorder(focused ? ax.accent : ax.borderStrong, lineWidth: focused ? 2 : 1))
        .syncedText(id: "tpl.chat.draft", value: composer.draft, text: $text)
        .accessibilityElement(children: .contain)
    }

    @ViewBuilder
    private var field: some View {
        if isStatic {
            Text(text.isEmpty ? composer.placeholder : text)
                .font(ax.fontBase)
                .foregroundStyle(text.isEmpty ? ax.textDisabled : ax.text)
                .frame(maxWidth: .infinity, minHeight: 24 * min(ax.scale, 1.4), alignment: .topLeading)
        } else {
            TextField(composer.placeholder, text: $text, prompt: Text(composer.placeholder).foregroundColor(ax.textDisabled), axis: .vertical)
                .textFieldStyle(.plain)
                .font(ax.fontBase)
                .foregroundStyle(ax.text)
                .lineLimit(1...6)
                .focused($focused)
                .submitLabel(.send)
                .onSubmit(submit)
                .accessibilityLabel(composer.placeholder)
        }
    }

    private var sendButton: some View {
        Button(action: submit) {
            Image(systemName: "arrow.up")
                .font(.system(size: ax.fontSize("font-size-base", 14), weight: .bold))
                .foregroundStyle(canSend ? ax.onAccent : ax.textDisabled)
                .frame(width: tChatSide(ax), height: tChatSide(ax))
                .background(Circle().fill(canSend ? ax.accent : ax.muted))
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
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
            HStack(spacing: ax.space(1)) {
                Text(composer.modeLabel).font(ax.fontLabel)
                Image(systemName: "chevron.up.chevron.down").font(.system(size: ax.fontSize("font-size-xs", 10), weight: .semibold))
            }
            .foregroundStyle(ax.textSecondary)
            .padding(.horizontal, ax.space(2))
            .frame(minHeight: tChatSide(ax))
            .contentShape(Rectangle())
        }
        .menuStyle(.button)
        .buttonStyle(.plain)
        .fixedSize()
    }

    /// A ghost icon button with no action of its own, as the web's Mention and Attach: the core
    /// lists them as inert, so they are drawn disabled and VoiceOver says so.
    private func iconButton(_ symbol: String, label: String, id: String) -> some View {
        Button {} label: {
            Image(systemName: symbol)
                .font(.system(size: ax.fontSize("font-size-base", 14)))
                .foregroundStyle(ax.iconSecondary)
                .frame(width: tChatSide(ax), height: tChatSide(ax))
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(inert.contains(id))
        .accessibilityLabel(label)
    }

    private func submit() {
        guard canSend else { return }
        send(.press(id: "tpl.chat.send"))
        text = ""
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
    @Environment(\.tChatInert) private var inert

    var body: some View {
        HStack(spacing: ax.space(1)) {
            Menu {
                ForEach(artifact.versions, id: \.self) { version in
                    Button(version) {}.disabled(inert.contains("versions"))
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

    /// "v2" from "v2 (current)": the version the menu button names.
    private var versionTag: String {
        artifact.versions.first.map { String($0.prefix(while: { !$0.isWhitespace })) } ?? ""
    }

    private func glyph(_ symbol: String) -> some View {
        Image(systemName: symbol)
            .font(.system(size: ax.fontSize("font-size-base", 14)))
            .foregroundStyle(ax.iconSecondary)
            .frame(width: tChatSide(ax), height: tChatSide(ax))
            .contentShape(Rectangle())
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

    var body: some View {
        VStack(alignment: .leading, spacing: ax.space(2)) {
            Text(artifact.title)
                .font(ax.heading(1))
                .foregroundStyle(ax.text)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
            TChatMarkdown(text: artifact.content, compact: false)
        }
        .frame(maxWidth: 720, alignment: .leading)
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
    @Environment(\.tChatInert) private var inert
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
            Section(artifact.versions.first.map { String($0.prefix(while: { !$0.isWhitespace })) } ?? "") {
                ForEach(artifact.versions, id: \.self) { version in Button(version) {}.disabled(inert.contains("versions")) }
            }
            Button { tChatCopy(artifact.content) } label: { Label(words.copy, systemImage: "doc.on.doc") }
            ShareLink(item: artifact.content, subject: Text(artifact.title)) { Label(words.share, systemImage: "square.and.arrow.up") }
        } label: {
            Image(systemName: "ellipsis")
                .font(.system(size: ax.fontSize("font-size-base", 14), weight: .semibold))
                .foregroundStyle(ax.iconSecondary)
                .frame(width: tChatSide(ax), height: tChatSide(ax))
                .contentShape(Rectangle())
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
