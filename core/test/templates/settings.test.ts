import { test } from "node:test";
import assert from "node:assert/strict";
import { settings } from "../../src/templates/settings/model.ts";

const NOW = { epochMs: Date.UTC(2026, 9, 13, 16, 30), utcOffsetMinutes: -420 };
const start = () => settings.initial(NOW);
const view = (s: ReturnType<typeof start>) => settings.view(s, NOW);

test("starts on Profile with the stock sample data", () => {
  const v = view(start());
  assert.deepEqual(v.navItems.map((n) => n.label), ["Profile", "Account", "Members", "Billing", "Invoices", "API"]);
  assert.deepEqual(v.navItems.filter((n) => n.isSelected).map((n) => n.label), ["Profile"]);
  assert.equal(v.username, "nicol43");
  assert.equal(v.email, "stephanie_nicol@mail.com");
  assert.equal(v.newPw, "password123");
  assert.equal(v.dataExport, false);
  assert.equal(v.search, null);
  assert.equal(v.searchItems.length, 8);
});

test("pressing a nav item selects it; an unknown one is ignored", () => {
  const a = settings.reduce(start(), { type: "press", id: "nav:Billing" }, NOW);
  assert.deepEqual(view(a).navItems.filter((n) => n.isSelected).map((n) => n.label), ["Billing"]);
  assert.equal(settings.reduce(a, { type: "press", id: "nav:Nope" }, NOW), a);
});

test("text fields are set on every change", () => {
  let s = start();
  s = settings.reduce(s, { type: "set", id: "username", value: "ada" }, NOW);
  s = settings.reduce(s, { type: "set", id: "confirmPw", value: "x" }, NOW);
  const v = view(s);
  assert.equal(v.username, "ada");
  assert.equal(v.confirmPw, "x");
  assert.equal(v.currentPw, "password123");
});

test("checkboxes toggle independently", () => {
  let s = start();
  s = settings.reduce(s, { type: "set", id: "twoFactor", value: true }, NOW);
  const v = view(s);
  assert.deepEqual([v.dataExport, v.adminMembers, v.twoFactor], [false, false, true]);
  assert.equal(view(settings.reduce(s, { type: "set", id: "twoFactor", value: false }, NOW)).twoFactor, false);
});

test("search keeps the chosen result and clears on an empty value", () => {
  let s = settings.reduce(start(), { type: "set", id: "search", value: "4" }, NOW);
  assert.deepEqual(view(s).search, { id: "4", label: "Email address" });
  s = settings.reduce(s, { type: "set", id: "search", value: "" }, NOW);
  assert.equal(view(s).search, null);
});

test("the view is plain JSON", () => {
  const v = view(start());
  assert.deepEqual(JSON.parse(JSON.stringify(v)), v);
});

test("the view says which controls are inert, and carries the native words", () => {
  const v = view(start());
  assert.deepEqual(v.inert, ["save.basic", "save.password", "save.advanced"]);
  assert.equal(v.words.save, "Save");
  assert.equal(v.words.password.current, "Verify current password");
  assert.equal(v.words.done, "Done");
});
