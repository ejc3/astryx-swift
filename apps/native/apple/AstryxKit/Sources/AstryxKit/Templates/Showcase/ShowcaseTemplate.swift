import SwiftUI

/// Astryx's showcase template, drawn natively from the core's view model
/// (core/src/templates/showcase/model.ts, its `View` type). A stub until it is written.
struct ShowcaseTemplate: View {
    let view: JSONValue
    var body: some View { AXTemplatePlaceholder(template: "showcase") }
}
