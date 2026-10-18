import SwiftUI

/// Astryx's checkout template, drawn natively from the core's view model
/// (core/src/templates/checkout/model.ts, its `View` type). A stub until it is written.
struct CheckoutTemplate: View {
    let view: JSONValue
    var body: some View { AXTemplatePlaceholder(template: "checkout") }
}
