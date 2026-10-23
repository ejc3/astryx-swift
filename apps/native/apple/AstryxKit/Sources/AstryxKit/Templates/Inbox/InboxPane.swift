import SwiftUI
#if canImport(UIKit)
import UIKit
#elseif canImport(AppKit)
import AppKit
#endif

/// The open conversation: a toolbar, the subject, its tokens, the thread and the reply buttons.
/// `fullWidth` is the single-surface form, where the pane has replaced the list.
struct InboxPaneView: View {
    let model: InboxModel
    let pane: InboxModel.Pane
    let fullWidth: Bool
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send
    @Environment(\.axStatic) private var isStatic

    private var words: InboxModel.Words.PaneText { model.text.pane }

    var body: some View {
        VStack(spacing: 0) {
            if fullWidth { fullToolbar } else { sideToolbar }
            if isStatic {
                content
            } else {
                ScrollView { content }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .accessibilityElement(children: .contain)
        .accessibilityLabel(words.label)
    }

    private var threadActions: some View {
        HStack(spacing: ax.hair) {
            ForEach(pane.actions) { action in
                if action.id == "move" && !model.isInert("move") {
                    InboxIconMenu(symbol: inboxSymbol(action.id), label: action.ariaLabel, help: action.label, targets: pane.moveTargets)
                } else {
                    InboxIconButton(symbol: inboxSymbol(action.id), label: action.ariaLabel, help: action.label) {
                        inboxPerform(action.id, row: pane.id, send: send, inert: model.inert)
                    }
                }
            }
        }
    }

    /// Back button and thread actions above the subject (the pane fills the surface).
    private var fullToolbar: some View {
        VStack(alignment: .leading, spacing: ax.space(2)) {
            HStack(spacing: ax.space(2)) {
                Button {
                    send(.press(id: inboxAction("close")))
                } label: {
                    Label(words.back, systemImage: "chevron.left")
                        .font(ax.fontLabel)
                        .foregroundStyle(ax.accent)
                        .frame(minHeight: max(36, InboxTarget.side))
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(words.back)
                Spacer(minLength: ax.space(2))
                threadActions
            }
            Text(pane.subject)
                .font(ax.heading(3))
                .foregroundStyle(ax.text)
                .accessibilityAddTraits(.isHeader)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.horizontal, ax.space(4))
        .padding(.top, ax.space(1))
        .padding(.bottom, ax.space(3))
        .overlay(alignment: .bottom) { InboxHairline() }
    }

    /// Subject, thread actions and the close control (the pane sits beside the list).
    private var sideToolbar: some View {
        HStack(alignment: .top, spacing: ax.space(2)) {
            Text(pane.subject)
                .font(ax.heading(2))
                .foregroundStyle(ax.text)
                .accessibilityAddTraits(.isHeader)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
            threadActions
            InboxIconButton(symbol: "xmark", label: words.close, help: words.closeTooltip) {
                send(.press(id: inboxAction("close")))
            }
        }
        .padding(.top, ax.space(4))
        .padding(.leading, ax.space(5))
        .padding(.trailing, ax.space(3))
        .padding(.bottom, ax.space(3))
    }

    private var content: some View {
        VStack(alignment: .leading, spacing: ax.space(4)) {
            InboxChips(priority: pane.priority, tags: pane.tags)
            VStack(spacing: 0) {
                ForEach(pane.messages) { message in
                    InboxMessageView(
                        message: message,
                        words: words,
                        measure: model.mode.rules.messageMeasure,
                        isOpen: pane.openMessages.contains(message.id),
                        toggle: { toggleMessage(message.id) }
                    )
                }
            }
            HStack(spacing: ax.space(2)) {
                Button {
                    inboxAdopt(pane.id, in: model, send: send)
                    send(.press(id: inboxAction("reply")))
                } label: {
                    Label(words.reply, systemImage: inboxSymbol("reply"))
                }
                .buttonStyle(AXButtonStyle(variant: .primary, ax: ax))
                Button {
                    inboxAdopt(pane.id, in: model, send: send)
                    send(.press(id: inboxAction("replyAll")))
                } label: {
                    Label(words.replyAll, systemImage: inboxSymbol("replyAll"))
                }
                .buttonStyle(AXButtonStyle(variant: .secondary, ax: ax))
            }
            .padding(.leading, 36 + ax.space(3))
        }
        .padding(.horizontal, fullWidth ? ax.space(4) : ax.space(5))
        .padding(.top, fullWidth ? ax.space(3) : 0)
        .padding(.bottom, ax.space(5))
        .frame(maxWidth: .infinity, alignment: .topLeading)
    }

    /// Opening or closing a message tells the core the new set, in thread order.
    private func toggleMessage(_ id: String) {
        var open = Set(pane.openMessages)
        if open.contains(id) { open.remove(id) } else { open.insert(id) }
        let ordered = pane.messages.map(\.id).filter { open.contains($0) }
        inboxAdopt(pane.id, in: model, send: send)
        send(.set(id: inboxAction("messages"), value: .string(ordered.joined(separator: ","))))
    }
}

// MARK: Message

/// One message of the thread: a header that discloses the body and its attachments.
struct InboxMessageView: View {
    let message: InboxModel.Message
    let words: InboxModel.Words.PaneText
    /// The widest a message's text gets (the core's `messageMeasure`).
    let measure: CGFloat
    let isOpen: Bool
    let toggle: () -> Void
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send
    @Environment(\.axWidth) private var width

    /// A phone-width pane has no room for the date beside the address, so it goes under it.
    private var narrow: Bool { width < 480 }

    var body: some View {
        VStack(alignment: .leading, spacing: ax.space(3)) {
            Button(action: toggle) {
                HStack(spacing: ax.space(3)) {
                    AXAvatar(name: message.sender, initials: InboxPeople.initials(message.sender), hue: InboxPeople.hue(message.sender))
                    VStack(alignment: .leading, spacing: ax.hair) {
                        Text(message.sender).font(ax.fontStrong).foregroundStyle(ax.text).lineLimit(1)
                        Text(message.senderEmail).font(ax.fontSmall).foregroundStyle(ax.textSecondary).lineLimit(1)
                        if narrow {
                            Text(message.receivedFull).font(ax.fontSmall).foregroundStyle(ax.textSecondary).lineLimit(1)
                        }
                    }
                    Spacer(minLength: ax.space(2))
                    if !narrow {
                        Text(message.receivedFull).font(ax.fontSmall).foregroundStyle(ax.textSecondary).lineLimit(1)
                    }
                    Image(systemName: "chevron.right")
                        .font(.system(size: ax.fontSize("font-size-sm", 12), weight: .semibold))
                        .foregroundStyle(ax.iconSecondary)
                        .rotationEffect(.degrees(isOpen ? 90 : 0))
                        .accessibilityHidden(true)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("\(message.sender), \(message.senderEmail), \(message.receivedFull)")
            .accessibilityAddTraits(.isButton)
            .accessibilityValue(isOpen ? words.expanded : words.collapsed)
            .accessibilityHint(isOpen ? words.collapseHint : words.expandHint)

            if isOpen {
                VStack(alignment: .leading, spacing: ax.space(3)) {
                    ForEach(Array(message.body.enumerated()), id: \.offset) { _, paragraph in
                        Text(paragraph)
                            .font(ax.fontBase)
                            .foregroundStyle(ax.text)
                            .lineSpacing(2)
                            .fixedSize(horizontal: false, vertical: true)
                            .textSelection(.enabled)
                    }
                    if !message.attachments.isEmpty { InboxAttachmentStrip(message: message) }
                }
                .frame(maxWidth: measure, alignment: .leading)
                .padding(.leading, 36 + ax.space(3))
            }
        }
        .padding(.vertical, ax.space(3))
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay(alignment: .bottom) { InboxHairline() }
        .sheet(isPresented: Binding(
            get: { message.lightboxIndex != nil },
            set: { if !$0 { send(.press(id: inboxAction("lightboxClose"))) } }
        )) {
            InboxLightbox(message: message, words: words)
        }
    }
}

// MARK: Attachments

/// The attachment label and its thumbnails; each opens the viewer.
struct InboxAttachmentStrip: View {
    let message: InboxModel.Message
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send

    var body: some View {
        VStack(alignment: .leading, spacing: ax.space(2)) {
            HStack(spacing: ax.space(1)) {
                Image(systemName: "paperclip").font(ax.fontSmall).foregroundStyle(ax.iconSecondary)
                Text(message.attachmentsLabel.joined()).font(ax.fontSmall).foregroundStyle(ax.textSecondary)
            }
            .accessibilityElement(children: .combine)
            FlowLayout(spacing: ax.space(2), crossAlignment: 0) {
                ForEach(Array(message.attachments.enumerated()), id: \.element.id) { index, attachment in
                    Button {
                        send(.press(id: inboxAction("lightbox:\(message.id):\(index)")))
                    } label: {
                        VStack(alignment: .leading, spacing: ax.hair) {
                            InboxPicture(attachment: attachment)
                                .frame(width: 112, height: 84)
                                .clipShape(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous))
                                .overlay(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).strokeBorder(ax.border, lineWidth: 1))
                            Text(attachment.name)
                                .font(ax.fontSmall)
                                .foregroundStyle(ax.textSecondary)
                                .lineLimit(1)
                                .frame(width: 112, alignment: .leading)
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(attachment.previewAlt)
                    .accessibilityHint(attachment.name)
                }
            }
        }
    }
}

/// An attachment's picture. The sample attachments are an SVG data URL, which the platforms
/// cannot decode to an image, so those (and anything else unreadable) draw as the photo glyph.
struct InboxPicture: View {
    let attachment: InboxModel.Attachment
    @Environment(\.ax) private var ax

    var body: some View {
        ZStack {
            ax.muted
            if let image = decoded {
                image.resizable().scaledToFill()
            } else {
                Image(systemName: "photo")
                    .font(.system(size: 28, weight: .light))
                    .foregroundStyle(ax.iconSecondary)
            }
        }
        .clipped()
        .accessibilityHidden(true)
    }

    private var decoded: Image? {
        let prefix = ";base64,"
        guard attachment.src.hasPrefix("data:image/"),
              !attachment.src.hasPrefix("data:image/svg"),
              let marker = attachment.src.range(of: prefix),
              let data = Data(base64Encoded: String(attachment.src[marker.upperBound...])) else { return nil }
        #if canImport(UIKit)
        return UIImage(data: data).map { Image(uiImage: $0) }
        #else
        return NSImage(data: data).map { Image(nsImage: $0) }
        #endif
    }
}

/// The attachment viewer: one picture, its caption, previous and next, close. Its open state
/// and index are the core's.
struct InboxLightbox: View {
    let message: InboxModel.Message
    let words: InboxModel.Words.PaneText
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send

    private var index: Int { min(max(message.lightboxIndex ?? 0, 0), max(message.attachments.count - 1, 0)) }

    var body: some View {
        let attachment = message.attachments.isEmpty ? nil : message.attachments[index]
        VStack(spacing: ax.space(3)) {
            HStack {
                Text(attachment?.name ?? "")
                    .font(ax.fontStrong)
                    .foregroundStyle(ax.text)
                    .lineLimit(1)
                Spacer()
                Button {
                    send(.press(id: inboxAction("lightboxClose")))
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 22))
                        .foregroundStyle(ax.iconSecondary)
                        .frame(minWidth: InboxTarget.side, minHeight: InboxTarget.side)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .keyboardShortcut(.cancelAction)
                .accessibilityLabel(words.closeTooltip)
            }
            if let attachment {
                InboxPicture(attachment: attachment)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .clipShape(RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous))
                    .accessibilityHidden(false)
                    .accessibilityLabel(attachment.lightboxAlt)
            }
            if message.attachments.count > 1 {
                HStack(spacing: ax.space(4)) {
                    step(-1, symbol: "chevron.left", label: words.previous)
                    Text("\(index + 1) / \(message.attachments.count)")
                        .font(ax.fontSmall.monospacedDigit())
                        .foregroundStyle(ax.textSecondary)
                    step(1, symbol: "chevron.right", label: words.next)
                }
            }
        }
        .padding(ax.space(4))
        .frame(minWidth: 420, minHeight: 420)
        .background(ax.surface)
        .presentationDetents([.large])
    }

    private func step(_ delta: Int, symbol: String, label: String) -> some View {
        let target = index + delta
        return Button {
            send(.set(id: inboxAction("lightboxIndex"), value: .number(Double(target))))
        } label: {
            Image(systemName: symbol)
                .font(.system(size: 16, weight: .semibold))
                .frame(width: max(36, InboxTarget.side), height: max(36, InboxTarget.side))
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .foregroundStyle(ax.accent)
        .disabled(target < 0 || target >= message.attachments.count)
        .keyboardShortcut(delta < 0 ? .leftArrow : .rightArrow, modifiers: [])
        .accessibilityLabel(label)
    }
}
