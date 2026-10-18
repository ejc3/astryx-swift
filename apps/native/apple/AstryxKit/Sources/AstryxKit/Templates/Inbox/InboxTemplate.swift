import SwiftUI

/// Astryx's inbox template, drawn natively from the core's view model
/// (core/src/templates/inbox/model.ts, its `View` type). A stub until it is written.
struct InboxTemplate: View {
    let view: JSONValue
    var body: some View { AXTemplatePlaceholder(template: "inbox") }
}
