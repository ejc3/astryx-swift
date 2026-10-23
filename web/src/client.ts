import { useSyncExternalStore } from "react";
import {
  createClient,
  THEME_INPUTS,
  type Action,
  type AppSnapshot,
  type Client,
  type ScreenId,
  type StoreName,
  type ThemeSnapshot,
} from "@astryx-native/core";

/**
 * Where the core runs. Standalone, the page makes its own client over the browser's clock.
 * Embedded in the native app's web view, the page makes none: the app's one core runs there,
 * and this file speaks to it over two calls.
 *
 *   page -> host   window.webkit.messageHandlers.astryx.postMessage(message)
 *                    { type: "ready" }                     once, at startup
 *                    { type: "dispatch", action: Action }  for every action
 *   host -> page   window.__astryx.receive(store, snapshotJSON)
 *                    store is "app" or "theme"; called for the initial snapshots, then on every change
 */
type HostPort = { postMessage(message: unknown): void };
declare global {
  interface Window {
    webkit?: { messageHandlers?: { astryx?: HostPort } };
    __astryx?: { receive(store: string, snapshotJSON: string): void };
  }
}

const port = window.webkit?.messageHandlers?.astryx;
export const embedded = port !== undefined;

/** `?screen=<id>` and `?theme=<id>` choose where a standalone client starts; read once, here. */
function standalone(): Client {
  const params = new URLSearchParams(window.location.search);
  // Any id: the core keeps it only if it names a screen (a demo or a "t.<template>").
  const screen = params.get("screen");
  const theme = THEME_INPUTS.find((t) => t.id === params.get("theme"))?.id;
  // `?stock=1`: behave exactly as stock Astryx (the parity and scenario harnesses), save nothing.
  const extras = params.get("stock") !== "1";
  const doc = extras ? storedDoc() : undefined;
  const client = createClient(
    () => ({ epochMs: Date.now(), utcOffsetMinutes: -new Date().getTimezoneOffset() }),
    { ...(screen ? { screen: screen as ScreenId } : {}), ...(theme ? { theme } : {}), extras, ...(extras ? { doc, seed: deviceSeed(), signIn: SYNC_URL !== "" } : {}) },
  );
  // Signed out, the saved doc lives in this browser (docs/SYNC.md); a failed write keeps the page working.
  const keepDoc = (json: string) => { try { localStorage.setItem(DOC_KEY, json); } catch { /* storage full or blocked */ } };
  if (extras && SYNC_URL === "") client.onSave((_mutations, saved) => keepDoc(JSON.stringify(saved)));
  // With a sync server, sign-in (and Zero) load on their own; until they have, changes are kept as above.
  if (extras && SYNC_URL !== "") {
    const interim = client.onSave((_mutations, saved) => keepDoc(JSON.stringify(saved)));
    void import("./sync.ts").then(({ startWebSync }) => {
      interim();
      startWebSync({ client, syncURL: SYNC_URL, deviceDoc: storedDoc() ?? doc, writeDeviceDoc: keepDoc, onApp: (l) => { appWatchers.add(l); l(cache.app); } });
    });
  }
  // Times like "12m" are words the core wrote at the last action; a minute's tick rewrites them.
  setInterval(() => client.dispatch({ type: "tick" }), 60_000);
  // The native app shows this page on its own core as a fourth drawing ("Web, own core") and
  // keeps it on the same screen as the others; nothing else of its state is shared.
  window.__astryxOwn = { navigate: (screen) => client.dispatch({ type: "navigate", screen: screen as ScreenId }) };
  return { ...client, dispatch: (action) => { const log = (window as unknown as { __astryxRecord?: unknown }).__astryxRecord; if (Array.isArray(log)) log.push(action); client.dispatch(action); } }; // scripts/record-scenarios.mjs sets window.__astryxRecord to collect actions
}

const DOC_KEY = "astryx.doc.v1";

/**
 * The sync server, when this build has one (VITE_ASTRYX_SYNC_URL, https://<sync host>); empty by
 * default, and then sign-in is off and the page keeps everything in this browser. Read at build
 * time, so a build without one carries none of the sync code.
 */
const SYNC_URL: string = (import.meta.env.VITE_ASTRYX_SYNC_URL as string | undefined)?.replace(/\/+$/, "") ?? "";
/** Hears each app snapshot (the page's own sync watches the account's requests). */
const appWatchers = new Set<(app: AppSnapshot | null) => void>();
const SEED_KEY = "astryx.seed.v1";

/** The saved doc this browser kept, or nothing; the core checks whatever it gets. */
function storedDoc(): unknown {
  try {
    const text = localStorage.getItem(DOC_KEY);
    return text === null ? undefined : (JSON.parse(text) as unknown);
  } catch {
    return undefined;
  }
}

/** A random id seed for this browser, made once: new records are "<seed>-<n>". */
function deviceSeed(): string {
  const fresh = () => Array.from(crypto.getRandomValues(new Uint8Array(9)), (b) => b.toString(36).padStart(2, "0")).join("");
  try {
    const kept = localStorage.getItem(SEED_KEY);
    if (kept !== null && /^[a-z0-9]{8,40}$/.test(kept)) return kept;
    const made = fresh();
    localStorage.setItem(SEED_KEY, made);
    return made;
  } catch {
    return fresh();
  }
}

declare global {
  interface Window {
    /** Set in standalone mode: the native app's "Web, own core" pane follows the current screen with it. */
    __astryxOwn?: { navigate(screen: string): void };
  }
}

/** The same three calls as the core's client, backed by the host. Nothing here knows the core. */
function hosted(host: HostPort): Client {
  const snapshots: { app: unknown; theme: unknown } = { app: null, theme: null };
  const listeners = new Set<(store: StoreName) => void>();
  window.__astryx = {
    receive(store, snapshotJSON) {
      if (store !== "app" && store !== "theme") return;
      snapshots[store] = JSON.parse(snapshotJSON) as unknown;
      for (const l of listeners) l(store);
    },
  };
  queueMicrotask(() => host.postMessage({ type: "ready" }));
  return {
    getSnapshot: (store) => snapshots[store],
    dispatch: (action) => host.postMessage({ type: "dispatch", action }),
    // The app's core saves its own data; the page only draws it.
    onSave: () => () => false,
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

export const client: Client = port ? hosted(port) : standalone();

// `getSnapshot` builds a fresh object each call in the core, so keep the latest one per store and
// replace it only when the client says that store changed. useSyncExternalStore needs a stable value.
const cache: { app: AppSnapshot | null; theme: ThemeSnapshot | null } = {
  app: client.getSnapshot("app") as AppSnapshot | null,
  theme: client.getSnapshot("theme") as ThemeSnapshot | null,
};
const listeners = new Set<() => void>();
client.subscribe((store: StoreName) => {
  if (store === "app") {
    cache.app = client.getSnapshot("app") as AppSnapshot | null;
    for (const w of appWatchers) w(cache.app);
  } else cache.theme = client.getSnapshot("theme") as ThemeSnapshot | null;
  for (const l of listeners) l();
});

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** The screen to draw; null only in a web view, until the host's first snapshot arrives. */
export function useApp(): AppSnapshot | null {
  return useSyncExternalStore(subscribe, () => cache.app);
}

export function useThemeSnapshot(): ThemeSnapshot | null {
  return useSyncExternalStore(subscribe, () => cache.theme);
}

export const send = (action: Action) => client.dispatch(action);
export const press = (id: string) => client.dispatch({ type: "press", id });
export const set = (id: string, value: string | number | boolean) => client.dispatch({ type: "set", id, value });
export const navigate = (screen: ScreenId) => client.dispatch({ type: "navigate", screen });
