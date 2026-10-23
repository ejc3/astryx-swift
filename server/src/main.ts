/**
 * The API on Node. Settings come from the environment (in staging, from Secrets Manager through
 * the task definition); none has a default that matters in production.
 *
 * - PORT (required), HOST (default 127.0.0.1: zero-cache and the Cloudflare connector reach it
 *   on the task's own loopback; nothing listens on a public address).
 * - Sign-in: ACCESS_TEAM_DOMAIN and ACCESS_AUD (Cloudflare Access), or DEV_IDENTITY locally
 *   (refused with NODE_ENV=production); TOKEN_SIGNING_KEY; WEB_ORIGIN for the web page's pop-up.
 * - Sync: DATABASE_URL and ZERO_API_KEY. With both, the tables are made at start and
 *   /api/zero/* is on; /healthz says so.
 */
import { serve } from "@hono/node-server";
import { schema } from "@astryx-native/sync";
import { chooseAuth } from "./access.ts";
import { createApp } from "./app.ts";
import { applySchema } from "./db.ts";
import { tokenKeys } from "./tokens.ts";
import type { ZeroDeps } from "./zero.ts";

const env = process.env;
const fail = (message: string): never => {
  console.error(`api: ${message}`);
  process.exit(2);
};

const port = Number(env.PORT);
if (!Number.isInteger(port) || port <= 0 || port > 65535) fail("set PORT");
const host = env.HOST || "127.0.0.1";

let auth;
try {
  auth = chooseAuth({ ACCESS_TEAM_DOMAIN: env.ACCESS_TEAM_DOMAIN, ACCESS_AUD: env.ACCESS_AUD, DEV_IDENTITY: env.DEV_IDENTITY, NODE_ENV: env.NODE_ENV });
} catch (e) {
  fail((e as Error).message);
}
const { auth: authenticate, kind: authKind } = auth!;
if (authKind === "none") console.warn("api: sign-in is off (set ACCESS_TEAM_DOMAIN and ACCESS_AUD, or DEV_IDENTITY locally)");
if (authKind === "dev") console.warn("api: DEV_IDENTITY stands in for Cloudflare Access: development only");

let keys = null;
try {
  keys = env.TOKEN_SIGNING_KEY ? tokenKeys(env.TOKEN_SIGNING_KEY) : null;
} catch (e) {
  fail((e as Error).message);
}

let zero: ZeroDeps | null = null;
if (env.DATABASE_URL && env.ZERO_API_KEY) {
  if (!keys) fail("sync needs TOKEN_SIGNING_KEY to check the tokens zero-cache forwards");
  const ran = await applySchema(env.DATABASE_URL);
  console.log(`api: schema ${ran.length === 0 ? "up to date" : `applied (${ran.length} statements)`}`);
  const { zeroPostgresJS } = await import("@rocicorp/zero/server/adapters/postgresjs");
  zero = { apiKey: env.ZERO_API_KEY, dbProvider: zeroPostgresJS(schema, env.DATABASE_URL) };
} else console.warn("api: sync is off (set DATABASE_URL and ZERO_API_KEY)");

const app = createApp({ auth: authenticate, authKind, keys, zero, webOrigin: env.WEB_ORIGIN || null, now: () => Math.floor(Date.now() / 1000) });
const server = serve({ fetch: app.fetch, port, hostname: host }, () => console.log(`api: listening on ${host}:${port} (sync ${zero ? "on" : "off"}, auth ${authKind})`));

for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  });
