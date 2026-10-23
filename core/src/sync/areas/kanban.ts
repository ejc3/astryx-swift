/** The kanban board's saved cards (core/src/templates/kanban). */
import { define, fields, isId, isInstant, isKey, isText, oneOf, put } from "../check.ts";

export const KANBAN_COLUMNS = ["todo", "in-progress", "in-review", "done"] as const;
export const KANBAN_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export const MAX_TITLE = 200;

export const tables = {
  kanban_card: { column: "string", order: "string", title: "string", description: "string", ref: "string", priority: "string", assignee: "string", createdAt: "number", editedAt: "number", deleted: "boolean" },
} as const;



const kanbanPlace = define<{ id: string; column: string; order: string; at: number }>({
  check: (a) => fields(a, { id: isId, column: oneOf(KANBAN_COLUMNS), order: isKey, at: isInstant }),
  writes: (a) => [put("kanban_card", a.id, { column: a.column, order: a.order, editedAt: a.at })],
});

const kanbanAdd = define<{ id: string; column: string; order: string; title: string; ref: string; priority: string; at: number }>({
  check: (a) => fields(a, { id: isId, column: oneOf(KANBAN_COLUMNS), order: isKey, title: (v) => isText(MAX_TITLE)(v) && (v as string).trim() !== "", ref: isText(40), priority: oneOf(KANBAN_PRIORITIES), at: isInstant }),
  writes: (a) => [put("kanban_card", a.id, { column: a.column, order: a.order, title: a.title.trim(), ref: a.ref, priority: a.priority, description: "", createdAt: a.at, editedAt: a.at })],
});

const kanbanAssign = define<{ id: string; assignee: string; at: number }>({
  check: (a) => fields(a, { id: isId, assignee: isText(80), at: isInstant }),
  writes: (a) => [put("kanban_card", a.id, { assignee: a.assignee, editedAt: a.at })],
});


export const mutations = {
  "kanban.place": kanbanPlace,
  "kanban.add": kanbanAdd,
  "kanban.assign": kanbanAssign,
};
