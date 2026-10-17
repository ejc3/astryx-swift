import { lazy, type ComponentType } from "react";
import type { TemplateProps } from "./props.ts";

/** The refactored templates' renderers, by template id (core/src/templates). */
export const TEMPLATE_VIEWS: Record<string, ComponentType<TemplateProps>> = {
  showcase: lazy(() => import("./showcase.tsx")),
  dashboard: lazy(() => import("./dashboard.tsx")),
  inbox: lazy(() => import("./inbox.tsx")),
  kanban: lazy(() => import("./kanban.tsx")),
  invoice: lazy(() => import("./invoice.tsx")),
  calendar: lazy(() => import("./calendar.tsx")),
  chat: lazy(() => import("./chat.tsx")),
  checkout: lazy(() => import("./checkout.tsx")),
  order: lazy(() => import("./order.tsx")),
  settings: lazy(() => import("./settings.tsx")),
};
