import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient, type AppSnapshot, type Doc, type Mutation, type Now } from "../src/index.ts";
import { between, spread, isOrderKey } from "../src/sync/order.ts";
import { applyWrites, emptyDoc, overlay, readDoc } from "../src/sync/doc.ts";
import { writesOf } from "../src/sync/mutations.ts";
import { SCENARIOS } from "../src/scenarios.generated.ts";

const NOW: Now = { epochMs: Date.UTC(2026, 9, 13, 16, 30), utcOffsetMinutes: -420 };
const clock = () => NOW;

type Board = { columns: { id: string; cards: { id: string; title: string }[] }[] };
const board = (c: ReturnType<typeof createClient>) => {
  const s = c.getSnapshot("app") as AppSnapshot;
  assert.equal(s.screen.body.kind, "template");
  return (s.screen.body as { view: Board }).view;
};
const column = (c: ReturnType<typeof createClient>, id: string) => board(c).columns.find((x) => x.id === id)!.cards.map((x) => x.id);

function recording(start: Parameters<typeof createClient>[1] = {}) {
  const c = createClient(clock, { screen: "t.kanban", ...start });
  const saves: { mutations: readonly Mutation[]; doc: Doc }[] = [];
  c.onSave((mutations, doc) => saves.push({ mutations, doc }));
  return { c, saves };
}

test("order keys sort as their positions, and there is always room between two", () => {
  const keys = spread(7);
  assert.deepEqual([...keys].sort(), keys);
  let lo = keys[0]!, hi = keys[1]!;
  for (let i = 0; i < 200; i++) {
    const mid = between(lo, hi);
    assert.ok(lo < mid && mid < hi, `${lo} < ${mid} < ${hi}`);
    assert.ok(isOrderKey(mid));
    if (i % 2) lo = mid; else hi = mid;
  }
  assert.ok(between(null, "1") < "1");
  assert.throws(() => between("b", "a"));
});

test("a change to saved data reaches the host once, with the mutations and the doc after them", () => {
  const { c, saves } = recording();
  c.dispatch({ type: "press", id: "tpl.kanban.move:t1:done" });
  assert.equal(saves.length, 1);
  assert.deepEqual(saves[0]!.mutations.map((m) => m.name), ["kanban.place"]);
  assert.equal(saves[0]!.doc.kanban_card.t1!.column, "done");
  // A view-only change saves nothing.
  c.dispatch({ type: "set", id: "tpl.kanban.sprint", value: "002" });
  assert.equal(saves.length, 1);
});

test("the doc a host kept is read back at start, and only its known tables and columns", () => {
  const { c } = recording({ doc: { kanban_card: { t1: { id: "t1", column: "done", order: "zz", bogus: "x" } }, nope: { a: { id: "a" } } } });
  assert.deepEqual(column(c, "done"), ["r1", "r2", "r3", "t1"]);
  assert.deepEqual(readDoc({ kanban_card: { t1: { id: "t1", column: 5 } } }).kanban_card.t1, { id: "t1" });
  assert.deepEqual(readDoc("garbage"), emptyDoc());
});

test("new records get ids from the host's seed", () => {
  const { c, saves } = recording({ seed: "dev123" });
  c.dispatch({ type: "press", id: "tpl.kanban.addTask" });
  c.dispatch({ type: "set", id: "tpl.kanban.newTitle", value: "Seeded" });
  c.dispatch({ type: "press", id: "tpl.kanban.addTaskCreate" });
  assert.equal(saves[0]!.mutations[0]!.args.id, "dev123-1");
  assert.equal(column(c, "todo")[0], "dev123-1");
});

test("rows from a sync source replace that table, and are checked", () => {
  const { c, saves } = recording();
  c.dispatch({ type: "rows", table: "kanban_card", rows: [{ id: "r1", column: "todo", order: "0a" }, { id: 7 }, "x"] });
  assert.deepEqual(column(c, "todo"), ["r1", "t1", "t2"]);
  c.dispatch({ type: "rows", table: "kanban_card", rows: [] });
  assert.deepEqual(column(c, "todo"), ["t1", "t2"]);
  c.dispatch({ type: "rows", table: "no_such_table", rows: [{ id: "a" }] });
  assert.equal(saves.length, 0, "rows from the source are not sent back");
});

test("a scenario plays on a scratch copy: it starts from the sample data and leaves saved work alone", () => {
  const scenario = SCENARIOS.find((s) => s.template === "kanban")!;
  const { c, saves } = recording();
  c.dispatch({ type: "press", id: "tpl.kanban.move:t1:done" });
  assert.equal(saves.length, 1);
  c.dispatch({ type: "press", id: `scenario.start:${scenario.id}:native` });
  assert.deepEqual(column(c, "todo"), ["t1", "t2"], "the scenario starts from the sample board");
  c.dispatch({ type: "press", id: "tpl.kanban.move:t2:done" });
  assert.equal(saves.length, 1, "nothing a scenario does is saved");
  // A sync source's rows during playback land in the set-aside copy.
  c.dispatch({ type: "rows", table: "kanban_card", rows: [{ id: "t1", column: "in-review", order: "zz" }] });
  c.dispatch({ type: "press", id: "scenario.stop" });
  assert.deepEqual(column(c, "in-review"), ["t1"]);
  assert.deepEqual(column(c, "done"), ["r1", "r2", "r3"]);
});

test("with stock behaviour only, nothing is saved or read back, and moves still happen in memory", () => {
  const { c, saves } = recording({ extras: false, doc: { kanban_card: { t1: { id: "t1", column: "done", order: "zz" } } } });
  assert.deepEqual(column(c, "todo"), ["t1", "t2"]);
  c.dispatch({ type: "press", id: "tpl.kanban.move:t1:done" });
  assert.deepEqual(column(c, "done"), ["t1", "r1", "r2", "r3"]);
  c.dispatch({ type: "rows", table: "kanban_card", rows: [] });
  assert.deepEqual(column(c, "done"), ["t1", "r1", "r2", "r3"]);
  assert.equal(saves.length, 0);
});

test("every mutation refuses arguments it does not expect", () => {
  assert.equal(writesOf("kanban.place", { id: "t1", column: "done", order: "a", at: 1, extra: 1 }), null);
  assert.equal(writesOf("kanban.place", { id: "../x", column: "done", order: "a", at: 1 }), null);
  assert.equal(writesOf("kanban.place", { id: "t1", column: "done", order: "a0", at: 1 }), null, "an order key never ends in 0");
  assert.equal(writesOf("kanban.add", { id: "n1", column: "todo", order: "a", title: "   ", ref: "Task 1", priority: "medium", at: 1 }), null);
  assert.equal(writesOf("settings.set", { key: "account.twoFactor", value: "yes" }), null);
  assert.equal(writesOf("settings.set", { key: "account.password", value: "x" }), null, "passwords are never saved");
  assert.equal(writesOf("nope", {}), null);
  assert.throws(() => applyWrites(emptyDoc(), [{ table: "kanban_card", id: "a", fields: { nope: 1 } }]));
});

test("overlay keeps sample order, applies saved fields, hides deleted rows and adds new ones", () => {
  const sample = [{ id: "a", n: 1 }, { id: "b", n: 2 }];
  const out = overlay(sample, { b: { id: "b", n: 5 }, a: { id: "a", deleted: true }, c: { id: "c", n: 9 } }, (r) => ({ id: r.id, n: Number(r.n) }));
  assert.deepEqual(out, [{ id: "b", n: 5 }, { id: "c", n: 9 }]);
});
