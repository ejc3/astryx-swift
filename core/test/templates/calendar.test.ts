import { test } from "node:test";
import assert from "node:assert/strict";
import { calendar } from "../../src/templates/calendar/model.ts";

const NOW = { epochMs: Date.UTC(2026, 9, 13, 16, 30), utcOffsetMinutes: -420 };
const start = () => calendar.initial(NOW);
const view = (s: ReturnType<typeof start>) => calendar.view(s, NOW);

test("opens on April 15, 2026, whatever today is", () => {
  assert.deepEqual(view(start()), { value: "2026-04-15", focusDate: "2026-04-15" });
});

test("picking a day selects it and leaves the visible month alone", () => {
  const s = calendar.reduce(start(), { type: "set", id: "select", value: "2026-04-22" }, NOW);
  assert.deepEqual(view(s), { value: "2026-04-22", focusDate: "2026-04-15" });
});

test("moving the month changes the focus and keeps the selection", () => {
  const s = calendar.reduce(start(), { type: "set", id: "focus", value: "2026-05-01" }, NOW);
  assert.deepEqual(view(s), { value: "2026-04-15", focusDate: "2026-05-01" });
});

test("a selection in another month does not move the view", () => {
  const a = calendar.reduce(start(), { type: "set", id: "focus", value: "2026-03-01" }, NOW);
  const b = calendar.reduce(a, { type: "set", id: "select", value: "2026-03-09" }, NOW);
  assert.deepEqual(view(b), { value: "2026-03-09", focusDate: "2026-03-01" });
});

test("repeating a value, a malformed date, a wrong type or an unknown id change nothing", () => {
  const s = start();
  assert.equal(calendar.reduce(s, { type: "set", id: "select", value: "2026-04-15" }, NOW), s);
  assert.equal(calendar.reduce(s, { type: "set", id: "select", value: "April 3" }, NOW), s);
  assert.equal(calendar.reduce(s, { type: "set", id: "select", value: "2026-13-01" }, NOW), s);
  assert.equal(calendar.reduce(s, { type: "set", id: "select", value: 5 }, NOW), s);
  assert.equal(calendar.reduce(s, { type: "set", id: "nope", value: "2026-04-01" }, NOW), s);
  assert.equal(calendar.reduce(s, { type: "press", id: "select" }, NOW), s);
});

test("the view is plain JSON", () => {
  const v = view(start());
  assert.deepEqual(JSON.parse(JSON.stringify(v)), v);
});
