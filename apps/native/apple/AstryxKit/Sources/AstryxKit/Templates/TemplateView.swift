import SwiftUI

/// A refactored Astryx template's screen: the template's own SwiftUI view, by id.
struct TemplateView: View {
    let node: TemplateNode

    var body: some View {
        switch node.template {
        case "showcase": ShowcaseTemplate(view: node.view)
        case "dashboard": DashboardTemplate(view: node.view)
        case "inbox": InboxTemplate(view: node.view)
        case "kanban": KanbanTemplate(view: node.view)
        case "invoice": InvoiceTemplate(view: node.view)
        case "calendar": CalendarTemplate(view: node.view)
        case "chat": ChatTemplate(view: node.view)
        case "checkout": CheckoutTemplate(view: node.view)
        case "order": OrderTemplate(view: node.view)
        case "settings": SettingsTemplate(view: node.view)
        default: AXTemplatePlaceholder(template: node.template)
        }
    }
}
