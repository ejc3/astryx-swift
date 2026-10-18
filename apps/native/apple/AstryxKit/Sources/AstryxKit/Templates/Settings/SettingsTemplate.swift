import SwiftUI

/// Astryx's settings template, drawn natively from the core's view model
/// (core/src/templates/settings/model.ts, its `View` type). A stub until it is written.
struct SettingsTemplate: View {
    let view: JSONValue
    var body: some View { AXTemplatePlaceholder(template: "settings") }
}
