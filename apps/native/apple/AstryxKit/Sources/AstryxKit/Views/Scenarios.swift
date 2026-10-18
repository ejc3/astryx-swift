import SwiftUI

/// The scenarios menu: each scenario, and under it the ways to drive it (from the native side
/// or from the web page on Hermes). Every word is the core's.
struct ScenarioMenu: View {
    let scenarios: ScenariosSnapshot
    @Environment(\.axSend) private var send

    var body: some View {
        Menu {
            ForEach(scenarios.list) { item in
                Menu("\(item.template): \(item.title)") {
                    ForEach(scenarios.drivers, id: \.value) { driver in
                        Button {
                            send(.press(id: "scenario.start:\(item.id):\(driver.value)"))
                        } label: {
                            Text(driver.label)
                            Text(driver.description)
                        }
                    }
                    Text(item.steps)
                }
            }
        } label: {
            Label(scenarios.label, systemImage: "play.circle")
        }
        .accessibilityLabel(scenarios.label)
    }
}

/// While a scenario plays: its title, the step's caption and progress, and its controls.
struct ScenarioBar: View {
    let playing: ScenariosSnapshot.Playing
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send

    var body: some View {
        HStack(spacing: ax.space(3)) {
            Image(systemName: playing.status == "done" ? "checkmark.circle.fill" : playing.driver == "web" ? "globe" : "hand.tap")
                .foregroundStyle(ax.accent)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(playing.title).font(ax.fontStrong).foregroundStyle(ax.text)
                Text("\(playing.progress) · \(playing.caption)")
                    .font(ax.font("font-size-sm", 12))
                    .foregroundStyle(ax.textSecondary)
                    .lineLimit(1)
            }
            Spacer(minLength: ax.space(2))
            if playing.status == "playing" {
                Button(playing.controls.pauseLabel) { send(.press(id: playing.controls.pauseId)) }
            } else if playing.status == "paused" {
                Button(playing.controls.resumeLabel) { send(.press(id: playing.controls.resumeId)) }
            }
            Button(playing.controls.stopLabel) { send(.press(id: playing.controls.stopId)) }
        }
        .padding(.horizontal, ax.space(4))
        .padding(.vertical, ax.space(3))
        .frame(maxWidth: 560)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous).stroke(ax.border))
        .shadow(color: .black.opacity(0.12), radius: 12, y: 4)
        .accessibilityElement(children: .contain)
    }
}
