/**
 * Astryx's `table-inbox` template, refactored: its state, sample data and logic, here.
 * The JSX is web/src/templates/inbox.tsx; the stock copy is web/src/stock/templates/table-inbox.tsx.
 * (A stub until the template is refactored.)
 */
import type { TemplateModule } from "../types.ts";

export type InboxState = Record<string, never>;
export type InboxView = Record<string, never>;

export const inbox: TemplateModule<InboxState, InboxView> = {
  id: "inbox",
  astryx: "table-inbox",
  title: "Inbox",
  initial: () => ({}),
  reduce: (s) => s,
  view: () => ({}),
};
