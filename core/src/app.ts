/**
 * The client: one state, two stores ("app" and "theme"), one way in (`dispatch`), and
 * snapshots out. A host gives it a clock; it gives the host JSON to draw. The bridge to
 * native hosts (connectBridge) speaks the same protocol as dolphin-labs' apps/native.
 */
import type { Now } from "./format.ts";
import { calendar, chat, checkout, profile, settings } from "./screens/life.ts";
import { dashboard, overview } from "./screens/overview.ts";
import { inbox, people, tasks } from "./screens/work.ts";
import { initialState, reduce, type State } from "./state.ts";
import { THEMES } from "./themes.generated.ts";
import { THEME_INPUTS, type ResolvedTheme } from "./themes.ts";
import { PROTOCOL, type Action, type AppSnapshot, type Dialog, type NavItem, type Screen, type ScreenId } from "./ui.ts";

const BUILDERS: Record<ScreenId, (s: State) => Screen> = { overview, dashboard, inbox, tasks, people, calendar, chat, checkout, profile, settings };

export type ThemeSnapshot = ResolvedTheme;

export function nav(s: State): NavItem[] {
  const unread = s.inbox.messages.filter((m) => !m.read && !m.archived).length;
  const open = s.tasks.tasks.filter((t) => t.column !== "done").length;
  const items: NavItem[] = [
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
  if (s.dialog === "discard-checkout") return { title: "Start a new order?", text: "Your cart goes back to its first three items and the forms are cleared.", confirm: { kind: "button", id: "dialog.confirm", label: "Start over", variant: "primary" }, cancel: { kind: "button", id: "dialog.cancel", label: "Cancel", variant: "secondary" } };
  return null;
}

export function appSnapshot(s: State): AppSnapshot {
  return {
    protocol: PROTOCOL,
    appName: "Astryx Native",
    nav: nav(s),
    current: s.screen,
    screen: BUILDERS[s.screen](s),
    toast: s.toast ? { id: s.toastSeq, tone: s.toast.tone, text: s.toast.text, ...(s.toast.undo ? { action: { id: "toast.undo", label: "Undo" } } : {}) } : null,
    dialog: dialog(s),
    theme: { id: s.theme, options: THEME_INPUTS.map((t) => ({ value: t.id, label: t.label })) },
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
};

/** A client over a clock. `now` is read for each action, never by the core itself. */
export function createClient(now: () => Now, start?: Partial<Pick<State, "screen" | "theme">>): Client {
  let state: State = { ...initialState(now()), ...start };
  const listeners = new Set<(store: StoreName) => void>();
  return {
    getSnapshot(store) {
      return store === "theme" ? themeSnapshot(state) : appSnapshot(state);
    },
    dispatch(action) {
      const before = state;
      state = reduce(state, action, now());
      if (state === before) return;
      for (const l of listeners) l("app");
      if (state.theme !== before.theme) for (const l of listeners) l("theme");
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
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
