/**
 * Astryx's `detail-page` template, refactored: its state, sample data and logic, here.
 * The JSX is web/src/templates/order.tsx; the stock copy is web/src/stock/templates/detail-page.tsx.
 * (A stub until the template is refactored.)
 */
import type { TemplateModule } from "../types.ts";

export type OrderState = Record<string, never>;
export type OrderView = Record<string, never>;

export const order: TemplateModule<OrderState, OrderView> = {
  id: "order",
  astryx: "detail-page",
  title: "Order detail",
  initial: () => ({}),
  reduce: (s) => s,
  view: () => ({}),
};
