import SwiftUI

/// Astryx's order template, drawn natively from the core's view model
/// (core/src/templates/order/model.ts, its `View` type). A stub until it is written.
struct OrderTemplate: View {
    let view: JSONValue
    var body: some View { AXTemplatePlaceholder(template: "order") }
}
