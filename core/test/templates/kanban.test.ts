import { test } from "node:test";
import assert from "node:assert/strict";
import { kanban } from "../../src/templates/kanban/model.ts";

const NOW = { epochMs: Date.UTC(2026, 9, 13, 16, 30), utcOffsetMinutes: -420 };
const start = () => kanban.initial(NOW);
const view = (s: ReturnType<typeof start>) => kanban.view(s, NOW);
const titles = (s: ReturnType<typeof start>, column: string) => view(s).columns.find((c) => c.id === column)!.cards.map((c) => c.id);
const press = (s: ReturnType<typeof start>, id: string) => kanban.reduce(s, { type: "press", id }, NOW);
const drop = (s: ReturnType<typeof start>, id: string, where: string) => kanban.reduce(s, { type: "set", id: `drop:${id}`, value: where }, NOW);

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

test("the menu moves a card between columns, keeping board order", () => {
  let s = press(start(), "move:t1:in-review");
  assert.deepEqual(titles(s, "todo"), ["t2"]);
  assert.deepEqual(titles(s, "in-review"), ["t1"]);
  assert.equal(view(s).total, 7);
  s = press(s, "move:r1:in-review");
  assert.deepEqual(titles(s, "in-review"), ["t1", "r1"]);
  assert.deepEqual(titles(s, "done"), ["r2", "r3"]);
});

test("moving to the card's own column, or to an unknown one, changes nothing", () => {
  const s = start();
  assert.equal(press(s, "move:t1:todo"), s);
  assert.equal(press(s, "move:t1:nowhere"), s);
  assert.equal(press(s, "move:zzz:done"), s);
  assert.equal(press(s, "move:t1"), s);
  assert.equal(press(s, "other"), s);
});

test("dropping puts the card at the index among the column's other cards", () => {
  const s = start();
  assert.deepEqual(titles(drop(s, "r1", "todo:0"), "todo"), ["r1", "t1", "t2"]);
  assert.deepEqual(titles(drop(s, "r1", "todo:1"), "todo"), ["t1", "r1", "t2"]);
  assert.deepEqual(titles(drop(s, "r1", "todo:2"), "todo"), ["t1", "t2", "r1"]);
  assert.deepEqual(titles(drop(s, "r1", "todo:9"), "todo"), ["t1", "t2", "r1"]);
  assert.deepEqual(titles(drop(s, "t1", "in-review:0"), "in-review"), ["t1"]);
  assert.deepEqual(titles(drop(s, "t1", "in-review:0"), "todo"), ["t2"]);
});

test("dropping within a column reorders it, counted without the card itself", () => {
  const s = start();
  assert.deepEqual(titles(drop(s, "r3", "done:0"), "done"), ["r3", "r1", "r2"]);
  assert.deepEqual(titles(drop(s, "r1", "done:1"), "done"), ["r2", "r1", "r3"]);
  assert.deepEqual(titles(drop(s, "r1", "done:2"), "done"), ["r2", "r3", "r1"]);
  assert.deepEqual(titles(drop(s, "r2", "done:1"), "done"), ["r1", "r2", "r3"]);
});

test("a bad drop is ignored", () => {
  const s = start();
  for (const where of ["", "todo", "todo:", "todo:-1", "todo:1.5", "todo:x", "nowhere:0", ":0"]) {
    assert.equal(drop(s, "r1", where), s, where);
  }
  assert.equal(drop(s, "zzz", "todo:0"), s);
});

test("the sprint selector sets the sprint; an unknown sprint is ignored", () => {
  const s = kanban.reduce(start(), { type: "set", id: "sprint", value: "002" }, NOW);
  assert.equal(view(s).sprint, "002");
  assert.equal(kanban.reduce(s, { type: "set", id: "sprint", value: "999" }, NOW), s);
});

test("the view is plain JSON", () => {
  const v = view(start());
  assert.deepEqual(JSON.parse(JSON.stringify(v)), v);
});

test("the view carries the board's words and lists the controls with no action as inert", () => {
  const v = kanban.view(kanban.initial(NOW), NOW);
  assert.deepEqual([v.words.addTask, v.words.sprint, v.words.workItemActions], ["Add task", "Sprint", "Work item actions"]);
  assert.deepEqual(v.inert, ["sort", "filter", "search", "addTask", "open", "assignToMe"]);
});
