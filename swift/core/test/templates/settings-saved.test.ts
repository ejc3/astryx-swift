/** The settings template's saved data (docs/SYNC.md): drafts in the inputs, Save and commit write `settings.set` rows. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { settings } from "../../src/templates/settings/model.ts";
import { harness } from "./harness.ts";
import { readDoc } from "../../src/sync/doc.ts";
import { writesOf } from "../../src/sync/mutations.ts";
import { createClient, type AppSnapshot, type Now } from "../../src/index.ts";

const NOW: Now = { epochMs: Date.UTC(2026, 9, 13, 16, 30), utcOffsetMinutes: -420 };
const h = harness(settings, NOW);
const stock = harness(settings, NOW, false);
const rowsOf = (w: ReturnType<typeof h.start>) => w.saved.map((m) => [m.name, m.args.key, m.args.value]);

test("typing changes the draft shown in the input and saves nothing until Save", () => {
  let w = h.start();
  w = h.set(w, "username", "ada");
  w = h.set(w, "email", "ada@lovelace.example");
  assert.equal(h.view(w).username, "ada");
  assert.equal(h.view(w).email, "ada@lovelace.example");
  assert.deepEqual(w.saved, []);
  assert.deepEqual(w.doc.settings_value, {});
});

test("Save (basic) commits the changed fields as settings.set rows, once, and the fields then show the saved values", () => {
  let w = h.start();
  w = h.set(w, "username", "ada");
  w = h.set(w, "lastName", "Lovelace");
  w = h.set(w, "firstName", "Stephanie"); // the sample's own value: not a change
  w = h.press(w, "save.basic");
  assert.deepEqual(rowsOf(w), [["settings.set", "account.username", "ada"], ["settings.set", "account.lastName", "Lovelace"]]);
  assert.deepEqual(w.state.drafts, {});
  assert.equal(h.view(w).username, "ada");
  assert.equal(h.view(w).firstName, "Stephanie");
  // A second Save has nothing to commit.
  const again = h.press(w, "save.basic");
  assert.equal(again, w);
});

test("Save (advanced) commits the checkboxes; each Save commits only its own section", () => {
  let w = h.start();
  w = h.set(w, "twoFactor", true);
  w = h.set(w, "username", "ada");
  w = h.press(w, "save.advanced");
  assert.deepEqual(rowsOf(w), [["settings.set", "account.twoFactor", true]]);
  assert.equal(h.view(w).username, "ada");
  assert.deepEqual(Object.keys(w.state.drafts), ["username"]);
  assert.equal(w.doc.settings_value["account.twoFactor"]!.value, true);
  // Unchecking back to the sample's value is a change from what is saved.
  w = h.set(w, "twoFactor", false);
  assert.equal(h.view(w).twoFactor, false);
  w = h.press(w, "save.advanced");
  assert.equal(w.doc.settings_value["account.twoFactor"]!.value, false);
});

test("a draft set back to the saved value is not a change", () => {
  let w = h.press(h.set(h.start(), "username", "ada"), "save.basic");
  w = h.set(w, "username", "grace");
  w = h.set(w, "username", "ada");
  assert.deepEqual(w.state.drafts, {});
  assert.equal(h.press(w, "save.basic"), w);
});

test("the password Save does nothing and passwords are never saved", () => {
  let w = h.start();
  w = h.set(w, "currentPw", "hunter2");
  w = h.set(w, "newPw", "correct horse");
  w = h.set(w, "confirmPw", "correct horse");
  assert.equal(h.view(w).newPw, "correct horse");
  const before = w;
  w = h.press(w, "save.password");
  w = h.press(w, "commit:newPw");
  w = h.press(w, "commit:currentPw");
  assert.equal(w, before);
  assert.deepEqual(w.saved, []);
  assert.ok(h.view(w).inert.includes("save.password"));
  assert.ok(!h.view(w).inert.includes("save.basic") && !h.view(w).inert.includes("save.advanced"));
  assert.ok(!JSON.stringify(w.doc).includes("correct horse"));
});

test("commit:<field> saves one field at once (the Apple platforms' trigger); a toggle is set, then committed", () => {
  let w = h.start();
  w = h.set(w, "username", "ada");
  w = h.set(w, "email", "ada@lovelace.example");
  w = h.press(w, "commit:username");
  assert.deepEqual(rowsOf(w), [["settings.set", "account.username", "ada"]]);
  assert.deepEqual(w.state.drafts, { email: "ada@lovelace.example" });
  w = h.set(w, "dataExport", true);
  w = h.press(w, "commit:dataExport");
  assert.deepEqual(rowsOf(w).at(-1), ["settings.set", "account.dataExport", true]);
  // Committing a field with no draft, or a field that is not saved, changes nothing.
  assert.equal(h.press(w, "commit:username"), w);
  assert.equal(h.press(w, "commit:search"), w);
  assert.equal(h.press(w, "commit:"), w);
});

test("a saved row from another device is what the fields show; a draft over it wins until saved", () => {
  const doc = readDoc({ settings_value: {
    "account.username": { id: "account.username", value: "grace" },
    "account.twoFactor": { id: "account.twoFactor", value: true },
    "account.firstName": { id: "account.firstName", value: 7 },
    "account.email": { id: "account.email", value: "x".repeat(300) },
    "account.nothing": { id: "account.nothing", value: "?" },
  } });
  let w = h.start(doc);
  const v = h.view(w);
  assert.equal(v.username, "grace");
  assert.equal(v.twoFactor, true);
  // A row the setting would refuse (the wrong type, too long) is ignored: the sample shows.
  assert.equal(v.firstName, "Stephanie");
  assert.equal(v.email, "stephanie_nicol@mail.com");
  w = h.set(w, "username", "ada");
  assert.equal(h.view(w).username, "ada");
  // Typing what the doc holds drops the draft.
  w = h.set(w, "username", "grace");
  assert.deepEqual(w.state.drafts, {});
});

test("a draft the setting refuses stays a draft and is not written", () => {
  let w = h.set(h.start(), "username", "x".repeat(65));
  w = h.press(w, "save.basic");
  assert.deepEqual(w.saved, []);
  assert.equal(h.view(w).username.length, 65);
});

test("the mutation refuses what it does not expect", () => {
  for (const args of [{ key: "account.username", value: 5 }, { key: "account.twoFactor", value: "yes" }, { key: "account.currentPw", value: "x" }, { key: "account.password", value: "x" }, { key: "account.username" }, { key: "account.username", value: "a", extra: 1 }]) {
    assert.equal(writesOf("settings.set", args), null, JSON.stringify(args));
  }
  assert.ok(writesOf("settings.set", { key: "account.username", value: "ada" }));
});

test("without extras (stock mode) the fields behave as before: set changes the field, Save and commit do nothing, nothing is saved", () => {
  let w = stock.start();
  w = stock.set(w, "username", "ada");
  w = stock.set(w, "dataExport", true);
  assert.equal(stock.view(w).username, "ada");
  assert.equal(stock.view(w).dataExport, true);
  const before = w;
  w = stock.press(w, "save.basic");
  w = stock.press(w, "save.advanced");
  w = stock.press(w, "commit:username");
  assert.equal(w, before);
  assert.deepEqual(w.saved, []);
  assert.deepEqual(stock.view(w).inert, ["save.basic", "save.password", "save.advanced"]);
  // Saved rows are not read in stock mode.
  const withRows = stock.start(readDoc({ settings_value: { "account.username": { id: "account.username", value: "grace" } } }));
  assert.equal(stock.view(withRows).username, "nicol43");
});

test("through the client: Save reaches the host as a settings.set mutation, and a reload shows the saved value", () => {
  const c = createClient(() => NOW, { screen: "t.settings", seed: "dev1" });
  const saves: { name: string; args: Record<string, unknown> }[] = [];
  let kept: unknown;
  c.onSave((m, d) => { saves.push(...m); kept = d; });
  c.dispatch({ type: "set", id: "tpl.settings.username", value: "ada" });
  assert.deepEqual(saves, []);
  c.dispatch({ type: "press", id: "tpl.settings.save.basic" });
  assert.deepEqual(saves, [{ name: "settings.set", args: { key: "account.username", value: "ada" } }]);
  const body = (x: typeof c) => (x.getSnapshot("app") as AppSnapshot).screen.body as unknown as { view: { username: string } };
  const again = createClient(() => NOW, { screen: "t.settings", seed: "dev1", doc: kept });
  assert.equal(body(again).view.username, "ada");
  const stockClient = createClient(() => NOW, { screen: "t.settings", extras: false, doc: kept });
  assert.equal(body(stockClient).view.username, "nicol43");
});
