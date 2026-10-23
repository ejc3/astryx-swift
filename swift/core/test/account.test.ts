import assert from "node:assert/strict";
import { test } from "node:test";
import { createClient, readDoc, type Action, type AppSnapshot, type Doc, type Mutation, type Now } from "../src/index.ts";

const NOW: Now = { epochMs: Date.UTC(2026, 9, 13, 16, 30), utcOffsetMinutes: -420 };
const clock = () => NOW;

const app = (c: ReturnType<typeof createClient>) => c.getSnapshot("app") as AppSnapshot;
const account = (c: ReturnType<typeof createClient>) => app(c).account;
const press = (c: ReturnType<typeof createClient>, id: string) => c.dispatch({ type: "press", id });

function signedIn(email = "sam@example.com") {
  const c = createClient(clock, { signIn: true });
  c.dispatch({ type: "account", event: "signedIn", email });
  return c;
}

test("sign-in is off unless the host says it is configured", () => {
  const off = createClient(clock);
  assert.equal(account(off).available, false);
  assert.equal(account(off).signIn, null);
  press(off, "account.signIn");
  assert.equal(account(off).request, null, "pressing Sign in where it is off asks nothing of the host");
  off.dispatch({ type: "account", event: "signedIn", email: "sam@example.com" });
  assert.equal(account(off).state, "signed-out");

  const on = createClient(clock, { signIn: true });
  assert.equal(account(on).available, true);
  assert.equal(account(on).title, "Sign in to sync");
  assert.equal(account(on).signIn?.id, "account.signIn");

  // A host can turn it on and off; the stock-only page (parity) never has it.
  off.dispatch({ type: "account", event: "available", available: true });
  assert.equal(account(off).available, true);
  const stock = createClient(clock, { signIn: true, extras: false });
  stock.dispatch({ type: "account", event: "available", available: true });
  assert.equal(account(stock).available, false);
});

test("Sign in raises a numbered request for the host, and shows signing in until the host answers", () => {
  const c = createClient(clock, { signIn: true });
  press(c, "account.signIn");
  assert.deepEqual(account(c).request, { kind: "signIn", seq: 1 });
  assert.equal(account(c).state, "signing-in");
  assert.equal(account(c).signIn, null, "no second sign-in while one is open");
  press(c, "account.signIn");
  assert.equal(account(c).request?.seq, 1);

  c.dispatch({ type: "account", event: "signedOut", why: "cancelled" });
  assert.equal(account(c).state, "signed-out");
  assert.equal(app(c).toast, null, "a cancelled sign-in says nothing");

  press(c, "account.signIn");
  assert.deepEqual(account(c).request, { kind: "signIn", seq: 2 });
  c.dispatch({ type: "account", event: "signedOut", why: "failed" });
  assert.equal(account(c).state, "signed-out");
  assert.equal(app(c).toast?.text, "Couldn't sign in. Try again.");
});

test("signed in: the email and the sync status in words, never a token", () => {
  const c = signedIn();
  const a = account(c);
  assert.equal(a.state, "signed-in");
  assert.equal(a.title, "sam@example.com");
  assert.equal(a.detail, "Connecting…");
  assert.equal(a.signIn, null);
  assert.equal(a.signOut?.id, "account.signOut");

  const words: [Action & { type: "account" }, string, string][] = [
    [{ type: "account", event: "status", state: "synced", pending: 0 }, "Synced", "success"],
    [{ type: "account", event: "status", state: "pending", pending: 2 }, "Saving…", "neutral"],
    [{ type: "account", event: "status", state: "offline", pending: 1 }, "Offline — changes will sync", "warning"],
    [{ type: "account", event: "status", state: "offline", pending: 0 }, "Offline", "warning"],
    [{ type: "account", event: "status", state: "signed-out", pending: 0 }, "Sign in again", "danger"],
  ];
  for (const [action, text, tone] of words) {
    c.dispatch(action);
    assert.equal(account(c).detail, text);
    assert.equal(account(c).status?.tone, tone);
    assert.match(account(c).accessibilityLabel, new RegExp(`sam@example.com\\. ${text}`));
  }
  // The server wants a new sign-in: Sign in again asks the host, and the person stays signed in meanwhile.
  assert.equal(account(c).signIn?.label, "Sign in again");
  press(c, "account.signIn");
  assert.deepEqual(account(c).request, { kind: "signIn", seq: 1 });
  assert.equal(account(c).state, "signed-in");
  c.dispatch({ type: "account", event: "signedOut", why: "cancelled" });
  assert.equal(account(c).state, "signed-in", "cancelling a renewal does not sign out");

  const json = JSON.stringify(app(c));
  assert.ok(!/token|eyJ/i.test(json), "nothing token-like in the snapshot");
});

test("status while signed out, and malformed account actions, change nothing", () => {
  const c = createClient(clock, { signIn: true });
  const before = JSON.stringify(app(c));
  c.dispatch({ type: "account", event: "status", state: "synced", pending: 0 });
  c.dispatch({ type: "account", event: "firstSignIn", seeded: [], kept: [] });
  for (const bad of [{ event: "status", state: "great", pending: 0 }, { event: "status", state: "synced", pending: -1 }, { event: "signedIn" }, { event: "signedOut", why: "bored" }, { event: "nope" }])
    c.dispatch({ type: "account", ...bad } as unknown as Action);
  assert.equal(JSON.stringify(app(c)), before);
});

test("Sign out asks first (a confirmation), then raises the request", () => {
  const c = signedIn();
  press(c, "account.signOut");
  const d = app(c).dialog;
  assert.equal(d?.title, "Sign out?");
  assert.equal(d?.confirm.variant, "destructive");
  assert.equal(account(c).request, null, "nothing is asked of the host before the person confirms");
  press(c, "dialog.cancel");
  assert.equal(account(c).state, "signed-in");
  assert.equal(account(c).request, null);

  press(c, "account.signOut");
  press(c, "dialog.confirm");
  assert.deepEqual(account(c).request, { kind: "signOut", seq: 1 });
  assert.equal(app(c).dialog, null);
  c.dispatch({ type: "account", event: "signedOut", why: "requested" });
  assert.equal(account(c).state, "signed-out");
  assert.equal(account(c).title, "Sign in to sync");
  assert.equal(app(c).toast?.text, "Signed out. This device shows its own copy again.");
});

test("a sign-in with work on the device says what happened to it", () => {
  const cases: [string[], string[], RegExp][] = [
    [["kanban_card"], [], /is now in your account/],
    [[], ["kanban_card"], /account's data is shown; this device's copy is kept/],
    [["settings_value"], ["kanban_card"], /Some of this device's work was added/],
    [[], [], /now sync to your other devices/],
  ];
  for (const [seeded, kept, words] of cases) {
    const c = signedIn();
    c.dispatch({ type: "account", event: "firstSignIn", seeded, kept });
    assert.match(app(c).toast?.text ?? "", words);
    assert.match(app(c).toast?.text ?? "", /^Signed in as sam@example.com\./);
  }
});

test("the host's doc replaces the core's, checked, and is not saved back", () => {
  const card = (column: string) => ({ id: "c-1", title: "Kept on the device", column, order: "m", priority: "low", ref: "T-1", createdAt: 1, editedAt: 1 });
  const c = createClient(clock, { screen: "t.kanban", signIn: true, doc: { kanban_card: { "c-1": card("todo") } } });
  const saves: { mutations: readonly Mutation[]; doc: Doc }[] = [];
  c.onSave((mutations, doc) => saves.push({ mutations, doc }));
  const cards = () => (app(c).screen.body as { view: { columns: { id: string; cards: { id: string }[] }[] } }).view.columns.flatMap((col) => col.cards.map((x) => `${col.id}:${x.id}`));
  assert.ok(cards().includes("todo:c-1"));

  // Signed in, Zero's rows replace the table...
  c.dispatch({ type: "rows", table: "kanban_card", rows: [] });
  assert.ok(!cards().some((x) => x.endsWith(":c-1")));
  // ...and signing out puts the device's copy back, as the core reads a stored doc.
  const device = { kanban_card: { "c-1": card("done"), "bad": { id: "not-bad" } }, no_such_table: { x: { id: "x" } } };
  c.dispatch({ type: "doc", doc: device });
  assert.ok(cards().includes("done:c-1"));
  assert.equal(saves.length, 0, "loading a copy is not a change to save");
  assert.deepEqual(Object.keys(readDoc(device).kanban_card), ["c-1"]);

  c.dispatch({ type: "doc", doc: "nonsense" });
  assert.ok(!cards().some((x) => x.endsWith(":c-1")), "a doc that is not one is an empty doc");
});
