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
import { ago, civilOf, minuteOf, type Now } from "../../format.ts";
import { overlay, type Doc, type Row } from "../../sync/doc.ts";
import { between, isOrderKey, spread } from "../../sync/order.ts";
import { KANBAN_PRIORITIES, MAX_TITLE } from "../../sync/areas/kanban.ts";
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
  /** The sample's "2h ago"; a card the person changed has `editedAt` instead. */
  lastEdited: string;
  /** The sample's "Jul 8"; a card the person made has none. */
  dueDate: string;
};

/** A card as drawn: a sample card or a saved one, with its place in its column. */
type Card = WorkItem & { order: string; editedAt?: number };

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

/**
 * The board's view state. The cards are saved data (docs/SYNC.md): the sample cards with the
 * person's saved rows (`kanban_card`) laid over them, ordered in each column by `order`.
 */
export type KanbanState = {
  sprint: string;
  /** The new-task sheet, while it is open: the title being typed and the column it goes in. */
  adding: { title: string; column: ColumnId } | null;
};

/** The sample cards' order keys: evenly spread, in the stock template's board order. */
const SAMPLE: readonly Card[] = (() => {
  const keys = spread(INITIAL_ITEMS.length);
  return INITIAL_ITEMS.map((it, i) => ({ ...it, order: keys[i]! }));
})();

const isPriority = (v: unknown): v is Priority => typeof v === "string" && (KANBAN_PRIORITIES as readonly string[]).includes(v);

/** A saved row for a card the person made; a row missing what a card needs is not drawn. */
function newCard(row: Row): Card | null {
  const { id, column, order, title, ref, priority, editedAt } = row;
  if (typeof column !== "string" || !isColumn(column) || typeof order !== "string" || !isOrderKey(order) || typeof title !== "string" || typeof ref !== "string" || !isPriority(priority)) return null;
  return { id, column, order, title, ref, priority, description: typeof row.description === "string" ? row.description : "", lastEdited: "", dueDate: "", ...(typeof editedAt === "number" ? { editedAt } : {}) };
}

/** Every card on the board, each column's in order (ties by id, so every device draws the same). */
function cards(doc: Doc | undefined): Card[] {
  const all = overlay(SAMPLE, doc?.kanban_card ?? {}, newCard).filter((c) => isColumn(c.column) && isOrderKey(c.order));
  return all.sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** The order key for a card put at `index` among `column`'s other cards. */
function orderAt(all: readonly Card[], id: string, column: ColumnId, index: number): string {
  const others = all.filter((c) => c.column === column && c.id !== id);
  const before = index > 0 ? (others[Math.min(index, others.length) - 1]?.order ?? null) : null;
  const after = others[index]?.order ?? null;
  // Equal neighbours (two devices made the same key) leave no room between them: go after both.
  return before !== null && after !== null && before >= after ? between(after, null) : between(before, after);
}

/** "Task 4822": the next number after every card's. */
function nextRef(all: readonly Card[]): string {
  const top = Math.max(0, ...all.map((c) => Number(/^Task (\d+)$/.exec(c.ref)?.[1] ?? 0)));
  return `Task ${top + 1}`;
}

/** "Edited 2h ago": the sample's words, or the time since the person last changed the card. */
function editedWords(c: Card, now: Now, extras: boolean): string {
  // Stock does not touch a card's "Edited" words when it moves; nor does the core without extras.
  if (c.editedAt === undefined || !extras) return c.lastEdited;
  const minutes = Math.max(0, Math.floor((now.epochMs - c.editedAt) / 60_000));
  const when = ago(minutes, civilOf(now), minuteOf(now));
  return when === "Now" ? "just now" : /^\d+[mh]$/.test(when) ? `${when} ago` : when;
}

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
  /** `meta` as the separate text nodes the stock template draws ("Edited ", "2h ago", " · Due ", "Jul 8"). */
  metaParts: string[];
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
  /** Spoken on the column's colored dot: "To-do status". */
  statusLabel: string;
  count: number;
  cards: CardView[];
};

/** The layout numbers both drawings read. */
export type KanbanRules = {
  /** Every board column's width in px; the board scrolls sideways when they do not fit. */
  columnWidth: number;
  /** The sprint selector's width in px (the most it takes). */
  sprintWidth: number;
};

const RULES: KanbanRules = { columnWidth: 300, sprintWidth: 200 };

/** The words the board's controls and spoken labels use; the web draws its own copies. */
export type KanbanWords = {
  boardActions: string;
  sort: string;
  filter: string;
  search: string;
  addTask: string;
  sprint: string;
  workItemActions: string;
  open: string;
  assignToMe: string;
  /** Spoken after a column's title on its colored dot ("To-do status"). */
  status: string;
  /** Closes a column's tip when it is a sheet. */
  done: string;
  /** Tells a VoiceOver user that a drop landed ("Moved to Done"); the column's title follows. */
  movedTo: string;
  /** The new-task sheet. */
  newTask: string;
  taskTitle: string;
  taskTitlePlaceholder: string;
  create: string;
  cancel: string;
  /** A card the person made has no due date. */
  noDueDate: string;
};

const WORDS: KanbanWords = {
  boardActions: "Board actions",
  sort: "Sort",
  filter: "Filter",
  search: "Search",
  addTask: "Add task",
  sprint: "Sprint",
  workItemActions: "Work item actions",
  open: "Open",
  assignToMe: "Assign to me",
  status: "status",
  done: "Done",
  movedTo: "Moved to",
  newTask: "New task",
  taskTitle: "Title",
  taskTitlePlaceholder: "What needs doing?",
  create: "Create",
  cancel: "Cancel",
  noDueDate: "No due date",
};

/** Ids of the controls with no action behind them (a host draws them disabled). */
const INERT = ["sort", "filter", "search", "addTask", "open", "assignToMe"];
/** With saving on, "Add task" works (docs/SYNC.md). */
const INERT_WITH_EXTRAS = INERT.filter((id) => id !== "addTask");

export type KanbanView = {
  words: KanbanWords;
  rules: KanbanRules;
  /** Ids of the controls the core has no action for; hosts draw these disabled. */
  inert: string[];
  title: string;
  /** The number of cards on the board. */
  total: number;
  sprint: string;
  sprintOptions: { value: string; label: string }[];
  columns: ColumnView[];
  /** The new-task sheet, while it is open. `canCreate` is false until the title has a letter in it. */
  adding: { title: string; column: ColumnId; canCreate: boolean; maxLength: number } | null;
};
export type View = KanbanView;

const isColumn = (id: string): id is ColumnId => COLUMNS.some((c) => c.id === id);

export const kanban: TemplateModule<KanbanState, KanbanView> = {
  id: "kanban",
  astryx: "kanban-board",
  title: "Kanban board",
  initial: () => ({ sprint: "003", adding: null }),
  reduce(s, action, now, io) {
    const colon = action.id.indexOf(":");
    const key = colon < 0 ? action.id : action.id.slice(0, colon);
    const arg = colon < 0 ? "" : action.id.slice(colon + 1);
    const all = () => cards(io?.doc);
    const place = (id: string, column: ColumnId, index: number): KanbanState => {
      const board = all();
      const card = board.find((c) => c.id === id);
      if (!card || !io) return s;
      const others = board.filter((c) => c.column === column && c.id !== id);
      const at = Math.min(index, others.length);
      // Dropped where it already is: same column, same place among the others.
      if (card.column === column && board.filter((c) => c.column === column).indexOf(card) === at) return s;
      io.save("kanban.place", { id, column, order: orderAt(board, id, column, at), at: now.epochMs });
      return s;
    };
    if (action.type === "press") {
      if (key === "move") {
        const cut = arg.indexOf(":");
        const column = arg.slice(cut + 1);
        const id = arg.slice(0, cut);
        const card = all().find((c) => c.id === id);
        if (cut < 0 || !isColumn(column) || !card || card.column === column || !io) return s;
        // As stock does: the card keeps its place in the board's order and changes column.
        io.save("kanban.place", { id, column, order: card.order, at: now.epochMs });
        return s;
      }
      if (!io?.extras) return s;
      if (key === "addTask") return s.adding ? s : { ...s, adding: { title: "", column: "todo" } };
      if (key === "addTaskCancel") return s.adding ? { ...s, adding: null } : s;
      if (key === "addTaskCreate") {
        const title = s.adding?.title.trim() ?? "";
        if (!s.adding || title === "") return s;
        const column = s.adding.column;
        const id = io.mint();
        const order = orderAt(all(), id, column, 0);
        io.save("kanban.add", { id, column, order, title: title.slice(0, MAX_TITLE), ref: nextRef(all()), priority: "medium", at: now.epochMs });
        return { ...s, adding: null };
      }
      return s;
    }
    if (key === "sprint") {
      const value = String(action.value);
      return SPRINTS.some((o) => o.value === value) && value !== s.sprint ? { ...s, sprint: value } : s;
    }
    if (key === "newTitle") return s.adding && io?.extras ? { ...s, adding: { ...s.adding, title: String(action.value).slice(0, MAX_TITLE) } } : s;
    if (key === "drop") {
      const where = String(action.value);
      const cut = where.lastIndexOf(":");
      const column = where.slice(0, Math.max(cut, 0));
      const n = cut < 0 || where.slice(cut + 1) === "" ? NaN : Number(where.slice(cut + 1));
      return isColumn(column) && Number.isInteger(n) && n >= 0 ? place(arg, column, n) : s;
    }
    return s;
  },
  view(s, now, doc, extras = true) {
    const all = cards(doc);
    return {
      words: WORDS,
      rules: RULES,
      inert: extras ? INERT_WITH_EXTRAS : INERT,
      title: "Sprint Board",
      total: all.length,
      sprint: s.sprint,
      sprintOptions: SPRINTS.map((o) => ({ ...o })),
      adding: s.adding ? { ...s.adding, canCreate: s.adding.title.trim() !== "", maxLength: MAX_TITLE } : null,
      columns: COLUMNS.map((c) => {
        const cards = all
          .filter((it) => it.column === c.id)
          .map((it): CardView => {
            const edited = editedWords(it, now, extras);
            const due = it.dueDate === "" ? WORDS.noDueDate : it.dueDate;
            const dueParts = it.dueDate === "" ? [" · ", WORDS.noDueDate] : [" · Due ", it.dueDate];
            return {
              id: it.id,
              ref: it.ref,
              priorityLabel: PRIORITY_META[it.priority].label,
              priorityVariant: PRIORITY_META[it.priority].variant,
              title: it.title,
              description: it.description,
              edited,
              due,
              meta: `Edited ${edited}${dueParts.join("")}`,
              metaParts: ["Edited ", edited, ...dueParts],
              moveTargets: COLUMNS.filter((o) => o.id !== it.column).map((o) => ({ label: `Move to ${o.title}`, id: `tpl.kanban.move:${it.id}:${o.id}` })),
            };
          });
        return {
          id: c.id,
          title: c.title,
          variant: c.variant,
          tooltip: c.tooltip,
          emptyTitle: c.emptyTitle,
          emptyDescription: c.emptyDescription,
          emptyIcon: c.emptyIcon,
          statusLabel: `${c.title} ${WORDS.status}`,
          count: cards.length,
          cards,
        };
      }),
    };
  },
};
