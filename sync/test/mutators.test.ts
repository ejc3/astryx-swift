import assert from "node:assert/strict";
import { test } from "node:test";
import { MUTATIONS, TABLES, writesOf } from "@astryx-native/core";
import { MAX_SEED_ROWS, MUTATOR_NAMES, Refused, SEED, checkSeed, mutation } from "../src/mutators.ts";
import { queries } from "../src/queries.ts";

/** A transaction that records what a mutator writes and reads, in place of Zero's. */
function fakeTx(location: "client" | "server", existingRow: unknown = undefined) {
  const writes: { table: string; op: string; value: Record<string, unknown> }[] = [];
  const locks: unknown[][] = [];
  const mutate = new Proxy({}, { get: (_, table: string) => ({ upsert: async (value: Record<string, unknown>) => void writes.push({ table, op: "upsert", value }), insert: async (value: Record<string, unknown>) => void writes.push({ table, op: "insert", value }) }) });
  // The only read a mutator makes is seed's "does the owner have a row in this table".
  const run = async () => existingRow;
  const tx = { location, reason: location === "server" ? "authoritative" : "optimistic", mutate, run, dbTransaction: { query: async (_sql: string, args: unknown[]) => void locks.push(args) } };
  return { tx, writes, locks };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const run = (name: string, args: unknown, tx: unknown, ctx: unknown) => (mutation(name, args) as any).mutator.fn({ args, tx, ctx });

const at = Date.UTC(2026, 9, 13, 16, 30);
const PLACE = { id: "card-1", column: "done", order: "m", at };

test("every core mutation has a Zero mutator of the same name, and there is a seed", () => {
  assert.deepEqual([...MUTATOR_NAMES].sort(), [...Object.keys(MUTATIONS), SEED].sort());
  for (const name of MUTATOR_NAMES) assert.equal(mutation(name, {}).mutator.mutatorName, name);
  assert.equal(mutation("no.such", {}), null);
});

test("every table has a query of its name", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const t of TABLES) assert.equal((queries as any)[t].queryName, t);
});

test("a mutator writes the core's rows as the signed-in user, whatever the arguments say", async () => {
  const { tx, writes } = fakeTx("server");
  await run("kanban.place", PLACE, tx, { userID: "user-a" });
  const expected = writesOf("kanban.place", PLACE)!;
  assert.deepEqual(writes, expected.map((w) => ({ table: w.table, op: "upsert", value: { ...w.fields, id: w.id, owner: "user-a" } })));
});

test("arguments the core refuses (including an owner) write nothing", async () => {
  for (const args of [{ ...PLACE, column: "nope" }, { ...PLACE, owner: "user-b" }, null, "x"]) {
    const { tx, writes } = fakeTx("server");
    await assert.rejects(run("kanban.place", args, tx, { userID: "user-a" }), Refused);
    assert.deepEqual(writes, []);
  }
});

test("signed out, every mutator refuses", async () => {
  const { tx, writes } = fakeTx("client");
  await assert.rejects(run("kanban.place", PLACE, tx, undefined), Refused);
  await assert.rejects(run(SEED, { table: TABLES[0], rows: [{ id: "x" }] }, tx, undefined), Refused);
  assert.deepEqual(writes, []);
});

test("a seed's rows are checked as the core reads a stored doc: unknown fields (an owner) dropped", () => {
  const t = "kanban_card";
  assert.deepEqual(checkSeed({ table: t, rows: [{ id: "a", title: "T", owner: "user-b", nope: 1 }] }), { table: t, rows: [{ id: "a", title: "T" }] });
  assert.deepEqual(checkSeed({ table: "settings_value", rows: [{ id: "account.email", value: "a@example.com" }] }), { table: "settings_value", rows: [{ id: "account.email", value: "a@example.com" }] });
  assert.equal(checkSeed({ table: "no_such", rows: [{ id: "a" }] }), null);
  assert.equal(checkSeed({ table: t, rows: [] }), null);
  assert.equal(checkSeed({ table: t, rows: [{ id: "a" }, { id: "a" }] }), null, "duplicate ids");
  assert.equal(checkSeed({ table: t, rows: [{ id: "" }] }), null);
  assert.equal(checkSeed({ table: t, rows: [{ id: "a" }], owner: "user-b" }), null, "unknown argument");
  assert.equal(checkSeed({ table: t, rows: Array.from({ length: MAX_SEED_ROWS + 1 }, (_, i) => ({ id: `r${i}` })) }), null, "too many rows");
  assert.ok(checkSeed({ table: t, rows: Array.from({ length: MAX_SEED_ROWS }, (_, i) => ({ id: `r${i}` })) }));
});

test("seed writes into an empty table as the signer, and on the server takes the per-owner lock first", async () => {
  const { tx, writes, locks } = fakeTx("server");
  await run(SEED, { table: "kanban_card", rows: [{ id: "a", title: "T", column: null, owner: "user-b" }] }, tx, { userID: "user-a" });
  assert.deepEqual(writes, [{ table: "kanban_card", op: "upsert", value: { title: "T", id: "a", owner: "user-a" } }]);
  assert.deepEqual(locks, [[JSON.stringify(["seed", "user-a", "kanban_card"])]]);
  assert.ok(!(locks[0]![0] as string).includes("\u0000"), "Postgres text cannot hold NUL");
});

test("seed is refused when the account already has rows in the table", async () => {
  const { tx, writes } = fakeTx("server", { id: "x", owner: "user-a" });
  await assert.rejects(run(SEED, { table: "kanban_card", rows: [{ id: "a", title: "T" }] }, tx, { userID: "user-a" }), /already has/);
  assert.deepEqual(writes, []);
});
