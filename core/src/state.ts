/**
 * Everything the demo remembers, and the one function that changes it. A host's action
 * names a node's id ("inbox.select:m3"); `reduce` decides what that means. Pure: the same
 * state, action and time give the same next state on every platform.
 */
import { addDays, civilOf, dayNumber, minuteOf, type Civil, type Now } from "./format.ts";
import { CHAT, MESSAGES, REPLIES, TASKS, type ChatLine, type Column, type Message, type Task } from "./sample.ts";
import { SCREENS, type Action, type ScreenId, type Tone } from "./ui.ts";
import { THEME_INPUTS } from "./themes.ts";

export type SortColumn = "name" | "role" | "team" | "joined" | "projects";

export type State = {
  screen: ScreenId;
  theme: string;
  today: Civil;
  minute: number;
  toastSeq: number;
  toast: { tone: Tone; text: string; undo?: Undo } | null;
  dialog: "delete-account" | "discard-checkout" | null;
  overview: { notify: boolean; size: string; volume: number; agree: boolean; plan: string; email: string; tags: string[]; bannerOpen: boolean; count: number };
  inbox: { tab: "all" | "unread" | "starred"; query: string; selected: string | null; messages: Message[] };
  tasks: { filter: "all" | "mine"; tasks: Task[] };
  people: { query: string; role: string; sort: SortColumn; descending: boolean; page: number; selected: string[] };
  calendar: { year: number; month: number; selected: Civil };
  chat: { draft: string; lines: ChatLine[]; replies: number };
  checkout: { step: number; quantities: Record<string, number>; name: string; address: string; city: string; zip: string; shipping: string; card: string; expiry: string; cvc: string; attempted: number; placed: boolean };
  profile: { following: boolean; tab: string };
  settings: { name: string; email: string; bio: string; emailNotes: boolean; pushNotes: boolean; digest: string; density: string; reduceMotion: boolean; deleted: boolean };
};

type Undo = { kind: "unarchive"; id: string } | { kind: "unmove"; id: string; column: Column };

export const PER_PAGE = 5;

export function initialState(now: Now): State {
  const today = civilOf(now);
  return {
    screen: "overview",
    theme: "astryx",
    today,
    minute: minuteOf(now),
    toastSeq: 0,
    toast: null,
    dialog: null,
    overview: { notify: true, size: "md", volume: 60, agree: false, plan: "team", email: "", tags: ["Design", "SwiftUI", "Tokens"], bannerOpen: true, count: 3 },
    inbox: { tab: "all", query: "", selected: "m1", messages: MESSAGES.map((m) => ({ ...m })) },
    tasks: { filter: "all", tasks: TASKS.map((t) => ({ ...t })) },
    people: { query: "", role: "all", sort: "name", descending: false, page: 0, selected: [] },
    calendar: { year: today.year, month: today.month, selected: today },
    chat: { draft: "", lines: CHAT.map((c) => ({ ...c })), replies: 0 },
    checkout: { step: 0, quantities: { k1: 1, k2: 2, k3: 1 }, name: "", address: "", city: "", zip: "", shipping: "standard", card: "", expiry: "", cvc: "", attempted: -1, placed: false },
    profile: { following: false, tab: "activity" },
    settings: { name: "Maya Okafor", email: "maya@northwind.example", bio: "Design engineer. I make the components and the tools that check them.", emailNotes: true, pushNotes: false, digest: "weekly", density: "comfortable", reduceMotion: false, deleted: false },
  };
}

/** Field checks, shared by the screens (to show the error) and the reducer (to refuse a step). */
export const checks = {
  email(value: string): string | undefined {
    if (value.trim() === "") return "Enter an email address.";
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? undefined : "That doesn't look like an email address.";
  },
  required(value: string, what: string): string | undefined {
    return value.trim() === "" ? `Enter ${what}.` : undefined;
  },
  zip(value: string): string | undefined {
    if (value.trim() === "") return "Enter a ZIP code.";
    return /^\d{5}$/.test(value.trim()) ? undefined : "A ZIP code is five digits.";
  },
  card(value: string): string | undefined {
    const digits = value.replace(/\s/g, "");
    if (digits === "") return "Enter a card number.";
    if (!/^\d{16}$/.test(digits)) return "A card number is 16 digits.";
    return luhn(digits) ? undefined : "That card number doesn't check out. Try 4242 4242 4242 4242.";
  },
  expiry(value: string, today: Civil): string | undefined {
    const m = /^(\d{2})\s*\/\s*(\d{2})$/.exec(value.trim());
    if (value.trim() === "") return "Enter the expiry date.";
    if (!m) return "Write it as MM/YY.";
    const month = Number(m[1]);
    const year = 2000 + Number(m[2]);
    if (month < 1 || month > 12) return "The month is 01 to 12.";
    return year * 12 + month < today.year * 12 + today.month ? "This card has expired." : undefined;
  },
  cvc(value: string): string | undefined {
    if (value.trim() === "") return "Enter the security code.";
    return /^\d{3,4}$/.test(value.trim()) ? undefined : "The security code is 3 or 4 digits.";
  },
};

function luhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}

/** The errors of one checkout step, by field. */
export function checkoutErrors(s: State, step: number): Record<string, string | undefined> {
  const c = s.checkout;
  if (step === 1) return { name: checks.required(c.name, "your name"), address: checks.required(c.address, "a street address"), city: checks.required(c.city, "a city"), zip: checks.zip(c.zip) };
  if (step === 2) return { card: checks.card(c.card), expiry: checks.expiry(c.expiry, s.today), cvc: checks.cvc(c.cvc) };
  if (step === 0) return { cart: Object.values(c.quantities).some((q) => q > 0) ? undefined : "Your cart is empty." };
  return {};
}

function stepValid(s: State, step: number): boolean {
  return Object.values(checkoutErrors(s, step)).every((e) => e === undefined);
}

function toast(s: State, tone: Tone, text: string, undo?: Undo): State {
  return { ...s, toastSeq: s.toastSeq + 1, toast: { tone, text, undo } };
}

/** "inbox.select:m3" -> ["inbox.select", "m3"]. */
function parse(id: string): [string, string] {
  const at = id.indexOf(":");
  return at < 0 ? [id, ""] : [id.slice(0, at), id.slice(at + 1)];
}

const asString = (v: string | number | boolean): string => String(v);
const asBool = (v: string | number | boolean): boolean => v === true || v === "true";
const asNumber = (v: string | number | boolean): number => (typeof v === "number" ? v : Number(v));

/** Formats a card number as it is typed: digits only, in groups of four. */
function cardFormat(v: string): string {
  return v.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ");
}

export function reduce(s: State, action: Action, now: Now): State {
  const today = civilOf(now), minute = minuteOf(now);
  // The same object when time has not moved, so an action that changes nothing returns `s`.
  const at: State = minute === s.minute && dayNumber(today) === dayNumber(s.today) ? s : { ...s, today, minute };
  switch (action.type) {
    case "navigate":
      return SCREENS.includes(action.screen) ? { ...at, screen: action.screen, dialog: null } : at;
    case "dismissToast":
      return { ...at, toast: null };
    case "set":
      return set(at, action.id, action.value);
    case "press":
      return press(at, action.id);
  }
}

function set(s: State, id: string, value: string | number | boolean): State {
  const [key, arg] = parse(id);
  const o = s.overview, c = s.checkout, st = s.settings;
  switch (key) {
    case "overview.notify": return { ...s, overview: { ...o, notify: asBool(value) } };
    case "overview.size": return { ...s, overview: { ...o, size: asString(value) } };
    case "overview.volume": return { ...s, overview: { ...o, volume: Math.max(0, Math.min(100, Math.round(asNumber(value)))) } };
    case "overview.agree": return { ...s, overview: { ...o, agree: asBool(value) } };
    case "overview.plan": return { ...s, overview: { ...o, plan: asString(value) } };
    case "overview.email": return { ...s, overview: { ...o, email: asString(value) } };
    case "inbox.tab": {
      const tab = asString(value);
      return tab === "all" || tab === "unread" || tab === "starred" ? { ...s, inbox: { ...s.inbox, tab } } : s;
    }
    case "inbox.query": return { ...s, inbox: { ...s.inbox, query: asString(value) } };
    case "tasks.filter": return { ...s, tasks: { ...s.tasks, filter: asString(value) === "mine" ? "mine" : "all" } };
    case "people.query": return { ...s, people: { ...s.people, query: asString(value), page: 0 } };
    case "people.role": return { ...s, people: { ...s.people, role: asString(value), page: 0 } };
    case "people.check": {
      const on = asBool(value);
      const sel = s.people.selected.filter((x) => x !== arg);
      return { ...s, people: { ...s.people, selected: on ? [...sel, arg] : sel } };
    }
    case "chat.draft": return { ...s, chat: { ...s.chat, draft: asString(value) } };
    case "checkout.qty": return { ...s, checkout: { ...c, quantities: { ...c.quantities, [arg]: Math.max(0, Math.min(9, Math.round(asNumber(value)))) } } };
    case "checkout.name": return { ...s, checkout: { ...c, name: asString(value) } };
    case "checkout.address": return { ...s, checkout: { ...c, address: asString(value) } };
    case "checkout.city": return { ...s, checkout: { ...c, city: asString(value) } };
    case "checkout.zip": return { ...s, checkout: { ...c, zip: asString(value).replace(/\D/g, "").slice(0, 5) } };
    case "checkout.shipping": return { ...s, checkout: { ...c, shipping: asString(value) } };
    case "checkout.card": return { ...s, checkout: { ...c, card: cardFormat(asString(value)) } };
    case "checkout.expiry": return { ...s, checkout: { ...c, expiry: asString(value).slice(0, 5) } };
    case "checkout.cvc": return { ...s, checkout: { ...c, cvc: asString(value).replace(/\D/g, "").slice(0, 4) } };
    case "profile.tab": return { ...s, profile: { ...s.profile, tab: asString(value) } };
    case "settings.name": return { ...s, settings: { ...st, name: asString(value) } };
    case "settings.email": return { ...s, settings: { ...st, email: asString(value) } };
    case "settings.bio": return { ...s, settings: { ...st, bio: asString(value).slice(0, 160) } };
    case "settings.emailNotes": return { ...s, settings: { ...st, emailNotes: asBool(value) } };
    case "settings.pushNotes": return { ...s, settings: { ...st, pushNotes: asBool(value) } };
    case "settings.digest": return { ...s, settings: { ...st, digest: asString(value) } };
    case "settings.density": return { ...s, settings: { ...st, density: asString(value) } };
    case "settings.reduceMotion": return { ...s, settings: { ...st, reduceMotion: asBool(value) } };
    case "settings.theme": {
      const t = asString(value);
      return THEME_INPUTS.some((x) => x.id === t) ? { ...s, theme: t } : s;
    }
    default: return s;
  }
}

function press(s: State, id: string): State {
  const [key, arg] = parse(id);
  const inbox = s.inbox, tasks = s.tasks, c = s.checkout;
  switch (key) {
    case "navigate":
      return SCREENS.includes(arg as ScreenId) ? { ...s, screen: arg as ScreenId, dialog: null } : s;
    case "toast.undo": {
      const u = s.toast?.undo;
      if (!u) return { ...s, toast: null };
      if (u.kind === "unarchive") return { ...s, toast: null, inbox: { ...inbox, selected: u.id, messages: inbox.messages.map((m) => (m.id === u.id ? { ...m, archived: false } : m)) } };
      return { ...s, toast: null, tasks: { ...tasks, tasks: tasks.tasks.map((t) => (t.id === u.id ? { ...t, column: u.column } : t)) } };
    }
    case "overview.count": return { ...s, overview: { ...s.overview, count: s.overview.count + 1 } };
    case "overview.untag": return { ...s, overview: { ...s.overview, tags: s.overview.tags.filter((t) => t !== arg) } };
    case "overview.closeBanner": return { ...s, overview: { ...s.overview, bannerOpen: false } };
    case "overview.toast": return toast(s, "success", "Saved. Toasts come from the core, like everything else.");
    case "overview.reset": return { ...s, overview: initialState({ epochMs: 0, utcOffsetMinutes: 0 }).overview };

    case "inbox.select":
      return { ...s, inbox: { ...inbox, selected: arg, messages: inbox.messages.map((m) => (m.id === arg ? { ...m, read: true } : m)) } };
    case "inbox.back": return { ...s, inbox: { ...inbox, selected: null } };
    case "inbox.star":
      return { ...s, inbox: { ...inbox, messages: inbox.messages.map((m) => (m.id === arg ? { ...m, starred: !m.starred } : m)) } };
    case "inbox.unread":
      return toast({ ...s, inbox: { ...inbox, selected: null, messages: inbox.messages.map((m) => (m.id === arg ? { ...m, read: false } : m)) } }, "neutral", "Marked as unread.");
    case "inbox.archive": {
      const next = { ...s, inbox: { ...inbox, selected: null, messages: inbox.messages.map((m) => (m.id === arg ? { ...m, archived: true } : m)) } };
      return toast(next, "neutral", "Conversation archived.", { kind: "unarchive", id: arg });
    }
    case "inbox.readAll":
      return toast({ ...s, inbox: { ...inbox, messages: inbox.messages.map((m) => ({ ...m, read: true })) } }, "success", "Everything is read.");

    case "tasks.forward":
    case "tasks.back": {
      const order: Column[] = ["todo", "doing", "done"];
      const task = tasks.tasks.find((t) => t.id === arg);
      if (!task) return s;
      const i = order.indexOf(task.column) + (key === "tasks.forward" ? 1 : -1);
      const column = order[i];
      if (!column) return s;
      const moved = { ...s, tasks: { ...tasks, tasks: tasks.tasks.map((t) => (t.id === arg ? { ...t, column } : t)) } };
      return column === "done" ? toast(moved, "success", `"${task.title}" is done.`, { kind: "unmove", id: arg, column: task.column }) : moved;
    }

    case "people.sort": {
      const col = arg as SortColumn;
      const p = s.people;
      return { ...s, people: { ...p, sort: col, descending: p.sort === col ? !p.descending : false, page: 0 } };
    }
    case "people.page": return { ...s, people: { ...s.people, page: Math.max(0, s.people.page + (arg === "next" ? 1 : -1)) } };
    case "people.invite": return toast(s, "accent", "Invitations are a demo: nobody was emailed.");
    case "people.clear": return { ...s, people: { ...s.people, selected: [] } };
    case "people.remind": {
      const n = s.people.selected.length;
      return toast({ ...s, people: { ...s.people, selected: [] } }, "success", n === 1 ? "Reminder sent to 1 person." : `Reminders sent to ${n} people.`);
    }

    case "calendar.month": {
      const cal = s.calendar;
      const m = cal.month + (arg === "next" ? 1 : -1);
      const year = m < 1 ? cal.year - 1 : m > 12 ? cal.year + 1 : cal.year;
      const month = ((m + 11) % 12) + 1;
      return { ...s, calendar: { ...cal, year, month, selected: { year, month, day: 1 } } };
    }
    case "calendar.day": {
      const n = Number(arg);
      return Number.isFinite(n) ? { ...s, calendar: { ...s.calendar, selected: addDays({ year: 1970, month: 1, day: 1 }, n) } } : s;
    }
    case "calendar.today":
      return { ...s, calendar: { year: s.today.year, month: s.today.month, selected: s.today } };

    case "chat.send": {
      const text = s.chat.draft.trim();
      if (text === "") return s;
      const mine: ChatLine = { id: `me${s.chat.lines.length}`, from: "p1", text, minutesAgo: 0 };
      const reply: ChatLine = { id: `re${s.chat.lines.length}`, from: "p2", text: REPLIES[s.chat.replies % REPLIES.length]!, minutesAgo: 0 };
      return { ...s, chat: { draft: "", lines: [...s.chat.lines, mine, reply], replies: s.chat.replies + 1 } };
    }

    case "checkout.next": {
      if (!stepValid(s, c.step)) return { ...s, checkout: { ...c, attempted: c.step } };
      return { ...s, checkout: { ...c, step: Math.min(3, c.step + 1), attempted: -1 } };
    }
    case "checkout.back": return { ...s, checkout: { ...c, step: Math.max(0, c.step - 1), attempted: -1 } };
    case "checkout.goto": {
      const step = Number(arg);
      return step < c.step ? { ...s, checkout: { ...c, step, attempted: -1 } } : s;
    }
    case "checkout.fill":
      return { ...s, checkout: { ...c, name: "Maya Okafor", address: "1200 Broadway", city: "Oakland", zip: "94612", card: "4242 4242 4242 4242", expiry: `12/${String((s.today.year + 2) % 100).padStart(2, "0")}`, cvc: "123" } };
    case "checkout.place": {
      if (![0, 1, 2].every((step) => stepValid(s, step))) return { ...s, checkout: { ...c, attempted: c.step } };
      return toast({ ...s, checkout: { ...c, placed: true } }, "success", "Order placed. A receipt is on its way.");
    }
    case "checkout.restart": return { ...s, dialog: "discard-checkout" };

    case "profile.follow": {
      const following = !s.profile.following;
      return toast({ ...s, profile: { ...s.profile, following } }, "neutral", following ? "You're following Maya." : "You unfollowed Maya.");
    }

    case "settings.save": {
      if (checks.required(s.settings.name, "your name") || checks.email(s.settings.email)) return toast(s, "danger", "Fix the highlighted fields first.");
      return toast(s, "success", "Settings saved.");
    }
    case "settings.delete": return { ...s, dialog: "delete-account" };

    case "dialog.cancel": return { ...s, dialog: null };
    case "dialog.confirm": {
      if (s.dialog === "delete-account") return toast({ ...s, dialog: null, settings: { ...s.settings, deleted: true } }, "danger", "Account scheduled for deletion. You have 30 days to change your mind.");
      if (s.dialog === "discard-checkout") return { ...s, dialog: null, checkout: initialState({ epochMs: dayNumber(s.today) * 86_400_000, utcOffsetMinutes: 0 }).checkout };
      return { ...s, dialog: null };
    }
    case "settings.restore": return toast({ ...s, settings: { ...s.settings, deleted: false } }, "success", "Deletion cancelled. Welcome back.");
    default: return s;
  }
}
