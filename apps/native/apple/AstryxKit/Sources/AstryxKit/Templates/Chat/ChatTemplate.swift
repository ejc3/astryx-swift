import SwiftUI

/// Astryx's chat template, drawn natively from the core's view model
/// (core/src/templates/chat/model.ts, its `View` type). A stub until it is written.
struct ChatTemplate: View {
    let view: JSONValue
    var body: some View { AXTemplatePlaceholder(template: "chat") }
}
