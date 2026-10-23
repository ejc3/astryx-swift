import assert from "node:assert/strict";
import net from "node:net";
import { test } from "node:test";
import { readDoc, type Action, type Doc, type Mutation, type Row } from "@astryx-native/core";
import { MAX_SEED_ROWS } from "../src/mutators.ts";
import { firstSignIn, readToken, startSync, statusOf, toRow, type SyncStatus } from "../src/client.ts";

test("the status: connecting, synced, pending, offline, signed out", () => {
  assert.deepEqual(statusOf("initializing", 0, false), { state: "connecting", pending: 0 });
  assert.deepEqual(statusOf("connecting", 2, false), { state: "connecting", pending: 2 });
  assert.deepEqual(statusOf("connected", 0, false), { state: "connecting", pending: 0 }, "connected but the tables have not loaded");
  assert.deepEqual(statusOf("connected", 0, true), { state: "synced", pending: 0 });
  assert.deepEqual(statusOf("connected", 3, true), { state: "pending", pending: 3 });
  assert.deepEqual(statusOf("disconnected", 1, true, true, "socket closed"), { state: "offline", pending: 1, reason: "socket closed" });
  assert.deepEqual(statusOf("connecting", 1, true, true), { state: "offline", pending: 1 }, "retrying a lost connection is offline");
  assert.deepEqual(statusOf("error", 0, true), { state: "offline", pending: 0 });
  assert.deepEqual(statusOf("needs-auth", 0, true, true, "401"), { state: "signed-out", pending: 0, reason: "401" });
});

test("a sign-in seeds an empty account from the device, keeps an account with rows, and does nothing without device rows", () => {
  const device = readDoc({ kanban_card: { a: { id: "a", title: "T" } } });
  assert.deepEqual(firstSignIn("kanban_card", 0, device), { seed: [{ id: "a", title: "T" }] });
  assert.equal(firstSignIn("kanban_card", 3, device), "kept");
  assert.equal(firstSignIn("settings_value", 0, device), "none");
  const many = readDoc({ kanban_card: Object.fromEntries(Array.from({ length: MAX_SEED_ROWS + 1 }, (_, i) => [`r${i}`, { id: `r${i}` }])) });
  assert.equal(firstSignIn("kanban_card", 0, many), "kept", "too many to upload: the device copy stays on the device");
});

test("a Zero row reaches the core without owner or empty fields", () => {
  assert.deepEqual(toRow({ owner: "user-a", id: "a", title: "T", column: null, deleted: false }), { id: "a", title: "T", deleted: false });
});

test("a token's claims are read without Node or browser APIs, UTF-8 included", () => {
  const b64url = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const token = `${b64url({ alg: "EdDSA" })}.${b64url({ sub: "dev:zoë@example.com", email: "zoë@example.com", exp: 1_800_000_000 })}.sig`;
  assert.deepEqual(readToken(token), { sub: "dev:zoë@example.com", email: "zoë@example.com", exp: 1_800_000_000 });
  assert.equal(readToken("nope"), null);
  assert.equal(readToken(`a.${b64url({ email: "x" })}.c`), null);
});

/** A port nothing listens on: Zero keeps trying to connect, as it does offline. */
async function deadPort(): Promise<number> {
  const s = net.createServer();
  await new Promise<void>((r) => s.listen(0, "127.0.0.1", r));
  const { port } = s.address() as net.AddressInfo;
  await new Promise((r) => s.close(r));
  return port;
}

function fakeCore() {
  const actions: Action[] = [];
  const savers = new Set<(m: readonly Mutation[], d: Doc) => void>();
  return {
    actions,
    dispatch: (a: Action) => void actions.push(a),
    onSave(l: (m: readonly Mutation[], d: Doc) => void) {
      savers.add(l);
      return () => savers.delete(l);
    },
    save: (...ms: Mutation[]) => savers.forEach((s) => s(ms, readDoc({}))),
    rows: (table: string) => actions.filter((a): a is Extract<Action, { type: "rows" }> => a.type === "rows" && a.table === table).at(-1)?.rows as Row[] | undefined,
  };
}

const until = async (what: string, fn: () => unknown, ms = 5000) => {
  for (const end = Date.now() + ms; !fn(); await new Promise((r) => setTimeout(r, 20))) if (Date.now() > end) throw new Error(`timed out: ${what}`);
};

test("offline, the core's mutations go to Zero, come back as rows, and wait as pending", async () => {
  const core = fakeCore();
  const statuses: SyncStatus[] = [];
  const sync = startSync({ client: core, cacheURL: `http://127.0.0.1:${await deadPort()}`, auth: "token", userID: "user-a", kvStore: "mem", onStatus: (s) => statuses.push(s), zeroOptions: { logSink: { log: () => {} } } });
  try {
    assert.equal(core.actions.length, 0, "nothing loaded yet: the core keeps what it has");
    core.save({ name: "kanban.place", args: { id: "card-1", column: "done", order: "m", at: Date.UTC(2026, 9, 13) } });
    await until("the row back in the core", () => core.rows("kanban_card")?.length);
    assert.deepEqual(core.rows("kanban_card"), [{ id: "card-1", column: "done", order: "m", editedAt: Date.UTC(2026, 9, 13) }]);
    assert.equal(sync.status().pending, 1);
    assert.notEqual(sync.status().state, "synced");
    assert.ok(statuses.length > 0 && statuses.every((s) => s.state === "connecting"), JSON.stringify(statuses));
  } finally {
    await sync.stop();
  }
  const after = core.actions.length;
  core.save({ name: "kanban.place", args: { id: "card-2", column: "done", order: "n", at: Date.UTC(2026, 9, 13) } });
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(core.actions.length, after, "stopped: nothing more goes out or comes in");
});

test("on a sign-in, the core's mutations wait until the uploads are decided", async () => {
  const core = fakeCore();
  const sync = startSync({ client: core, cacheURL: `http://127.0.0.1:${await deadPort()}`, auth: "token", userID: "user-b", kvStore: "mem", deviceDoc: readDoc({ kanban_card: { a: { id: "a", title: "T" } } }), zeroOptions: { logSink: { log: () => {} } } });
  try {
    core.save({ name: "kanban.place", args: { id: "card-1", column: "done", order: "m", at: Date.UTC(2026, 9, 13) } });
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(core.rows("kanban_card"), undefined, "held: not in Zero yet");
    assert.equal(sync.status().pending, 1, "but counted as waiting");
  } finally {
    await sync.stop();
  }
});
