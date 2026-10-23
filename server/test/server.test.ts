import assert from "node:assert/strict";
import { test } from "node:test";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import { accessAuth, chooseAuth, devAuth, noAuth, teamOrigin } from "../src/access.ts";
import { APP_REDIRECTS, WEB_MESSAGE, createApp, type AppDeps } from "../src/app.ts";
import { TOKEN_AUDIENCE, TOKEN_ISSUER, TOKEN_SECONDS, newSigningKey, tokenKeys } from "../src/tokens.ts";
import { sameSecret } from "../src/zero.ts";

const NOW = 1_800_000_000;
const keys = tokenKeys(newSigningKey());
const who = { sub: "user-a", email: "a@example.com" };

// --- Tokens ---------------------------------------------------------------------------------------

test("a token round-trips for its hour, and only for it", async () => {
  const t = await keys.sign(who, NOW);
  assert.deepEqual(await keys.verify(t, NOW), who);
  assert.deepEqual(await keys.verify(t, NOW + TOKEN_SECONDS - 1), who);
  assert.equal(await keys.verify(t, NOW + TOKEN_SECONDS), null, "expired");
  assert.equal(await tokenKeys(newSigningKey()).verify(t, NOW), null, "another key");
  assert.equal(await keys.verify(`${t}x`, NOW), null, "tampered");
  assert.equal(await keys.verify("", NOW), null);
});

test("a token with another issuer or audience is refused, even signed with the right key", async () => {
  const { createPrivateKey } = await import("node:crypto");
  const pkcs8 = newSigningKey();
  const k = tokenKeys(pkcs8);
  const priv = createPrivateKey({ key: Buffer.from(pkcs8, "base64"), format: "der", type: "pkcs8" });
  const make = (iss: string, aud: string) => new SignJWT({ email: "a@example.com" }).setProtectedHeader({ alg: "EdDSA" }).setSubject("user-a").setIssuer(iss).setAudience(aud).setExpirationTime(NOW + 60).sign(priv);
  assert.ok(await k.verify(await make(TOKEN_ISSUER, TOKEN_AUDIENCE), NOW));
  assert.equal(await k.verify(await make("someone-else", TOKEN_AUDIENCE), NOW), null);
  assert.equal(await k.verify(await make(TOKEN_ISSUER, "someone-else"), NOW), null);
});

test("a signing key that is not Ed25519 PKCS8 is refused at start", async () => {
  assert.throws(() => tokenKeys("not a key"), /PKCS8/);
  const { generateKeyPairSync } = await import("node:crypto");
  const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({ format: "der", type: "pkcs8" }).toString("base64");
  assert.throws(() => tokenKeys(rsa), /Ed25519/);
});

test("secrets compare by content, never empty", () => {
  assert.ok(sameSecret("abc", "abc"));
  assert.ok(!sameSecret("abd", "abc"));
  assert.ok(!sameSecret("abcd", "abc"));
  assert.ok(!sameSecret("", ""));
  assert.ok(!sameSecret(null, "abc"));
});

// --- Access ---------------------------------------------------------------------------------------

test("DEV_IDENTITY is refused in production; Access wins when configured", () => {
  assert.throws(() => chooseAuth({ DEV_IDENTITY: "dev@example.com", NODE_ENV: "production" }), /production/);
  assert.throws(() => chooseAuth({ DEV_IDENTITY: "dev@example.com", NODE_ENV: "production", ACCESS_TEAM_DOMAIN: "team.example.com", ACCESS_AUD: "aud" }), /production/);
  assert.equal(chooseAuth({ DEV_IDENTITY: "dev@example.com" }).kind, "dev");
  assert.equal(chooseAuth({ ACCESS_TEAM_DOMAIN: "team.example.com", ACCESS_AUD: "aud" }).kind, "access");
  assert.equal(chooseAuth({}).kind, "none");
  assert.equal(teamOrigin("team.example.com/"), "https://team.example.com");
});

test("an Access JWT is checked against the team's keys, issuer and audience; a service token is refused", async () => {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwks = createLocalJWKSet({ keys: [{ ...(await exportJWK(publicKey)), kid: "k1", alg: "RS256" }] });
  const team = "https://team.example.com";
  const auth = accessAuth(team, "aud-1", jwks);
  const jwt = (claims: Record<string, unknown>, aud = "aud-1", iss = team) => new SignJWT(claims).setProtectedHeader({ alg: "RS256", kid: "k1" }).setIssuer(iss).setAudience(aud).setIssuedAt().setExpirationTime("5m").sign(privateKey);
  const req = async (token: string | null) => new Request("https://api.example.com/native/login", { headers: token ? { "cf-access-jwt-assertion": token } : {} });
  assert.deepEqual(await auth(await req(await jwt({ sub: "access-sub-1", email: "A@Example.com" }))), { sub: "access-sub-1", email: "a@example.com" });
  assert.equal(await auth(await req(await jwt({ sub: "s", email: "a@example.com" }, "other-aud"))), null);
  assert.equal(await auth(await req(await jwt({ sub: "s", email: "a@example.com" }, "aud-1", "https://evil.example.com"))), null);
  assert.equal(await auth(await req(await jwt({ sub: "", common_name: "svc" }))), null, "service token");
  assert.equal(await auth(await req(null)), null);
});

// --- Routes ---------------------------------------------------------------------------------------

const app = (over: Partial<AppDeps> = {}) => createApp({ auth: devAuth("dev@example.com"), authKind: "dev", keys, zero: null, sessions: null, webOrigin: null, now: () => NOW, ...over });
const get = (a: ReturnType<typeof app>, path: string, init?: RequestInit) => a.request(`http://api.test${path}`, init);

test("/healthz says whether sync and sign-in are on", async () => {
  assert.deepEqual(await (await get(app(), "/healthz")).json(), { ok: true, sync: "off", auth: "dev" });
  assert.deepEqual(await (await get(app({ zero: { apiKey: "k", dbProvider: null }, authKind: "access" }), "/healthz")).json(), { ok: true, sync: "on", auth: "access" });
});

test("/native/login redirects to the app's scheme with a token for the signed-in person, in the fragment", async () => {
  const r = await get(app(), `/native/login?redirect=${encodeURIComponent(APP_REDIRECTS[0])}`);
  assert.equal(r.status, 302);
  const location = r.headers.get("location")!;
  assert.match(location, /^astryxswift:\/\/signed-in#token=/);
  assert.deepEqual(await keys.verify(decodeURIComponent(location.split("#token=")[1]!), NOW), { sub: "dev:dev@example.com", email: "dev@example.com" });
  assert.equal(r.headers.get("cache-control"), "no-store");
});

test("/native/login never redirects anywhere else", async () => {
  for (const redirect of ["https://attacker.example/", "astryxswift://signed-in.attacker.example", "astryxswift://other", "//attacker.example", "javascript:alert(1)", ""]) {
    const r = await get(app(), `/native/login?redirect=${encodeURIComponent(redirect)}`);
    assert.equal(r.status, 400, redirect);
    assert.equal(r.headers.get("location"), null);
  }
});

test("/native/login refuses without a signed-in person or without keys", async () => {
  assert.equal((await get(app({ auth: noAuth }), `/native/login?redirect=${encodeURIComponent(APP_REDIRECTS[0])}`)).status, 401);
  assert.equal((await get(app({ keys: null }), `/native/login?redirect=${encodeURIComponent(APP_REDIRECTS[0])}`)).status, 503);
});

test("the web pop-up posts the token to the site's own origin only, and never puts it in a URL", async () => {
  assert.equal((await get(app(), "/native/login?redirect=web")).status, 503, "no WEB_ORIGIN: off");
  const r = await get(app({ webOrigin: "https://app.example.com" }), "/native/login?redirect=web");
  assert.equal(r.status, 200);
  const html = await r.text();
  assert.match(html, new RegExp(`window\\.opener\\.postMessage\\(\\{"type":"${WEB_MESSAGE}","token":"[^"]+","refresh":null\\}, "https://app\\.example\\.com"\\)`));
  assert.ok(!html.includes('"*"'));
  assert.match(r.headers.get("content-security-policy")!, /default-src 'none'; script-src 'nonce-[0-9a-f]+'/);
  assert.equal(r.headers.get("referrer-policy"), "no-referrer");
});

test("/api/zero/* is off without sync, and needs zero-cache's key and a person's token", async () => {
  const body = JSON.stringify(["transform", [{ id: "q1", name: "kanban_card", args: [] }]]);
  const post = (a: ReturnType<typeof app>, headers: Record<string, string>) => get(a, "/api/zero/query?schema=zero_0&appID=zero", { method: "POST", headers: { "content-type": "application/json", ...headers }, body });
  const token = await keys.sign(who, NOW);
  assert.equal((await post(app(), { "x-api-key": "k", authorization: `Bearer ${token}` })).status, 503);
  const on = app({ zero: { apiKey: "k", dbProvider: null } });
  assert.equal((await post(on, { authorization: `Bearer ${token}` })).status, 401);
  assert.equal((await post(on, { "x-api-key": "wrong", authorization: `Bearer ${token}` })).status, 401);
  assert.equal((await post(on, { "x-api-key": "k" })).status, 401);
  assert.equal((await post(on, { "x-api-key": "k", authorization: `Bearer ${await keys.sign(who, NOW - TOKEN_SECONDS)}` })).status, 401);
  const ok = await post(on, { "x-api-key": "k", authorization: `Bearer ${token}` });
  assert.equal(ok.status, 200);
  const out = JSON.stringify(await ok.json());
  assert.ok(out.includes('"owner"') && out.includes('"user-a"'), out);
});

test("the server refuses to start with DEV_IDENTITY when NODE_ENV=production", async () => {
  const { spawnSync } = await import("node:child_process");
  const r = spawnSync(process.execPath, [new URL("../src/main.ts", import.meta.url).pathname], { env: { PATH: process.env.PATH, PORT: "1", DEV_IDENTITY: "dev@example.com", NODE_ENV: "production" }, encoding: "utf8", timeout: 20_000 });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /DEV_IDENTITY is refused in production/);
});

// --- Staying signed in (sessions.ts) ------------------------------------------------------------

import { GRACE_SECONDS, memorySessions } from "../src/sessions.ts";

const post = (a: ReturnType<typeof app>, path: string, body: unknown, headers: Record<string, string> = {}) =>
  get(a, path, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });

function signedIn() {
  let now = NOW;
  const sessions = memorySessions();
  const a = createApp({ auth: devAuth("dev@example.com"), authKind: "dev", keys, zero: null, sessions, webOrigin: "https://web.example.com", now: () => now });
  return { a, sessions, at: (t: number) => void (now = t) };
}

async function login(a: ReturnType<typeof app>) {
  const r = await get(a, `/native/login?redirect=${encodeURIComponent(APP_REDIRECTS[0])}`);
  const fragment = new URLSearchParams(new URL(r.headers.get("location")!).hash.slice(1));
  return { token: fragment.get("token")!, refresh: fragment.get("refresh")! };
}

test("sign-in hands out a refresh token with the first access token, in the fragment", async () => {
  const { a } = signedIn();
  const { token, refresh } = await login(a);
  assert.ok(await keys.verify(token, NOW));
  assert.match(refresh, /^rt1\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}$/);
});

test("a refresh token is traded for a new pair, long after the first token expired, again and again", async () => {
  const { a, at } = signedIn();
  let { refresh } = await login(a);
  for (const days of [1, 30, 400]) {
    const t = NOW + days * 86_400;
    at(t);
    const r = await post(a, "/api/token/refresh", { refresh });
    assert.equal(r.status, 200);
    const body = (await r.json()) as { token: string; refresh: string };
    assert.equal((await keys.verify(body.token, t))?.email, "dev@example.com");
    assert.notEqual(body.refresh, refresh);
    refresh = body.refresh;
  }
});

test("a replaced refresh token works only within the grace; after it, the session ends", async () => {
  const { a, at } = signedIn();
  const first = (await login(a)).refresh;
  const second = ((await (await post(a, "/api/token/refresh", { refresh: first })).json()) as { refresh: string }).refresh;
  // The answer was lost: the client tries the old one again, within the grace.
  at(NOW + GRACE_SECONDS - 1);
  const retried = await post(a, "/api/token/refresh", { refresh: first });
  assert.equal(retried.status, 200);
  const third = ((await retried.json()) as { refresh: string }).refresh;
  // Long after: someone else holds a copy of an old token. The whole session ends.
  at(NOW + 10 * GRACE_SECONDS);
  assert.equal((await post(a, "/api/token/refresh", { refresh: second })).status, 401);
  assert.equal((await post(a, "/api/token/refresh", { refresh: third })).status, 401, "the current one is refused too");
});

test("signing out ends the session; garbage and unknown tokens are refused", async () => {
  const { a } = signedIn();
  const { refresh } = await login(a);
  assert.equal((await post(a, "/api/token/revoke", { refresh })).status, 204);
  assert.equal((await post(a, "/api/token/refresh", { refresh })).status, 401);
  for (const bad of ["", "rt1.x.y", 7, null, `rt1.${"A".repeat(22)}.${"B".repeat(43)}`]) {
    assert.equal((await post(a, "/api/token/refresh", { refresh: bad })).status, 401, String(bad));
  }
  assert.equal((await post(a, "/api/token/revoke", { refresh: "nonsense" })).status, 204, "revoking is idempotent and says nothing");
});

test("a wrong secret for a real session refuses without ending it", async () => {
  const { a } = signedIn();
  const { refresh } = await login(a);
  const [, id] = refresh.split(".");
  assert.equal((await post(a, "/api/token/refresh", { refresh: `rt1.${id}.${"C".repeat(43)}` })).status, 401);
  assert.equal((await post(a, "/api/token/refresh", { refresh })).status, 200);
});

test("only the web page's own origin may read the token routes' answers", async () => {
  const { a } = signedIn();
  const { refresh } = await login(a);
  const ok = await post(a, "/api/token/refresh", { refresh }, { origin: "https://web.example.com" });
  assert.equal(ok.headers.get("access-control-allow-origin"), "https://web.example.com");
  const other = await post(a, "/api/token/refresh", { refresh: "x" }, { origin: "https://evil.example" });
  assert.equal(other.headers.get("access-control-allow-origin"), null);
});

test("without sessions the token routes are off, and sign-in gives no refresh token", async () => {
  const a = app();
  assert.equal((await post(a, "/api/token/refresh", { refresh: "x" })).status, 503);
  const r = await get(a, `/native/login?redirect=${encodeURIComponent(APP_REDIRECTS[0])}`);
  assert.equal(new URLSearchParams(new URL(r.headers.get("location")!).hash.slice(1)).get("refresh"), null);
});
