import { test } from "node:test";
import assert from "node:assert/strict";
import { invoice } from "../../src/templates/invoice/model.ts";

const NOW = { epochMs: Date.UTC(2026, 9, 13, 16, 30), utcOffsetMinutes: -420 };
type S = ReturnType<typeof start>;
const start = () => invoice.initial(NOW);
const view = (s: S) => invoice.view(s, NOW);
const press = (s: S, id: string) => invoice.reduce(s, { type: "press", id }, NOW);
const set = (s: S, id: string, value: string | number | boolean) => invoice.reduce(s, { type: "set", id, value }, NOW);
const names = (s: S) => view(s).rows.map((r) => r.description);

test("starts with the stock invoice: 19 lines in order, totals, no banner", () => {
  const v = view(start());
  assert.equal(v.title, "Invoice INV-2043");
  assert.equal(v.rows.length, 19);
  assert.equal(v.rows[0]!.id, "li-01");
  assert.equal(v.rows[18]!.id, "li-19");
  assert.deepEqual(v.details.map((d) => d.label), ["Billed to", "Project", "Issue date", "Due date", "Payment terms", "Purchase order"]);
  assert.deepEqual(v.totals.map((t) => [t.label, t.value, t.emphasis]), [
    ["Subtotal", "$101,512.00", null],
    ["Tax (8.75%)", "$8,882.30", "muted"],
    ["Total due", "$110,394.30", "strong"],
  ]);
  assert.equal(v.banner, null);
  assert.equal(v.empty, null);
  assert.deepEqual(v.sort, []);
});

test("rows are formatted: quantity, rate, amount and the hover card", () => {
  const r = view(start()).rows[8]!;
  assert.deepEqual(r, {
    id: "li-09",
    description: "Frontend build — page templates",
    category: "Development",
    quantity: "104",
    rate: "$165.00",
    amount: "$17,160.00",
    card: { category: "Development", billing: "Hourly", calculation: "104 × $165.00", amount: "$17,160.00", share: "16.9%" },
  });
  assert.equal(view(start()).rows[0]!.card.billing, "Fixed fee");
});

test("search matches descriptions without regard to case, ignoring outer spaces", () => {
  const s = set(start(), "query", "  WIREFRAMES ");
  assert.deepEqual(names(s), ["Wireframes — key templates"]);
  assert.equal(view(s).query, "  WIREFRAMES ");
});

test("the Hourly toggle drops the fixed-fee lines", () => {
  const s = set(start(), "basis", "hourly");
  assert.equal(view(s).rows.length, 13);
  assert.equal(view(s).basis, "hourly");
  assert.equal(set(s, "basis", "nope"), s);
  assert.equal(view(set(s, "basis", "all")).rows.length, 19);
});

test("a filter retotals the figures and mounts the banner", () => {
  const s = set(start(), "basis", "hourly");
  const v = view(s);
  assert.deepEqual(v.totals.map((t) => t.value), ["$76,080.00", "$6,657.00", "$82,737.00"]);
  assert.equal(v.banner?.title, "Filtered view — these totals are partial");
  assert.equal(v.banner?.description, "Showing 13 of 19 lines. The subtotal, tax, and total due above cover only the lines currently visible.");
});

test("column filters: description contains, category is, quantity equals", () => {
  assert.deepEqual(names(set(start(), "filter:description", "build")), ["Frontend build — component library", "Frontend build — page templates"]);
  assert.equal(view(set(start(), "filter:category", "content")).rows.length, 3);
  assert.deepEqual(names(set(start(), "filter:quantity", 24)), ["Cross-browser QA", "Stock photography licences"]);
  const s = set(set(start(), "filter:category", "design"), "filter:quantity", 1);
  assert.deepEqual(names(s), ["Discovery workshop", "Visual design system"]);
  assert.deepEqual(view(s).filters, { category: "design", quantity: 1 });
});

test("a column filter is replaced, cleared by unfilter, and bad values are ignored", () => {
  let s = set(start(), "filter:category", "design");
  s = set(s, "filter:category", "project");
  assert.equal(view(s).rows.length, 2);
  assert.equal(set(s, "filter:category", "nope"), s);
  assert.equal(set(s, "filter:nope", "x"), s);
  assert.equal(set(s, "filter:quantity", "x"), s);
  s = press(s, "unfilter:category");
  assert.deepEqual(view(s).filters, {});
  assert.equal(view(s).banner, null);
});

test("nothing left shows the empty state and no table or banner", () => {
  const s = set(start(), "query", "zzz");
  const v = view(s);
  assert.deepEqual(v.rows, []);
  assert.equal(v.empty?.title, "No matching line items");
  assert.equal(v.banner, null);
  assert.deepEqual(v.totals.map((t) => t.value), ["$0.00", "$0.00", "$0.00"]);
});

test("clear resets the search, the toggle and the column filters, but not the sort", () => {
  let s = set(start(), "query", "a");
  s = set(s, "basis", "hourly");
  s = set(s, "filter:category", "design");
  s = set(s, "sort", "amount:descending");
  s = press(s, "clear");
  const v = view(s);
  assert.deepEqual([v.query, v.basis, v.filters, v.rows.length], ["", "all", {}, 19]);
  assert.deepEqual(v.sort, [{ sortKey: "amount", direction: "descending" }]);
});

test("sorting by value: quantity, amount and rate", () => {
  assert.deepEqual(view(set(start(), "sort", "quantity:descending")).rows.slice(0, 3).map((r) => r.quantity), ["104", "88", "62"]);
  assert.equal(view(set(start(), "sort", "amount:ascending")).rows[0]!.description, "Stock photography licences");
  assert.equal(view(set(start(), "sort", "amount:descending")).rows[0]!.description, "Frontend build — page templates");
  assert.equal(view(set(start(), "sort", "unitPrice:ascending")).rows[0]!.rate, "$18.00");
});

test("sorting is stable, and an empty value clears it", () => {
  const byRate = view(set(start(), "sort", "unitPrice:ascending")).rows.map((r) => r.id);
  // Equal rates keep the invoice's own order.
  assert.deepEqual(byRate.slice(1, 8), ["li-16", "li-15", "li-14", "li-02", "li-03", "li-04", "li-06"]);
  const stable = view(set(start(), "sort", "category:ascending")).rows.map((r) => r.id);
  assert.deepEqual(stable.slice(0, 3), ["li-15", "li-16", "li-17"]);
  assert.deepEqual(view(set(set(start(), "sort", "category:ascending"), "sort", "")).rows.map((r) => r.id)[0], "li-01");
  assert.equal(set(start(), "sort", "nope:ascending").sort, null);
});

test("sorting follows the filter, and totals do not depend on the sort", () => {
  const a = view(set(set(start(), "basis", "hourly"), "sort", "description:ascending"));
  assert.equal(a.rows.length, 13);
  assert.equal(a.rows[0]!.description, "Analytics & tag manager setup");
  const b = view(set(start(), "sort", "description:descending"));
  assert.deepEqual(b.totals, view(start()).totals);
});

test("text sort agrees with localeCompare for every description and category", () => {
  const asc = (key: string) => view(set(start(), "sort", `${key}:ascending`)).rows;
  const desc = asc("description").map((r) => r.description);
  assert.deepEqual(desc, [...view(start()).rows.map((r) => r.description)].sort((a, b) => a.localeCompare(b)));
  const cats = asc("category").map((r) => r.category);
  assert.deepEqual(cats, [...cats].sort((a, b) => a.localeCompare(b)));
  const down = view(set(start(), "sort", "description:descending")).rows.map((r) => r.description);
  assert.deepEqual(down, [...desc].reverse());
});

test("the view is plain JSON", () => {
  const v = view(set(start(), "filter:category", "design"));
  assert.deepEqual(JSON.parse(JSON.stringify(v)), v);
});

test("the view carries the column titles and words, and lists the controls with no action as inert", () => {
  const v = invoice.view(invoice.initial(NOW), NOW);
  assert.deepEqual(v.columns.map((c) => [c.key, c.title, c.filter]), [
    ["description", "Description", "description"],
    ["category", "Category", "category"],
    ["quantity", "Qty", "quantity"],
    ["unitPrice", "Rate", null],
    ["amount", "Amount", null],
  ]);
  assert.equal(v.words.downloadPdf, "Download PDF");
  assert.deepEqual(v.inert, ["downloadPdf", "dispute"]);
});
