/**
 * Zero's mutators: one per core mutation, by the same name (core/src/sync/mutations.ts), plus
 * `seed`. Each is a thin wrapper: the core checks the arguments and says which rows to write
 * (`writesOf`, no reads), and the wrapper writes them as the signed-in user. The same code runs
 * optimistically in Zero's client and authoritatively in the API's Postgres transaction.
 *
 * The owner of every row written is `ctx.userID`: on the server, the subject of the verified
 * token. Nothing a client sends can name another owner: the core refuses unknown arguments, a
 * row's fields can only be the core's columns, and the key is set here last.
 */
import { MUTATIONS, fitsColumn, isTable, readDoc, writesOf, type Field, type Row, type TableName, type Write } from "@astryx-native/core";
import { defineMutatorsWithType, defineMutatorWithType, getMutator } from "@rocicorp/zero";
import { zql, type Context, type Schema } from "./schema.ts";

const defineMutator = defineMutatorWithType<Schema, Context>();

/** The most rows one `seed` may upload to one table. */
export const MAX_SEED_ROWS = 2000;

/** The name of the mutator that uploads a device's signed-out rows (docs/SYNC.md, "Signing in with work on the device"). */
export const SEED = "seed";

/** Thrown by a mutator that refuses: Zero reports it as the mutation's error, and nothing is written. */
export class Refused extends Error {}

// Zero's transaction is typed per table; tables chosen at run time are typed loosely here.
/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyTx = { location: "client" | "server"; mutate: any; run(q: any): Promise<any>; dbTransaction?: { query(sql: string, args: unknown[]): Promise<unknown> } };
const from = (t: TableName): any => (zql as any)[t];
/* eslint-enable @typescript-eslint/no-explicit-any */

const signedIn = (ctx: Context): string => {
  if (!ctx?.userID) throw new Refused("sign in first");
  return ctx.userID;
};

/** Writes one row's fields as `owner`: the given fields change, the others keep their values; a new row is made. */
async function put(tx: AnyTx, owner: string, w: Write): Promise<void> {
  const fields: Record<string, Field> = {};
  for (const [k, v] of Object.entries(w.fields)) {
    if (!fitsColumn(w.table, k, v)) throw new Refused(`${w.table}.${k} cannot hold ${JSON.stringify(v)}`);
    fields[k] = v;
  }
  // An upsert is "read the row; update these fields, or insert it", done in one statement, so two
  // devices making the same new row at once both land instead of one failing on the key.
  await tx.mutate[w.table].upsert({ ...fields, id: w.id, owner });
}

function coreMutator(name: string) {
  return defineMutator(async ({ args, tx, ctx }) => {
    const owner = signedIn(ctx);
    const writes = writesOf(name, args);
    if (!writes) throw new Refused(`${name}: refused`);
    for (const w of writes) await put(tx as unknown as AnyTx, owner, w);
  });
}

/** A row's id: minted ids and sample ids, and setting names ("account.email"): short text. */
const isRowId = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 128;

/** A `seed`'s arguments checked: the table, and its rows as the core reads a stored doc (unknown fields dropped). */
export function checkSeed(args: unknown): { table: TableName; rows: Row[] } | null {
  if (typeof args !== "object" || args === null || Array.isArray(args)) return null;
  const { table, rows, ...rest } = args as { table?: unknown; rows?: unknown };
  if (Object.keys(rest).length > 0 || typeof table !== "string" || !isTable(table)) return null;
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > MAX_SEED_ROWS) return null;
  const byId: Record<string, unknown> = {};
  for (const r of rows) {
    const id = (r as { id?: unknown } | null)?.id;
    if (!isRowId(id) || id in byId) return null;
    byId[id] = r;
  }
  const checked = Object.values(readDoc({ [table]: byId })[table]);
  return checked.length === rows.length ? { table, rows: checked } : null;
}

const seed = defineMutator(async ({ args, tx: anyTx, ctx }) => {
  const owner = signedIn(ctx);
  const tx = anyTx as unknown as AnyTx;
  const checked = checkSeed(args);
  if (!checked) throw new Refused("seed: refused");
  // Two devices signing in at once: the second waits for the first, then finds its rows.
  if (tx.location === "server") await tx.dbTransaction!.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [JSON.stringify(["seed", owner, checked.table])]);
  if (await tx.run(from(checked.table).where("owner", owner).one())) throw new Refused(`seed: the account already has ${checked.table} rows`);
  for (const row of checked.rows) {
    const { id, ...fields } = row;
    const set: Record<string, Field> = {};
    for (const [k, v] of Object.entries(fields)) if (v !== undefined && v !== null) set[k] = v;
    await put(tx, owner, { table: checked.table, id, fields: set });
  }
});

/** `{a: {b: m}}` from `{"a.b": m}`: Zero names a mutator by its path, joined with dots. */
function nest<T>(flat: Record<string, T>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, m] of Object.entries(flat)) {
    const path = name.split(".");
    let at = out;
    for (const part of path.slice(0, -1)) {
      const next = (at[part] ??= {});
      if (typeof next !== "object" || next === null || "fn" in next) throw new Error(`mutator ${name}: ${part} is already a mutator`);
      at = next as Record<string, unknown>;
    }
    const leaf = path[path.length - 1]!;
    if (leaf in at) throw new Error(`mutator ${name} is defined twice`);
    at[leaf] = m;
  }
  return out;
}

const definitions = { ...Object.fromEntries(Object.keys(MUTATIONS).map((name) => [name, coreMutator(name)])), [SEED]: seed };
// Zero's registry is typed by its literal shape; one made from a list is typed loosely.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const mutators: any = defineMutatorsWithType<Schema>()(nest(definitions) as never);

/** Every mutator's name: the core's mutations and `seed`. */
export const MUTATOR_NAMES: readonly string[] = Object.keys(definitions);

/** The request for mutator `name` with `args`, as `zero.mutate` takes it; null for an unknown name. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mutation(name: string, args: unknown): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = getMutator(mutators, name) as any;
  return typeof m === "function" ? m(args) : null;
}

