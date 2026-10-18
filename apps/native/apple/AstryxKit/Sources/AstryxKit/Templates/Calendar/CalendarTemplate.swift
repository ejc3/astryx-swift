import SwiftUI

/// Astryx's calendar template, drawn natively from the core's view model
/// (core/src/templates/calendar/model.ts, its `View` type). A stub until it is written.
struct CalendarTemplate: View {
    let view: JSONValue
    var body: some View { AXTemplatePlaceholder(template: "calendar") }
}
