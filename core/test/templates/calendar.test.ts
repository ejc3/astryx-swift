import { test } from "node:test";
import assert from "node:assert/strict";
import { calendar, monthWeeks } from "../../src/templates/calendar/model.ts";

const NOW = { epochMs: Date.UTC(2026, 9, 13, 16, 30), utcOffsetMinutes: -420 };
const start = () => calendar.initial(NOW);
const view = (s: ReturnType<typeof start>) => {
  const { value, focusDate } = calendar.view(s, NOW);
  return { value, focusDate };
};

test("the view carries the words the native drawing speaks", () => {
  const { words } = calendar.view(start(), NOW);
  assert.deepEqual(Object.keys(words).sort(), ["nextMonth", "previousMonth", "selected", "today", "weekdays"]);
  const { weekdays, ...sentences } = words;
  assert.ok(Object.values(sentences).every((w) => w.length > 0));
  assert.deepEqual(weekdays, ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]);
});

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
  assert.equal(calendar.reduce(s, { type: "press", id: "next" }, NOW), s);
});

test("the view is plain JSON", () => {
  const v = view(start());
  assert.deepEqual(JSON.parse(JSON.stringify(v)), v);
});

// Today in the tests' NOW is Tuesday 2026-10-13 (UTC-7).
const at = (value: string | null, focusDate: string) => calendar.view({ value, focusDate }, NOW);

test("the view names the month and its neighbors in English", () => {
  const v = at("2026-04-15", "2026-04-15");
  assert.equal(v.title, "April 2026");
  assert.deepEqual(v.previous, { target: "2026-03-01", label: "Previous month, March 2026" });
  assert.deepEqual(v.next, { target: "2026-05-01", label: "Next month, May 2026" });
  assert.equal(v.selectedAnnouncement, "Selected, Wednesday, April 15, 2026");
  assert.equal(at(null, "2026-04-15").selectedAnnouncement, null);
});

test("months step across the year boundaries", () => {
  const dec = at(null, "2026-12-20");
  assert.equal(dec.next.target, "2027-01-01");
  assert.equal(dec.next.label, "Next month, January 2027");
  const jan = at(null, "2026-01-31");
  assert.equal(jan.previous.target, "2025-12-01");
  assert.equal(jan.previous.label, "Previous month, December 2025");
});

test("six weeks of seven, Sunday first, from the Sunday on or before the 1st", () => {
  const { weeks } = at("2026-04-15", "2026-04-15");
  assert.equal(weeks.length, 6);
  assert.ok(weeks.every((w) => w.length === 7));
  // April 1, 2026 is a Wednesday: the grid starts Sunday March 29.
  assert.equal(weeks[0]![0]!.date, "2026-03-29");
  assert.equal(weeks[0]![0]!.inMonth, false);
  assert.equal(weeks[0]![3]!.date, "2026-04-01");
  assert.equal(weeks[0]![3]!.inMonth, true);
  assert.equal(weeks[5]![6]!.date, "2026-05-09");
  assert.equal(weeks[5]![6]!.inMonth, false);
  assert.equal(weeks.flat().filter((d) => d.inMonth).length, 30);
  assert.deepEqual(weeks.flat().slice(0, 4).map((d) => d.day), [29, 30, 31, 1]);
});

test("a month starting on Sunday has no days before it", () => {
  // February 2026 starts on a Sunday.
  const { weeks } = at(null, "2026-02-10");
  assert.equal(weeks[0]![0]!.date, "2026-02-01");
  assert.ok(weeks[0]![0]!.inMonth);
  assert.equal(weeks[5]![6]!.date, "2026-03-14");
});

test("a day carries the selected and today flags and its spoken labels", () => {
  const days = at("2026-10-15", "2026-10-02").weeks.flat();
  const byDate = (d: string) => days.find((x) => x.date === d)!;
  assert.deepEqual(days.filter((d) => d.selected).map((d) => d.date), ["2026-10-15"]);
  assert.deepEqual(days.filter((d) => d.today).map((d) => d.date), ["2026-10-13"]);
  assert.equal(byDate("2026-10-15").label, "Thursday, October 15, 2026");
  assert.equal(byDate("2026-10-13").label, "Today, Tuesday, October 13, 2026");
  assert.equal(byDate("2026-10-15").agendaLabel, "Thursday 15");
  assert.equal(byDate("2026-10-01").agendaLabel, "Thursday 1");
});

test("the selected day shows in a neighboring month's padding too", () => {
  const days = at("2026-03-30", "2026-04-15").weeks.flat();
  assert.deepEqual(days.filter((d) => d.selected).map((d) => [d.date, d.inMonth]), [["2026-03-30", false]]);
});

test("a leap day is a day of February 2028", () => {
  const days = monthWeeks({ year: 2028, month: 2, day: 1 }, null, { year: 2028, month: 2, day: 29 }).flat();
  assert.ok(days.some((d) => d.date === "2028-02-29" && d.inMonth && d.today));
});

test("setting the focus to a step's target steps the month and keeps the selection", () => {
  const next = calendar.reduce(start(), { type: "set", id: "focus", value: calendar.view(start(), NOW).next.target }, NOW);
  assert.deepEqual(view(next), { value: "2026-04-15", focusDate: "2026-05-01" });
  const back = calendar.reduce(next, { type: "set", id: "focus", value: calendar.view(next, NOW).previous.target }, NOW);
  assert.equal(back.focusDate, "2026-04-01");
});

test("pick selects a day, and moves the view only for a day of another month", () => {
  const inMonth = calendar.reduce(start(), { type: "set", id: "pick", value: "2026-04-22" }, NOW);
  assert.deepEqual(view(inMonth), { value: "2026-04-22", focusDate: "2026-04-15" });
  const neighbor = calendar.reduce(start(), { type: "set", id: "pick", value: "2026-03-30" }, NOW);
  assert.deepEqual(view(neighbor), { value: "2026-03-30", focusDate: "2026-03-01" });
  const same = start();
  assert.equal(calendar.reduce(same, { type: "set", id: "pick", value: "2026-04-15" }, NOW), same);
  assert.equal(calendar.reduce(same, { type: "set", id: "pick", value: "nope" }, NOW), same);
});
