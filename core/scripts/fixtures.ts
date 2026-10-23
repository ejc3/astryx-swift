// Writes every screen's snapshot, and every theme, as JSON fixtures for the hosts' tests:
// apps/native/apple/AstryxKit/Tests/AstryxKitTests/Fixtures. Run: node scripts/fixtures.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createClient, gridFrames, placeLabels, routeEdge, SCREENS, TEMPLATES, THEME_INPUTS, type AppSnapshot, type DiagramNode, type Now } from "../src/index.ts";

// Tuesday 2026-10-13, 9:30 AM in UTC-7: the fixtures' fixed "now".
const NOW: Now = { epochMs: Date.UTC(2026, 9, 13, 16, 30), utcOffsetMinutes: -420 };
const dir = fileURLToPath(new URL("../../apps/native/apple/AstryxKit/Tests/AstryxKitTests/Fixtures/", import.meta.url));
mkdirSync(dir, { recursive: true });
for (const screen of SCREENS) {
  const c = createClient(() => NOW, { screen });
  writeFileSync(`${dir}app-${screen}.json`, JSON.stringify(c.getSnapshot("app"), null, 1) + "\n");
}
// Every refactored template's screen, as the native apps receive it (a "template" node with its view model).
for (const t of TEMPLATES) {
  const c = createClient(() => NOW, { screen: `t.${t.id}` });
  writeFileSync(`${dir}template-${t.id}.json`, JSON.stringify(c.getSnapshot("app"), null, 1) + "\n");
}
// A few states worth drawing: a toast, a dialog, an inbox on a phone (detail shown), checkout errors.
const extra: [string, (c: ReturnType<typeof createClient>) => void][] = [
  ["inbox-archived", (c) => { c.dispatch({ type: "navigate", screen: "inbox" }); c.dispatch({ type: "press", id: "inbox.archive:m1" }); }],
  ["settings-dialog", (c) => { c.dispatch({ type: "navigate", screen: "settings" }); c.dispatch({ type: "press", id: "settings.delete" }); }],
  ["checkout-errors", (c) => { c.dispatch({ type: "navigate", screen: "checkout" }); c.dispatch({ type: "press", id: "checkout.next" }); c.dispatch({ type: "press", id: "checkout.next" }); }],
  ["architecture-selected", (c) => { c.dispatch({ type: "navigate", screen: "architecture" }); c.dispatch({ type: "press", id: "how.select:axclient" }); }],
  ["people-selected", (c) => { c.dispatch({ type: "navigate", screen: "people" }); c.dispatch({ type: "set", id: "people.check:p2", value: true }); c.dispatch({ type: "set", id: "people.check:p4", value: true }); }],
];
for (const [name, steps] of extra) {
  const c = createClient(() => NOW);
  steps(c);
  writeFileSync(`${dir}app-${name}.json`, JSON.stringify(c.getSnapshot("app"), null, 1) + "\n");
}
for (const t of THEME_INPUTS) {
  const c = createClient(() => NOW, { theme: t.id });
  writeFileSync(`${dir}theme-${t.id}.json`, JSON.stringify(c.getSnapshot("theme"), null, 1) + "\n");
}
// The diagram's routes and label places as the core computes them over fixed frames, for the
// Swift ports of routeEdge and placeLabels: each arrangement, at rest and with AXClient selected.
{
  const cases = [];
  for (const selected of [null, "axclient"]) {
    const c = createClient(() => NOW, { screen: "architecture" });
    if (selected) c.dispatch({ type: "press", id: `how.select:${selected}` });
    const node = (c.getSnapshot("app") as AppSnapshot).screen.body as DiagramNode;
    for (const layout of ["wide", "narrow", "single"] as const) {
      const m = { columnWidth: layout === "wide" ? 190 : layout === "narrow" ? 150 : 240, columnGap: node[layout].gap.x, rowGap: node[layout].gap.y, titleRow: 22, boxRow: 64, groupPad: node[layout].pad };
      const { boxes, groups, size } = gridFrames(node, layout, m);
      const grid = { x: 0, y: 0, width: size.width, height: size.height };
      const drawn = node.edges.filter((e) => e.drawn[layout]);
      const routes = drawn.map((e) => ({ id: e.id, points: routeEdge(boxes.get(e.from)!, e.toGroup ? groups.get(e.to)! : boxes.get(e.to)!, e[layout], grid) }));
      const labels = node[layout].labels ? drawn.filter((e) => e.showLabel).map((e) => ({ id: e.id, width: Math.ceil(e.label.length * 6.6) + 10, height: 20 })) : [];
      const bounds = { x: -node[layout].margin.left, y: -node[layout].margin.top, width: size.width + node[layout].margin.left + node[layout].margin.right, height: size.height + node[layout].margin.top + m.groupPad };
      cases.push({
        layout, selected, grid,
        frames: Object.fromEntries([...boxes].map(([id, r]) => [id, r])),
        groupFrames: Object.fromEntries([...groups].map(([id, r]) => [id, r])),
        routes: Object.fromEntries(routes.map((r) => [r.id, r.points])),
        labels, bounds,
        placed: placeLabels(routes, labels, [...boxes.values()], bounds),
      });
    }
  }
  writeFileSync(`${dir}diagram-routes.json`, JSON.stringify(cases, null, 1) + "\n");
}
console.log(`${SCREENS.length + extra.length} app fixtures, ${TEMPLATES.length} template fixtures and ${THEME_INPUTS.length} themes -> ${dir}`);
