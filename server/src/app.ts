/**
 * The API (docs/SYNC.md, "What runs where"): Hono, run on Node by main.ts.
 *
 * | Route | Who may call it | How it is checked |
 * |---|---|---|
 * | GET /healthz | anyone | nothing to check; says whether sync and sign-in are on |
 * | GET /native/login | a person, through Cloudflare Access | the Access JWT (Cf-Access-Jwt-Assertion), or DEV_IDENTITY locally |
 * | POST /api/zero/query, /api/zero/mutate | zero-cache, for a person | zero-cache's API key and the person's bearer token |
 */
import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { Authenticate, AuthKind } from "./access.ts";
import type { Identity, TokenKeys } from "./tokens.ts";
import { bearer, keyOk, zeroMutate, zeroQuery, type ZeroDeps } from "./zero.ts";

/** Where /native/login may send a token: the Apple apps' URL scheme. Nothing else, ever. */
export const APP_REDIRECTS = ["astryxswift://signed-in"] as const;

/** The message a web sign-in pop-up posts to the page that opened it. */
export const WEB_MESSAGE = "astryx-swift-token";

/** The largest body zero-cache may send: a `seed` of the most rows a table may upload, with room. */
const ZERO_BODY_BYTES = 4 * 1024 * 1024;

export type AppDeps = {
  auth: Authenticate;
  authKind: AuthKind;
  /** The token keys; null leaves sign-in off (and sync can't be on without them). */
  keys: TokenKeys | null;
  /** Zero's endpoints; null when sync is off (no DATABASE_URL or ZERO_API_KEY). */
  zero: ZeroDeps | null;
  /** The web page's origin (WEB_ORIGIN): the only window a web sign-in hands its token to. */
  webOrigin: string | null;
  /** Seconds since the epoch. */
  now: () => number;
};

const NO_STORE = { "cache-control": "no-store", "referrer-policy": "no-referrer" };

export function createApp(deps: AppDeps): Hono {
  const app = new Hono();

  app.get("/healthz", (c) => c.json({ ok: true, sync: deps.zero ? "on" : "off", auth: deps.authKind }));

  // --- Sign-in --------------------------------------------------------------------------------

  app.get("/native/login", async (c) => {
    c.header("cache-control", NO_STORE["cache-control"]);
    c.header("referrer-policy", NO_STORE["referrer-policy"]);
    const redirect = c.req.query("redirect") ?? "";
    const toApp = (APP_REDIRECTS as readonly string[]).includes(redirect);
    if (!toApp && redirect !== "web") return c.json({ error: "redirect must be one of the app's sign-in addresses, or web" }, 400);
    if (redirect === "web" && !deps.webOrigin) return c.json({ error: "web sign-in is not configured here" }, 503);
    if (!deps.keys) return c.json({ error: "sign-in is not configured here" }, 503);
    const who: Identity | null = await deps.auth(c.req.raw);
    if (!who) return c.json({ error: "sign in first" }, 401);
    const token = await deps.keys.sign(who, deps.now());
    // In the fragment, so it is never part of a request line or a server log.
    if (toApp) return c.redirect(`${redirect}#token=${encodeURIComponent(token)}`, 302);
    return webHandoff(c, token, deps.webOrigin!);
  });

  // --- Zero -----------------------------------------------------------------------------------

  const zero = new Hono();
  zero.use("*", bodyLimit({ maxSize: ZERO_BODY_BYTES, onError: (c) => c.json({ error: "too large" }, 413) }));
  zero.use("*", async (c, next) => {
    if (!deps.zero || !deps.keys) return c.json({ error: "sync is off" }, 503);
    if (!keyOk(c.req.raw, deps.zero)) return c.json({ error: "not zero-cache" }, 401);
    return next();
  });
  zero.post("/query", async (c) => {
    const who = await bearer(c.req.raw, deps.keys!, deps.now());
    if (!who) return c.json({ error: "sign in first" }, 401);
    return c.json(await zeroQuery(c.req.raw, who));
  });
  zero.post("/mutate", async (c) => {
    const who = await bearer(c.req.raw, deps.keys!, deps.now());
    if (!who) return c.json({ error: "sign in first" }, 401);
    return c.json(await zeroMutate(c.req.raw, who, deps.zero!));
  });
  app.route("/api/zero", zero);

  return app;
}

/**
 * The web page's sign-in pop-up: hands the token to the window that opened it, only if that
 * window is the site (postMessage's target origin), then closes. The token never enters a URL.
 */
function webHandoff(c: Context, token: string, origin: string) {
  const nonce = crypto.randomUUID().replace(/-/g, "");
  c.header("content-security-policy", `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; frame-ancestors 'none'`);
  c.header("x-content-type-options", "nosniff");
  const data = JSON.stringify({ type: WEB_MESSAGE, token }).replace(/</g, "\\u003c");
  const target = JSON.stringify(origin).replace(/</g, "\\u003c");
  return c.html(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Signed in</title><style>:root{color-scheme:light dark;font:16px/1.5 system-ui,sans-serif}body{max-width:30rem;margin:3rem auto;padding:0 1rem}</style>
<p id="m">Signed in. You can close this window.</p>
<script nonce="${nonce}">
if (window.opener) { window.opener.postMessage(${data}, ${target}); window.close(); }
else document.getElementById("m").textContent = "Signed in, but the page that asked has gone. Sign in again from it.";
</script></html>`);
}
