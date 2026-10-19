import SwiftUI

/// The compose sheet's content. The recipients, Cc/Bcc, subject and body are the core's;
/// typing is sent as it happens, like the kit's text fields.
///
/// On a device it is a `NavigationStack` around a `Form`, as Mail's: Cancel at the leading edge
/// and Send at the trailing edge of the top bar (Send is disabled, the core has no send action),
/// and the draft's tools in the bottom bar. Cancelling a draft with typed content asks what to do
/// with it (Discard Draft, Save Draft, Keep Editing), and swiping the sheet away is switched off
/// while there is such content. Drawn to an image (`axStatic`, where a Form cannot be drawn) it
/// is the same content in a plain column.
struct InboxComposeForm: View {
    let compose: InboxModel.Compose
    let words: InboxModel.Words.Composer
    var inert: [String] = []
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send
    @Environment(\.axStatic) private var isStatic
    @State private var subject: String
    @State private var bodyText: String
    @State private var confirmingDiscard = false

    init(compose: InboxModel.Compose, words: InboxModel.Words.Composer, inert: [String] = []) {
        self.compose = compose
        self.words = words
        self.inert = inert
        _subject = State(initialValue: compose.subject)
        _bodyText = State(initialValue: compose.body)
    }

    /// What was typed that cancelling would lose; the core's word, plus a body typed this instant.
    private var isDirty: Bool {
        compose.isDirty || !bodyText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var body: some View {
        if isStatic { staticSheet } else { sheet }
    }

    // MARK: On a device

    private var sheet: some View {
        NavigationStack {
            Form {
                Section {
                    recipientFields
                }
                Section {
                    subjectField
                    bodyField
                }
                Section {
                    Button(role: .destructive) {
                        confirmingDiscard = true
                    } label: {
                        Label(words.discard, systemImage: "trash")
                    }
                }
            }
            .formStyle(.grouped)
            .navigationTitle(words.heading)
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(words.cancel, action: cancel)
                        .keyboardShortcut(.cancelAction)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(words.send) {}
                }
                ToolbarItemGroup(placement: toolsPlacement) {
                    ForEach(words.tools, id: \.id) { tool in
                        Button {
                        } label: {
                            Label(tool.label, systemImage: Self.toolSymbol(tool.id))
                        }
                    }
                }
            }
        }
        .interactiveDismissDisabled(isDirty)
        .confirmationDialog(words.discardTitle, isPresented: $confirmingDiscard, titleVisibility: .visible) {
            Button(words.discardAction, role: .destructive) { send(.press(id: inboxAction("discard"))) }
            Button(words.saveDraft) { close() }
            Button(words.keepEditing, role: .cancel) {}
        }
        .accessibilityLabel(words.sheetLabel)
    }

    private var toolsPlacement: ToolbarItemPlacement {
        #if os(iOS)
        .bottomBar
        #else
        .automatic
        #endif
    }

    private func cancel() {
        if isDirty { confirmingDiscard = true } else { close() }
    }

    private func close() { send(.set(id: inboxAction("composeOpen"), value: .bool(false))) }

    // MARK: Drawn to an image

    private var staticSheet: some View {
        VStack(spacing: 0) {
            HStack {
                Text(words.cancel).font(ax.fontBase).foregroundStyle(ax.accent)
                Spacer()
                Text(words.heading)
                    .font(ax.fontStrong)
                    .foregroundStyle(ax.text)
                    .accessibilityAddTraits(.isHeader)
                Spacer()
                Text(words.send).font(ax.fontStrong).foregroundStyle(ax.textDisabled)
            }
            .padding(ax.space(4))
            InboxHairline()
            VStack(spacing: ax.space(2)) {
                recipientFields
                subjectField
                bodyField
            }
            .padding(ax.space(3))
            InboxHairline()
            HStack(spacing: ax.space(1)) {
                ForEach(words.tools, id: \.id) { tool in
                    InboxIconButton(symbol: Self.toolSymbol(tool.id), label: tool.label)
                }
                Spacer(minLength: ax.space(2))
                InboxIconButton(symbol: "trash", label: words.discard)
            }
            .padding(ax.space(3))
        }
        .background(ax.surface)
        .accessibilityElement(children: .contain)
        .accessibilityLabel(words.sheetLabel)
    }

    // MARK: Fields

    @ViewBuilder
    private var recipientFields: some View {
        InboxRecipientField(
            field: "recipients", placeholder: words.recipient, remove: words.remove,
            people: compose.recipients, directory: compose.directory,
            showCc: compose.hasCc ? nil : words.cc,
            showBcc: compose.hasBcc ? nil : words.bcc
        )
        if compose.hasCc {
            InboxRecipientField(field: "cc", placeholder: words.cc, remove: words.remove, people: compose.cc, directory: compose.directory)
        }
        if compose.hasBcc {
            InboxRecipientField(field: "bcc", placeholder: words.bcc, remove: words.remove, people: compose.bcc, directory: compose.directory)
        }
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

    private var subjectField: some View {
        Group {
            if isStatic {
                Text(subject.isEmpty ? words.subject : subject)
                    .foregroundStyle(subject.isEmpty ? ax.textDisabled : ax.text)
                    .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                TextField(words.subject, text: $subject, prompt: Text(words.subject).foregroundColor(ax.textDisabled))
                    .labelsHidden()
                    .textFieldStyle(.plain)
                    .foregroundStyle(ax.text)
            }
        }
        .font(ax.fontBase)
        .modifier(InboxFieldFrame(horizontal: ax.space(3), vertical: 0, minHeight: 38 * min(ax.scale, 1.4)))
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
        .modifier(InboxFieldFrame(horizontal: ax.space(2), vertical: ax.space(2), minHeight: 0))
        .syncedText(id: inboxAction("body"), value: compose.body, text: $bodyText)
    }
}

/// The bordered box a field is drawn in when it is drawn to an image; in a Form the row is the box.
struct InboxFieldFrame: ViewModifier {
    let horizontal: CGFloat
    let vertical: CGFloat
    let minHeight: CGFloat
    @Environment(\.ax) private var ax
    @Environment(\.axStatic) private var isStatic

    func body(content: Content) -> some View {
        if isStatic {
            let shape = RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous)
            content
                .padding(.horizontal, horizontal)
                .padding(.vertical, vertical)
                .frame(minHeight: minHeight)
                .background(shape.fill(ax.surface))
                .overlay(shape.strokeBorder(ax.borderStrong, lineWidth: 1))
        } else {
            content
        }
    }
}

/// A recipients field: the chosen people as removable tokens, a text box that suggests from the
/// directory the core offers, and (on the first field) the Cc and Bcc buttons. A change is sent
/// whole, as the JSON array of `{id, label}` the core reads.
struct InboxRecipientField: View {
    let field: String
    let placeholder: String
    /// Spoken before a person's name on the control that removes them.
    let remove: String
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
            .modifier(InboxFieldFrame(horizontal: ax.space(2), vertical: ax.space(1), minHeight: 38 * min(ax.scale, 1.4)))

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
                .labelsHidden()
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
                    .inboxHitTarget(size: 16)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("\(remove) \(person.label)")
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
            .frame(minHeight: InboxTarget.side)
    }
}
