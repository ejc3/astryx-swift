import SwiftUI

/// Astryx's kanban template, drawn natively from the core's view model
/// (core/src/templates/kanban/model.ts, its `View` type). A stub until it is written.
struct KanbanTemplate: View {
    let view: JSONValue
    var body: some View { AXTemplatePlaceholder(template: "kanban") }
}
