/**
 * Astryx's `table-page` template, refactored: its state, sample data and logic, here.
 * The JSX is web/src/templates/invoice.tsx; the stock copy is web/src/stock/templates/table-page.tsx.
 * (A stub until the template is refactored.)
 */
import type { TemplateModule } from "../types.ts";

export type InvoiceState = Record<string, never>;
export type InvoiceView = Record<string, never>;

export const invoice: TemplateModule<InvoiceState, InvoiceView> = {
  id: "invoice",
  astryx: "table-page",
  title: "Invoice",
  initial: () => ({}),
  reduce: (s) => s,
  view: () => ({}),
};
