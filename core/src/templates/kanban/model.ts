/**
 * Astryx's `kanban-board` template, refactored: its state, sample data and logic, here.
 * The JSX is web/src/templates/kanban.tsx; the stock copy is web/src/stock/templates/kanban-board.tsx.
 *
 * The board's order lives here: one flat list of cards, each in a column; a column shows
 * its cards in list order. The drag gesture (pointer tracking, the floating clone and the
 * landing-slot ghost) stays in the host and ends in one `set` that drops the card.
 *
 * Actions (the "tpl.kanban." prefix removed):
 *   press  move:<card id>:<column id>   the card's "Move to ..." menu entry
 *   set    sprint  <sprint value>       the sprint selector
 *   set    drop:<card id>  "<column id>:<index>"
 *            put the card in the column at that index, counted among the cards that
 *            remain in the column once the card itself is taken out
 */
import type { TemplateModule } from "../types.ts";

export type ColumnId = "todo" | "in-progress" | "in-review" | "done";
type Priority = "high" | "medium" | "low";
export type ColumnVariant = "neutral" | "accent" | "warning" | "success";
export type PriorityVariant = "error" | "warning" | "teal";
/** Which icon a column's empty state shows; the host maps the name to a drawing. */
export type EmptyIcon = "inbox" | "arrow-path" | "clipboard-check" | "check-circle";

type WorkItem = {
  id: string;
  column: ColumnId;
  ref: string;
  priority: Priority;
  title: string;
  description: string;
  lastEdited: string;
  dueDate: string;
};

type ColumnMeta = {
  id: ColumnId;
  title: string;
  variant: ColumnVariant;
  tooltip: string;
  emptyTitle: string;
  emptyDescription: string;
  emptyIcon: EmptyIcon;
};

const COLUMNS: readonly ColumnMeta[] = [
  {
    id: "todo",
    title: "To-do",
    variant: "neutral",
    tooltip: "Items assigned to this sprint, waiting to be picked up.",
    emptyTitle: "To-do is empty",
    emptyDescription: "Items pulled into this sprint appear here.",
    emptyIcon: "inbox",
  },
  {
    id: "in-progress",
    title: "In progress",
    variant: "accent",
    tooltip: "Items currently in progress.",
    emptyTitle: "Nothing in progress",
    emptyDescription: "Items being worked on appear here.",
    emptyIcon: "arrow-path",
  },
  {
    id: "in-review",
    title: "In review",
    variant: "warning",
    tooltip: "Items waiting for your review.",
    emptyTitle: "Nothing in review",
    emptyDescription: "Items awaiting your review appear here.",
    emptyIcon: "clipboard-check",
  },
  {
    id: "done",
    title: "Done",
    variant: "success",
    tooltip: "Items that have been handled.",
    emptyTitle: "Nothing done yet",
    emptyDescription: "Completed items appear here.",
    emptyIcon: "check-circle",
  },
];

const PRIORITY_META: Record<Priority, { label: string; variant: PriorityVariant }> = {
  high: { label: "High", variant: "error" },
  medium: { label: "Medium", variant: "warning" },
  low: { label: "Low", variant: "teal" },
};

const SPRINTS: readonly { value: string; label: string }[] = [
  { value: "003", label: "Sprint 003" },
  { value: "002", label: "Sprint 002" },
  { value: "001", label: "Sprint 001" },
];

const INITIAL_ITEMS: readonly WorkItem[] = [
  {
    id: "t1",
    column: "todo",
    ref: "Task 4821",
    priority: "low",
    title: "Draft project kickoff brief",
    description: "Write a short brief outlining goals, scope, and success criteria for the upcoming project.",
    lastEdited: "2h ago",
    dueDate: "Jul 8",
  },
  {
    id: "t2",
    column: "todo",
    ref: "Task 4842",
    priority: "low",
    title: "Collect feedback from stakeholders",
    description: "Gather input from key stakeholders and summarize the main themes for the next review.",
    lastEdited: "1d ago",
    dueDate: "Jul 11",
  },
  {
    id: "p1",
    column: "in-progress",
    ref: "Task 4825",
    priority: "high",
    title: "Design the landing page layout",
    description: "Create a first-pass layout for the landing page and share it for early feedback.",
    lastEdited: "18m ago",
    dueDate: "Jul 3",
  },
  {
    id: "p2",
    column: "in-progress",
    ref: "Task 4833",
    priority: "medium",
    title: "Set up the project workspace",
    description: "Configure the shared workspace and invite the team so everyone has access.",
    lastEdited: "5m ago",
    dueDate: "Jul 4",
  },
  {
    id: "r1",
    column: "done",
    ref: "Task 4788",
    priority: "low",
    title: "Write the weekly status update",
    description: "Summarize progress, blockers, and next steps in a short update for the team.",
    lastEdited: "Yesterday",
    dueDate: "Jul 1",
  },
  {
    id: "r2",
    column: "done",
    ref: "Task 4789",
    priority: "high",
    title: "Prepare the demo walkthrough",
    description: "Put together a short walkthrough covering the main features for the demo.",
    lastEdited: "3d ago",
    dueDate: "Jun 30",
  },
  {
    id: "r3",
    column: "done",
    ref: "Task 4790",
    priority: "medium",
    title: "Review and merge open changes",
    description: "Go through the pending changes, leave comments, and merge the ones that are ready.",
    lastEdited: "4d ago",
    dueDate: "Jun 28",
  },
];

export type KanbanState = {
  /** Every card, in board order: a column lists its cards in this order. */
  items: WorkItem[];
  sprint: string;
};

export type CardView = {
  id: string;
  ref: string;
  priorityLabel: string;
  priorityVariant: PriorityVariant;
  title: string;
  description: string;
  edited: string;
  due: string;
  /** "Edited 2h ago · Due Jul 8", the two above in one line */
  meta: string;
  /** The card menu's "Move to ..." entries; `id` is the action to press. */
  moveTargets: { label: string; id: string }[];
};

export type ColumnView = {
  id: ColumnId;
  title: string;
  variant: ColumnVariant;
  tooltip: string;
  emptyTitle: string;
  emptyDescription: string;
  emptyIcon: EmptyIcon;
  count: number;
  cards: CardView[];
};

export type KanbanView = {
  title: string;
  /** The number of cards on the board. */
  total: number;
  sprint: string;
  sprintOptions: { value: string; label: string }[];
  columns: ColumnView[];
};
export type View = KanbanView;

const isColumn = (id: string): id is ColumnId => COLUMNS.some((c) => c.id === id);

function moveItem(s: KanbanState, id: string, to: ColumnId): KanbanState {
  const at = s.items.find((it) => it.id === id);
  if (!at || at.column === to) return s;
  return { ...s, items: s.items.map((it) => (it.id === id ? { ...it, column: to } : it)) };
}

/** Put the card at `index` of the column, counted among the column's other cards. */
function dropItem(s: KanbanState, id: string, to: ColumnId, index: number): KanbanState {
  const moved = s.items.find((it) => it.id === id);
  if (!moved) return s;
  const rest = s.items.filter((it) => it.id !== id);
  const updated: WorkItem = { ...moved, column: to };
  const anchor = rest.filter((it) => it.column === to)[index];
  const at = anchor ? rest.indexOf(anchor) : rest.length;
  const items = [...rest.slice(0, at), updated, ...rest.slice(at)];
  return { ...s, items };
}

export const kanban: TemplateModule<KanbanState, KanbanView> = {
  id: "kanban",
  astryx: "kanban-board",
  title: "Kanban board",
  initial: () => ({ items: INITIAL_ITEMS.map((it) => ({ ...it })), sprint: "003" }),
  reduce(s, action) {
    const colon = action.id.indexOf(":");
    const key = colon < 0 ? action.id : action.id.slice(0, colon);
    const arg = colon < 0 ? "" : action.id.slice(colon + 1);
    if (action.type === "press") {
      if (key !== "move") return s;
      const cut = arg.indexOf(":");
      const column = arg.slice(cut + 1);
      return cut < 0 || !isColumn(column) ? s : moveItem(s, arg.slice(0, cut), column);
    }
    if (key === "sprint") {
      const value = String(action.value);
      return SPRINTS.some((o) => o.value === value) && value !== s.sprint ? { ...s, sprint: value } : s;
    }
    if (key === "drop") {
      const where = String(action.value);
      const cut = where.lastIndexOf(":");
      const column = where.slice(0, Math.max(cut, 0));
      const n = cut < 0 || where.slice(cut + 1) === "" ? NaN : Number(where.slice(cut + 1));
      return isColumn(column) && Number.isInteger(n) && n >= 0 ? dropItem(s, arg, column, n) : s;
    }
    return s;
  },
  view(s) {
    return {
      title: "Sprint Board",
      total: s.items.length,
      sprint: s.sprint,
      sprintOptions: SPRINTS.map((o) => ({ ...o })),
      columns: COLUMNS.map((c) => {
        const cards = s.items
          .filter((it) => it.column === c.id)
          .map((it): CardView => ({
            id: it.id,
            ref: it.ref,
            priorityLabel: PRIORITY_META[it.priority].label,
            priorityVariant: PRIORITY_META[it.priority].variant,
            title: it.title,
            description: it.description,
            edited: it.lastEdited,
            due: it.dueDate,
            meta: `Edited ${it.lastEdited} · Due ${it.dueDate}`,
            moveTargets: COLUMNS.filter((o) => o.id !== it.column).map((o) => ({ label: `Move to ${o.title}`, id: `tpl.kanban.move:${it.id}:${o.id}` })),
          }));
        return {
          id: c.id,
          title: c.title,
          variant: c.variant,
          tooltip: c.tooltip,
          emptyTitle: c.emptyTitle,
          emptyDescription: c.emptyDescription,
          emptyIcon: c.emptyIcon,
          count: cards.length,
          cards,
        };
      }),
    };
  },
};
