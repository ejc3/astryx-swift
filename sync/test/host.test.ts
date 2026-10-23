import assert from "node:assert/strict";
import net from "node:net";
import { test } from "node:test";
import { readDoc, type Action, type Doc, type Mutation } from "@astryx-native/core";
import { connectSync } from "../src/host.ts";

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
    save: (doc: unknown) => savers.forEach((s) => s([{ name: "kanban.place", args: { id: "c", column: "done", order: "m", at: 1 } }], readDoc(doc))),
  };
}

const b64url = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
const token = (sub: string, email: string) => `${b64url({ alg: "EdDSA" })}.${b64url({ sub, email, exp: 1_800_000_000 })}.sig`;

test("signed out the device copy follows each change; signed in it is left alone; signing out puts it back", async () => {
  const core = fakeCore();
  const written: string[] = [];
  const logs: string[] = [];
  const first = { kanban_card: { a: { id: "a", title: "Mine", column: "todo" } } };
  const sync = connectSync({ client: core, writeDeviceDoc: (j) => written.push(j), kvStore: () => "mem", log: (m) => logs.push(m), zeroOptions: { logSink: { log: () => {} } } }, first);

  const second = { kanban_card: { a: { id: "a", title: "Mine", column: "done" } } };
  core.save(second);
  assert.equal(written.length, 1);
  assert.deepEqual(JSON.parse(written[0]!).kanban_card.a.column, "done");

  const url = `http://127.0.0.1:${await deadPort()}`;
  await sync.auth({ token: token("user-a", "a@example.com"), syncURL: url, firstSignIn: true });
  assert.ok(sync.signedIn());
  assert.deepEqual(core.actions.find((a) => a.type === "account"), { type: "account", event: "signedIn", email: "a@example.com" });
  core.save({ kanban_card: { a: { id: "a", title: "Theirs", column: "todo" } } });
  assert.equal(written.length, 1, "signed in, nothing is written to the device copy");

  // A renewal for the same person keeps sync running.
  await sync.auth({ token: token("user-a", "a@example.com"), syncURL: url });
  assert.ok(sync.signedIn());

  // Zero closed in the same moment it started leaves a BroadcastChannel open (Node has one; Hermes does not): let it start.
  await new Promise((r) => setTimeout(r, 300));
  await sync.auth(null);
  assert.ok(!sync.signedIn());
  const doc = core.actions.filter((a): a is Extract<Action, { type: "doc" }> => a.type === "doc").at(-1);
  assert.deepEqual(readDoc(doc?.doc).kanban_card.a?.column, "done", "the device copy as it was when the person signed in");
  assert.deepEqual(core.actions.at(-1), { type: "account", event: "signedOut", why: "requested" });

  core.save({ kanban_card: {} });
  assert.equal(written.length, 2, "signed out again, the device copy follows changes");
  assert.ok(logs.every((m) => !m.includes("sig")), "no token in the log");
});

test("a sign-out while signed out does nothing; a token that is not one is refused", async () => {
  const core = fakeCore();
  const sync = connectSync({ client: core, writeDeviceDoc: () => {}, kvStore: () => "mem", log: () => {} }, undefined);
  await sync.auth(null);
  assert.equal(core.actions.length, 0);
  await assert.rejects(sync.auth({ token: "nope", syncURL: "https://sync.example" }), /not a token/);
  await assert.rejects(sync.auth({ token: token("u", "u@example.com"), syncURL: "javascript:alert(1)" }), /not a URL/);
  assert.ok(!sync.signedIn());
});
