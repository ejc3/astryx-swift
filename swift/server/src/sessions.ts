/**
 * Sign-in sessions that last until the person signs out (docs/SYNC.md, "Signing in").
 *
 * /native/login opens a session and hands the client a refresh token with its first access token.
 * The access token lasts an hour; the client trades the refresh token for a new pair at
 * /api/token/refresh, with no browser and no prompt, for as long as the session stands. A session
 * has no expiry: it ends when the person signs out (/api/token/revoke) or when a refresh token is
 * used twice (below).
 *
 * - A refresh token is `rt1.<session id>.<secret>`, both parts random (128 and 256 bits). Only a
 *   SHA-256 of the secret is stored, so a copy of the database signs nobody in.
 * - Every refresh rotates the secret. The secret it replaced still works for a short grace
 *   (`GRACE_SECONDS`), for a client whose answer was lost on the way; after that, presenting it
 *   means two parties hold the session, and the session is ended.
 * - Sessions live in their own schema, which zero-cache does not replicate (it replicates
 *   `public`), so nothing of them can reach a client through sync.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import postgres from "postgres";
import type { Identity } from "./tokens.ts";

export const GRACE_SECONDS = 120;
const PREFIX = "rt1";

export type Sessions = {
  /** A new session for `who`; its first refresh token. */
  open(who: Identity, nowSeconds: number): Promise<string>;
  /** The session's person and its next refresh token; null when the token does not stand (unknown, ended, or reused). */
  refresh(token: string, nowSeconds: number): Promise<{ who: Identity; refresh: string } | null>;
  /** Ends the session the token belongs to, if it is a current token of it. */
  revoke(token: string, nowSeconds: number): Promise<void>;
  close(): Promise<void>;
};

const b64 = (bytes: Buffer) => bytes.toString("base64url");
const hash = (secret: string) => createHash("sha256").update(secret).digest("hex");
const same = (a: string, b: string | null) => b !== null && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

function parse(token: unknown): { id: string; secret: string } | null {
  if (typeof token !== "string" || token.length > 200) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== PREFIX) return null;
  const [, id, secret] = parts as [string, string, string];
  if (!/^[A-Za-z0-9_-]{22}$/.test(id) || !/^[A-Za-z0-9_-]{43}$/.test(secret)) return null;
  return { id, secret };
}

/** One session's stored state, wherever it is kept. */
export type Row = { id: string; sub: string; email: string; hash: string; prevHash: string | null; rotatedAt: number; revokedAt: number | null };

/**
 * The rules, apart from where rows are kept: what a refresh does with the session it names.
 * `null`: refuse; `revoke`: refuse and end the session; otherwise the session's next secret.
 */
export function decide(row: Row | null, secret: string, now: number): "refuse" | "revoke" | "rotate" {
  if (!row || row.revokedAt !== null) return "refuse";
  const h = hash(secret);
  if (same(h, row.hash)) return "rotate";
  if (same(h, row.prevHash)) return now - row.rotatedAt <= GRACE_SECONDS ? "rotate" : "revoke";
  return "refuse";
}

/** Sessions in Postgres (the API's DATABASE_URL), schema `astryx_auth`. */
export async function postgresSessions(url: string): Promise<Sessions> {
  const sql = postgres(url, { max: 4, onnotice: () => {} });
  await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtextextended('astryx-swift sessions', 0))`;
    await tx`CREATE SCHEMA IF NOT EXISTS astryx_auth`;
    await tx`CREATE TABLE IF NOT EXISTS astryx_auth.session (
      id text PRIMARY KEY,
      sub text NOT NULL,
      email text NOT NULL,
      hash text NOT NULL,
      prev_hash text,
      created_at bigint NOT NULL,
      rotated_at bigint NOT NULL,
      last_used_at bigint NOT NULL,
      revoked_at bigint
    )`;
  });
  const rowOf = (r: { id: string; sub: string; email: string; hash: string; prev_hash: string | null; rotated_at: string; revoked_at: string | null }): Row =>
    ({ id: r.id, sub: r.sub, email: r.email, hash: r.hash, prevHash: r.prev_hash, rotatedAt: Number(r.rotated_at), revokedAt: r.revoked_at === null ? null : Number(r.revoked_at) });
  return {
    async open(who, now) {
      const id = b64(randomBytes(16));
      const secret = b64(randomBytes(32));
      await sql`INSERT INTO astryx_auth.session (id, sub, email, hash, created_at, rotated_at, last_used_at)
        VALUES (${id}, ${who.sub}, ${who.email}, ${hash(secret)}, ${now}, ${now}, ${now})`;
      return `${PREFIX}.${id}.${secret}`;
    },
    async refresh(token, now) {
      const t = parse(token);
      if (!t) return null;
      return sql.begin(async (tx) => {
        const [found] = await tx`SELECT id, sub, email, hash, prev_hash, rotated_at, revoked_at FROM astryx_auth.session WHERE id = ${t.id} FOR UPDATE`;
        const row = found ? rowOf(found as never) : null;
        const verdict = decide(row, t.secret, now);
        if (verdict === "refuse" || !row) return null;
        if (verdict === "revoke") {
          await tx`UPDATE astryx_auth.session SET revoked_at = ${now} WHERE id = ${t.id}`;
          return null;
        }
        const next = b64(randomBytes(32));
        await tx`UPDATE astryx_auth.session SET prev_hash = hash, hash = ${hash(next)}, rotated_at = ${now}, last_used_at = ${now} WHERE id = ${t.id}`;
        return { who: { sub: row.sub, email: row.email }, refresh: `${PREFIX}.${t.id}.${next}` };
      });
    },
    async revoke(token, now) {
      const t = parse(token);
      if (!t) return;
      const [found] = await sql`SELECT id, sub, email, hash, prev_hash, rotated_at, revoked_at FROM astryx_auth.session WHERE id = ${t.id}`;
      const row = found ? rowOf(found as never) : null;
      if (decide(row, t.secret, now) !== "refuse") await sql`UPDATE astryx_auth.session SET revoked_at = ${now} WHERE id = ${t.id} AND revoked_at IS NULL`;
    },
    close: () => sql.end(),
  };
}

/** Sessions in memory, for tests and a local server without a database. */
export function memorySessions(): Sessions {
  const rows = new Map<string, Row>();
  return {
    async open(who, now) {
      const id = b64(randomBytes(16));
      const secret = b64(randomBytes(32));
      rows.set(id, { id, sub: who.sub, email: who.email, hash: hash(secret), prevHash: null, rotatedAt: now, revokedAt: null });
      return `${PREFIX}.${id}.${secret}`;
    },
    async refresh(token, now) {
      const t = parse(token);
      const row = t ? rows.get(t.id) ?? null : null;
      if (!t || !row) return null;
      const verdict = decide(row, t.secret, now);
      if (verdict === "refuse") return null;
      if (verdict === "revoke") { row.revokedAt = now; return null; }
      const next = b64(randomBytes(32));
      row.prevHash = row.hash;
      row.hash = hash(next);
      row.rotatedAt = now;
      return { who: { sub: row.sub, email: row.email }, refresh: `${PREFIX}.${t.id}.${next}` };
    },
    async revoke(token, now) {
      const t = parse(token);
      const row = t ? rows.get(t.id) : undefined;
      if (t && row && decide(row, t.secret, now) !== "refuse") row.revokedAt ??= now;
    },
    close: async () => {},
  };
}
