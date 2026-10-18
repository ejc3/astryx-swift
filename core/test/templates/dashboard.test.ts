import assert from "node:assert/strict";
import { test } from "node:test";
import type { Now } from "../../src/format.ts";
import { dashboard } from "../../src/templates/dashboard/model.ts";

const NOW: Now = { epochMs: Date.UTC(2026, 9, 13, 16, 30), utcOffsetMinutes: -420 };
const view = () => dashboard.view(dashboard.initial(NOW), NOW);

test("the active users chart has 96 points, in order, with the three series adding up", () => {
  const { activeUsers } = view();
  assert.equal(activeUsers.points.length, 96);
  assert.deepEqual(activeUsers.points[0], { hour: 0, label: "Apr 1 14:00", allUsers: 116, desktop: 79, mobile: 37 });
  assert.deepEqual(activeUsers.points[95], { hour: 95, label: "Apr 2 14:00", allUsers: 120, desktop: 83, mobile: 37 });
  activeUsers.points.forEach((p, i) => assert.equal(p.hour, i));
  assert.deepEqual(activeUsers.xTicks.map((t) => [t.at, t.label]), [[0, "Apr 1 14:00"], [32, "Apr 1 22:00"], [64, "Apr 2 06:00"], [95, "Apr 2 14:00"]]);
  assert.deepEqual(activeUsers.series.map((s) => s.name), ["All Users", "Desktop", "Mobile"]);
});

test("metric cards carry their sparklines", () => {
  const { metrics } = view();
  assert.deepEqual(metrics.map((m) => [m.label, m.value, m.change, m.positive]), [
    ["Monthly Visitors", "27.3 k", "+18.2%", true],
    ["Monthly Page Views", "48.2 k", "+12.5%", true],
    ["Avg. Session", "4.5 min", "-14.3%", false],
    ["Bounce Rate", "42.3%", "-8.7%", false],
  ]);
  for (const m of metrics) assert.equal(m.sparkline.length, 30);
  assert.deepEqual(metrics[3]!.sparkline.slice(0, 4), [52, 56, 50, 54]);
});

test("demographics say each share to two decimals", () => {
  const { cards } = view().demographics;
  assert.deepEqual(cards.map((c) => c.title), ["Region", "Role"]);
  assert.deepEqual(cards[0]!.segments.map((s) => `${s.value} - ${s.share}%`), ["38 - 38.00%", "28 - 28.00%", "22 - 22.00%", "8 - 8.00%", "4 - 4.00%"]);
  assert.deepEqual(cards[1]!.segments.map((s) => s.color), ["blue", "orange", "green", "purple", "neutral"]);
});

test("tables format their numbers with thousands separators", () => {
  const { pages, events } = view().engagement;
  assert.equal(pages.rows.length, 10);
  assert.deepEqual(pages.rows[0], { id: "1", page: "/home", views: 8420, max: 8420, barLabel: "/home views", viewsLabel: "8,420 views", newUsers: "62.3%", avgTime: "3:42" });
  assert.equal(events.rows.length, 10);
  assert.deepEqual(events.rows[0], { id: "1", event: "page_view", count: 18420, max: 18420, barLabel: "18420", countLabel: "18,420", usersLabel: "12,300", newUsersLabel: "4,920" });
  assert.equal(events.rows[9]!.countLabel, "580");
});

test("the view is plain JSON, and Reload changes nothing", () => {
  const s = dashboard.initial(NOW);
  assert.deepEqual(JSON.parse(JSON.stringify(dashboard.view(s, NOW))), dashboard.view(s, NOW));
  assert.equal(dashboard.reduce(s, { type: "press", id: "reload" }, NOW), s);
});
