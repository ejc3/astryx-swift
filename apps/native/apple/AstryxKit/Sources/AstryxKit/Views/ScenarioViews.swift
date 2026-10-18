import SwiftUI

extension ScenariosSnapshot {
    /// The press that starts `item`, driven from the native side or the web (`driver`).
    func startId(_ item: Item, _ driver: Driver) -> String {
        "scenario.start:\(item.id):\(driver.value)"
    }
}

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
                            send(.press(id: scenarios.startId(item, driver)))
                        } label: {
                            Text(driver.label)
                            Text(driver.description)
                        }
                    }
                    Text(item.steps)
                }
            }
        } label: {
            Label(scenarios.label, systemImage: "play.fill")
        }
        .help(scenarios.label)
        .accessibilityLabel(scenarios.label)
    }
}

/// The floating control layer's surface: Liquid Glass (regular, for text) where the system has
/// it, a material with a hairline before.
private struct BarSurface: ViewModifier {
    @Environment(\.ax) private var ax

    func body(content: Content) -> some View {
        let shape = RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous)
        if #available(iOS 26, macOS 26, *) {
            content.glassEffect(.regular, in: shape)
        } else {
            content
                .background(.regularMaterial, in: shape)
                .overlay(shape.stroke(ax.border))
                .shadow(color: .black.opacity(0.12), radius: 12, y: 4)
        }
    }
}

/// While a scenario plays: its title, the step's caption and progress, and its controls. It
/// floats in the bottom stack, inset from the edges, and its buttons are full-size targets.
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
                    .lineLimit(2)
            }
            Spacer(minLength: ax.space(2))
            if playing.status == "playing" {
                control(playing.controls.pauseLabel, id: playing.controls.pauseId)
            } else if playing.status == "paused" {
                control(playing.controls.resumeLabel, id: playing.controls.resumeId)
            }
            control(playing.controls.stopLabel, id: playing.controls.stopId)
        }
        .padding(.leading, ax.space(4))
        .padding(.trailing, ax.space(2))
        .padding(.vertical, ax.space(2))
        .frame(maxWidth: 560)
        .modifier(BarSurface())
        .accessibilityElement(children: .contain)
    }

    private func control(_ label: String, id: String) -> some View {
        Button {
            send(.press(id: id))
        } label: {
            Text(label)
                .frame(minWidth: chromeTarget, minHeight: chromeTarget)
                .contentShape(Rectangle())
        }
        .buttonStyle(.borderless)
    }
}
