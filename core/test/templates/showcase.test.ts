import { test } from "node:test";
import assert from "node:assert/strict";
import { showcase } from "../../src/templates/showcase/model.ts";

const NOW = { epochMs: Date.UTC(2026, 9, 13, 16, 30), utcOffsetMinutes: -420 };
const start = () => showcase.initial(NOW);
const view = (s: ReturnType<typeof start>) => showcase.view(s, NOW);

test("the nav, hero and three products are the stock sample data", () => {
  const v = view(start());
  assert.equal(v.nav.heading, "Studio");
  assert.deepEqual(v.nav.items.map((i) => [i.label, i.isSelected]), [["Shop", true], ["New In", false], ["Stories", false], ["Help", false]]);
  assert.deepEqual(v.nav.actions.map((a) => a.label), ["Search", "Account", "Cart"]);
  assert.deepEqual(v.hero.lines, ["Little joys,", "everywhere you go"]);
  assert.deepEqual(v.products.map((p) => [p.name, p.badge, p.badgeVariant]), [
    ["Minimalist Watch", "New", "blue"],
    ["Wireless Headphones", "Popular", "green"],
    ["Canvas Backpack", "Limited", "yellow"],
  ]);
  assert.ok(v.products.every((p) => p.image.startsWith("data:image/svg+xml,") && p.quantity.value === 1 && p.quantity.min === 1 && p.quantity.max === 99));
});

test("the checkout form starts empty, on Economy shipping, paying by card, in the United States", () => {
  const c = view(start()).checkout;
  assert.equal(c.email.value, "");
  assert.equal(c.shipping.value, "economy");
  assert.deepEqual(c.shipping.options.map((o) => o.price), ["$12.00", "$16.00", "$24.00"]);
  assert.deepEqual(c.payment.options.map((o) => [o.text, o.isSelected]), [["Card", true], ["Apple Pay", false], ["Google Pay", false]]);
  assert.equal(c.country.value, "us");
  assert.equal(c.country.options.length, 6);
  assert.equal(c.saveInfo.value, true);
  assert.equal(c.payLabel, "Pay now");
});

test("the chat shows five lines and the order details, with a link, an amount and a badge", () => {
  const chat = view(start()).chat;
  assert.deepEqual(chat.messages.map((m) => m.kind), ["system", "user", "assistant", "user", "assistant"]);
  const details = chat.messages.flatMap((m) => (m.kind === "assistant" && m.details ? m.details : []));
  assert.deepEqual(details.map((d) => d.end.kind), ["amount", "amount", "badge", "link"]);
  assert.deepEqual(chat.suggestions, ["Reschedule delivery", "Update shipping address", "Start a return"]);
});

test("revenue amounts are signed and grouped, and a refund is muted", () => {
  const r = view(start()).revenue;
  assert.deepEqual(r.items.map((i) => i.amount), ["+$248", "−$89", "+$156", "+$412", "+$95"]);
  assert.deepEqual(r.items.map((i) => i.isMuted), [false, true, false, false, false]);
  assert.deepEqual(r.kpis.map((k) => k.value), ["18K", "+12%"]);
  const big = showcase.initial(NOW);
  big.activity[0]!.amount = 1234567;
  assert.equal(view(big).revenue.items[0]!.amount, "+$1,234,567");
});

test("the inventory warns about the two items under 25 in stock", () => {
  const inv = view(start()).inventory;
  assert.equal(inv.banner, "2 items are running low");
  assert.equal(inv.rows.length, 6);
  assert.deepEqual(inv.rows.filter((r) => r.selected).map((r) => r.name), ["Wireless Headphones", "Leather Wallet", "Linen Throw"]);
  assert.equal(inv.rows[0]!.selectLabel, "Select Minimalist Watch");
  assert.deepEqual(inv.columns, { select: "", item: "Item", available: "Available", location: "Location", tags: "Tags", actions: "" });
  assert.deepEqual(inv.rowMenu.map((m) => ("divider" in m ? "-" : m.label)), ["Edit", "Duplicate", "Move to…", "-", "Delete"]);
  assert.deepEqual(inv.filters.map((f) => f.options.length), [5, 6, 6]);
});

test("the banner follows the stock counts: none when nothing is low", () => {
  const s = start();
  for (const row of s.inventory) row.available = 100;
  assert.equal(view(s).inventory.banner, null);
  s.inventory[0]!.available = 1;
  assert.equal(view(s).inventory.banner, "1 items are running low");
});

test("typing, picking and checking change nothing, as in the stock template", () => {
  const s = start();
  for (const id of ["email", "shipping", "payment", "card", "expiry", "cvc", "country", "saveInfo", "search", "chatDraft", "select.a", "filter.Tags"]) {
    assert.equal(showcase.reduce(s, { type: "set", id, value: "x" }, NOW), s);
  }
  assert.equal(showcase.reduce(s, { type: "press", id: "chatSend" }, NOW), s);
  assert.deepEqual(view(s), view(start()));
});

test("the view is plain JSON", () => {
  const v = view(start());
  assert.deepEqual(JSON.parse(JSON.stringify(v)), v);
});
