import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { createClient, type AppSnapshot, type DiagramNode, type Node, type Now } from "../src/index.ts";
import { gridFrames, placeLabels, routeEdge, type GridMetrics, type LabelPlacement, type Point, type Rect } from "../src/diagram.ts";
import { ASTRYX_VERSION, FIXTURES, PARITY, REACT_NATIVE, ZERO_VERSION, architectureDiagram, boxSpecs } from "../src/screens/architecture.ts";
import { BIRTH, BIRTH_UTC, BUILT, FOLLOWED, FOLLOWED_UTC, LINES, RESULT, SHARED, SHARED_SHARE } from "../src/screens/story.ts";
import { readdirSync } from "node:fs";
import { THEMES } from "../src/themes.generated.ts";

/** "2026-10-19 01:56" (UTC) as Pacific daylight time, "Oct 18, 6:56 pm PT": the test's own conversion. */
function pt(utc: string): string {
  const [date, time] = utc.split(" ");
  const [y, mo, d] = date!.split("-").map(Number);
  const [h, mi] = time!.split(":").map(Number);
  const t = new Date(Date.UTC(y!, mo! - 1, d!, h!, mi!) - 7 * 3600_000);
  const hour = t.getUTCHours(), h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `Oct ${t.getUTCDate()}, ${h12}:${String(t.getUTCMinutes()).padStart(2, "0")} ${hour < 12 ? "am" : "pm"} PT`;
}

const NOW: Now = { epochMs: Date.UTC(2026, 9, 13, 16, 30), utcOffsetMinutes: -420 };
const root = fileURLToPath(new URL("../../", import.meta.url));
const read = (path: string) => readFileSync(root + path, "utf8");

function diagram(c: ReturnType<typeof createClient>): DiagramNode {
  const body = (c.getSnapshot("app") as AppSnapshot).screen.body;
  assert.equal(body.kind, "diagram");
  return body as DiagramNode;
}

/** Sizes like the hosts': wide at a Mac window's width with the inspector open and at full width, narrow at phone widths. */
const LAYOUTS = ["wide", "narrow", "single"] as const;
type Layout = (typeof LAYOUTS)[number];
function metrics(d: DiagramNode, layout: Layout): GridMetrics[] {
  const widths = { wide: [104, 140, 190], narrow: [118, 160], single: [240] }[layout];
  return widths.map((w) => ({ columnWidth: w, columnGap: d[layout].gap.x, rowGap: d[layout].gap.y, titleRow: 20, boxRow: 64, groupPad: d[layout].pad }));
}
/** A label's size at 12 points on Astryx's label leading (1.4286) with its border, as both hosts draw it, generously estimated. */
const labelSize = (text: string) => ({ width: Math.ceil(text.length * 6.6) + 10, height: 20 });
/** A group title's frame: semibold 12 at the group's first cell, generously estimated. */
const titleWidth = (text: string) => Math.ceil(text.length * 7.2) + 8;

/** Everything drawn in one state at one size: boxes, title frames, the drawn routes, and the canvas. */
function drawn(d: DiagramNode, layout: Layout, m: GridMetrics) {
  const { boxes, groups, size } = gridFrames(d, layout, m);
  const grid: Rect = { x: 0, y: 0, width: size.width, height: size.height };
  const titles = new Map(d.groups.map((g) => {
    const a = g[layout], r = groups.get(g.id)!;
    return [g.id, { x: r.x + m.groupPad, y: r.y + m.groupPad, width: Math.min(titleWidth(g.title), a.cols * m.columnWidth), height: m.titleRow }] as const;
  }));
  const target = (e: DiagramNode["edges"][number]) => (e.toGroup ? groups.get(e.to)! : boxes.get(e.to)!);
  const routes = d.edges.filter((e) => e.drawn[layout]).map((e) => ({ id: e.id, edge: e, points: routeEdge(boxes.get(e.from)!, target(e), e[layout], grid) }));
  const bounds: Rect = { x: -d[layout].margin.left, y: -d[layout].margin.top, width: size.width + d[layout].margin.left + d[layout].margin.right, height: size.height + d[layout].margin.top + m.groupPad };
  return { boxes, groups, titles, routes, bounds, size };
}

/** The most lines that run along one gutter (between columns, beside the grid, or between rows) at any point. */
function mostInAGutter(routes: { points: Point[] }[], columns: { x: number; width: number }[], rows: { y: number; height: number }[]): number {
  const segs = routes.flatMap((r) => segments(r.points));
  const insideCol = (x: number) => columns.some((c) => x > c.x + 0.5 && x < c.x + c.width - 0.5);
  const insideRow = (y: number) => rows.some((c) => y > c.y + 0.5 && y < c.y + c.height - 0.5);
  let most = 0;
  const verticals = segs.filter(([p, q]) => p.x === q.x && Math.abs(p.y - q.y) > 1 && !insideCol(p.x));
  const horizontals = segs.filter(([p, q]) => p.y === q.y && Math.abs(p.x - q.x) > 1 && !insideRow(p.y));
  const gutterOf = (v: number, cuts: number[]) => cuts.filter((c) => c < v).length;
  const colCuts = columns.flatMap((c) => [c.x, c.x + c.width]);
  const rowCuts = rows.flatMap((c) => [c.y, c.y + c.height]);
  for (const [p, q] of verticals) {
    const y = (p.y + q.y) / 2, g = gutterOf(p.x, colCuts);
    most = Math.max(most, verticals.filter(([a, b]) => gutterOf(a.x, colCuts) === g && Math.min(a.y, b.y) < y && Math.max(a.y, b.y) > y).length);
    for (const yy of [Math.min(p.y, q.y) + 1, Math.max(p.y, q.y) - 1]) most = Math.max(most, verticals.filter(([a, b]) => gutterOf(a.x, colCuts) === g && Math.min(a.y, b.y) < yy && Math.max(a.y, b.y) > yy).length);
  }
  for (const [p, q] of horizontals) {
    const g = gutterOf(p.y, rowCuts);
    for (const xx of [(p.x + q.x) / 2, Math.min(p.x, q.x) + 1, Math.max(p.x, q.x) - 1]) most = Math.max(most, horizontals.filter(([a, b]) => gutterOf(a.y, rowCuts) === g && Math.min(a.x, b.x) < xx && Math.max(a.x, b.x) > xx).length);
  }
  return most;
}

const intersects = (a: Rect, b: Rect) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const segmentRect = (p: Point, q: Point): Rect => ({ x: Math.min(p.x, q.x), y: Math.min(p.y, q.y), width: Math.abs(q.x - p.x), height: Math.abs(q.y - p.y) });

/** Whether the segment p-q (horizontal or vertical) passes through the inside of r. */
function crosses(p: Point, q: Point, r: Rect): boolean {
  const x0 = Math.min(p.x, q.x), x1 = Math.max(p.x, q.x), y0 = Math.min(p.y, q.y), y1 = Math.max(p.y, q.y);
  return x1 > r.x + 0.5 && x0 < r.x + r.width - 0.5 && y1 > r.y + 0.5 && y0 < r.y + r.height - 0.5;
}

/** Whether two axis-aligned segments run along each other for any length. */
function overlaps(a: [Point, Point], b: [Point, Point]): boolean {
  const ah = a[0].y === a[1].y, bh = b[0].y === b[1].y;
  if (ah !== bh) return false;
  if (ah) {
    if (Math.abs(a[0].y - b[0].y) > 2) return false;
    const lo = Math.max(Math.min(a[0].x, a[1].x), Math.min(b[0].x, b[1].x)), hi = Math.min(Math.max(a[0].x, a[1].x), Math.max(b[0].x, b[1].x));
    return hi - lo > 1;
  }
  if (Math.abs(a[0].x - b[0].x) > 2) return false;
  const lo = Math.max(Math.min(a[0].y, a[1].y), Math.min(b[0].y, b[1].y)), hi = Math.min(Math.max(a[0].y, a[1].y), Math.max(b[0].y, b[1].y));
  return hi - lo > 1;
}

const segments = (pts: Point[]) => pts.slice(1).map((q, i) => [pts[i]!, q] as [Point, Point]);

test("how it works: a screen in its own nav section, first, with how this was built", () => {
  const c = createClient(() => NOW);
  const nav = (c.getSnapshot("app") as AppSnapshot).nav;
  assert.deepEqual(nav.slice(0, 2).map((n) => [n.id, n.section]), [["architecture", "About this spike"], ["story", "About this spike"]]);
  c.dispatch({ type: "navigate", screen: "architecture" });
  const app = c.getSnapshot("app") as AppSnapshot;
  assert.equal(app.screen.title, "How it works");
  assert.deepEqual(JSON.parse(JSON.stringify(app)), app, "plain JSON");
});

test("every box sits in its group, one row high, never in a group's title row, never on another box", () => {
  const d = architectureDiagram(null);
  for (const layout of LAYOUTS) {
    const grid = d[layout];
    const taken = new Map<string, string>();
    const titleRows = new Map(d.groups.map((g) => [g.id, g[layout].row]));
    for (const g of d.groups) {
      const a = g[layout];
      assert.ok(a.col >= 0 && a.row >= 0 && a.col + a.cols <= grid.columns && a.row + a.rows <= grid.rows, `${layout} ${g.id} on the grid`);
    }
    for (const b of d.boxes) {
      const a = b[layout], g = d.groups.find((x) => x.id === b.group)![layout];
      assert.equal(a.rows, 1, `${b.id} is one row high`);
      assert.ok(a.col >= g.col && a.col + a.cols <= g.col + g.cols && a.row > g.row && a.row < g.row + g.rows, `${layout} ${b.id} inside ${b.group}, below its title`);
      for (const [, row] of titleRows) assert.notEqual(a.row, row, `${layout} ${b.id} not in a title row`);
      for (let col = a.col; col < a.col + a.cols; col++) {
        const key = `${col},${a.row}`;
        assert.ok(!taken.has(key), `${layout} ${b.id} on ${taken.get(key)} at ${key}`);
        taken.set(key, b.id);
      }
    }
    for (const g of d.groups) for (const h of d.groups) {
      if (g === h) continue;
      const a = g[layout], b = h[layout];
      assert.ok(a.col + a.cols <= b.col || b.col + b.cols <= a.col || a.row + a.rows <= b.row || b.row + b.rows <= a.row, `${layout} ${g.id} and ${h.id} overlap`);
    }
  }
});

test("every edge joins a box to a box or a group, every word is there, ids are unique", () => {
  const d = architectureDiagram(null);
  const ids = new Set(d.boxes.map((b) => b.id));
  const groupIds = new Set(d.groups.map((g) => g.id));
  assert.equal(ids.size, d.boxes.length);
  assert.equal(new Set(d.edges.map((e) => e.id)).size, d.edges.length);
  for (const e of d.edges) {
    assert.ok(ids.has(e.from) && (e.toGroup ? groupIds.has(e.to) : ids.has(e.to)) && e.from !== e.to, e.id);
    assert.ok(e.label.trim().length > 0, e.id);
  }
  for (const b of d.boxes) {
    for (const w of [b.title, b.detail, b.accessibilityLabel]) assert.ok(w.trim().length > 0 && !/undefined|NaN/.test(w), `${b.id}: ${w}`);
    // One short line at a projector's distance in a wide column.
    assert.ok(b.title.length <= 19, `${b.id} title "${b.title}"`);
    // One line in a wide column at the Mac's default window (a shared box's tag may take a second).
    assert.ok(b.detail.length <= 24, `${b.id} detail "${b.detail}"`);
    assert.ok(d.edges.some((e) => e.from === b.id || e.to === b.id), `${b.id} has an edge`);
  }
  for (const g of d.groups) assert.ok(g.title.trim().length > 0);
  for (const l of d.legend) assert.ok(l.label.trim().length > 0);
  assert.deepEqual(new Set(d.legend.map((l) => l.style)), new Set(d.edges.map((e) => e.style)));
  for (const s of boxSpecs()) {
    assert.ok(s.about.length > 40, s.id);
    for (const f of s.facts) assert.ok(f.label.length > 0 && f.value.length > 0 && !/undefined|NaN/.test(f.value), `${s.id}: ${f.label}`);
  }
});

test("the fixture counts the Swift panel names match the folder", () => {
  const names = readdirSync(root + "apps/native/apple/AstryxKit/Tests/AstryxKitTests/Fixtures/");
  assert.equal(names.filter((n) => n.startsWith("app-")).length, FIXTURES.screens);
  assert.equal(names.filter((n) => n.startsWith("template-")).length, FIXTURES.templates);
  assert.equal(names.filter((n) => n.startsWith("theme-")).length, FIXTURES.themes);
});

test("the grid gaps and pads are steps of Astryx's spacing scale", () => {
  const sizes = THEMES.themes[0]!.light.sizes;
  const steps = new Set(Object.entries(sizes).filter(([k]) => k.startsWith("spacing-")).map(([, v]) => v));
  const d = architectureDiagram(null);
  for (const layout of LAYOUTS) for (const v of [d[layout].gap.x, d[layout].gap.y, d[layout].pad]) assert.ok(v === 0 || steps.has(v), `${layout}: ${v}`);
});

test("every file a box names exists", () => {
  for (const s of boxSpecs()) for (const f of s.files) assert.ok(existsSync(root + f), `${s.id}: ${f}`);
});

test("the numbers the core cannot count match the files they come from", () => {
  const pin = (path: string) => (JSON.parse(read(path)) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> });
  const dep = (path: string, name: string) => { const p = pin(path); return p.dependencies?.[name] ?? p.devDependencies?.[name]; };
  assert.equal(dep("web/package.json", "@astryxdesign/core"), ASTRYX_VERSION);
  assert.equal(dep("web/package.json", "@astryxdesign/cli"), ASTRYX_VERSION);
  assert.equal(dep("core/package.json", "@astryxdesign/core"), ASTRYX_VERSION);
  for (const p of ["sync/package.json", "server/package.json", "apps/native/package.json"]) assert.equal(dep(p, "@rocicorp/zero"), ZERO_VERSION, p);
  assert.equal(dep("apps/native/package.json", "react-native"), REACT_NATIVE.ios);
  assert.equal(dep("apps/native/package.json", "react-native-macos"), REACT_NATIVE.macos);
  assert.match(read("README.md"), new RegExp(`${PARITY.identical} of ${PARITY.total} comparisons identical`));
  assert.match(read("apps/native/js/specs/NativeAXClient.ts"), /connected\(.*\n.*changed\(.*\n.*answered\(.*\n.*onCall.*\n[\s\S]*start\(\)/);
  assert.match(read("apps/native/apple/Host/WebPane.swift"), /forURLScheme: "astryx"/);
  assert.match(read("apps/native/apple/AstryxKit/Package.swift"), /\.iOS\(\.v17\), \.macOS\(\.v14\)/);
  assert.match(read("server/src/zero.ts"), /handleMutateRequest/);
  assert.match(read("server/src/tokens.ts"), /EdDSA/);
  assert.match(read("web/scripts/parity.mjs"), /threshold: 0/);
});

const STATES = [null, ...boxSpecs().map((b) => b.id)];

test("every arrangement and state: no route through a box or a group title, none along another, at most two lines in a gutter, arrowheads apart", () => {
  const problems = new Set<string>();
  const check = (ok: boolean, what: string) => { if (!ok) problems.add(what.replace(/@\d+/, "")); };
  for (const sel of STATES) {
    const d = architectureDiagram(sel);
    for (const layout of LAYOUTS) for (const m of metrics(d, layout)) {
      const { boxes, titles, routes, bounds } = drawn(d, layout, m);
      const at = `${layout}@${m.columnWidth} (${sel ?? "at rest"})`;
      for (const rt of routes) for (const [p, q] of segments(rt.points)) {
        for (const [id, r] of boxes) check(!crosses(p, q, r), `${at}: ${rt.id} passes through ${id}`);
        for (const [id, r] of titles) check(!crosses(p, q, r), `${at}: ${rt.id} crosses the ${id} title`);
        for (const pt of [p, q]) check(pt.x >= bounds.x && pt.x <= bounds.x + bounds.width && pt.y >= bounds.y, `${at}: ${rt.id} inside the canvas`);
      }
      for (const a of routes) for (const b of routes) {
        if (a.id >= b.id) continue;
        for (const s1 of segments(a.points)) for (const t of segments(b.points)) check(!overlaps(s1, t), `${at}: ${a.id} runs along ${b.id}`);
      }
      // Gutters: between and beside the columns, and between the rows.
      const cols = Array.from({ length: d[layout].columns }, (_, i) => ({ x: i * (m.columnWidth + m.columnGap), width: m.columnWidth }));
      const rowBands = [...boxes.values(), ...titles.values()].map((r) => ({ y: r.y, height: r.height }));
      check(mostInAGutter(routes, cols, rowBands) <= 2, `${at}: more than two lines share a gutter`);
      // Arrowheads: no two tips within 8 points.
      const tips = routes.flatMap((r) => [r.points[r.points.length - 1]!, ...(r.edge.direction === "both" ? [r.points[0]!] : [])].map((p) => ({ id: r.id, p })));
      for (const a of tips) for (const b of tips) if (a !== b) check(Math.hypot(a.p.x - b.p.x, a.p.y - b.p.y) >= 8, `${at}: arrowheads of ${a.id} and ${b.id} together`);
    }
  }
  assert.deepEqual([...problems].sort(), []);
});

test("narrow and single draw the neighbours' edges at rest and every edge of the selected box; wide draws all; every box is joined", () => {
  const rest = architectureDiagram(null);
  for (const e of rest.edges) assert.equal(e.drawn.wide, true, e.id);
  for (const layout of ["narrow", "single"] as const) {
    assert.ok(rest.edges.some((e) => e.drawn[layout]) && rest.edges.some((e) => !e.drawn[layout]), `${layout} draws some edges at rest, not all`);
    for (const b of boxSpecs()) {
      const d = architectureDiagram(b.id);
      for (const e of d.edges) if (e.from === b.id || e.to === b.id) assert.ok(e.drawn[layout], `${layout}: ${b.id}'s edge ${e.id} drawn when selected`);
    }
  }
  for (const b of rest.boxes) assert.ok(rest.edges.some((e) => e.from === b.id || e.to === b.id), `${b.id} has an edge`);
});

test("labels: placed clear of every box, title, other edge and each other, inside the canvas; the key ones fit at rest", () => {
  const problems = new Set<string>();
  const check = (ok: boolean, what: string) => { if (!ok) problems.add(what.replace(/@\d+/, "")); };
  for (const sel of STATES) {
    const d = architectureDiagram(sel);
    for (const layout of ["wide", "narrow"] as const) for (const m of metrics(d, layout)) {
      const { boxes, titles, routes, bounds } = drawn(d, layout, m);
      const shown = d.edges.filter((e) => e.showLabel && e.drawn[layout]).map((e) => ({ id: e.id, ...labelSize(e.label) }));
      const placed = placeLabels(routes, shown, [...boxes.values(), ...titles.values()], bounds);
      const rect = (l: LabelPlacement): Rect => ({ x: l.x - l.width / 2, y: l.y - l.height / 2, width: l.width, height: l.height });
      const fitting = placed.filter((l) => l.fits);
      for (const l of fitting) {
        for (const b of [...boxes.values(), ...titles.values()]) check(!intersects(rect(l), b), `${layout} ${l.id} on a box or title`);
        for (const r of routes) if (r.id !== l.id) for (const [p, q] of segments(r.points)) check(!intersects(rect(l), segmentRect(p, q)), `${layout} ${l.id} on ${r.id}`);
        for (const o of fitting) if (o !== l) check(!intersects(rect(l), rect(o)), `${layout} ${l.id} on ${o.id}`);
      }
      if (sel === null && layout === "wide") for (const l of shown) check(fitting.some((f) => f.id === l.id), `wide@${m.columnWidth}: the key label of ${l.id} fits at rest`);
    }
  }
  assert.deepEqual([...problems].sort(), []);
  // "runs the core and sync" is always labelled in the wide arrangement.
  assert.equal(architectureDiagram(null).edges.find((e) => e.id === "hermes-core")!.showLabel, true);
  assert.equal(architectureDiagram(null).single.labels, false);
});

test("selecting a box highlights it and its edges, dims the rest, and fills the panel; again or Close clears it", () => {
  const c = createClient(() => NOW, { screen: "architecture" });
  assert.equal(diagram(c).panel, null);
  assert.ok(diagram(c).boxes.every((b) => b.state === "normal"));
  c.dispatch({ type: "press", id: "how.select:axclient" });
  let d = diagram(c);
  assert.equal(d.selected, "axclient");
  const box = (id: string) => d.boxes.find((b) => b.id === id)!;
  assert.equal(box("axclient").state, "selected");
  assert.equal(box("swiftui").state, "linked");
  assert.equal(box("postgres").state, "dimmed");
  for (const e of d.edges) assert.equal(e.state, e.from === "axclient" || e.to === "axclient" ? "highlighted" : "dimmed", e.id);
  assert.ok(d.panel);
  assert.ok(d.panel.links.some((l) => l.text === "To AstryxKit: snapshot JSON" && l.selectId === "how.select:swiftui"));
  assert.ok(d.panel.links.some((l) => l.text === "From View model: snapshot JSON"));
  assert.match(d.hint, /or Close,/);
  assert.match(d.hintMac, /press Escape/);
  assert.equal(d.panel.links.length, d.edges.filter((e) => e.state === "highlighted").length);
  // A link selects the box at its other end.
  c.dispatch({ type: "press", id: d.panel.links[0]!.selectId });
  d = diagram(c);
  assert.notEqual(d.selected, "axclient");
  c.dispatch({ type: "press", id: `how.select:${d.selected!}` });
  assert.equal(diagram(c).selected, null);
  c.dispatch({ type: "press", id: "how.select:zero" });
  c.dispatch({ type: "press", id: "how.close" });
  assert.equal(diagram(c).panel, null);
  // An unknown box changes nothing.
  c.dispatch({ type: "press", id: "how.select:nothing" });
  assert.equal(diagram(c).selected, null);
});

test("how this was built: dated entries, the birth moment quoted, numbers as given", () => {
  const c = createClient(() => NOW, { screen: "story" });
  const app = c.getSnapshot("app") as AppSnapshot;
  assert.equal(app.screen.title, "How this was built");
  const all: Node[] = [];
  const walk = (n: Node) => { all.push(n); if ("children" in n && Array.isArray(n.children)) n.children.forEach(walk); };
  walk(app.screen.body);
  const timelines = all.filter((n) => n.kind === "timeline");
  assert.equal(timelines.length, 2);
  const birth = BIRTH.find((e) => e.emphasized)!;
  assert.equal(birth.when, "Oct 17, 9:52 am PT");
  assert.ok(birth.quote?.startsWith("I want to do a spike for astryx native."));
  // Known pairs, UTC to Pacific daylight time (UTC−7), across midnight too.
  assert.equal(pt("2026-10-17 14:20"), "Oct 17, 7:20 am PT");
  assert.equal(pt("2026-10-17 16:52"), "Oct 17, 9:52 am PT");
  assert.equal(pt("2026-10-19 01:56"), "Oct 18, 6:56 pm PT");
  // Every timed entry is its UTC, converted.
  for (const e of [...BIRTH_UTC, ...FOLLOWED_UTC]) {
    if (e.utc === undefined) { assert.match(e.when, /^Oct \d\d?( to Oct \d\d?)?$/, e.title); continue; }
    const at = pt(e.utc);
    assert.ok(e.when === at || e.when.startsWith(at.replace(/ [ap]m PT$/, " to ")), `${e.title}: ${e.when} is ${at}`);
  }
  for (const e of [...BIRTH, ...FOLLOWED]) {
    assert.ok(!("utc" in e), "the UTC stays out of the snapshot");
    assert.doesNotMatch(e.when + (e.text ?? ""), /UTC/);
    assert.ok(e.title.length > 0 && (e.quote ?? e.text ?? "").length > 0, e.when);
  }
  assert.equal([...BIRTH, ...FOLLOWED].filter((e) => e.badge === "Turning point" && e.outcome).length, 8);
  assert.equal(BUILT.insightful.length, 8);
  const day = (when: string) => Number(/^Oct (\d+)/.exec(when)![1]);
  for (let i = 1; i < FOLLOWED.length; i++) assert.ok(day(FOLLOWED[i - 1]!.when) <= day(FOLLOWED[i]!.when), `in date order: ${FOLLOWED[i]!.title}`);
  // The agents by kind add up to the 57 launched.
  assert.equal([...BIRTH, ...FOLLOWED].filter((e) => `${e.title} ${e.text ?? ""} ${e.outcome ?? ""}`.includes("1216 of 1216")).length, 1, "1216 of 1216 once");
  assert.equal(BUILT.agents.reduce((sum, a) => sum + Number(/^\d+/.exec(a.value)![0]), 0), 57);
  // The shares come from one table of lines, and the bar's parts are that table.
  const shared = LINES.core + LINES.sync, apple = LINES.kit + LINES.host + LINES.glue + LINES.shells;
  assert.equal(SHARED.split.reduce((sum, p) => sum + p.value, 0), shared + LINES.web + apple + LINES.server);
  assert.equal(SHARED_SHARE, `${Math.round((100 * shared) / (shared + LINES.web + apple + LINES.server))}%`);
  // The first question names the project only as it was redacted.
  assert.ok(BIRTH[0]!.quote?.includes("[the family dashboard]"));
  assert.equal(BUILT.metrics.find((m) => m.label.startsWith("Agents"))!.value, "57");
  assert.ok(!JSON.stringify({ BUILT, RESULT }).match(/claude-|sonnet-|opus-/i), "models only by family name");
  assert.equal(RESULT.tests.find((t) => t.label === "Parity")!.value, `${PARITY.identical} of ${PARITY.total} identical`);
});
