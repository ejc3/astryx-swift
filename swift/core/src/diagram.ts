/**
 * How a host draws a `diagram` node's edges and their labels (ui.ts), written once. The web page
 * calls these; AstryxKit ports `routeEdge` and `placeLabels` line for line (Views/Diagram.swift),
 * and its tests check the port against what this file computed (core/scripts/fixtures.ts).
 *
 * The routing rule. An edge leaves its source box at the anchor on the side its route names, `fromAt`
 * of the way along that side (left to right, top to bottom; the middle when absent), and enters its
 * target at the anchor on the side `to`, `toAt` along it. Every segment is horizontal or vertical:
 *
 * - Sides that face each other (right to left, left to right, bottom to top, top to bottom): a
 *   straight line when the source anchor's line meets the target's side (the target's anchor then
 *   moves along its side to meet it); otherwise three segments, turning `bend` of the way from the
 *   source anchor to the target's (the middle when absent).
 * - Sides at right angles (right to top, bottom to left, ...): two segments, turning once where the
 *   source anchor's line meets the target anchor's.
 * - The same side (left to left, ...): three segments, going out `lane` × LANE points beyond the
 *   further of the two sides (lane 1 when absent), or beyond the grid's own edge on that side when
 *   the route is `outside`, along it, and back in.
 *
 * An edge whose target is a group ends on the group's ground: the group's cells, grown by the
 * arrangement's `pad`.
 *
 * Arrowheads: at the target, and at the source too for an edge whose direction is "both".
 *
 * The labelling rule (`placeLabels`). Labels are placed in the order given. Each one is centred on a
 * point of its own route: the longest segment first, from its middle outwards in steps of STEP
 * points, then the next longest. The first place where the label lies inside the canvas and clear
 * (by CLEAR points) of every box, every other edge and every label already placed is taken. If there
 * is none, the label goes to the middle of the longest segment, moved inside the canvas, and is
 * marked as not fitting (the core's tests require that none of the core's layouts needs that).
 */
import type { DiagramArea, DiagramGroup, DiagramLayoutName, DiagramNode, DiagramRoute, DiagramSide } from "./ui.ts";

export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; width: number; height: number };

/** How far a same-side route's lane runs outside the boxes, per lane. */
export const LANE = 12;
/** The step a label slides along its route, and the clearance it keeps from boxes, edges and labels. */
export const STEP = 4;
export const CLEAR = 2;

const horizontal = (side: DiagramSide) => side === "left" || side === "right";

/** The point `at` (0 to 1) of the way along `side` of `r`. */
export function anchor(r: Rect, side: DiagramSide, at = 0.5): Point {
  switch (side) {
    case "top": return { x: r.x + r.width * at, y: r.y };
    case "bottom": return { x: r.x + r.width * at, y: r.y + r.height };
    case "left": return { x: r.x, y: r.y + r.height * at };
    case "right": return { x: r.x + r.width, y: r.y + r.height * at };
  }
}

/** The corners of an edge's route from `from` to `to`, by the rule above. `grid` is the grid's own frame (for `outside` routes). */
export function routeEdge(from: Rect, to: Rect, route: DiagramRoute, grid?: Rect): Point[] {
  const a = anchor(from, route.from, route.fromAt ?? 0.5);
  const b = anchor(to, route.to, route.toAt ?? 0.5);
  const bend = route.bend ?? 0.5;
  const out = LANE * (route.lane ?? 1);
  const fh = horizontal(route.from), th = horizontal(route.to);
  if (route.from === route.to) {
    const g = route.outside && grid ? grid : null;
    if (fh) {
      const x = route.from === "left" ? (g ? g.x : Math.min(a.x, b.x)) - out : (g ? g.x + g.width : Math.max(a.x, b.x)) + out;
      return [a, { x, y: a.y }, { x, y: b.y }, b];
    }
    const y = route.from === "top" ? (g ? g.y : Math.min(a.y, b.y)) - out : (g ? g.y + g.height : Math.max(a.y, b.y)) + out;
    return [a, { x: a.x, y }, { x: b.x, y }, b];
  }
  if (fh && th) {
    if (a.y >= to.y && a.y <= to.y + to.height) return [a, { x: b.x, y: a.y }];
    const x = a.x + (b.x - a.x) * bend;
    return [a, { x, y: a.y }, { x, y: b.y }, b];
  }
  if (!fh && !th) {
    if (a.x >= to.x && a.x <= to.x + to.width) return [a, { x: a.x, y: b.y }];
    const y = a.y + (b.y - a.y) * bend;
    return [a, { x: a.x, y }, { x: b.x, y }, b];
  }
  return fh ? [a, { x: b.x, y: a.y }, b] : [a, { x: a.x, y: b.y }, b];
}

/** Whether two rectangles overlap, each grown by `by`. */
function hits(a: Rect, b: Rect, by: number): boolean {
  return a.x - by < b.x + b.width && b.x - by < a.x + a.width && a.y - by < b.y + b.height && b.y - by < a.y + a.height;
}

/** A segment as a rectangle of no thickness. */
function segmentRect(p: Point, q: Point): Rect {
  return { x: Math.min(p.x, q.x), y: Math.min(p.y, q.y), width: Math.abs(q.x - p.x), height: Math.abs(q.y - p.y) };
}

export type LabelPlacement = { id: string; x: number; y: number; width: number; height: number; fits: boolean };

/**
 * Where each label goes, by the labelling rule above. `routes` are every drawn edge's corners (the
 * labelled ones and the rest); `labels` the labels to place, in order, with their measured sizes;
 * `bounds` the canvas. Returns each label's centre and size.
 */
export function placeLabels(
  routes: readonly { id: string; points: readonly Point[] }[],
  labels: readonly { id: string; width: number; height: number }[],
  boxes: readonly Rect[],
  bounds: Rect,
): LabelPlacement[] {
  const placed: LabelPlacement[] = [];
  const rectOf = (c: Point, w: number, h: number): Rect => ({ x: c.x - w / 2, y: c.y - h / 2, width: w, height: h });
  for (const label of labels) {
    const own = routes.find((r) => r.id === label.id);
    if (!own || own.points.length < 2) continue;
    const others = routes.filter((r) => r.id !== label.id).flatMap((r) => r.points.slice(1).map((q, i) => segmentRect(r.points[i]!, q)));
    const segments = own.points.slice(1).map((q, i) => [own.points[i]!, q] as const)
      .map(([p, q]) => ({ p, q, length: Math.abs(q.x - p.x) + Math.abs(q.y - p.y) }))
      .sort((s, t) => t.length - s.length);
    const free = (r: Rect) =>
      r.x >= bounds.x && r.y >= bounds.y && r.x + r.width <= bounds.x + bounds.width && r.y + r.height <= bounds.y + bounds.height &&
      !boxes.some((b) => hits(r, b, CLEAR)) && !others.some((s) => hits(r, s, CLEAR)) && !placed.some((l) => hits(r, rectOf(l, l.width, l.height), CLEAR));
    let found: Point | null = null;
    for (const s of segments) {
      const half = s.length / 2;
      for (let d = 0; d <= half && !found; d += STEP) {
        for (const sign of d === 0 ? [1] : [1, -1]) {
          const t = s.length === 0 ? 0.5 : (half + sign * d) / s.length;
          const c = { x: s.p.x + (s.q.x - s.p.x) * t, y: s.p.y + (s.q.y - s.p.y) * t };
          if (free(rectOf(c, label.width, label.height))) { found = c; break; }
        }
      }
      if (found) break;
    }
    if (found) placed.push({ id: label.id, ...found, width: label.width, height: label.height, fits: true });
    else {
      const s = segments[0]!;
      const mid = { x: (s.p.x + s.q.x) / 2, y: (s.p.y + s.q.y) / 2 };
      const x = Math.min(Math.max(mid.x, bounds.x + label.width / 2), bounds.x + bounds.width - label.width / 2);
      const y = Math.min(Math.max(mid.y, bounds.y + label.height / 2), bounds.y + bounds.height - label.height / 2);
      placed.push({ id: label.id, x, y, width: label.width, height: label.height, fits: false });
    }
  }
  return placed;
}

/** A host's sizes for laying out a diagram's grid: equal columns, a title row's height and a box row's. */
export type GridMetrics = { columnWidth: number; columnGap: number; rowGap: number; titleRow: number; boxRow: number; groupPad: number };

/**
 * The frames a host with fixed row heights would give a layout's boxes and groups: for tests and
 * the Swift fixtures. A real host measures its rows (each as tall as its tallest box).
 */
export function gridFrames(node: DiagramNode, layout: DiagramLayoutName, m: GridMetrics): { boxes: Map<string, Rect>; groups: Map<string, Rect>; size: { width: number; height: number } } {
  const grid = node[layout];
  const titleRows = new Set(node.groups.map((g) => g[layout].row));
  const tops: number[] = [];
  let y = 0;
  for (let r = 0; r < grid.rows; r++) {
    tops.push(y);
    y += (titleRows.has(r) ? m.titleRow : m.boxRow) + (r < grid.rows - 1 ? m.rowGap : 0);
  }
  const rowHeight = (r: number) => (titleRows.has(r) ? m.titleRow : m.boxRow);
  const cell = (a: DiagramArea): Rect => ({
    x: a.col * (m.columnWidth + m.columnGap),
    y: tops[a.row]!,
    width: a.cols * m.columnWidth + (a.cols - 1) * m.columnGap,
    height: tops[a.row + a.rows - 1]! + rowHeight(a.row + a.rows - 1) - tops[a.row]!,
  });
  const boxes = new Map(node.boxes.map((b) => [b.id, cell(b[layout])] as const));
  const groups = new Map(node.groups.map((g: DiagramGroup) => {
    const r = cell(g[layout]);
    return [g.id, { x: r.x - m.groupPad, y: r.y - m.groupPad, width: r.width + 2 * m.groupPad, height: r.height + 2 * m.groupPad }] as const;
  }));
  return { boxes, groups, size: { width: grid.columns * m.columnWidth + (grid.columns - 1) * m.columnGap, height: y } };
}
