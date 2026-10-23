import { test } from "node:test";
import assert from "node:assert/strict";
import { order, type OrderState } from "../../src/templates/order/model.ts";
import { applyWrites, emptyDoc, type Doc } from "../../src/sync/doc.ts";
import { writesOf } from "../../src/sync/mutations.ts";
import { harness, type World } from "./harness.ts";

const NOW = { epochMs: Date.UTC(2026, 9, 13, 16, 30), utcOffsetMinutes: -420 };
// The harness runs the template as the core does: view state, the saved doc, the mutations asked for.
const run = harness(order, NOW);
const stock = harness(order, NOW, false);
type W = World<OrderState>;
const start = () => run.start();
const view = (w: W) => run.view(w);
const press = (w: W, id: string) => run.press(w, id);
const set = (w: W, id: string, value: string | number | boolean) => run.set(w, id, value);

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
  const v = stock.view(stock.start());
  assert.deepEqual(v.inert, ["allOrders", "restock", "edit", "seeAll", "fulfill", "label", "refund", "invoice", "filters", "like", "reply"]);
  // With saving on, Fulfill item, Like and Reply work; the rest has no backend and stays inert.
  assert.deepEqual(view(start()).inert, ["allOrders", "restock", "edit", "seeAll", "label", "refund", "invoice", "filters"]);
  assert.deepEqual(v.tabs.map((t) => [t.value, t.label, t.more]), [
    ["details", "Details", false], ["invoices", "Invoices", false], ["timeline", "Timeline", false],
    ["customer", "Customer", true], ["analysis", "Analysis", true],
  ]);
  assert.equal(v.itemsLabel, "5 ordered items");
  assert.equal(v.itemsLabelParts.join(""), v.itemsLabel);
  assert.deepEqual(v.activity.map((a) => a.reactionsLabel), ["2 reactions", "3 reactions", "Reactions", "1 reaction"]);
  assert.equal(v.fraud.riskValue, "15 percent");
  assert.equal(v.words.panelTitle, "Order details");
});

test("the rules carry the layout numbers the stock page keeps, and the web words are the stock page's", async () => {
  const { readFileSync } = await import("node:fs");
  const flat = readFileSync(new URL("../../../web/src/stock/templates/detail-page.tsx", import.meta.url), "utf8").replace(/\s+/g, " ");
  const v = view(start());
  assert.ok(flat.includes(`useMediaQuery('(max-width: ${v.rules.viewportNarrowAtMost}px)')`));
  assert.ok(flat.includes(`contentWidth={${v.rules.contentWidth}}`));
  assert.ok(flat.includes(`width={${v.rules.panelWidth}}`));
  // A drawing that measures its pane goes narrow where the page and the panel no longer fit together.
  assert.ok(v.rules.paneNarrowBelow < v.rules.viewportNarrowAtMost);

  const w = v.words;
  const drawn = [
    w.allOrders, w.restock, w.edit, w.seeAll, w.showPanel, w.hidePanel, w.more, w.panelTitle, w.items, w.fulfillItem,
    w.createLabel, w.invoice, w.paid, w.refund, w.sendInvoice, w.timeline, w.filters, w.like, w.reply, w.notes, w.showMore,
    w.customer, w.fraudAnalysis, w.riskLevel, ...v.tabs.map((t) => t.label),
  ];
  for (const word of drawn) assert.ok(flat.includes(word), `the stock page does not write "${word}"`);
  assert.ok(flat.includes("ordered items"));
});

// --- Saved data (docs/SYNC.md) -------------------------------------------------------------------

const docWith = (tables: Record<string, Record<string, Record<string, string | number | boolean>>>): Doc => {
  const doc = emptyDoc() as unknown as Record<string, Record<string, unknown>>;
  for (const [t, rows] of Object.entries(tables)) for (const [id, row] of Object.entries(rows)) doc[t]![id] = { id, ...row };
  return doc as unknown as Doc;
};
const later = (minutes: number) => ({ epochMs: NOW.epochMs + minutes * 60_000, utcOffsetMinutes: NOW.utcOffsetMinutes });

test("the notes are a text area with Save: the draft is view state, Save keeps it", () => {
  let w = start();
  const sample = view(w).notes;
  assert.deepEqual(view(w).notesEditor, { value: sample, canSave: false, maxLength: 2000 });
  w = set(w, "notes", "Wrap in kraft paper.");
  assert.deepEqual(view(w).notesEditor, { value: "Wrap in kraft paper.", canSave: true, maxLength: 2000 });
  assert.equal(view(w).notes, sample, "the saved notes are unchanged until Save");
  assert.deepEqual(w.saved, []);
  w = press(w, "notesSave");
  assert.deepEqual(w.saved, [{ name: "order.note", args: { text: "Wrap in kraft paper.", at: NOW.epochMs } }]);
  assert.equal(view(w).notes, "Wrap in kraft paper.");
  assert.deepEqual(view(w).notesEditor, { value: "Wrap in kraft paper.", canSave: false, maxLength: 2000 });
  // Saving without a change, or with no draft, saves nothing.
  assert.equal(press(w, "notesSave"), w);
  const same = press(set(w, "notes", "Wrap in kraft paper."), "notesSave");
  assert.equal(same.saved.length, 1);
  // A relaunch over the same doc draws the saved notes.
  assert.equal(view({ ...start(), doc: w.doc }).notes, "Wrap in kraft paper.");
  // Notes may be cleared.
  assert.equal(view(press(set(w, "notes", ""), "notesSave")).notes, "");
});

test("Fulfill item marks the next item fulfilled, and the status words follow", () => {
  let w = start();
  assert.deepEqual([view(w).status, view(w).statusVariant], ["Unfulfilled", "warning"]);
  w = press(w, "fulfill");
  assert.deepEqual(w.saved, [{ name: "order.fulfill", args: { id: "solstice-mug", at: NOW.epochMs } }]);
  assert.deepEqual(view(w).products.map((p) => p.fulfilled), [true, false, false, false, false]);
  assert.deepEqual([view(w).status, view(w).statusVariant], ["Partially fulfilled", "warning"]);
  for (let i = 0; i < 4; i++) w = press(w, "fulfill");
  assert.deepEqual(view(w).products.map((p) => p.fulfilled), [true, true, true, true, true]);
  assert.deepEqual([view(w).status, view(w).statusVariant], ["Fulfilled", "success"]);
  assert.ok(view(w).inert.includes("fulfill"), "nothing is left to fulfill");
  assert.equal(press(w, "fulfill"), w);
  assert.equal(w.saved.length, 5);
  // The items' other words are untouched.
  assert.equal(view(w).itemsLabel, "5 ordered items");
  assert.equal(view({ ...start(), doc: w.doc }).status, "Fulfilled");
});

test("a like toggles, and the reaction count follows", () => {
  let w = start();
  assert.deepEqual(view(w).activity.map((a) => [a.id, a.liked, a.reactions]), [["a1", false, 2], ["a2", false, 3], ["a3", false, null], ["a4", false, 1]]);
  w = press(press(w, "like:a2"), "like:a3");
  assert.deepEqual(w.saved.map((m) => [m.name, m.args]), [["order.like", { id: "a2", liked: true }], ["order.like", { id: "a3", liked: true }]]);
  assert.deepEqual(view(w).activity.map((a) => [a.liked, a.reactions, a.reactionsLabel]), [
    [false, 2, "2 reactions"], [true, 4, "4 reactions"], [true, 1, "1 reaction"], [false, 1, "1 reaction"],
  ]);
  w = press(w, "like:a3");
  assert.deepEqual(w.saved.at(-1), { name: "order.like", args: { id: "a3", liked: false } });
  assert.deepEqual([view(w).activity[2]!.liked, view(w).activity[2]!.reactions, view(w).activity[2]!.reactionsLabel], [false, null, "Reactions"]);
  assert.equal(press(w, "like:nope"), w);
});

test("a reply is written, sent, and drawn under its entry with the time it was sent", () => {
  let w = start();
  w = press(w, "reply:a2");
  assert.deepEqual(view(w).activity[1]!.composer, { value: "", canSend: false, maxLength: 500 });
  assert.equal(view(w).activity[0]!.composer, null);
  assert.equal(press(w, "replySend"), w, "an empty reply is not sent");
  w = set(w, "replyText", "  Done, thanks!  ");
  assert.deepEqual(view(w).activity[1]!.composer, { value: "  Done, thanks!  ", canSend: true, maxLength: 500 });
  w = press(w, "replySend");
  assert.deepEqual(w.saved, [{ name: "order.reply", args: { id: "dev-1", item: "a2", text: "Done, thanks!", at: NOW.epochMs } }]);
  assert.equal(view(w).activity[1]!.composer, null);
  assert.deepEqual(view(w).activity[1]!.replies, [{ id: "dev-1", user: "You", text: "Done, thanks!", time: "just now" }]);
  assert.deepEqual(run.view(w, later(5)).activity[1]!.replies[0]!.time, "5m ago");
  assert.deepEqual(run.view(w, later(180)).activity[1]!.replies[0]!.time, "3h ago");
  // A second reply goes after the first; cancelling and toggling close the box without sending.
  w = press(set(press(w, "reply:a2"), "replyText", "Second"), "replySend");
  assert.deepEqual(view(w).activity[1]!.replies.map((r) => r.text), ["Done, thanks!", "Second"]);
  const opened = press(w, "reply:a4");
  assert.equal(view(press(opened, "replyCancel")).activity[3]!.composer, null);
  assert.equal(view(press(opened, "reply:a4")).activity[3]!.composer, null);
  assert.equal(view(press(opened, "reply:a1")).activity[3]!.composer, null);
  assert.equal(press(w, "reply:nope"), w);
  assert.equal(set(w, "replyText", "stray"), w, "no box is open");
});

test("without extras (stock's behaviour) nothing new works or is drawn", () => {
  const s = stock.start();
  const v = stock.view(s);
  assert.equal(v.notesEditor, null);
  assert.deepEqual([v.status, v.statusVariant], ["Unfulfilled", "warning"]);
  for (const id of ["fulfill", "like:a1", "reply:a1", "notesSave", "replySend", "replyCancel"]) assert.equal(stock.press(s, id), s, id);
  assert.equal(stock.set(s, "notes", "x"), s);
  assert.equal(stock.set(s, "replyText", "x"), s);
  // Rows from a doc are not drawn: the screen is stock's.
  const doc = docWith({ order_item: { "solstice-mug": { fulfilledAt: 1 } }, order_like: { a1: { liked: true } }, order_note: { notes: { text: "x", editedAt: 1 } } });
  const drawn = stock.view({ ...stock.start(), doc });
  assert.equal(drawn.status, "Unfulfilled");
  assert.equal(drawn.activity[0]!.reactions, 2);
  assert.notEqual(drawn.notes, "x");
  // And the stock view carries the stock facts: nothing fulfilled, nobody liked, no replies.
  assert.ok(v.products.every((p) => !p.fulfilled) && v.activity.every((a) => !a.liked && a.replies.length === 0 && a.composer === null));
});

test("rows from another device are drawn, and malformed rows are ignored", () => {
  const doc = docWith({
    order_note: { notes: { text: "From the phone", editedAt: 5 } },
    order_item: { "ember-bowl": { fulfilledAt: 9 }, "no-such-item": { fulfilledAt: 9 }, "terra-cup": { fulfilledAt: "soon" } },
    order_like: { a4: { liked: true }, a9: { liked: true } },
    order_reply: {
      r2: { item: "a1", text: "Second", at: NOW.epochMs - 60_000 },
      r1: { item: "a1", text: "First", at: NOW.epochMs - 120_000 },
      bad1: { item: "a9", text: "Nowhere", at: 1 },
      bad2: { item: "a1", text: "   ", at: 1 },
      bad3: { item: "a1", text: "No time" },
    },
  });
  const v = view({ ...start(), doc });
  assert.equal(v.notes, "From the phone");
  assert.deepEqual(v.products.map((p) => p.fulfilled), [false, true, false, false, false]);
  assert.equal(v.status, "Partially fulfilled");
  assert.deepEqual(v.activity.map((a) => a.liked), [false, false, false, true]);
  assert.deepEqual(v.activity[0]!.replies.map((r) => [r.text, r.time]), [["First", "2m ago"], ["Second", "1m ago"]]);
  assert.deepEqual(JSON.parse(JSON.stringify(v)), v);
});

test("mutations refuse what they do not expect", () => {
  const refused = (name: string, args: unknown) => assert.equal(writesOf(name, args), null, `${name} ${JSON.stringify(args)}`);
  refused("order.note", { text: "x".repeat(2001), at: 1 });
  refused("order.note", { text: "x", at: 0 });
  refused("order.note", { text: "x", at: 1, extra: 1 });
  refused("order.fulfill", { id: "gold-bar", at: 1 });
  refused("order.like", { id: "a1", liked: "yes" });
  refused("order.like", { id: "a5", liked: true });
  refused("order.reply", { id: "r1", item: "a1", text: "   ", at: 1 });
  refused("order.reply", { id: "r1", item: "a1", text: "x".repeat(501), at: 1 });
  refused("order.reply", { id: "bad id", item: "a1", text: "x", at: 1 });
  refused("order.reply", { id: "r1", item: "a7", text: "x", at: 1 });
  const doc = applyWrites(emptyDoc(), writesOf("order.reply", { id: "r1", item: "a1", text: " hi ", at: 7 })!);
  assert.deepEqual(doc.order_reply.r1, { id: "r1", item: "a1", text: "hi", at: 7 });
});
