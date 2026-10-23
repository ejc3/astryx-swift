/**
 * Everything the demo remembers, and the one function that changes it. A host's action
 * names a node's id ("inbox.select:m3"); `reduce` decides what that means. Pure: the same
 * state, action and time give the same next state on every platform.
 */
import { addDays, civilOf, dayNumber, minuteOf, type Civil, type Now } from "./format.ts";
import { REPLIES, type Column } from "./sample.ts";
import { SCREENS, SURFACES, type Action, type ScreenId, type Surface, type Tone } from "./ui.ts";
import { THEME_INPUTS } from "./themes.ts";
import { TEMPLATES, templateById } from "./templates/index.ts";
import { SCENARIOS } from "./scenarios.generated.ts";
import type { Driver, Playback } from "./scenarios.ts";
import { applyWrites, emptyDoc, isTable, readDoc, replaceTable, TABLES, type Doc } from "./sync/doc.ts";
import { writesOf, type Mutation } from "./sync/mutations.ts";
import type { TemplateIO } from "./templates/types.ts";
import { cartOf, messagesOf, profileOf, repliesSent, savedTheme, shipOf, tasksOf } from "./screens/saved.ts";
import { MAX_QUANTITY } from "./sync/areas/demo.ts";
import { ACCOUNT_WORDS, SIGN_IN_ID, SIGN_OUT_ID, firstSignInWords, initialAccount, isAccountEvent, type AccountEvent, type AccountState } from "./account.ts";

/** Whether `id` names a screen: a demo, or a registered template's "t.<id>". */
export function isScreen(id: string): id is ScreenId {
  return (SCREENS as readonly string[]).includes(id) || (id.startsWith("t.") && templateById(id.slice(2)) !== undefined);
}

export type SortColumn = "name" | "role" | "status" | "team" | "joined" | "projects";

export type State = {
  screen: ScreenId;
  /** The saved data (docs/SYNC.md): what the person made or changed, laid over the sample data. */
  doc: Doc;
  /** Mutations applied to `doc` that the host has not taken yet (to save on the device, or to send to Zero). */
  outbox: readonly Mutation[];
  /** This device's id seed, from the host; new records are "<seed>-<n>". */
  seed: string;
  /** Ids minted so far with `seed`. */
  minted: number;
  /** False on a page that must behave exactly as stock Astryx (the parity harness): no saving, no controls beyond stock. */
  extras: boolean;
  /** While a scenario plays, the saved data it set aside; playback works on a scratch copy. */
  setAside: Doc | null;
  /** Each refactored template's own state, by template id. */
  templates: Record<string, unknown>;
  /** The scenario playing, if one is. */
  playback: Playback | null;
  surface: Surface;
  theme: string;
  today: Civil;
  minute: number;
  /** The viewer's offset from UTC (minutes), as the host's clock last said: with `today` and `minute` it names the instant. */
  utcOffsetMinutes: number;
  toastSeq: number;
  toast: { tone: Tone; text: string; undo?: Undo } | null;
  dialog: "delete-account" | "discard-checkout" | "sign-out" | null;
  /** Signing in to sync (account.ts): who, the sync status, and what the host is asked to do. */
  account: AccountState;
  overview: { notify: boolean; size: string; volume: number; agree: boolean; plan: string; email: string; tags: string[]; bannerOpen: boolean; count: number };
  /** Read, starred and archived are saved (`doc.demo_message`); the rest is view state. */
  inbox: { tab: "all" | "unread" | "starred"; query: string; selected: string | null };
  /** The columns are saved (`doc.demo_task`). */
  tasks: { filter: "all" | "mine" };
  people: { query: string; role: string; sort: SortColumn; descending: boolean; page: number; selected: string[] };
  calendar: { year: number; month: number; selected: Civil };
  /** The lines sent are saved (`doc.demo_chat`). */
  chat: { draft: string };
  /** The cart, the address and the delivery choice are saved (`doc.demo_cart`, `doc.demo_checkout`); the card, expiry and code never are. */
  checkout: { step: number; card: string; expiry: string; cvc: string; attempted: number; placed: boolean };
  /** Following is saved (`profile.following`). */
  profile: { tab: string };
  /**
   * The name, email, bio, notifications, digest, density and reduce motion are saved
   * (`profile.*`, `profileOf`). A name or email that fails its check is kept here, as typed, so
   * the field shows it and its error, and is saved once it passes. Deleting the account is not saved.
   */
  settings: { drafts: { name?: string; email?: string }; deleted: boolean };
};

type Undo = { kind: "unarchive"; id: string } | { kind: "unmove"; id: string; column: Column };

export const PER_PAGE = 5;

export function initialState(now: Now): State {
  const today = civilOf(now);
  return {
    screen: "t.dashboard",
    doc: emptyDoc(),
    outbox: [],
    seed: "local",
    minted: 0,
    extras: true,
    setAside: null,
    templates: Object.fromEntries(TEMPLATES.map((t) => [t.id, t.initial(now)])),
    playback: null,
    surface: "native",
    theme: "astryx",
    today,
    minute: minuteOf(now),
    utcOffsetMinutes: now.utcOffsetMinutes,
    toastSeq: 0,
    toast: null,
    dialog: null,
    account: initialAccount(false),
    overview: { notify: true, size: "md", volume: 60, agree: false, plan: "team", email: "", tags: ["Design", "SwiftUI", "Tokens"], bannerOpen: true, count: 3 },
    inbox: { tab: "all", query: "", selected: "m1" },
    tasks: { filter: "all" },
    people: { query: "", role: "all", sort: "name", descending: false, page: 0, selected: [] },
    calendar: { year: today.year, month: today.month, selected: today },
    chat: { draft: "" },
    checkout: { step: 0, card: "", expiry: "", cvc: "", attempted: -1, placed: false },
    profile: { tab: "activity" },
    settings: { drafts: {}, deleted: false },
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
  if (step === 1) { const to = shipOf(s.doc); return { name: checks.required(to.name, "your name"), address: checks.required(to.address, "a street address"), city: checks.required(to.city, "a city"), zip: checks.zip(to.zip) }; }
  if (step === 2) return { card: checks.card(c.card), expiry: checks.expiry(c.expiry, s.today), cvc: checks.cvc(c.cvc) };
  if (step === 0) return { cart: Object.values(cartOf(s.doc)).some((q) => q > 0) ? undefined : "Your cart is empty." };
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
  const at: State = minute === s.minute && dayNumber(today) === dayNumber(s.today) && now.utcOffsetMinutes === s.utcOffsetMinutes ? s : { ...s, today, minute, utcOffsetMinutes: now.utcOffsetMinutes };
  switch (action.type) {
    case "navigate":
      return isScreen(action.screen) ? { ...at, screen: action.screen, dialog: null } : at;
    case "dismissToast":
      return at.toast === null ? at : { ...at, toast: null };
    case "tick":
      return at;
    case "rows":
      return takeRows(at, action.table, action.rows);
    case "doc":
      return takeDoc(at, action.doc);
    case "account":
      return isAccountEvent(action) ? accountEvent(at, action) : at;
    case "set":
    case "press": {
      const routed = toTemplate(at, action, now);
      if (routed) return routed;
      return action.type === "set" ? set(at, action.id, action.value) : press(at, action.id, now);
    }
  }
}

/** "tpl.<template>.<rest>" goes to that template's reducer with the prefix removed. */
function toTemplate(s: State, action: Extract<Action, { type: "set" | "press" }>, now: Now): State | null {
  if (!action.id.startsWith("tpl.")) return null;
  const rest = action.id.slice(4);
  const dot = rest.indexOf(".");
  const t = templateById(dot < 0 ? rest : rest.slice(0, dot));
  if (!t) return s;
  const id = dot < 0 ? "" : rest.slice(dot + 1);
  const before = s.templates[t.id];
  const saves: Mutation[] = [];
  let minted = s.minted;
  const io: TemplateIO = {
    doc: s.doc,
    extras: s.extras,
    mint: () => { const [id, n] = nextId(s.doc, s.seed, minted); minted = n; return id; },
    save: (name, args) => void saves.push({ name, args }),
  };
  const after = t.reduce(before, action.type === "set" ? { type: "set", id, value: action.value } : { type: "press", id }, now, io);
  const moved = after === before ? s : { ...s, templates: { ...s.templates, [t.id]: after } };
  return saves.length === 0 && minted === s.minted ? moved : save({ ...moved, minted }, saves);
}

/**
 * Applies mutations to the saved data and queues them for the host. A refused mutation (unknown,
 * or arguments that fail its check) changes nothing and is dropped: the core asked for something
 * it may not do, which a test catches. While a scenario plays, the scratch copy changes and
 * nothing is queued, so a replay never touches the person's saved data. Without extras (stock
 * behaviour only) the doc changes in memory, as stock's React state would, and nothing is queued.
 */
export function save(s: State, mutations: readonly Mutation[]): State {
  let doc = s.doc;
  const taken: Mutation[] = [];
  for (const m of mutations) {
    const writes = writesOf(m.name, m.args);
    if (!writes) continue;
    doc = applyWrites(doc, writes);
    taken.push(m);
  }
  if (taken.length === 0) return s;
  return { ...s, doc, outbox: s.setAside || !s.extras ? s.outbox : [...s.outbox, ...taken] };
}

/** `n` new record ids, minted from the device's seed like a template's `io.mint()`, and the state that counts them. */
function mint(s: State, n: number): [string[], State] {
  const ids: string[] = [];
  let minted = s.minted;
  for (let i = 0; i < n; i++) { const [id, next] = nextId(s.doc, s.seed, minted); ids.push(id); minted = next; }
  return [ids, { ...s, minted }];
}

/**
 * The next id from this device's seed that no saved row uses. The counter starts again at 0 on
 * every launch, so after a relaunch it skips the ids the saved work already holds, and a new
 * record never overwrites an old one.
 */
function nextId(doc: Doc, seed: string, after: number): [string, number] {
  for (let n = after + 1; ; n++) {
    const id = `${seed}-${n.toString(36)}`;
    if (!TABLES.some((t) => id in doc[t])) return [id, n];
  }
}

/** The mutation that sets one of the demo account's settings (areas/settings.ts). */
const setting = (key: string, value: string | boolean): Mutation => ({ name: "settings.set", args: { key: `profile.${key}`, value } });

/** A sync source's rows for one table replace the core's copy (the set-aside copy while a scenario plays). */
function takeRows(s: State, table: string, rows: unknown[]): State {
  if (!isTable(table) || !s.extras) return s;
  const checked = readDoc({ [table]: Object.fromEntries(rows.flatMap((r) => (typeof r === "object" && r !== null && typeof (r as { id?: unknown }).id === "string" ? [[(r as { id: string }).id, r]] : []))) })[table];
  const replaced = (d: Doc) => replaceTable(d, table, Object.values(checked));
  if (s.setAside) return { ...s, setAside: replaced(s.setAside) };
  const doc = replaced(s.doc);
  // The theme another device chose is this device's too.
  return { ...s, doc, theme: savedTheme(doc) ?? s.theme };
}

/**
 * The host's whole saved doc replaces the core's (signing out: the device's own copy comes back).
 * It is checked as a stored doc is; nothing is queued, since nothing was changed by the person.
 */
function takeDoc(s: State, value: unknown): State {
  if (!s.extras) return s;
  const doc = readDoc(value);
  if (s.setAside) return { ...s, setAside: doc };
  return { ...s, doc, theme: savedTheme(doc) ?? s.theme, settings: { ...s.settings, drafts: {} } };
}

/** The host's word on signing in and sync. Out of turn (a status while signed out, say), it changes nothing. */
function accountEvent(s: State, e: AccountEvent): State {
  const a = s.account;
  if (!s.extras) return s;
  switch (e.event) {
    case "available":
      return e.available === a.available ? s : { ...s, account: e.available ? { ...a, available: true } : initialAccount(false), dialog: !e.available && s.dialog === "sign-out" ? null : s.dialog };
    case "signedIn":
      if (!a.available) return s;
      return { ...s, account: { ...a, phase: "signed-in", email: e.email.trim().slice(0, 254), sync: a.phase === "signed-in" ? a.sync : null } };
    case "signedOut": {
      if (!a.available || (a.phase === "signed-out" && e.why !== "failed")) return s;
      // A sign-in that failed while signed in (asked to sign in again) leaves the person signed in.
      const signedOut = a.phase === "signed-in" && e.why !== "requested" ? s : { ...s, account: { ...a, phase: "signed-out" as const, email: "", sync: null }, dialog: s.dialog === "sign-out" ? null : s.dialog };
      if (e.why === "requested") return toast(signedOut, "neutral", ACCOUNT_WORDS.signedOut);
      if (e.why === "failed") return toast(signedOut, "danger", ACCOUNT_WORDS.failed);
      return signedOut;
    }
    case "status":
      if (a.phase !== "signed-in") return s;
      if (a.sync?.state === e.state && a.sync.pending === e.pending) return s;
      return { ...s, account: { ...a, sync: { state: e.state, pending: Math.floor(e.pending) } } };
    case "firstSignIn":
      return a.phase === "signed-in" ? toast(s, "success", firstSignInWords(a.email, e.seeded, e.kept)) : s;
  }
}

/** Asks the host to sign in or out: the next request, by number. */
function request(s: State, kind: "signIn" | "signOut"): State {
  return { ...s, account: { ...s.account, request: { kind, seq: (s.account.request?.seq ?? 0) + 1 } } };
}

/** Saves one field of the shipping address or the delivery choice, when it changes. */
function saveShipTo(s: State, field: "name" | "address" | "city" | "zip" | "shipping", value: string): State {
  return shipOf(s.doc)[field] === value ? s : save(s, [{ name: "demo.shipTo", args: { field, value } }]);
}

/** Saves one of the demo account's settings when it changes; a value the setting refuses changes nothing. */
function saveSetting(s: State, key: keyof ReturnType<typeof profileOf>, value: string | boolean): State {
  return profileOf(s.doc)[key] === value ? s : save(s, [setting(key, value)]);
}

/**
 * A text setting that must pass a check (`error` is its message, if it fails): a value that passes
 * is saved and any draft dropped; one that fails stays a draft, as typed, so the field shows it
 * and the error while the saved value stays what it was.
 */
function saveText(s: State, key: "name" | "email", value: string, error: string | undefined): State {
  const drafts = s.settings.drafts;
  if (error !== undefined) {
    return drafts[key] === value ? s : { ...s, settings: { ...s.settings, drafts: { ...drafts, [key]: value } } };
  }
  const cleared = drafts[key] !== undefined ? { ...s, settings: { ...s.settings, drafts: Object.fromEntries(Object.entries(drafts).filter(([k]) => k !== key)) } } : s;
  return saveSetting(cleared, key, value);
}

function set(s: State, id: string, value: string | number | boolean): State {
  const [key, arg] = parse(id);
  const o = s.overview, c = s.checkout;
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
    case "checkout.qty": {
      const quantity = Math.max(0, Math.min(MAX_QUANTITY, Math.round(asNumber(value))));
      return cartOf(s.doc)[arg] === quantity ? s : save(s, [{ name: "demo.cart", args: { id: arg, quantity } }]);
    }
    case "checkout.name": return saveShipTo(s, "name", asString(value));
    case "checkout.address": return saveShipTo(s, "address", asString(value));
    case "checkout.city": return saveShipTo(s, "city", asString(value));
    case "checkout.zip": return saveShipTo(s, "zip", asString(value).replace(/\D/g, "").slice(0, 5));
    case "checkout.shipping": return saveShipTo(s, "shipping", asString(value));
    case "checkout.card": return { ...s, checkout: { ...c, card: cardFormat(asString(value)) } };
    case "checkout.expiry": return { ...s, checkout: { ...c, expiry: asString(value).slice(0, 5) } };
    case "checkout.cvc": return { ...s, checkout: { ...c, cvc: asString(value).replace(/\D/g, "").slice(0, 4) } };
    case "profile.tab": return { ...s, profile: { ...s.profile, tab: asString(value) } };
    case "settings.name": return saveText(s, "name", asString(value).slice(0, 80), checks.required(asString(value), "your name"));
    case "settings.email": return saveText(s, "email", asString(value).slice(0, 254), checks.email(asString(value)));
    case "settings.bio": return saveSetting(s, "bio", asString(value).slice(0, 160));
    case "settings.emailNotes": return saveSetting(s, "emailNotes", asBool(value));
    case "settings.pushNotes": return saveSetting(s, "pushNotes", asBool(value));
    case "settings.digest": return saveSetting(s, "digest", asString(value));
    case "settings.density": return saveSetting(s, "density", asString(value));
    case "settings.reduceMotion": return saveSetting(s, "reduceMotion", asBool(value));
    case "app.surface": {
      const v = asString(value);
      return (SURFACES as readonly string[]).includes(v) ? { ...s, surface: v as Surface } : s;
    }
    case "settings.theme": {
      const t = asString(value);
      if (!THEME_INPUTS.some((x) => x.id === t)) return s;
      const chosen = t === s.theme ? s : { ...s, theme: t };
      return savedTheme(s.doc) === t ? chosen : save(chosen, [{ name: "settings.set", args: { key: "app.theme", value: t } }]);
    }
    default: return s;
  }
}

function press(s: State, id: string, now: Now): State {
  const [key, arg] = parse(id);
  const inbox = s.inbox, c = s.checkout;
  switch (key) {
    case "scenario.start": {
      // "scenario.start:<id>:<driver>": its template's screen, from the template's first state.
      const [id, driver] = arg.split(":");
      const scenario = SCENARIOS.find((x) => x.id === id);
      const t = scenario ? templateById(scenario.template) : undefined;
      if (!scenario || !t || (driver !== "native" && driver !== "web")) return s;
      return { ...s, screen: `t.${t.id}`, dialog: null, toast: null, setAside: s.setAside ?? s.doc, doc: emptyDoc(), templates: { ...s.templates, [t.id]: t.initial({ epochMs: dayNumber(s.today) * 86_400_000 + s.minute * 60_000, utcOffsetMinutes: 0 }) }, playback: { scenario: scenario.id, driver: driver as Driver, step: 0, status: "playing" } };
    }
    case "scenario.done": {
      // The host performed step <n>; a report for any other step (late, or doubled) is ignored.
      const p = s.playback;
      const scenario = p && SCENARIOS.find((x) => x.id === p.scenario);
      if (!p || !scenario || p.status !== "playing" || Number(arg) !== p.step) return s;
      const step = p.step + 1;
      return { ...s, playback: { ...p, step, status: step >= scenario.steps.length ? "done" : "playing" } };
    }
    case "scenario.pause": return s.playback?.status === "playing" ? { ...s, playback: { ...s.playback, status: "paused" } } : s;
    case "scenario.resume": return s.playback?.status === "paused" ? { ...s, playback: { ...s.playback, status: "playing" } } : s;
    case "scenario.stop": return s.playback ? { ...s, playback: null, doc: s.setAside ?? s.doc, setAside: null } : s;
    case "navigate":
      return isScreen(arg) ? { ...s, screen: arg, dialog: null } : s;
    case "toast.undo": {
      const u = s.toast?.undo;
      if (!u) return { ...s, toast: null };
      if (u.kind === "unarchive") return save({ ...s, toast: null, inbox: { ...inbox, selected: u.id } }, [{ name: "demo.message", args: { id: u.id, archived: false } }]);
      return save({ ...s, toast: null }, [{ name: "demo.task", args: { id: u.id, column: u.column } }]);
    }
    case "overview.count": return { ...s, overview: { ...s.overview, count: s.overview.count + 1 } };
    case "overview.untag": return { ...s, overview: { ...s.overview, tags: s.overview.tags.filter((t) => t !== arg) } };
    case "overview.closeBanner": return { ...s, overview: { ...s.overview, bannerOpen: false } };
    case "overview.toast": return toast(s, "success", "Saved. Toasts come from the core, like everything else.");
    case "overview.reset": return { ...s, overview: initialState({ epochMs: 0, utcOffsetMinutes: 0 }).overview };

    case "inbox.select": {
      const opened = { ...s, inbox: { ...inbox, selected: arg } };
      return messagesOf(s.doc).some((m) => m.id === arg && !m.read) ? save(opened, [{ name: "demo.message", args: { id: arg, read: true } }]) : opened;
    }
    case "inbox.back": return { ...s, inbox: { ...inbox, selected: null } };
    case "inbox.star": {
      const m = messagesOf(s.doc).find((x) => x.id === arg);
      return m ? save(s, [{ name: "demo.message", args: { id: arg, starred: !m.starred } }]) : s;
    }
    case "inbox.unread":
      return toast(save({ ...s, inbox: { ...inbox, selected: null } }, [{ name: "demo.message", args: { id: arg, read: false } }]), "neutral", "Marked as unread.");
    case "inbox.archive": {
      const next = save({ ...s, inbox: { ...inbox, selected: null } }, [{ name: "demo.message", args: { id: arg, archived: true } }]);
      return toast(next, "neutral", "Conversation archived.", { kind: "unarchive", id: arg });
    }
    case "inbox.readAll":
      return toast(save(s, messagesOf(s.doc).filter((m) => !m.read).map((m) => ({ name: "demo.message", args: { id: m.id, read: true } }))), "success", "Everything is read.");

    case "tasks.forward":
    case "tasks.back": {
      const order: Column[] = ["todo", "doing", "done"];
      const task = tasksOf(s.doc).find((t) => t.id === arg);
      if (!task) return s;
      const i = order.indexOf(task.column) + (key === "tasks.forward" ? 1 : -1);
      const column = order[i];
      if (!column) return s;
      const moved = save(s, [{ name: "demo.task", args: { id: arg, column } }]);
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
      // Two lines are saved, the person's and the canned reply to it; the reply cycle carries on from the replies already saved.
      const [[id, replyId], minted] = mint(s, 2);
      const ordinal = repliesSent(s.doc);
      return save({ ...minted, chat: { draft: "" } }, [{ name: "demo.chatSend", args: { id: id!, replyId: replyId!, text, reply: REPLIES[ordinal % REPLIES.length]!, ordinal, at: Math.floor(now.epochMs) } }]);
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
    case "checkout.fill": {
      const to = shipOf(s.doc);
      const fill = { name: "Maya Okafor", address: "1200 Broadway", city: "Oakland", zip: "94612" } as const;
      const changed = (Object.keys(fill) as (keyof typeof fill)[]).filter((field) => to[field] !== fill[field]);
      return save({ ...s, checkout: { ...c, card: "4242 4242 4242 4242", expiry: `12/${String((s.today.year + 2) % 100).padStart(2, "0")}`, cvc: "123" } }, changed.map((field) => ({ name: "demo.shipTo", args: { field, value: fill[field] } })));
    }
    case "checkout.place": {
      if (![0, 1, 2].every((step) => stepValid(s, step))) return { ...s, checkout: { ...c, attempted: c.step } };
      return toast({ ...s, checkout: { ...c, placed: true } }, "success", "Order placed. A receipt is on its way.");
    }
    case "checkout.restart": return { ...s, dialog: "discard-checkout" };

    case "profile.follow": {
      const following = !profileOf(s.doc).following;
      return toast(save(s, [setting("following", following)]), "neutral", following ? "You're following Maya." : "You unfollowed Maya.");
    }

    case "settings.delete": return { ...s, dialog: "delete-account" };

    case SIGN_IN_ID: {
      // Signed out: the host opens its sign-in. Signed in, when the server wants a new sign-in: the same, to renew.
      const a = s.account;
      if (!a.available || a.phase === "signing-in" || (a.phase === "signed-in" && a.sync?.state !== "signed-out")) return s;
      return request(a.phase === "signed-out" ? { ...s, account: { ...a, phase: "signing-in" } } : s, "signIn");
    }
    case SIGN_OUT_ID: return s.account.phase === "signed-in" ? { ...s, dialog: "sign-out" } : s;

    case "dialog.cancel": return { ...s, dialog: null };
    case "dialog.confirm": {
      if (s.dialog === "delete-account") return toast({ ...s, dialog: null, settings: { ...s.settings, deleted: true } }, "danger", "Account scheduled for deletion. You have 30 days to change your mind.");
      if (s.dialog === "sign-out") return s.account.phase === "signed-in" ? request({ ...s, dialog: null }, "signOut") : { ...s, dialog: null };
      if (s.dialog === "discard-checkout") return save({ ...s, dialog: null, checkout: initialState({ epochMs: dayNumber(s.today) * 86_400_000, utcOffsetMinutes: 0 }).checkout }, [{ name: "demo.checkoutReset", args: {} }]);
      return { ...s, dialog: null };
    }
    case "settings.restore": return toast({ ...s, settings: { ...s.settings, deleted: false } }, "success", "Deletion cancelled. Welcome back.");
    default: return s;
  }
}
