import SwiftUI

/// The account at the foot of the sidebar (core/src/account.ts): "Sign in to sync" when signed
/// out, and when signed in the email and the sync status, with Sign Out in a menu. Every word is
/// the core's; signing out asks first (the core's dialog). Nothing is drawn when sign-in is off.
struct AccountFooter: View {
    let account: AccountInfo
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send

    var body: some View {
        Group {
            switch account.state {
            case "signed-in": signedIn
            case "signing-in": signingIn
            default: signedOut
            }
        }
        .padding(.horizontal, ax.space(3))
        .padding(.vertical, ax.space(2))
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var signedOut: some View {
        Button {
            if let signIn = account.signIn { send(.press(id: signIn.id)) }
        } label: {
            row(icon: Image(systemName: "person.crop.circle"), iconStyle: AnyShapeStyle(ax.accent), title: account.title, detail: Text(account.detail))
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(account.title)
        .accessibilityHint(account.detail)
        .accessibilityAddTraits(.isButton)
    }

    private var signingIn: some View {
        HStack(spacing: ax.space(3)) {
            ProgressView().controlSize(.small)
            VStack(alignment: .leading, spacing: 1) {
                Text(account.title).font(ax.fontLabel).foregroundStyle(ax.text)
                Text(account.detail).font(.caption).foregroundStyle(ax.textSecondary).lineLimit(2)
            }
        }
        .accessibilityElement(children: .combine)
    }

    private var signedIn: some View {
        Menu {
            if let signIn = account.signIn {
                Button(signIn.label) { send(.press(id: signIn.id)) }
            }
            if let signOut = account.signOut {
                Button(signOut.label) { send(.press(id: signOut.id)) }
            }
        } label: {
            row(
                icon: Image(systemName: "person.crop.circle.fill"),
                iconStyle: AnyShapeStyle(ax.iconSecondary),
                title: account.title,
                detail: statusText
            )
            .contentShape(Rectangle())
        }
        .menuStyle(.button)
        .buttonStyle(.plain)
        #if os(macOS)
        .menuIndicator(.hidden)
        #endif
        .accessibilityLabel(account.accessibilityLabel)
    }

    /// The status with its icon, both in the status's tone.
    private var statusText: Text {
        guard let status = account.status else { return Text(account.detail) }
        let color = status.tone == .neutral ? ax.textSecondary : ax.tone(status.tone).text
        return Text("\(Image(systemName: status.icon.symbol)) \(status.text)").foregroundStyle(color)
    }

    private func row(icon: Image, iconStyle: AnyShapeStyle, title: String, detail: Text) -> some View {
        HStack(spacing: ax.space(3)) {
            icon
                .font(.title2)
                .foregroundStyle(iconStyle)
            VStack(alignment: .leading, spacing: 1) {
                Text(title)
                    .font(ax.fontLabel)
                    .foregroundStyle(ax.text)
                    .lineLimit(1)
                    .truncationMode(.middle)
                detail
                    .font(.caption)
                    .foregroundStyle(ax.textSecondary)
                    .lineLimit(2)
            }
            Spacer(minLength: 0)
        }
    }
}

/// The account in the Mac's Settings window: the same words and buttons as the sidebar's.
struct AccountSettingsSection: View {
    let account: AccountInfo
    let send: (Action) -> Void

    var body: some View {
        Section(account.label) {
            switch account.state {
            case "signed-in":
                LabeledContent(account.title) {
                    if let status = account.status {
                        Label(status.text, systemImage: status.icon.symbol)
                    }
                }
                HStack {
                    Spacer()
                    if let signIn = account.signIn {
                        Button(signIn.label) { send(.press(id: signIn.id)) }
                    }
                    if let signOut = account.signOut {
                        Button(signOut.label) { send(.press(id: signOut.id)) }
                    }
                }
            case "signing-in":
                LabeledContent(account.title) { ProgressView().controlSize(.small) }
            default:
                LabeledContent {
                    if let signIn = account.signIn {
                        Button(signIn.label) { send(.press(id: signIn.id)) }
                    }
                } label: {
                    Text(account.detail)
                }
            }
        }
    }
}
