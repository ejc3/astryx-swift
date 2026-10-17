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
  const client = createClient(
    () => ({ epochMs: Date.now(), utcOffsetMinutes: -new Date().getTimezoneOffset() }),
    { ...(screen ? { screen: screen as ScreenId } : {}), ...(theme ? { theme } : {}) },
  );
  // Times like "12m" are words the core wrote at the last action; a minute's tick rewrites them.
  setInterval(() => client.dispatch({ type: "tick" }), 60_000);
  return client;
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
  if (store === "app") cache.app = client.getSnapshot("app") as AppSnapshot | null;
  else cache.theme = client.getSnapshot("theme") as ThemeSnapshot | null;
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
