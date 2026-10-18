import { test } from "node:test";
import assert from "node:assert/strict";
import { order } from "../../src/templates/order/model.ts";

const NOW = { epochMs: Date.UTC(2026, 9, 13, 16, 30), utcOffsetMinutes: -420 };
const start = () => order.initial(NOW);
const view = (s: ReturnType<typeof start>) => order.view(s, NOW);
const press = (s: ReturnType<typeof start>, id: string) => order.reduce(s, { type: "press", id }, NOW);
const set = (s: ReturnType<typeof start>, id: string, value: string | number | boolean) => order.reduce(s, { type: "set", id, value }, NOW);

test("starts on Details with the side panel shown and the dialog closed", () => {
  const v = view(start());
  assert.deepEqual([v.tab, v.sidePanel, v.panelDialog], ["details", true, false]);
  assert.equal(v.number, "#1001");
  assert.equal(v.itemCount, 5);
  assert.deepEqual(v.products.map((p) => p.name), ["Solstice Mug", "Ember Bowl", "Terra Cup", "Dawn Plate Set", "Kiln Salad Bowl"]);
});

test("amounts are worked out as the stock page does", () => {
  const v = view(start());
  assert.deepEqual(v.products.map((p) => [p.amount, p.unit]), [
    ["$89.00", ["$89.00", " ", "×", " ", 1]],
    ["$84.00", ["$42.00", " ", "×", " ", 2]],
    ["$65.00", ["$65.00", " ", "×", " ", 1]],
    ["$102.00", ["$34.00", " ", "×", " ", 3]],
    ["$78.00", ["$78.00", " ", "×", " ", 1]],
  ]);
  assert.deepEqual(v.summary.map((r) => [r.label, r.note, r.amount, r.strong]), [
    ["Subtotal", [5, " items"], "$418.00", false],
    ["Discount", ["New customer code: NEW15"], "– $15.00", false],
    ["Shipping", ["Free shipping (0.0lbs) USPS"], "$0.00", false],
    ["Tax", ["Sales tax (8.25%)"], "$33.25", false],
    ["Total", null, "$436.25", true],
  ]);
  assert.deepEqual(v.paidBy, { label: "Paid by customer", note: "Visa ...7482", amount: "$436.25" });
});

test("product lines split on the newline", () => {
  assert.deepEqual(view(start()).products[0]!.lines, ["Glaze: Snow", "Finish: Matte"]);
});

test("activity keeps changes and reactions only where the stock data has them", () => {
  const a = view(start()).activity;
  assert.deepEqual(a.map((x) => x.reactions), [2, 3, null, 1]);
  assert.deepEqual(a.map((x) => x.changes), [null, null, ["Payment verified via Visa ...7482", "Fraud check passed — low risk"], null]);
});

test("tabs: a known one is selected, an unknown one is ignored", () => {
  let s = set(start(), "tab", "timeline");
  assert.equal(view(s).tab, "timeline");
  s = set(s, "tab", "customer");
  assert.equal(view(s).tab, "customer");
  assert.equal(set(s, "tab", "nope"), s);
});

test("the side panel toggles on its own flag", () => {
  const s = press(start(), "panel:side");
  assert.deepEqual([view(s).sidePanel, view(s).panelDialog], [false, false]);
  assert.equal(view(press(s, "panel:side")).sidePanel, true);
});

test("the dialog toggles on its own flag and follows set", () => {
  let s = press(start(), "panel:dialog");
  assert.deepEqual([view(s).sidePanel, view(s).panelDialog], [true, true]);
  s = set(s, "panelDialog", false);
  assert.equal(view(s).panelDialog, false);
  assert.equal(set(s, "panelDialog", false), s);
  assert.equal(view(set(s, "panelDialog", true)).panelDialog, true);
});

test("unknown actions change nothing, and the view is plain JSON", () => {
  const s = start();
  assert.equal(press(s, "nope"), s);
  assert.equal(set(s, "nope", 1), s);
  assert.deepEqual(JSON.parse(JSON.stringify(view(s))), view(s));
});

test("the view says which controls are inert, and carries tabs, labels and the native words", () => {
  const v = view(start());
  assert.ok(v.inert.includes("refund") && v.inert.includes("like") && v.inert.includes("allOrders"));
  assert.deepEqual(v.tabs.map((t) => [t.value, t.label, t.more]), [
    ["details", "Details", false], ["invoices", "Invoices", false], ["timeline", "Timeline", false],
    ["customer", "Customer", true], ["analysis", "Analysis", true],
  ]);
  assert.equal(v.itemsLabel, "5 ordered items");
  assert.deepEqual(v.activity.map((a) => a.reactionsLabel), ["2 reactions", "3 reactions", "Reactions", "1 reaction"]);
  assert.equal(v.fraud.riskValue, "15 percent");
  assert.equal(v.words.panelTitle, "Order details");
});
