import SwiftUI

/// Astryx's dashboard template, drawn natively from the core's view model
/// (core/src/templates/dashboard/model.ts, its `View` type). A stub until it is written.
struct DashboardTemplate: View {
    let view: JSONValue
    var body: some View { AXTemplatePlaceholder(template: "dashboard") }
}
