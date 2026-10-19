/** Inbox, Tasks and People: lists, a board and a table, all filtered and sorted here. */
import { addDays, ago, grouped, hueOf, initials, plural, relativeDay } from "../format.ts";
import { COLUMNS, PEOPLE, ROLES, ME, person, type Person } from "../sample.ts";
import { PER_PAGE, type SortColumn, type State } from "../state.ts";
import type { BoardColumn, Node, Screen, Tone } from "../ui.ts";
import { badge, button, card, h, heading, spread, text, v } from "./nodes.ts";

export function inbox(s: State): Screen {
  const i = s.inbox;
  const live = i.messages.filter((m) => !m.archived);
  const q = i.query.trim().toLowerCase();
  const inTab = live.filter((m) => (i.tab === "unread" ? !m.read : i.tab === "starred" ? m.starred : true));
  const shown = q === "" ? inTab : inTab.filter((m) => `${person(m.from).name} ${m.subject} ${m.preview}`.toLowerCase().includes(q));
  const selected = live.find((m) => m.id === i.selected) ?? null;
  const unread = live.filter((m) => !m.read).length;
  const starred = live.filter((m) => m.starred).length;

  const list: Node = v("sm",
    { kind: "textInput", id: "inbox.query", label: "Search mail", value: i.query, placeholder: "Search by person or subject", icon: "search" },
    { kind: "tabs", id: "inbox.tab", value: i.tab, tabs: [{ value: "all", label: "All", count: grouped(live.length) }, { value: "unread", label: "Unread", count: grouped(unread) }, { value: "starred", label: "Starred", count: grouped(starred) }] },
    {
      kind: "list",
      empty: q !== "" ? `Nothing matches "${i.query.trim()}".` : i.tab === "unread" ? "You've read everything." : i.tab === "starred" ? "Star a message to keep it here." : "No messages.",
      items: shown.map((m) => {
        const from = person(m.from);
        return { id: m.id, title: from.name, subtitle: m.subject, meta: ago(m.minutesAgo, s.today, s.minute), leading: { avatar: { initials: initials(from.name), hue: hueOf(from.name) } }, ...(m.label ? { trailing: m.label } : {}), emphasized: !m.read, selected: m.id === i.selected, selectId: `inbox.select:${m.id}` };
      }),
    },
  );

  const detail: Node = selected
    ? card(undefined, [
        spread(heading(selected.subject, 2), ...(selected.label ? [badge(selected.label.text, selected.label.tone)] : [])),
        h("sm", { kind: "avatar", name: person(selected.from).name, initials: initials(person(selected.from).name), hue: hueOf(person(selected.from).name), size: "md" }, v("xs", text(person(selected.from).name, "emphasis"), text(`${person(selected.from).email} · ${ago(selected.minutesAgo, s.today, s.minute)}`, "caption"))),
        { kind: "divider" },
        ...selected.body.map((p) => text(p)),
        h("sm", button(`inbox.star:${selected.id}`, selected.starred ? "Starred" : "Star", selected.starred ? "primary" : "secondary", selected.starred ? "star-fill" : "star"), button(`inbox.archive:${selected.id}`, "Archive", "secondary", "archive"), button(`inbox.unread:${selected.id}`, "Mark unread", "ghost", "mail")),
      ])
    : { kind: "empty", icon: "inbox", title: "No conversation selected", text: unread === 0 ? "You're all caught up." : `${plural(unread, "unread message")} waiting.` };

  return {
    id: "inbox", title: "Inbox", subtitle: unread === 0 ? "All caught up" : `${plural(unread, "unread message")}`,
    toolbar: [button("inbox.readAll", "Mark all read", "secondary", "check", unread === 0)],
    body: { kind: "split", primary: list, detail, showDetailWhenNarrow: selected !== null, backId: "inbox.back", backLabel: "Inbox" },
  };
}

/** Three columns need about 240 each plus the gaps; narrower than this they stack. */
const BOARD_STACK_BELOW = 760;

export function tasks(s: State): Screen {
  const t = s.tasks;
  const mine = t.filter === "mine";
  const shown = mine ? t.tasks.filter((x) => x.assignee === ME.id) : t.tasks;
  const columns: BoardColumn[] = COLUMNS.map((c, ci) => {
    const cards = shown.filter((x) => x.column === c.id);
    return {
      id: c.id, title: c.title, count: grouped(cards.length),
      cards: cards.map((x) => {
        const who = person(x.assignee);
        const due = addDays(s.today, x.dueInDays);
        const dueTone: Tone = x.column === "done" ? "neutral" : x.dueInDays < 0 ? "danger" : x.dueInDays <= 1 ? "warning" : "neutral";
        return {
          id: x.id, title: x.title, tags: x.tags, assignee: { initials: initials(who.name), hue: hueOf(who.name) },
          due: dueText(x.column === "done", relativeDay(due, s.today), x.dueInDays < 0),
          dueTone,
          ...(ci > 0 ? { moveBackId: `tasks.back:${x.id}` } : {}),
          ...(ci < COLUMNS.length - 1 ? { moveForwardId: `tasks.forward:${x.id}` } : {}),
          moveBackLabel: ci > 0 ? `Move to ${COLUMNS[ci - 1]!.title}` : "",
          moveForwardLabel: ci < COLUMNS.length - 1 ? `Move to ${COLUMNS[ci + 1]!.title}` : "",
        };
      }),
    };
  });
  const open = shown.filter((x) => x.column !== "done").length;
  const done = shown.length - open;
  return {
    id: "tasks", title: "Tasks", subtitle: `${plural(open, "open task")}, ${grouped(done)} done`,
    toolbar: [],
    body: v("md",
      spread({ kind: "segmented", id: "tasks.filter", label: "Show", labelHidden: true, options: [{ value: "all", label: "Everyone" }, { value: "mine", label: "Assigned to me" }], value: t.filter }, { kind: "progress", label: "Sprint", value: shown.length === 0 ? 0 : done / shown.length, valueText: `${grouped(done)} of ${grouped(shown.length)}`, tone: "success" }),
      { kind: "board", columns, stackBelow: BOARD_STACK_BELOW },
    ),
  };
}

/** "Due today", "Due Oct 14", "Overdue since yesterday", "Done". */
function dueText(done: boolean, day: string, overdue: boolean): string {
  if (done) return "Done";
  const word = /^[A-Z][a-z]+$/.test(day) ? day.toLowerCase() : day;
  return overdue ? `Overdue since ${word}` : `Due ${word}`;
}

const SORTS: { id: SortColumn; label: string; align: "start" | "end" }[] = [
  { id: "name", label: "Name", align: "start" },
  { id: "role", label: "Role", align: "start" },
  { id: "status", label: "Status", align: "start" },
  { id: "team", label: "Team", align: "start" },
  { id: "joined", label: "Joined", align: "end" },
  { id: "projects", label: "Projects", align: "end" },
];

function compare(a: Person, b: Person, by: SortColumn): number {
  switch (by) {
    case "name": return a.name.localeCompare(b.name);
    case "role": return a.role.localeCompare(b.role) || a.name.localeCompare(b.name);
    case "status": return a.status.localeCompare(b.status) || a.name.localeCompare(b.name);
    case "team": return a.team.localeCompare(b.team) || a.name.localeCompare(b.name);
    case "joined": return a.joinedDaysAgo - b.joinedDaysAgo;
    case "projects": return a.projects - b.projects || a.name.localeCompare(b.name);
  }
}

function tenure(days: number): string {
  if (days < 7) return days <= 1 ? "Just joined" : `${days} days`;
  if (days < 60) return `${Math.floor(days / 7)} weeks`;
  if (days < 730) return `${Math.floor(days / 30)} months`;
  return `${Math.floor(days / 365)} years`;
}

export function people(s: State): Screen {
  const p = s.people;
  const q = p.query.trim().toLowerCase();
  const filtered = PEOPLE.filter((x) => (p.role === "all" || x.role === p.role) && (q === "" || `${x.name} ${x.email} ${x.team}`.toLowerCase().includes(q)));
  const sorted = [...filtered].sort((a, b) => (p.descending ? -1 : 1) * compare(a, b, p.sort));
  const pages = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
  const page = Math.min(p.page, pages - 1);
  const rows = sorted.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);
  const statusTone: Record<Person["status"], Tone> = { active: "success", away: "warning", invited: "info" };
  const statusText: Record<Person["status"], string> = { active: "Active", away: "Away", invited: "Invited" };
  const n = p.selected.length;
  return {
    id: "people", title: "People", subtitle: `${plural(PEOPLE.length, "person", "people")} in ${grouped(new Set(PEOPLE.map((x) => x.team)).size)} teams`,
    toolbar: [button("people.invite", "Invite", "primary", "plus")],
    body: v("md",
      { kind: "stack", axis: "horizontal", gap: "sm", align: "end", wrap: true, children: [
        { kind: "textInput", id: "people.query", label: "Search", value: p.query, placeholder: "Name, email or team", icon: "search" },
        { kind: "select", id: "people.role", label: "Role", value: p.role, options: [{ value: "all", label: "All roles" }, ...ROLES.map((r) => ({ value: r, label: r }))] },
      ] },
      ...(n > 0 ? [{ kind: "banner", tone: "accent", title: `${plural(n, "person", "people")} selected`, text: "Send them a reminder to finish setting up their profile.", action: button("people.remind", n === 1 ? "Send reminder" : "Send reminders", "primary", "send"), dismissId: "people.clear" } satisfies Node] : []),
      card(undefined, [
        {
          kind: "table",
          empty: q !== "" ? `No one matches "${p.query.trim()}".` : "No one has that role yet.",
          columns: SORTS.map((c) => ({ id: c.id, label: c.label, align: c.align, sort: p.sort === c.id ? (p.descending ? "desc" : "asc") : "none", sortId: `people.sort:${c.id}` })),
          rows: rows.map((x) => ({
            id: x.id, selected: p.selected.includes(x.id), selectId: `people.check:${x.id}`,
            cells: [
              { text: x.name, secondary: x.email, avatar: { initials: initials(x.name), hue: hueOf(x.name) } },
              { text: x.role },
              { text: statusText[x.status], badge: { text: statusText[x.status], tone: statusTone[x.status] } },
              { text: x.team },
              { text: tenure(x.joinedDaysAgo), align: "end" },
              { text: grouped(x.projects), align: "end" },
            ],
          })),
        },
        { kind: "pagination", previousLabel: "Previous page", nextLabel: "Next page", label: sorted.length === 0 ? "No results" : `${grouped(page * PER_PAGE + 1)}-${grouped(page * PER_PAGE + rows.length)} of ${grouped(sorted.length)}`, ...(page > 0 ? { previousId: "people.page:previous" } : {}), ...(page < pages - 1 ? { nextId: "people.page:next" } : {}) },
      ]),
    ),
  };
}
