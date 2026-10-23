/**
 * Where "How it works" puts each box and how each edge runs, in the three arrangements the core
 * gives its diagram (ui.ts `DiagramNode`):
 *
 * - `wide`: five lanes left to right (Astryx, the core, the Apple app, the drawings, the proof)
 *   with sync in a band below. Every edge is drawn, routed by hand here.
 * - `narrow`: two columns, the groups one above another; `single`: one column, for a phone at the
 *   accessibility text sizes or a very narrow page. They draw the edges between neighbouring boxes
 *   at rest, and every edge of the selected box, routed by a rule (`columnRoutes`) over just the
 *   edges drawn, so no gutter ever carries more than two lines.
 *
 * core/test/architecture.test.ts checks every arrangement and selection: no route through a box or
 * a group title, none along another, at most two lines in a gutter, no two arrowheads together,
 * every box joined (at rest or when selected), and every label it shows clear of boxes and edges.
 */
import { LANE } from "../diagram.ts";
import type { DiagramArea, DiagramGrid, DiagramLayoutName, DiagramRoute, DiagramSide } from "../ui.ts";

export const at = (col: number, row: number, cols = 1, rows = 1): DiagramArea => ({ col, row, cols, rows });
const r = (from: DiagramSide, to: DiagramSide, extra: Partial<DiagramRoute> = {}): DiagramRoute => ({ from, to, ...extra });

/** The groups and boxes in reading order, which is also the single column's order. */
export const GROUP_ORDER = ["astryx", "core", "app", "drawings", "proof", "sync"] as const;
export const BOX_ORDER: Record<(typeof GROUP_ORDER)[number], string[]> = {
  astryx: ["cli", "components"],
  core: ["templates", "view", "tokens", "saved"],
  app: ["hermes", "axclient", "webviews"],
  drawings: ["stock", "swiftui", "jsx", "own"],
  proof: ["fixtures", "replay", "parity"],
  sync: ["device", "zero", "cache", "api", "postgres", "access"],
};

/**
 * Columns, rows, gaps (Astryx spacing steps: 32 is spacing-8, 28 spacing-7, 24 spacing-6) and how
 * far a group's ground reaches beyond its cells; the margins come from the routes (`withMargins`).
 */
export const GRIDS: Record<DiagramLayoutName, Omit<DiagramGrid, "margin">> = {
  wide: { columns: 5, rows: 9, gap: { x: 32, y: 24 }, pad: 8, labels: true },
  narrow: { columns: 2, rows: 18, gap: { x: 32, y: 28 }, pad: 8, labels: true },
  single: { columns: 1, rows: GROUP_ORDER.length + Object.values(BOX_ORDER).flat().length, gap: { x: 0, y: 24 }, pad: 8, labels: false },
};

/** Room beside and above the grid for the routes that run outside it, plus the groups' padding. */
export function withMargins(grid: Omit<DiagramGrid, "margin">, routes: readonly DiagramRoute[]): DiagramGrid {
  // A lane counts from a box's side or, for a route to a group, from the group's ground (pad further out).
  const out = (side: DiagramSide) => Math.max(0, ...routes.filter((r) => r.from === side && r.to === side && (side !== "top" || r.outside)).map((r) => (r.lane ?? 1) * LANE + (r.outside ? 0 : grid.pad)));
  return { ...grid, margin: { top: Math.max(grid.pad, out("top") + 6), left: Math.max(grid.pad, out("left") + 6), right: Math.max(grid.pad, out("right") + 6) } };
}

export const GROUP_AREAS: Record<string, { wide: DiagramArea; narrow: DiagramArea }> = {
  astryx: { wide: at(0, 0, 1, 6), narrow: at(0, 0, 2, 2) },
  core: { wide: at(1, 0, 1, 6), narrow: at(0, 2, 2, 3) },
  app: { wide: at(2, 0, 1, 6), narrow: at(0, 5, 2, 3) },
  drawings: { wide: at(3, 0, 1, 6), narrow: at(0, 8, 2, 3) },
  proof: { wide: at(4, 0, 1, 6), narrow: at(0, 11, 2, 3) },
  sync: { wide: at(0, 6, 5, 3), narrow: at(0, 14, 2, 4) },
};

export const BOX_AREAS: Record<string, { wide: DiagramArea; narrow: DiagramArea }> = {
  cli: { wide: at(0, 1), narrow: at(1, 1) },
  components: { wide: at(0, 5), narrow: at(0, 1) },
  templates: { wide: at(1, 1), narrow: at(1, 3) },
  view: { wide: at(1, 2), narrow: at(1, 4) },
  tokens: { wide: at(1, 3), narrow: at(0, 3) },
  saved: { wide: at(1, 4), narrow: at(0, 4) },
  hermes: { wide: at(2, 1), narrow: at(0, 6) },
  axclient: { wide: at(2, 2), narrow: at(1, 6) },
  webviews: { wide: at(2, 3), narrow: at(0, 7) },
  stock: { wide: at(3, 1), narrow: at(1, 9) },
  swiftui: { wide: at(3, 2), narrow: at(1, 10) },
  jsx: { wide: at(3, 3), narrow: at(0, 9) },
  own: { wide: at(3, 4), narrow: at(0, 10) },
  fixtures: { wide: at(4, 2), narrow: at(1, 12) },
  replay: { wide: at(4, 3), narrow: at(0, 12) },
  parity: { wide: at(4, 4), narrow: at(1, 13) },
  device: { wide: at(0, 7), narrow: at(1, 15) },
  zero: { wide: at(1, 7), narrow: at(0, 15) },
  cache: { wide: at(3, 7), narrow: at(0, 16) },
  api: { wide: at(2, 8), narrow: at(1, 16) },
  postgres: { wide: at(4, 8), narrow: at(0, 17) },
  access: { wide: at(0, 8), narrow: at(1, 17) },
};

/** Each edge's route in the wide arrangement, by hand. */
export const WIDE_ROUTES: Record<string, DiagramRoute> = {
  // Upstream: the CLI along the top, to the core's templates under the lane titles and to stock above them.
  // Midway between the lane titles and the boxes, so its label clears both.
  "cli-templates": r("top", "top", { fromAt: 0.95, toAt: 0.5, lane: 1 }),
  "cli-stock": r("top", "top", { fromAt: 0.8, toAt: 0.85, outside: true, lane: 3 }),
  "components-tokens": r("top", "left", { fromAt: 0.85, toAt: 0.6 }),
  "components-drawings": r("right", "left", { fromAt: 0.5 }),
  "hermes-core": r("top", "top", { fromAt: 0.85, toAt: 0.6, outside: true, lane: 2 }),
  "templates-view": r("bottom", "top"),
  "templates-saved": r("left", "left", { fromAt: 0.75, toAt: 0.3 }),
  "view-axclient": r("right", "left", { fromAt: 0.5 }),
  "tokens-axclient": r("right", "left", { fromAt: 0.5, toAt: 0.85, bend: 0.4 }),
  "axclient-templates": r("left", "right", { fromAt: 0.15, toAt: 0.75, bend: 0.6 }),
  "axclient-swiftui": r("right", "left", { fromAt: 0.35 }),
  "swiftui-axclient": r("left", "right", { fromAt: 0.7 }),
  "axclient-webviews": r("bottom", "top", { fromAt: 0.3 }),
  "webviews-axclient": r("top", "bottom", { fromAt: 0.7 }),
  "webviews-jsx": r("right", "left", { fromAt: 0.25 }),
  "jsx-webviews": r("left", "right", { fromAt: 0.5 }),
  "webviews-own": r("right", "left", { fromAt: 0.8, bend: 0.5 }),
  "webviews-stock": r("right", "left", { fromAt: 0.95, toAt: 0.5, bend: 0.25 }),
  "fixtures-swiftui": r("left", "right", { fromAt: 0.3 }),
  "replay-swiftui": r("left", "right", { fromAt: 0.25, toAt: 0.85, bend: 0.5 }),
  "replay-jsx": r("left", "right", { fromAt: 0.6 }),
  "parity-own": r("left", "right", { fromAt: 0.5 }),
  "parity-stock": r("right", "right", { fromAt: 0.5, toAt: 0.5, lane: 1 }),
  // Down past the components line and under the band's title, then across to the device copy.
  "saved-device": r("bottom", "top", { fromAt: 0.1, toAt: 0.6, bend: 0.92 }),
  "saved-zero": r("bottom", "top", { fromAt: 0.8 }),
  "zero-cache": r("right", "left", { fromAt: 0.35 }),
  "postgres-cache": r("top", "right", { fromAt: 0.5, toAt: 0.6 }),
  "cache-api": r("bottom", "right", { fromAt: 0.35, toAt: 0.3 }),
  "api-postgres": r("right", "left", { fromAt: 0.7 }),
  "access-api": r("right", "left", { fromAt: 0.55 }),
  "api-zero": r("top", "right", { fromAt: 0.3, toAt: 0.7 }),
};

type Edge = { id: string; from: string; to: string; toGroup: boolean };

/** Whether two boxes are neighbours in a column arrangement: next to each other in a column (title rows between them do not count) or side by side in a row. */
export function neighbours(columns: number, boxes: Record<string, DiagramArea>, a: DiagramArea, b: DiagramArea): boolean {
  const occupied = (col: number, row: number) => Object.values(boxes).some((x) => x.col === col && x.row === row);
  if (a.col === b.col) {
    const lo = Math.min(a.row, b.row), hi = Math.max(a.row, b.row);
    for (let row = lo + 1; row < hi; row++) if (occupied(a.col, row)) return false;
    return true;
  }
  return columns > 1 && a.row === b.row && Math.abs(a.col - b.col) === 1;
}

/**
 * Routes for a column arrangement (narrow: two columns; single: one), by a rule rather than by
 * hand, over the edges drawn in one state (the neighbours' edges, and the selected box's):
 *
 * - Neighbours in a column: straight down or up (a second edge between the same two a little left).
 *   Neighbours in a row: straight across, high on the facing sides.
 * - An edge to a group: straight to the group's ground, from the side facing it.
 * - Every other edge runs in a channel: the gutter between the two columns, or the margin left or
 *   right of the grid, in whichever lane nearest the boxes has no other edge over the same height.
 *   A channel holds at most two lanes; the shorter edges are placed first.
 * - On a box's side the routes are shared out: those going up in the upper half, those going down
 *   in the lower half, so no two arrive together.
 *
 * Throws if a state needs more than two lanes in every channel: the layout must change.
 */
export function columnRoutes(
  columns: number,
  gap: number,
  boxes: Record<string, DiagramArea>,
  groups: Record<string, DiagramArea>,
  edges: readonly Edge[],
): Record<string, DiagramRoute> {
  const occupied = (col: number, row: number) => Object.values(boxes).some((x) => x.col === col && x.row === row);
  const routes: Record<string, DiagramRoute> = {};
  type Channel = "left" | "gutter" | "right";
  const used: { channel: Channel; lane: number; lo: number; hi: number }[] = [];
  /** Endpoints on each side of each box, with the height they leave towards (to order them). */
  const ends = new Map<string, { edge: string; end: "from" | "to"; toward: number }[]>();
  const note = (box: string, side: DiagramSide, edge: string, end: "from" | "to", toward: number) => {
    const k = `${box}:${side}`;
    ends.set(k, [...(ends.get(k) ?? []), { edge, end, toward }]);
  };
  const pairs = new Map<string, number>();
  const area = (e: Edge, end: "from" | "to") => (end === "to" && e.toGroup ? groups[e.to]! : boxes[e[end]]!);
  const mid = (a: DiagramArea) => a.row + a.rows / 2;
  const span = (e: Edge) => Math.abs(mid(area(e, "from")) - mid(area(e, "to")));
  const sorted = [...edges].sort((x, y) => span(x) - span(y) || x.id.localeCompare(y.id));
  const GUTTER = [0.35, 0.65];
  for (const e of sorted) {
    const a = area(e, "from"), b = area(e, "to");
    if (e.toGroup) {
      // Straight to the group's ground when nothing stands between; else in a margin's lane, below.
      const down = b.row > a.row;
      const rows = down ? [a.row + 1, b.row - 1] : [b.row + b.rows, a.row - 1];
      let clear = true;
      for (let row = rows[0]!; row <= rows[1]!; row++) if (occupied(a.col, row)) clear = false;
      if (clear) {
        routes[e.id] = down ? { from: "bottom", to: "top", fromAt: 0.85 } : { from: "top", to: "bottom", fromAt: 0.85 };
        continue;
      }
    }
    if (neighbours(columns, boxes, a, b)) {
      const pair = [e.from, e.to].sort().join("+");
      const k = pairs.get(pair) ?? 0;
      pairs.set(pair, k + 1);
      if (a.col === b.col) {
        // Right of the group titles, which sit at a column's left.
        const down = b.row > a.row, x = [0.92, 0.75][k] ?? 0.5;
        routes[e.id] = { from: down ? "bottom" : "top", to: down ? "top" : "bottom", fromAt: x, toAt: x };
      } else {
        const right = b.col > a.col, y = [0.5, 0.42][k] ?? 0.5;
        routes[e.id] = { from: right ? "right" : "left", to: right ? "left" : "right", fromAt: y, toAt: y };
      }
      continue;
    }
    // A lane: its height runs from the source's middle to the target's (half-open at each end, so
    // routes meeting one box from above and from below do not count as sharing).
    const lo = Math.min(mid(a), mid(b)), hi = Math.max(mid(a), mid(b));
    const reaches = (x: DiagramArea, channel: Channel) =>
      channel === "gutter" ? columns === 2 : channel === "left" ? x.col === 0 || !occupied(0, x.row) : x.col + x.cols === columns || !occupied(columns - 1, x.row);
    const free = (channel: Channel, lane: number) => !used.some((u) => u.channel === channel && u.lane === lane && u.lo < hi && lo < u.hi);
    const channels: Channel[] = (columns === 2 ? ["gutter", a.col === 0 ? "left" : "right", a.col === 0 ? "right" : "left"] as Channel[] : ["right", "left"] as Channel[])
      .filter((c) => !(e.toGroup && c === "gutter"));
    let pick: { channel: Channel; lane: number } | null = null;
    for (let lane = 1; lane <= 2 && !pick; lane++) {
      for (const channel of channels) {
        if (!pick && reaches(a, channel) && reaches(b, channel) && free(channel, lane)) pick = { channel, lane };
      }
    }
    if (!pick) throw new Error(`No channel for ${e.id}`);
    used.push({ ...pick, lo, hi });
    let route: DiagramRoute;
    if (pick.channel === "gutter") {
      const g = GUTTER[pick.lane - 1]!;
      if (a.col !== b.col) route = a.col === 0 ? { from: "right", to: "left", bend: g } : { from: "left", to: "right", bend: 1 - g };
      else route = a.col === 0 ? { from: "right", to: "right", lane: (g * gap) / LANE } : { from: "left", to: "left", lane: ((1 - g) * gap) / LANE };
    } else {
      route = { from: pick.channel, to: pick.channel, lane: pick.lane };
    }
    routes[e.id] = route;
    note(e.from, route.from, e.id, "from", mid(b));
    if (!e.toGroup) note(e.to, route.to, e.id, "to", mid(a));
  }
  // Share each side out: upward routes in the upper half, downward ones in the lower half.
  for (const [key, list] of ends) {
    const area0 = boxes[key.split(":")[0]!]!, box = mid(area0);
    // The second column's anchors sit a little lower, so routes from facing boxes in a row never meet.
    const shift = area0.col === 1 ? 0.1 : 0;
    const up = list.filter((p) => p.toward < box).sort((x, y) => x.toward - y.toward);
    const down = list.filter((p) => p.toward >= box).sort((x, y) => x.toward - y.toward);
    const set = (p: { edge: string; end: "from" | "to" }, at: number) => {
      routes[p.edge] = { ...routes[p.edge]!, [p.end === "from" ? "fromAt" : "toAt"]: Math.round(at * 100) / 100 };
    };
    up.forEach((p, k) => set(p, 0.1 + shift + (0.3 * k) / Math.max(up.length, 1)));
    down.forEach((p, k) => set(p, 0.55 + shift + (0.3 * k) / Math.max(down.length, 1)));
  }
  return routes;
}

/** The single column: the groups in reading order, each a title row and then its boxes. */
export function singleAreas(): { groups: Record<string, DiagramArea>; boxes: Record<string, DiagramArea> } {
  const groups: Record<string, DiagramArea> = {};
  const boxes: Record<string, DiagramArea> = {};
  let row = 0;
  for (const g of GROUP_ORDER) {
    groups[g] = at(0, row, 1, BOX_ORDER[g].length + 1);
    row++;
    for (const b of BOX_ORDER[g]) { boxes[b] = at(0, row); row++; }
  }
  return { groups, boxes };
}
