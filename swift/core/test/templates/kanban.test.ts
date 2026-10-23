import { test } from "node:test";
import assert from "node:assert/strict";
import { kanban } from "../../src/templates/kanban/model.ts";
import { harness, type World } from "./harness.ts";
import { emptyDoc } from "../../src/sync/doc.ts";

const NOW = { epochMs: Date.UTC(2026, 9, 13, 16, 30), utcOffsetMinutes: -420 };
const h = harness(kanban, NOW);
type W = World<ReturnType<typeof kanban.initial>>;
const start = () => h.start();
const view = (w: W) => h.view(w);
const titles = (w: W, column: string) => view(w).columns.find((c) => c.id === column)!.cards.map((c) => c.id);
const press = (w: W, id: string) => h.press(w, id);
const drop = (w: W, id: string, where: string) => h.set(w, `drop:${id}`, where);

test("starts with the stock sample data in four columns", () => {
  const v = view(start());
  assert.equal(v.title, "Sprint Board");
  assert.equal(v.total, 7);
  assert.equal(v.sprint, "003");
  assert.deepEqual(v.sprintOptions.map((o) => o.label), ["Sprint 003", "Sprint 002", "Sprint 001"]);
  assert.deepEqual(v.columns.map((c) => [c.id, c.title, c.count]), [
    ["todo", "To-do", 2],
    ["in-progress", "In progress", 2],
    ["in-review", "In review", 0],
    ["done", "Done", 3],
  ]);
  assert.deepEqual(titles(start(), "done"), ["r1", "r2", "r3"]);
  assert.equal(view(start()).adding, null);
});

test("a card has its words worked out", () => {
  const c = view(start()).columns[0]!.cards[0]!;
  assert.equal(c.ref, "Task 4821");
  assert.equal(c.priorityLabel, "Low");
  assert.equal(c.priorityVariant, "teal");
  assert.equal(c.title, "Draft project kickoff brief");
  assert.equal(c.edited, "2h ago");
  assert.equal(c.due, "Jul 8");
  assert.equal(c.meta, "Edited 2h ago · Due Jul 8");
  assert.deepEqual(c.moveTargets.map((t) => t.label), ["Move to In progress", "Move to In review", "Move to Done"]);
  assert.equal(c.moveTargets[1]!.id, "tpl.kanban.move:t1:in-review");
});

test("the menu moves a card to another column, keeping its place in board order, and saves only that card", () => {
  let w = press(start(), "move:t1:in-review");
  assert.deepEqual(titles(w, "todo"), ["t2"]);
  assert.deepEqual(titles(w, "in-review"), ["t1"]);
  assert.equal(view(w).total, 7);
  w = press(w, "move:r1:in-review");
  assert.deepEqual(titles(w, "in-review"), ["t1", "r1"]);
  assert.deepEqual(titles(w, "done"), ["r2", "r3"]);
  assert.deepEqual(w.saved.map((m) => [m.name, m.args.id, m.args.column]), [["kanban.place", "t1", "in-review"], ["kanban.place", "r1", "in-review"]]);
  assert.deepEqual(Object.keys(w.doc.kanban_card).sort(), ["r1", "t1"]);
});

test("a moved card says it was edited just now, and later how long ago", () => {
  const w = press(start(), "move:t1:done");
  const card = (at: typeof NOW) => h.view(w, at).columns.find((c) => c.id === "done")!.cards.find((c) => c.id === "t1")!;
  assert.equal(card(NOW).edited, "just now");
  assert.equal(card({ ...NOW, epochMs: NOW.epochMs + 5 * 60_000 }).edited, "5m ago");
  assert.equal(card({ ...NOW, epochMs: NOW.epochMs + 3 * 3_600_000 }).meta, "Edited 3h ago · Due Jul 8");
});

test("moving to the card's own column, or to an unknown one, changes nothing", () => {
  const w = start();
  assert.equal(press(w, "move:t1:todo"), w);
  assert.equal(press(w, "move:t1:nowhere"), w);
  assert.equal(press(w, "move:zzz:done"), w);
  assert.equal(press(w, "move:t1"), w);
  assert.equal(press(w, "other"), w);
});

test("dropping puts the card at the index among the column's other cards", () => {
  const w = start();
  assert.deepEqual(titles(drop(w, "r1", "todo:0"), "todo"), ["r1", "t1", "t2"]);
  assert.deepEqual(titles(drop(w, "r1", "todo:1"), "todo"), ["t1", "r1", "t2"]);
  assert.deepEqual(titles(drop(w, "r1", "todo:2"), "todo"), ["t1", "t2", "r1"]);
  assert.deepEqual(titles(drop(w, "r1", "todo:9"), "todo"), ["t1", "t2", "r1"]);
  assert.deepEqual(titles(drop(w, "t1", "in-review:0"), "in-review"), ["t1"]);
  assert.deepEqual(titles(drop(w, "t1", "in-review:0"), "todo"), ["t2"]);
});

test("dropping within a column reorders it, counted without the card itself", () => {
  const w = start();
  assert.deepEqual(titles(drop(w, "r3", "done:0"), "done"), ["r3", "r1", "r2"]);
  assert.deepEqual(titles(drop(w, "r1", "done:1"), "done"), ["r2", "r1", "r3"]);
  assert.deepEqual(titles(drop(w, "r1", "done:2"), "done"), ["r2", "r3", "r1"]);
  assert.equal(drop(w, "r2", "done:1"), w, "dropped where it already is");
});

test("many drops at the top of a column keep finding room", () => {
  let w = start();
  for (let i = 0; i < 60; i++) w = drop(w, i % 2 ? "r1" : "r2", "done:0");
  assert.deepEqual(titles(w, "done"), ["r1", "r2", "r3"]);
});

test("a bad drop is ignored", () => {
  const w = start();
  for (const where of ["", "todo", "todo:", "todo:-1", "todo:1.5", "todo:x", "nowhere:0", ":0"]) {
    assert.equal(drop(w, "r1", where), w, where);
  }
  assert.equal(drop(w, "zzz", "todo:0"), w);
});

test("Add task opens a sheet; Create makes a card at the top of To-do with the next number", () => {
  let w = press(start(), "addTask");
  assert.deepEqual(view(w).adding, { title: "", column: "todo", canCreate: false, maxLength: 200 });
  assert.equal(press(w, "addTaskCreate"), w, "nothing to create without a title");
  w = h.set(w, "newTitle", "  Ship the sync design  ");
  assert.equal(view(w).adding!.canCreate, true);
  w = press(w, "addTaskCreate");
  assert.equal(view(w).adding, null);
  const todo = view(w).columns[0]!;
  assert.deepEqual(todo.cards.map((c) => c.id), ["dev-1", "t1", "t2"]);
  const card = todo.cards[0]!;
  assert.deepEqual([card.title, card.ref, card.priorityLabel, card.edited, card.meta], ["Ship the sync design", "Task 4843", "Medium", "just now", "Edited just now · No due date"]);
  assert.equal(card.metaParts.join(""), card.meta);
  assert.deepEqual(w.saved.map((m) => m.name), ["kanban.add"]);
  // The next one is numbered after it, and Cancel closes the sheet without a card.
  w = press(h.set(press(w, "addTask"), "newTitle", "Second"), "addTaskCreate");
  assert.equal(view(w).columns[0]!.cards[0]!.ref, "Task 4844");
  const cancelled = press(h.set(press(w, "addTask"), "newTitle", "Never mind"), "addTaskCancel");
  assert.equal(view(cancelled).total, 9);
  assert.equal(view(cancelled).adding, null);
});

test("cards from another device's saved rows are drawn; a malformed row is not", () => {
  const doc = { ...emptyDoc(), kanban_card: {
    t2: { id: "t2", column: "done", order: "zz" },
    x1: { id: "x1", column: "in-review", order: "i", title: "From the phone", ref: "Task 9000", priority: "high" },
    x2: { id: "x2", column: "in-review", order: "i" },
    t1: { id: "t1", deleted: true },
  } };
  const w = h.start(doc);
  assert.deepEqual(titles(w, "todo"), []);
  assert.deepEqual(titles(w, "done"), ["r1", "r2", "r3", "t2"]);
  assert.deepEqual(titles(w, "in-review"), ["x1"]);
  assert.equal(view(w).total, 7);
});

test("the sprint selector sets the sprint; an unknown sprint is ignored", () => {
  const w = h.set(start(), "sprint", "002");
  assert.equal(view(w).sprint, "002");
  assert.equal(h.set(w, "sprint", "999"), w);
  assert.deepEqual(w.saved, []);
});

test("the view is plain JSON", () => {
  const v = view(press(start(), "addTask"));
  assert.deepEqual(JSON.parse(JSON.stringify(v)), v);
});

test("with saving on, Add task works; with stock behaviour only, it is inert and nothing beyond stock happens", () => {
  assert.deepEqual(view(start()).inert, ["sort", "filter", "search", "open", "assignToMe"]);
  const stock = harness(kanban, NOW, false);
  const w = stock.start();
  assert.deepEqual(stock.view(w).inert, ["sort", "filter", "search", "addTask", "open", "assignToMe"]);
  assert.equal(stock.press(w, "addTask"), w);
  // Stock still moves cards (in its own state); the core does the same in memory.
  assert.deepEqual(stock.view(stock.press(w, "move:t1:done")).columns[3]!.cards.map((c) => c.id), ["t1", "r1", "r2", "r3"]);
});

test("the view carries the board's words", () => {
  const v = view(start());
  assert.deepEqual([v.words.addTask, v.words.sprint, v.words.workItemActions, v.words.newTask, v.words.create], ["Add task", "Sprint", "Work item actions", "New task", "Create"]);
});

test("the column width and the sprint selector's width are the core's, and a column names its status dot", () => {
  const v = view(start());
  assert.deepEqual(v.rules, { columnWidth: 300, sprintWidth: 200 });
  assert.deepEqual(v.columns.map((c) => c.statusLabel), ["To-do status", "In progress status", "In review status", "Done status"]);
  for (const c of v.columns) for (const card of c.cards) {
    assert.equal(card.meta, `Edited ${card.edited} · Due ${card.due}`);
    assert.equal(card.metaParts.join(""), card.meta);
  }
});
