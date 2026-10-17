/**
 * Astryx's `kanban-board` template, refactored: its state, sample data and logic, here.
 * The JSX is web/src/templates/kanban.tsx; the stock copy is web/src/stock/templates/kanban-board.tsx.
 * (A stub until the template is refactored.)
 */
import type { TemplateModule } from "../types.ts";

export type KanbanState = Record<string, never>;
export type KanbanView = Record<string, never>;

export const kanban: TemplateModule<KanbanState, KanbanView> = {
  id: "kanban",
  astryx: "kanban-board",
  title: "Kanban board",
  initial: () => ({}),
  reduce: (s) => s,
  view: () => ({}),
};
