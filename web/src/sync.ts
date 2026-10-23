/**
 * The standalone page's sign-in and sync (docs/SYNC.md, "Signing in, and signing out"), loaded only
 * when the build names a sync server (VITE_ASTRYX_SYNC_URL). Sign in is the API's
 * `/native/login?redirect=web` in a pop-up, which hands the token back by `postMessage`: taken only
 * from that pop-up and the sync server's origin. The token is kept for this tab
 * (sessionStorage), never given to the core; Zero keeps the account's data in IndexedDB.
 */
import { readToken } from "@astryx-native/sync/client";
import { connectSync } from "@astryx-native/sync/host";
import type { AppSnapshot, Client } from "@astryx-native/core";

/** What the API's pop-up posts (server/src/app.ts, WEB_MESSAGE). */
const WEB_MESSAGE = "astryx-swift-token";
const TOKEN_KEY = "astryx.token.v1";

export function startWebSync(o: {
  client: Client;
  syncURL: string;
  deviceDoc: unknown;
  writeDeviceDoc(json: string): void;
  /** Called with each app snapshot the page draws (the account's requests arrive in it). */
  onApp(listener: (app: AppSnapshot | null) => void): void;
}) {
  const { client, syncURL } = o;
  const origin = new URL(syncURL).origin;
  const sync = connectSync({ client, writeDeviceDoc: o.writeDeviceDoc, kvStore: () => "idb", log: (m) => console.warn(m) }, o.deviceDoc);
  const fail = (e: unknown) => console.warn(`sync: ${e instanceof Error ? e.message : String(e)}`);

  const kept = (): string | null => {
    try {
      return sessionStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  };
  const keep = (token: string | null) => {
    try {
      if (token === null) sessionStorage.removeItem(TOKEN_KEY);
      else sessionStorage.setItem(TOKEN_KEY, token);
    } catch { /* storage blocked: signed in for this page only */ }
  };

  // A reload while signed in: sync again, with nothing uploaded (an expired token shows "Sign in again").
  const token = kept();
  if (token && readToken(token)) sync.auth({ token, syncURL }).catch(fail);

  let open: Window | null = null;
  function signIn() {
    if (open && !open.closed) return open.focus();
    const popup = window.open(`${syncURL}/native/login?redirect=web`, "astryx-sign-in", "popup,width=480,height=680");
    if (!popup) return client.dispatch({ type: "account", event: "signedOut", why: "failed" });
    open = popup;
    let got = false;
    const done = () => {
      window.removeEventListener("message", onMessage);
      clearInterval(watch);
      open = null;
    };
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== origin || e.source !== popup) return;
      const data = e.data as { type?: unknown; token?: unknown } | null;
      if (!data || data.type !== WEB_MESSAGE || typeof data.token !== "string") return;
      const claims = readToken(data.token);
      if (!claims) return;
      got = true;
      done();
      const before = kept();
      keep(data.token);
      // The same person again (Sign in again) keeps their sync; anyone else is an actual sign-in.
      sync.auth({ token: data.token, syncURL, firstSignIn: !(before && readToken(before)?.sub === claims.sub) }).catch(fail);
    };
    const watch = setInterval(() => {
      if (!popup.closed) return;
      done();
      if (!got) client.dispatch({ type: "account", event: "signedOut", why: "cancelled" });
    }, 500);
    window.addEventListener("message", onMessage);
  }

  function signOut() {
    keep(null);
    sync.auth(null).catch(fail);
  }

  let handled = 0;
  o.onApp((app) => {
    const request = app?.account.request;
    if (!request || request.seq <= handled) return;
    handled = request.seq;
    if (request.kind === "signIn") signIn();
    else signOut();
  });
}
