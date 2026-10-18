import SwiftUI

/// The compose sheet's content. The recipients, Cc/Bcc, subject and body are the core's;
/// typing is sent as it happens, like the kit's text fields.
struct InboxComposeForm: View {
    let compose: InboxModel.Compose
    let words: InboxModel.Words.Composer
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send
    @Environment(\.axStatic) private var isStatic
    @State private var subject: String
    @State private var bodyText: String

    init(compose: InboxModel.Compose, words: InboxModel.Words.Composer) {
        self.compose = compose
        self.words = words
        _subject = State(initialValue: compose.subject)
        _bodyText = State(initialValue: compose.body)
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            InboxHairline()
            if isStatic { fields } else { ScrollView { fields } }
            InboxHairline()
            footer
        }
        .background(ax.surface)
        .accessibilityElement(children: .contain)
        .accessibilityLabel(words.sheetLabel)
    }


    private var fields: some View {
        VStack(spacing: ax.space(2)) {
            InboxRecipientField(
                field: "recipients", placeholder: words.recipient,
                people: compose.recipients, directory: compose.directory,
                showCc: compose.hasCc ? nil : words.cc,
                showBcc: compose.hasBcc ? nil : words.bcc
            )
            if compose.hasCc {
                InboxRecipientField(field: "cc", placeholder: words.cc, people: compose.cc, directory: compose.directory)
            }
            if compose.hasBcc {
                InboxRecipientField(field: "bcc", placeholder: words.bcc, people: compose.bcc, directory: compose.directory)
            }
            subjectField
            bodyField
        }
        .padding(ax.space(3))
    }

    private func close() { send(.set(id: inboxAction("composeOpen"), value: .bool(false))) }

    private var header: some View {
        HStack {
            Text(words.heading)
                .font(ax.heading(2))
                .foregroundStyle(ax.text)
                .accessibilityAddTraits(.isHeader)
            Spacer()
            InboxIconButton(symbol: "xmark", label: words.close, help: words.closeTooltip, action: close)
                .keyboardShortcut(.cancelAction)
        }
        .padding(ax.space(4))
    }

    private var footer: some View {
        HStack(spacing: ax.space(1)) {
            Button {
            } label: {
                Label(words.send, systemImage: "paperplane")
            }
            .buttonStyle(AXButtonStyle(variant: .primary, ax: ax))
            .padding(.trailing, ax.space(1))
            ForEach(words.tools, id: \.id) { tool in
                InboxIconButton(symbol: Self.toolSymbol(tool.id), label: tool.label)
            }
            Spacer(minLength: ax.space(2))
            InboxIconButton(symbol: "trash", label: words.discard) {
                send(.press(id: inboxAction("discard")))
            }
        }
        .padding(ax.space(3))
        .accessibilityElement(children: .contain)
        .accessibilityLabel(words.actionsLabel)
    }

    private static func toolSymbol(_ id: String) -> String {
        switch id {
        case "attach": "paperclip"
        case "link": "link"
        case "image": "photo"
        case "emoji": "face.smiling"
        default: "paperclip"
        }
    }

    private var fieldShape: RoundedRectangle { RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous) }

    private var subjectField: some View {
        Group {
            if isStatic {
                Text(subject.isEmpty ? words.subject : subject)
                    .foregroundStyle(subject.isEmpty ? ax.textDisabled : ax.text)
                    .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                TextField(words.subject, text: $subject, prompt: Text(words.subject).foregroundColor(ax.textDisabled))
                    .textFieldStyle(.plain)
                    .foregroundStyle(ax.text)
            }
        }
        .font(ax.fontBase)
        .padding(.horizontal, ax.space(3))
        .frame(minHeight: 38 * min(ax.scale, 1.4))
        .background(fieldShape.fill(ax.surface))
        .overlay(fieldShape.strokeBorder(ax.borderStrong, lineWidth: 1))
        .syncedText(id: inboxAction("subject"), value: compose.subject, text: $subject)
    }

    private var bodyField: some View {
        Group {
            if isStatic {
                Text(bodyText.isEmpty ? words.bodyPlaceholder : bodyText)
                    .foregroundStyle(bodyText.isEmpty ? ax.textDisabled : ax.text)
                    .frame(maxWidth: .infinity, minHeight: 160, alignment: .topLeading)
            } else {
                TextEditor(text: $bodyText)
                    .scrollContentBackground(.hidden)
                    .foregroundStyle(ax.text)
                    .frame(minHeight: 160)
                    .overlay(alignment: .topLeading) {
                        if bodyText.isEmpty {
                            Text(words.bodyPlaceholder)
                                .foregroundStyle(ax.textDisabled)
                                .padding(.leading, 5)
                                .padding(.top, 8)
                                .allowsHitTesting(false)
                        }
                    }
                    .accessibilityLabel(words.body)
            }
        }
        .font(ax.fontBase)
        .padding(.horizontal, ax.space(2))
        .padding(.vertical, ax.space(2))
        .background(fieldShape.fill(ax.surface))
        .overlay(fieldShape.strokeBorder(ax.borderStrong, lineWidth: 1))
        .syncedText(id: inboxAction("body"), value: compose.body, text: $bodyText)
    }
}

/// A recipients field: the chosen people as removable tokens, a text box that suggests from the
/// directory the core offers, and (on the first field) the Cc and Bcc buttons. A change is sent
/// whole, as the JSON array of `{id, label}` the core reads.
struct InboxRecipientField: View {
    let field: String
    let placeholder: String
    let people: [InboxModel.Person]
    let directory: [InboxModel.Person]
    var showCc: String? = nil
    var showBcc: String? = nil
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send
    @Environment(\.axStatic) private var isStatic
    @State private var query = ""

    private var suggestions: [InboxModel.Person] {
        let term = query.trimmingCharacters(in: .whitespaces).lowercased()
        guard !term.isEmpty else { return [] }
        let chosen = Set(people.map(\.id))
        return directory.filter { !chosen.contains($0.id) && $0.label.lowercased().contains(term) }.prefix(5).map { $0 }
    }

    private func commit(_ next: [InboxModel.Person]) {
        guard let data = try? JSONEncoder().encode(next) else { return }
        send(.set(id: inboxAction(field), value: .string(String(decoding: data, as: UTF8.self))))
    }

    private func add(_ person: InboxModel.Person) {
        guard !people.contains(where: { $0.id == person.id }) else { return }
        commit(people + [person])
        query = ""
    }

    /// Return adds the first suggestion, or the typed text itself as a new recipient.
    private func submit() {
        let typed = query.trimmingCharacters(in: .whitespaces)
        guard !typed.isEmpty else { return }
        add(suggestions.first ?? InboxModel.Person(id: typed, label: typed))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: ax.space(1)) {
            HStack(alignment: .center, spacing: ax.space(2)) {
                FlowLayout(spacing: ax.space(1), crossAlignment: 0.5) {
                    ForEach(people) { person in personChip(person) }
                    entry
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                if let showCc { optionButton(showCc, action: "showCc") }
                if let showBcc { optionButton(showBcc, action: "showBcc") }
            }
            .padding(.horizontal, ax.space(2))
            .padding(.vertical, ax.space(1))
            .frame(minHeight: 38 * min(ax.scale, 1.4))
            .background(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).fill(ax.surface))
            .overlay(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).strokeBorder(ax.borderStrong, lineWidth: 1))

            if !suggestions.isEmpty {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(suggestions) { person in
                        Button { add(person) } label: {
                            HStack(spacing: ax.space(2)) {
                                AXAvatar(name: person.label, initials: InboxPeople.initials(person.label), hue: InboxPeople.hue(person.label), size: .sm)
                                VStack(alignment: .leading, spacing: 0) {
                                    Text(person.label).font(ax.fontBase).foregroundStyle(ax.text)
                                    Text(person.id).font(ax.fontSmall).foregroundStyle(ax.textSecondary)
                                }
                                Spacer(minLength: 0)
                            }
                            .padding(ax.space(2))
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                }
                .background(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).fill(ax.surface))
                .overlay(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).strokeBorder(ax.border, lineWidth: 1))
            }
        }
    }

    @ViewBuilder
    private var entry: some View {
        if isStatic {
            Text(people.isEmpty ? placeholder : "")
                .font(ax.fontBase)
                .foregroundStyle(ax.textDisabled)
                .frame(minWidth: 100, alignment: .leading)
        } else {
            TextField(placeholder, text: $query, prompt: Text(placeholder).foregroundColor(ax.textDisabled))
                .textFieldStyle(.plain)
                .font(ax.fontBase)
                .foregroundStyle(ax.text)
                .frame(minWidth: 120)
                .onSubmit(submit)
                #if os(iOS)
                .textInputAutocapitalization(.never)
                .keyboardType(.emailAddress)
                #endif
        }
    }

    private func personChip(_ person: InboxModel.Person) -> some View {
        HStack(spacing: ax.space(1)) {
            Text(person.label)
                .font(ax.font("font-size-sm", 12, weight: "font-weight-medium"))
                .foregroundStyle(ax.text)
                .lineLimit(1)
            Button {
                commit(people.filter { $0.id != person.id })
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: ax.fontSize("font-size-2xs", 8), weight: .bold))
                    .foregroundStyle(ax.iconSecondary)
                    .padding(ax.space(1))
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Remove \(person.label)")
        }
        .padding(.leading, ax.space(2))
        .padding(.trailing, ax.space(1))
        .padding(.vertical, ax.hair)
        .background(RoundedRectangle(cornerRadius: ax.radiusInner + 2, style: .continuous).fill(ax.muted))
        .accessibilityElement(children: .combine)
    }

    private func optionButton(_ label: String, action: String) -> some View {
        Button(label) { send(.press(id: inboxAction(action))) }
            .buttonStyle(.plain)
            .font(ax.fontLabel)
            .foregroundStyle(ax.accent)
            .padding(.horizontal, ax.space(2))
            .frame(minHeight: 28)
    }
}
