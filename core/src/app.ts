/**
 * The client: one state, two stores ("app" and "theme"), one way in (`dispatch`), and
 * snapshots out. A host gives it a clock; it gives the host JSON to draw. The bridge to
 * native hosts (connectBridge): connected/changed out, getSnapshot/dispatch in.
 */
import type { Now } from "./format.ts";
import { calendar, chat, checkout, profile, settings } from "./screens/life.ts";
import { dashboard, overview } from "./screens/overview.ts";
import { inbox, people, tasks } from "./screens/work.ts";
import { messagesOf, savedTheme, tasksOf } from "./screens/saved.ts";
import { initialState, isScreen, reduce, type State } from "./state.ts";
import { ACCOUNT_WORDS, accountSnapshot, initialAccount } from "./account.ts";
import { readDoc, type Doc } from "./sync/doc.ts";
import type { Mutation } from "./sync/mutations.ts";
import { TEMPLATES, templateById } from "./templates/index.ts";
import { SCENARIOS } from "./scenarios.generated.ts";
import type { ScenariosSnapshot } from "./scenarios.ts";
import { THEMES } from "./themes.generated.ts";
import { THEME_INPUTS, type ResolvedTheme } from "./themes.ts";
import { PROTOCOL, SURFACES, type Action, type AppSnapshot, type DemoScreenId, type Dialog, type Icon, type NavItem, type Screen, type TemplateScreenId, type Tone } from "./ui.ts";

/**
 * The stock Astryx template closest to each screen (web/stock: Astryx's own templates,
 * unchanged). Placeholder names until web/stock lists what Astryx ships.
 */
export const STOCK_TEMPLATE: Record<DemoScreenId, string> = {
  overview: "components", dashboard: "dashboard", inbox: "inbox", tasks: "kanban", people: "table",
  calendar: "calendar", chat: "chat", checkout: "checkout", profile: "profile", settings: "settings",
};

const BUILDERS: Record<DemoScreenId, (s: State) => Screen> = { overview, dashboard, inbox, tasks, people, calendar, chat, checkout, profile, settings };

/** A template's screen: one node, its view model, drawn by the template's own renderer. */
function templateScreen(s: State, id: TemplateScreenId, now: Now): Screen {
  const t = templateById(id.slice(2))!;
  return { id, title: t.title, subtitle: `Astryx's ${t.astryx} template, on the shared core`, toolbar: [], body: { kind: "template", template: t.id, view: t.view(s.templates[t.id], now, s.doc, s.extras) } };
}

const TEMPLATE_ICONS: Record<string, Icon> = { showcase: "sparkle", dashboard: "chart", inbox: "inbox", kanban: "check", invoice: "card", calendar: "calendar", chat: "chat", checkout: "cart", order: "truck", settings: "gear" };

export type ThemeSnapshot = ResolvedTheme;

/** A toast's tone in a word, for a screen reader (the tone is only a colored dot to the eye). */
const TONE_WORDS: Partial<Record<Tone, string>> = { success: "Success", warning: "Warning", danger: "Error", info: "Information" };

export function nav(s: State): NavItem[] {
  const templates: NavItem[] = TEMPLATES.map((t) => withSection({ id: `t.${t.id}` as const, label: t.title, icon: TEMPLATE_ICONS[t.id] ?? "grid" }, "Astryx templates"));
  return [...templates, ...demoNav(s).map((n) => withSection(n, "More demos"))];
}

/** Both sections have a Dashboard, an Inbox...: a screen reader hears the section with the name. */
function withSection(n: Omit<NavItem, "section" | "accessibilityLabel">, section: string): NavItem {
  return { ...n, section, accessibilityLabel: `${n.label}, ${section}` };
}

function demoNav(s: State): Omit<NavItem, "section" | "accessibilityLabel">[] {
  const unread = messagesOf(s.doc).filter((m) => !m.read && !m.archived).length;
  const open = tasksOf(s.doc).filter((t) => t.column !== "done").length;
  const items: Omit<NavItem, "section" | "accessibilityLabel">[] = [
    { id: "overview", label: "Components", icon: "grid" },
    { id: "dashboard", label: "Dashboard", icon: "chart" },
    { id: "inbox", label: "Inbox", icon: "inbox", ...(unread > 0 ? { badge: String(unread) } : {}) },
    { id: "tasks", label: "Tasks", icon: "check", ...(open > 0 ? { badge: String(open) } : {}) },
    { id: "people", label: "People", icon: "people" },
    { id: "calendar", label: "Calendar", icon: "calendar" },
    { id: "chat", label: "Messages", icon: "chat" },
    { id: "checkout", label: "Checkout", icon: "cart" },
    { id: "profile", label: "Profile", icon: "person" },
    { id: "settings", label: "Settings", icon: "gear" },
  ];
  return items;
}

function dialog(s: State): Dialog | null {
  if (s.dialog === "delete-account") return { title: "Delete your account?", text: "Your profile, tasks and messages will be removed after 30 days. You can cancel until then.", confirm: { kind: "button", id: "dialog.confirm", label: "Delete account", variant: "destructive" }, cancel: { kind: "button", id: "dialog.cancel", label: "Keep it", variant: "secondary" } };
  if (s.dialog === "sign-out") { const w = ACCOUNT_WORDS.dialog; return { title: w.title, text: w.text, confirm: { kind: "button", id: "dialog.confirm", label: w.confirm, variant: "destructive" }, cancel: { kind: "button", id: "dialog.cancel", label: w.cancel, variant: "secondary" } }; }
  if (s.dialog === "discard-checkout") return { title: "Start a new order?", text: "Your cart goes back to its first three items and the forms are cleared.", confirm: { kind: "button", id: "dialog.confirm", label: "Start over", variant: "primary" }, cancel: { kind: "button", id: "dialog.cancel", label: "Cancel", variant: "secondary" } };
  return null;
}

export function scenariosSnapshot(s: State): ScenariosSnapshot {
  const p = s.playback;
  const scenario = p ? SCENARIOS.find((x) => x.id === p.scenario) : undefined;
  const steps = scenario?.steps.length ?? 0;
  return {
    label: "Scenarios",
    list: SCENARIOS.map((x) => ({ id: x.id, title: x.title, template: templateById(x.template)?.title ?? x.template, steps: x.steps.length === 1 ? "1 step" : `${x.steps.length} steps` })),
    drivers: [
      { value: "native", label: "Drive from native", description: "Each step taps the SwiftUI side; the web drawings follow" },
      { value: "web", label: "Drive from web", description: "Each step clicks the web page on Hermes; the native side follows" },
    ],
    controls: { pauseId: "scenario.pause", resumeId: "scenario.resume", stopId: "scenario.stop", pauseLabel: "Pause", resumeLabel: "Resume", stopLabel: "Stop" },
    playing: !p || !scenario ? null : {
      id: scenario.id, title: scenario.title, driver: p.driver, status: p.status,
      progress: p.status === "done" ? `Done: ${steps} of ${steps} steps` : `Step ${p.step + 1} of ${steps}`,
      caption: p.status === "done" ? "Finished" : scenario.steps[p.step]?.caption ?? "",
      step: p.status === "playing" && scenario.steps[p.step] ? { index: p.step, ...scenario.steps[p.step]! } : null,
      controls: { pauseId: "scenario.pause", resumeId: "scenario.resume", stopId: "scenario.stop", pauseLabel: "Pause", resumeLabel: "Resume", stopLabel: p.status === "done" ? "Close" : "Stop" },
    },
  };
}

export function appSnapshot(s: State, now: Now): AppSnapshot {
  return {
    protocol: PROTOCOL,
    appName: "Astryx Swift",
    nav: nav(s),
    current: s.screen,
    screen: s.screen.startsWith("t.") ? templateScreen(s, s.screen as TemplateScreenId, now) : BUILDERS[s.screen as DemoScreenId](s),
    toast: s.toast ? { id: s.toastSeq, tone: s.toast.tone, text: s.toast.text, ...(TONE_WORDS[s.toast.tone] ? { toneLabel: TONE_WORDS[s.toast.tone] } : {}), dismissLabel: "Dismiss", ...(s.toast.undo ? { action: { id: "toast.undo", label: "Undo" } } : {}) } : null,
    dialog: dialog(s),
    theme: { id: s.theme, label: "Theme", setId: "settings.theme", options: THEME_INPUTS.map((t) => ({ value: t.id, label: t.label })) },
    scenarios: scenariosSnapshot(s),
    account: accountSnapshot(s.account),
    surface: {
      id: "app.surface", label: "Show", value: s.surface,
      options: [
        { value: "native", label: "Native", description: "SwiftUI, on the shared core in Hermes" },
        { value: "web", label: "Web on Hermes", description: "The refactored web page, on the same shared core" },
        { value: "webOwn", label: "Web, own core", description: "The refactored web page, on a core of its own in the page: no Hermes" },
        { value: "stock", label: "Stock Astryx", description: "Astryx as it is today: its own template and its own state" },
        { value: "compare", label: "Native and web", description: "Native and web on Hermes, side by side" },
        { value: "all", label: "All four", description: "All four drawings at once" },
      ],
      groups: [
        { label: "Drawing", values: ["native", "web", "webOwn", "stock"] },
        { label: "Side by side", values: ["compare", "all"] },
      ],
      unavailable: "Needs a wider window",
      stockTemplate: s.screen.startsWith("t.") ? templateById(s.screen.slice(2))!.astryx : STOCK_TEMPLATE[s.screen as DemoScreenId], stockLabel: "Astryx as it is today: its own template and its own state",
    },
  };
}

export function themeSnapshot(s: State): ThemeSnapshot {
  return THEMES.themes.find((t) => t.id === s.theme) ?? THEMES.themes[0]!;
}

export type StoreName = "app" | "theme";

export type Client = {
  getSnapshot(store: StoreName): unknown;
  dispatch(action: Action): void;
  subscribe(listener: (store: StoreName) => void): () => void;
  /**
   * Hears every change to saved data once the core has applied it: the mutations, in order, and
   * the whole saved doc after them. A host saves the doc on the device (signed out) or sends the
   * mutations to Zero (signed in); docs/SYNC.md.
   */
  onSave(listener: (mutations: readonly Mutation[], doc: Doc) => void): () => void;
};

/** Where a client starts: the screen, theme and drawing; the saved doc kept on the device; this device's id seed. */
export type ClientStart = Partial<Pick<State, "screen" | "theme" | "surface">> & {
  /** The saved doc as the host stored it; checked, never trusted. */
  doc?: unknown;
  /** A new random string per install (the host's randomness; the core has none). */
  seed?: string;
  /** False to behave exactly as stock Astryx (the parity harness): nothing beyond stock, nothing saved. */
  extras?: boolean;
  /** Whether this host can sign in to sync (it was configured with a sync server). Off by default. */
  signIn?: boolean;
};

/** A client over a clock. `now` is read for each action, never by the core itself. */
export function createClient(now: () => Now, start?: ClientStart): Client {
  const first = initialState(now());
  const seed = start?.seed !== undefined && /^[A-Za-z0-9_]{4,40}$/.test(start.seed) ? start.seed : first.seed;
  let state: State = {
    ...first,
    ...(start?.theme !== undefined ? { theme: start.theme } : {}),
    screen: start?.screen && isScreen(start.screen) ? start.screen : first.screen,
    surface: start?.surface && (SURFACES as readonly string[]).includes(start.surface) ? start.surface : first.surface,
    doc: start?.extras === false || start?.doc === undefined ? first.doc : readDoc(start.doc),
    seed,
    extras: start?.extras ?? true,
    account: initialAccount(start?.signIn === true && start?.extras !== false),
  };
  // The theme the person chose (saved) wins over the host's starting one.
  state = { ...state, theme: savedTheme(state.doc) ?? state.theme };
  const listeners = new Set<(store: StoreName) => void>();
  const savers = new Set<(mutations: readonly Mutation[], doc: Doc) => void>();
  return {
    getSnapshot(store) {
      return store === "theme" ? themeSnapshot(state) : appSnapshot(state, now());
    },
    dispatch(action) {
      const before = state;
      state = reduce(state, action, now());
      if (state === before) return;
      const out = state.outbox;
      if (out.length > 0) state = { ...state, outbox: [] };
      if (out.length > 0) for (const s of savers) s(out, state.doc);
      for (const l of listeners) l("app");
      if (state.theme !== before.theme) for (const l of listeners) l("theme");
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    onSave(listener) {
      savers.add(listener);
      return () => savers.delete(listener);
    },
  };
}

/** The other side of a native host: what it calls and what it is told. */
export type BridgeHost = {
  connected(bridgeVersion: number): void;
  changed(store: string, snapshotJSON: string): void;
};

export const BRIDGE_VERSION = 1;

/** Carries a client over a host's two calls in (getSnapshot, dispatch) and two out. */
export function connectBridge(client: Client, host: BridgeHost) {
  client.subscribe((store) => host.changed(store, JSON.stringify(client.getSnapshot(store))));
  host.connected(BRIDGE_VERSION);
  return {
    getSnapshot(store: string): string {
      if (store !== "app" && store !== "theme") throw new Error(`No store is named ${JSON.stringify(store)}`);
      return JSON.stringify(client.getSnapshot(store));
    },
    dispatch(actionJSON: string): void {
      client.dispatch(JSON.parse(actionJSON) as Action);
    },
  };
}
