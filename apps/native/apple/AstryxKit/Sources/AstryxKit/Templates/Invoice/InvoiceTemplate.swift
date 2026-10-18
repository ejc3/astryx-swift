import SwiftUI

/// Astryx's invoice template, drawn natively from the core's view model
/// (core/src/templates/invoice/model.ts, its `View` type). A stub until it is written.
struct InvoiceTemplate: View {
    let view: JSONValue
    var body: some View { AXTemplatePlaceholder(template: "invoice") }
}
