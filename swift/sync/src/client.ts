/**
 * Sync for a signed-in person (docs/SYNC.md, "The sync layer"), the same in every host: the
 * Apple apps' Hermes runtime (Zero's store on op-sqlite) and the standalone web page (IndexedDB).
 * Nothing here touches the DOM, React Native or Node: the host passes in the core client, where
 * zero-cache is, the token, and Zero's local store.
 *
 * - Zero's live query for each table feeds the core: `{type: "rows", table, rows}` replaces that
 *   table in the core's doc. `owner` is dropped (the core has no such column), and so are empty
 *   fields (an empty field and a missing one mean the same to the core).
 * - Each mutation the core saves (`client.onSave`) goes to the Zero mutator of the same name,
 *   which applies it to Zero's store at once and sends it to the server.
 * - A status says whether everything is on the server: connecting, synced, pending changes,
 *   offline, or signed out by the server (the token was refused: sign in again).
 *
 * On a sign-in (not a relaunch) the host also passes the device's signed-out doc: each table the
 * account has no rows in is uploaded from it (`seed`); where the account has rows, the account
 * wins and the device copy is left as it is, for when the person signs out.
 */
import { TABLES, type Client, type Doc, type Field, type Mutation, type Row, type TableName } from "@astryx-native/core";
import { Zero, type ZeroOptions } from "@rocicorp/zero";
import { MAX_SEED_ROWS, SEED, mutation, mutators } from "./mutators.ts";
import { tableQuery } from "./queries.ts";
import { schema } from "./schema.ts";

export type SyncState = "connecting" | "synced" | "pending" | "offline" | "signed-out";

export type SyncStatus = {
  state: SyncState;
  /** Changes made here that the server has not confirmed yet. */
  pending: number;
  /** Why, when Zero gave a reason (offline, signed out). */
  reason?: string;
};

/** What happened to the device's signed-out work on a sign-in. */
export type FirstSignIn = {
  /** Tables the account had no rows in: the device's rows were uploaded. */
  seeded: TableName[];
  /** Tables the account already had rows in: the account's rows are shown; the device copy is kept, untouched. */
  kept: TableName[];
};

/** The connection states Zero reports (`zero.connection.state`). */
export type ConnectionName = "initializing" | "connecting" | "disconnected" | "connected" | "needs-auth" | "error" | "closed";

/**
 * The status shown for Zero's connection state, the changes waiting, and whether every table has
 * loaded. Zero retries a lost connection as `connecting` for up to a minute before it says
 * `disconnected`; once it has been connected, that retrying is shown as offline.
 */
export function statusOf(connection: ConnectionName, pending: number, loaded: boolean, wasConnected = false, reason?: string): SyncStatus {
  const why = reason ? { reason } : {};
  switch (connection) {
    case "needs-auth": return { state: "signed-out", pending, ...why };
    case "disconnected": case "error": case "closed": return { state: "offline", pending, ...why };
    case "initializing": case "connecting": return wasConnected ? { state: "offline", pending, ...why } : { state: "connecting", pending };
    case "connected": return { state: pending > 0 ? "pending" : loaded ? "synced" : "connecting", pending };
  }
}

/**
 * What a sign-in does with one table, once the account's rows for it are known: upload the
 * device's rows when the account has none (`seed`), keep the account's otherwise (`kept`), or
 * nothing when the device has none. More rows than one `seed` may carry are not uploaded: the
 * account starts empty, and the device copy is kept.
 */
export function firstSignIn(table: TableName, accountRows: number, device: Doc): { seed: Row[] } | "kept" | "none" {
  const rows = Object.values(device[table] ?? {});
  if (rows.length === 0) return "none";
  if (accountRows > 0 || rows.length > MAX_SEED_ROWS) return "kept";
  return { seed: rows };
}

/** A Zero row as the core's row: no `owner`, no empty fields. */
export function toRow(zeroRow: Readonly<Record<string, unknown>>): Row {
  const row: Record<string, Field> = {};
  for (const [k, v] of Object.entries(zeroRow)) if (k !== "owner" && v !== null && v !== undefined) row[k] = v as Field;
  return row as Row;
}

/** A token's claims, read without checking its signature (the server checks it): who to start Zero as, and when to renew. */
export function readToken(token: string): { sub: string; email: string; exp: number } | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const claims = JSON.parse(base64urlText(part)) as { sub?: unknown; email?: unknown; exp?: unknown };
    if (typeof claims.sub !== "string" || typeof claims.exp !== "number") return null;
    return { sub: claims.sub, email: typeof claims.email === "string" ? claims.email : "", exp: claims.exp };
  } catch {
    return null;
  }
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
/** UTF-8 text from base64url, with no atob, Buffer or TextDecoder (Hermes has not always had them). */
function base64urlText(s: string): string {
  let bits = 0, value = 0, escaped = "";
  for (const ch of s.replace(/=+$/, "")) {
    const n = B64.indexOf(ch);
    if (n < 0) throw new Error("not base64url");
    value = (value << 6) | n;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      escaped += `%${((value >> bits) & 0xff).toString(16).padStart(2, "0")}`;
    }
  }
  return decodeURIComponent(escaped);
}

export type StartSync = {
  /** The core client: rows go in by `dispatch`, mutations come out of `onSave`. */
  client: Pick<Client, "dispatch" | "onSave">;
  /** zero-cache's URL. */
  cacheURL: string;
  /** The API's token (from /native/login); zero-cache forwards it to the API with every query and mutation. */
  auth: string;
  /** The token's subject (`readToken(auth).sub`): Zero keeps a separate local store per user. */
  userID: string;
  /** Zero's local store: an op-sqlite store on Apple platforms, "idb" in a browser, "mem" in tests. */
  kvStore: ZeroOptions["kvStore"];
  onStatus?: (status: SyncStatus) => void;
  /** On a sign-in only: the device's signed-out doc, uploaded to each table the account has nothing in. */
  deviceDoc?: Doc;
  /** Once the sign-in's uploads are settled: which tables were uploaded and which kept the account's rows. */
  onFirstSignIn?: (result: FirstSignIn) => void;
  /** A mutation the server refused (its rows were not written; the account's copy comes back). */
  onRefused?: (name: string, message: string) => void;
  /** More of Zero's options (logLevel, storageKey, ...). */
  zeroOptions?: Partial<ZeroOptions>;
};

export type SyncHandle = {
  /** The Zero instance, for tests and diagnostics; hosts go through the core. */
  readonly zero: Zero;
  status(): SyncStatus;
  /** A renewed token: Zero uses it at once, and reconnects when it was signed out by the server. */
  setAuth(token: string): Promise<void>;
  /** Stops sync: no more rows into the core, no more mutations out. Zero's local store stays. */
  stop(): Promise<void>;
};

export function startSync(o: StartSync): SyncHandle {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const zero = new Zero({ logLevel: "error", ...o.zeroOptions, cacheURL: o.cacheURL, auth: o.auth, userID: o.userID, schema, mutators, context: { userID: o.userID }, kvStore: o.kvStore } as any) as Zero;
  let stopped = false;
  let pending = 0;
  const loaded = new Set<TableName>();
  let last = "";

  // On a sign-in, the core's mutations wait until every table's upload is decided, so an edit made
  // in the first moment cannot land first and make the account look as if it had data.
  let held: Mutation[] | null = o.deviceDoc ? [] : null;
  const undecided = new Set<TableName>(o.deviceDoc ? TABLES : []);
  const seeding: Promise<[TableName, boolean]>[] = [];
  const kept: TableName[] = [];

  let wasConnected = false;
  const status = (): SyncStatus => {
    const c = zero.connection.state.current;
    if (c.name === "connected") wasConnected = true;
    return statusOf(c.name, pending + (held?.length ?? 0), loaded.size === TABLES.length, wasConnected, "reason" in c && typeof c.reason === "string" ? c.reason : undefined);
  };
  const report = () => {
    if (stopped) return;
    const s = status();
    const key = JSON.stringify(s);
    if (key !== last) {
      last = key;
      o.onStatus?.(s);
    }
  };

  /** Sends one mutation to Zero; resolves to whether the server took it. */
  const send = (m: Mutation | { name: string; args: unknown }): Promise<boolean> => {
    const req = mutation(m.name, m.args);
    if (!req) {
      o.onRefused?.(m.name, "no such mutation");
      return Promise.resolve(false);
    }
    pending++;
    report();
    const result = zero.mutate(req) as { server: Promise<{ type: "success" } | { type: "error"; error: { message: string } }> };
    return result.server.then(
      (r) => {
        if (r.type === "error") o.onRefused?.(m.name, r.error.message);
        return r.type === "success";
      },
      (e: unknown) => {
        o.onRefused?.(m.name, e instanceof Error ? e.message : String(e));
        return false;
      },
    ).finally(() => {
      pending--;
      report();
    });
  };

  const decide = (t: TableName, accountRows: number): boolean => {
    if (!o.deviceDoc || !undecided.delete(t)) return false;
    const plan = firstSignIn(t, accountRows, o.deviceDoc);
    let seeded = false;
    if (plan === "kept") kept.push(t);
    else if (plan !== "none") {
      seeded = true;
      seeding.push(send({ name: SEED, args: { table: t, rows: plan.seed } }).then((ok) => [t, ok]));
    }
    if (undecided.size === 0 && held) {
      const waiting = held;
      held = null;
      for (const m of waiting) void send(m);
      void Promise.all(seeding).then((done) => {
        if (stopped) return;
        const inOrder = (ts: TableName[]) => TABLES.filter((x) => ts.includes(x));
        o.onFirstSignIn?.({ seeded: inOrder(done.filter(([, ok]) => ok).map(([table]) => table)), kept: inOrder([...kept, ...done.filter(([, ok]) => !ok).map(([table]) => table)]) });
      });
    }
    return seeded;
  };

  const views = TABLES.map((t) => {
    const view = zero.materialize(tableQuery(t));
    view.addListener((data: unknown, resultType: string) => {
      if (stopped) return;
      const rows = data as readonly Readonly<Record<string, unknown>>[];
      let first = false;
      if (resultType === "complete" && !loaded.has(t)) {
        loaded.add(t);
        first = true;
      }
      // Until the server has answered, an empty local result says nothing: keep what the core has.
      if (!loaded.has(t) && resultType !== "cached" && rows.length === 0) return report();
      // A table about to be uploaded: its rows arrive with the upload; don't blank it first.
      if (first && decide(t, rows.length)) return report();
      o.client.dispatch({ type: "rows", table: t, rows: rows.map(toRow) });
      report();
    });
    return view;
  });

  const unsave = o.client.onSave((mutations) => {
    if (stopped) return;
    if (held) {
      held.push(...mutations);
      report();
    } else for (const m of mutations) void send(m);
  });
  const unconnect = zero.connection.state.subscribe(() => report());
  report();

  return {
    zero,
    status,
    async setAuth(token) {
      await zero.connection.connect({ auth: token });
    },
    async stop() {
      if (stopped) return;
      stopped = true;
      unsave();
      unconnect();
      for (const v of views) v.destroy();
      await zero.close();
    },
  };
}
