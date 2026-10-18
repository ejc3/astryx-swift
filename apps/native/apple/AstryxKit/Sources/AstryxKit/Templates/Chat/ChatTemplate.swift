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
                TChatComposer(composer: model.composer)
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
    @State private var text: String
    @FocusState private var focused: Bool
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send
    @Environment(\.axStatic) private var isStatic

    init(composer: TChatModel.Composer) {
        self.composer = composer
        _text = State(initialValue: composer.draft)
    }

    private var canSend: Bool { !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: ax.radiusContainer + 6, style: .continuous)
        VStack(alignment: .leading, spacing: ax.space(2)) {
            field
            HStack(spacing: ax.space(1)) {
                iconButton("at", label: "Mention")
                iconButton("paperclip", label: "Attach")
                Spacer(minLength: ax.space(2))
                modeMenu
                Button(action: submit) {
                    Image(systemName: "arrow.up")
                        .font(.system(size: ax.fontSize("font-size-base", 14), weight: .bold))
                        .foregroundStyle(canSend ? ax.onAccent : ax.textDisabled)
                        .frame(width: 32 * min(ax.scale, 1.4), height: 32 * min(ax.scale, 1.4))
                        .background(Circle().fill(canSend ? ax.accent : ax.muted))
                        .contentShape(Circle())
                }
                .buttonStyle(.plain)
                .disabled(!canSend)
                .accessibilityLabel("Send")
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
            .frame(minHeight: 32 * min(ax.scale, 1.4))
            .contentShape(Rectangle())
        }
        .menuStyle(.button)
        .buttonStyle(.plain)
        .fixedSize()
    }

    /// A ghost icon button with no action of its own, as the web's Mention and Attach.
    private func iconButton(_ symbol: String, label: String) -> some View {
        Button {} label: {
            Image(systemName: symbol)
                .font(.system(size: ax.fontSize("font-size-base", 14)))
                .foregroundStyle(ax.iconSecondary)
                .frame(width: 32 * min(ax.scale, 1.4), height: 32 * min(ax.scale, 1.4))
                .contentShape(Rectangle())
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

// MARK: Artifact

/// The side panel of a wide screen: the document under a toolbar.
private struct TChatArtifactPanel: View {
    let artifact: TChatModel.Artifact
    let close: () -> Void
    @Environment(\.ax) private var ax

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: ax.space(3)) {
                Image(systemName: "doc.text").foregroundStyle(ax.textSecondary)
                VStack(alignment: .leading, spacing: 0) {
                    Text(artifact.title).font(ax.fontStrong).foregroundStyle(ax.text).lineLimit(1)
                    Text(artifact.subtitle).font(ax.fontSmall).foregroundStyle(ax.textSecondary).lineLimit(1)
                }
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
                .frame(minHeight: 32 * min(ax.scale, 1.4))
                .contentShape(Rectangle())
            }
            .menuStyle(.button)
            .buttonStyle(.plain)
            .fixedSize()
            action("doc.on.doc", label: "Copy") { tChatCopy(artifact.content) }
            ShareLink(item: artifact.content, subject: Text(artifact.title)) {
                glyph("square.and.arrow.up")
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Share")
            if let onClose {
                action("xmark", label: "Close document", perform: onClose)
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
            .frame(width: 32 * min(ax.scale, 1.4), height: 32 * min(ax.scale, 1.4))
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

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: ax.space(2)) {
                VStack(alignment: .leading, spacing: 0) {
                    Text(artifact.title).font(ax.fontStrong).foregroundStyle(ax.text).lineLimit(2)
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityAddTraits(.isHeader)
                    Text(artifact.subtitle).font(ax.fontSmall).foregroundStyle(ax.textSecondary).lineLimit(1)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                overflow
                Button {
                    send(.set(id: "tpl.chat.dialog", value: .bool(false)))
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: ax.fontSize("font-size-base", 14)))
                        .foregroundStyle(ax.iconSecondary)
                        .frame(width: 32 * min(ax.scale, 1.4), height: 32 * min(ax.scale, 1.4))
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Close document")
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
                ForEach(artifact.versions, id: \.self) { version in Button(version) {} }
            }
            Button { tChatCopy(artifact.content) } label: { Label("Copy", systemImage: "doc.on.doc") }
            ShareLink(item: artifact.content, subject: Text(artifact.title)) { Label("Share", systemImage: "square.and.arrow.up") }
        } label: {
            Image(systemName: "ellipsis")
                .font(.system(size: ax.fontSize("font-size-base", 14), weight: .semibold))
                .foregroundStyle(ax.iconSecondary)
                .frame(width: 32 * min(ax.scale, 1.4), height: 32 * min(ax.scale, 1.4))
                .contentShape(Rectangle())
        }
        .menuStyle(.button)
        .buttonStyle(.plain)
        .menuIndicator(.hidden)
        .fixedSize()
        .accessibilityLabel("Document actions")
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
