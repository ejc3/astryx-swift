// Writes every screen's snapshot, and every theme, as JSON fixtures for the hosts' tests:
// apps/native/apple/AstryxKit/Tests/AstryxKitTests/Fixtures. Run: node scripts/fixtures.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createClient, SCREENS, TEMPLATES, THEME_INPUTS, type Now } from "../src/index.ts";

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
console.log(`${SCREENS.length + extra.length} app fixtures, ${TEMPLATES.length} template fixtures and ${THEME_INPUTS.length} themes -> ${dir}`);
