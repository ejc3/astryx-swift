/**
 * The standalone page's sign-in and sync (docs/SYNC.md, "Signing in, and signing out"), loaded only
 * when the build names a sync server (VITE_ASTRYX_SYNC_URL). Sign in is the API's
 * `/native/login?redirect=web` in a pop-up, which hands the token back by `postMessage`: taken only
 * from that pop-up and the sync server's origin, with a refresh token. A sign-in lasts until
 * sign-out (server/src/sessions.ts): both are kept in this browser (localStorage), the token is
 * renewed with the refresh token shortly before it expires, and signing out ends the session on
 * the server. Neither is given to the core; Zero keeps the account's data in IndexedDB.
 */
import { readToken } from "@astryx-native/sync/client";
import { connectSync } from "@astryx-native/sync/host";
import type { AppSnapshot, Client } from "@astryx-native/core";

/** What the API's pop-up posts (server/src/app.ts, WEB_MESSAGE). */
const WEB_MESSAGE = "astryx-swift-token";
const TOKEN_KEY = "astryx.signin.v1";
/** How long before the token's expiry it is renewed, and how long to wait when the server cannot be reached. */
const RENEW_BEFORE_MS = 5 * 60_000;
const RETRY_MS = 60_000;

type Kept = { token: string; refresh: string | null };

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

  let memory: Kept | null = null;
  const kept = (): Kept | null => {
    try {
      const text = localStorage.getItem(TOKEN_KEY);
      const value = text ? (JSON.parse(text) as Partial<Kept>) : null;
      return value && typeof value.token === "string" ? { token: value.token, refresh: typeof value.refresh === "string" ? value.refresh : null } : memory;
    } catch {
      return memory;
    }
  };
  const keep = (value: Kept | null) => {
    memory = value;
    try {
      if (value === null) localStorage.removeItem(TOKEN_KEY);
      else localStorage.setItem(TOKEN_KEY, JSON.stringify(value));
    } catch { /* storage blocked: signed in for this page only */ }
  };

  // Staying signed in: trade the refresh token for a new pair shortly before the token expires.
  let timer: ReturnType<typeof setTimeout> | undefined;
  let renewing: Promise<void> | null = null;
  const schedule = (token: string) => {
    clearTimeout(timer);
    const claims = readToken(token);
    if (!claims || !kept()?.refresh) return;
    timer = setTimeout(() => void renew(), Math.max(0, claims.exp * 1000 - Date.now() - RENEW_BEFORE_MS));
  };
  async function renew(): Promise<void> {
    if (renewing) return renewing;
    renewing = (async () => {
      const now = kept();
      if (!now?.refresh) return;
      let r: Response;
      try {
        r = await fetch(`${syncURL}/api/token/refresh`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ refresh: now.refresh }) });
      } catch {
        timer = setTimeout(() => void renew(), RETRY_MS);
        return;
      }
      if (r.status === 401) {
        // The session has ended (signed out elsewhere): "Sign in again" shows when the token runs out.
        keep({ token: now.token, refresh: null });
        return;
      }
      const body = (await r.json().catch(() => null)) as { token?: unknown; refresh?: unknown } | null;
      if (!r.ok || !body || typeof body.token !== "string" || typeof body.refresh !== "string" || readToken(body.token)?.sub !== readToken(now.token)?.sub) {
        timer = setTimeout(() => void renew(), RETRY_MS);
        return;
      }
      keep({ token: body.token, refresh: body.refresh });
      await sync.auth({ token: body.token, syncURL });
      schedule(body.token);
    })().finally(() => { renewing = null; });
    return renewing;
  }

  // A reload while signed in: sync again, with nothing uploaded; a run-out token is renewed first.
  const start = kept();
  if (start && readToken(start.token)) {
    const claims = readToken(start.token)!;
    if (claims.exp * 1000 - Date.now() < RENEW_BEFORE_MS && start.refresh) void renew().then(() => sync.auth({ token: kept()!.token, syncURL })).catch(fail);
    else sync.auth({ token: start.token, syncURL }).then(() => schedule(start.token)).catch(fail);
  }

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
      const data = e.data as { type?: unknown; token?: unknown; refresh?: unknown } | null;
      if (!data || data.type !== WEB_MESSAGE || typeof data.token !== "string") return;
      const claims = readToken(data.token);
      if (!claims) return;
      got = true;
      done();
      const before = kept();
      const token = data.token;
      keep({ token, refresh: typeof data.refresh === "string" ? data.refresh : null });
      // The same person again (Sign in again) keeps their sync; anyone else is an actual sign-in.
      sync.auth({ token, syncURL, firstSignIn: !(before && readToken(before.token)?.sub === claims.sub) }).then(() => schedule(token)).catch(fail);
    };
    const watch = setInterval(() => {
      if (!popup.closed) return;
      done();
      if (!got) client.dispatch({ type: "account", event: "signedOut", why: "cancelled" });
    }, 500);
    window.addEventListener("message", onMessage);
  }

  function signOut() {
    clearTimeout(timer);
    const refresh = kept()?.refresh;
    // End the session on the server too; signed out here whatever the network says.
    if (refresh) void fetch(`${syncURL}/api/token/revoke`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ refresh }) }).catch(() => {});
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
