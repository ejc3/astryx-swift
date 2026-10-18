import SwiftUI

/// The menu bar's commands (the Mac's, and the iPad's when a keyboard is attached), every
/// word the core's: a Scenarios menu to play each scenario from the native side or the web
/// and to pause (⌘.) and stop it, and in the View menu the choice of drawing (⌘1 to ⌘6).
/// The host adds the system's `SidebarCommands` and `ToolbarCommands` beside them.
public struct AstryxCommands: Commands {
    @ObservedObject private var model: AppModel

    public init(model: AppModel) {
        self.model = model
    }

    public var body: some Commands {
        CommandMenu(model.app?.scenarios?.label ?? "") {
            ScenarioCommandItems(model: model)
        }
        CommandGroup(after: .toolbar) {
            SurfaceCommandItems(model: model)
        }
    }
}

private struct ScenarioCommandItems: View {
    @ObservedObject var model: AppModel

    var body: some View {
        if let scenarios = model.app?.scenarios {
            ForEach(scenarios.list) { item in
                Menu("\(item.template): \(item.title)") {
                    ForEach(scenarios.drivers, id: \.value) { driver in
                        Button(driver.label) {
                            model.perform(.press(id: scenarios.startId(item, driver)))
                        }
                    }
                }
            }
            Divider()
            let playing = scenarios.playing
            let controls = playing?.controls ?? scenarios.controls
            if let controls {
                if playing?.status == "paused" {
                    Button(controls.resumeLabel) { model.perform(.press(id: controls.resumeId)) }
                        .keyboardShortcut(".", modifiers: .command)
                } else {
                    Button(controls.pauseLabel) { model.perform(.press(id: controls.pauseId)) }
                        .keyboardShortcut(".", modifiers: .command)
                        .disabled(playing?.status != "playing")
                }
                Button(controls.stopLabel) { model.perform(.press(id: controls.stopId)) }
                    .keyboardShortcut(".", modifiers: [.command, .shift])
                    .disabled(playing == nil)
            }
        }
    }
}

private struct SurfaceCommandItems: View {
    @ObservedObject var model: AppModel

    var body: some View {
        if let surface = model.app?.surface {
            Divider()
            ForEach(Array(sections(surface).enumerated()), id: \.offset) { _, section in
                Section {
                    ForEach(section.options) { entry in
                        Toggle(entry.option.label, isOn: Binding(
                            get: { surface.value == entry.option.value },
                            set: { _ in model.perform(.set(id: surface.id, value: .string(entry.option.value))) }
                        ))
                        .keyboardShortcut(KeyEquivalent(Character(String(entry.number))), modifiers: .command)
                    }
                } header: {
                    if let title = section.title { Text(title) }
                }
            }
        }
    }

    private struct Entry: Identifiable {
        let option: Option
        let number: Int
        var id: String { option.value }
    }

    /// The options in the core's groups, each numbered by its place in the core's list.
    private func sections(_ surface: AppSnapshot.SurfaceChoice) -> [(title: String?, options: [Entry])] {
        let numbered = surface.options.enumerated().map { Entry(option: $0.element, number: $0.offset + 1) }
        guard let groups = surface.groups, !groups.isEmpty else { return [(nil, numbered)] }
        return groups.map { group in
            (group.label, group.values.compactMap { value in numbered.first { $0.option.value == value } })
        }
    }
}

/// The Mac's Settings window (⌘,): the theme, chosen from the core's list.
public struct AstryxSettingsView: View {
    @ObservedObject private var model: AppModel

    public init(model: AppModel) {
        self.model = model
    }

    public var body: some View {
        Form {
            if let theme = model.app?.theme, let setId = theme.setId {
                Picker(theme.label ?? "", selection: Binding(
                    get: { theme.id },
                    set: { model.perform(.set(id: setId, value: .string($0))) }
                )) {
                    ForEach(theme.options, id: \.value) { Text($0.label).tag($0.value) }
                }
            }
        }
        .formStyle(.grouped)
        .frame(width: 380)
        .fixedSize(horizontal: false, vertical: true)
    }
}
