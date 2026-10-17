// Builds the app, serves the build, and screenshots every screen into web/shots/ (git-ignored):
// 1440x900 and 390x844, light and dark, plus the ocean and grape looks on the dashboard, plus the
// stock page (Astryx's own templates) for each screen, light.
//
//   npm run shots -w web              build, then shoot
//   npm run shots -w web -- --no-build   shoot the existing dist/
//
// The browser comes from Playwright's cache (`npx playwright install chromium` once).
import { mkdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { build, preview } from "vite";
import { chromium } from "playwright";
import { SCREENS } from "@astryx-native/core";

const root = fileURLToPath(new URL("..", import.meta.url));
const out = fileURLToPath(new URL("../shots/", import.meta.url));

const SIZES = [
  { name: "desktop", width: 1440, height: 900, scale: 1 },
  { name: "mobile", width: 390, height: 844, scale: 2 },
];

if (!process.argv.includes("--no-build")) await build({ root, logLevel: "warn" });
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const server = await preview({ root, logLevel: "error", preview: { port: 0, host: "localhost", strictPort: false } });
const base = server.resolvedUrls?.local[0];
if (!base) throw new Error("The preview server gave no address.");

const browser = await chromium.launch();
const problems = [];

// The stock page (Astryx's own templates), by the screen it stands in for.
const STOCK = {
  overview: "theme-showcase", dashboard: "dashboard", inbox: "table-inbox", tasks: "kanban-board", people: "table-page",
  calendar: "CalendarShowcase", chat: "ai-chat", checkout: "checkout-wizard", profile: "detail-page", settings: "settings",
};

async function shoot({ screen, theme, size, scheme, stock }) {
  const context = await browser.newContext({
    viewport: { width: size.width, height: size.height },
    deviceScaleFactor: size.scale,
    colorScheme: scheme,
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => problems.push(`${screen}/${size.name}/${scheme}: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") problems.push(`${screen}/${size.name}/${scheme}: ${m.text()}`); });
  const query = new URLSearchParams(stock ? { template: STOCK[screen] } : { screen, ...(theme ? { theme } : {}) });
  await page.goto(`${base}${stock ? "stock.html" : ""}?${query}`, { waitUntil: "networkidle" });
  await page.waitForSelector(stock ? "#root > *" : "main");
  await page.waitForTimeout(stock ? 600 : 250);
  const name = `${stock ? "stock-" : ""}${screen}${theme ? `-${theme}` : ""}-${size.name}-${scheme}.png`;
  await page.screenshot({ path: `${out}${name}`, fullPage: true });
  await context.close();
  return name;
}

const made = [];
for (const screen of SCREENS)
  for (const size of SIZES)
    for (const scheme of ["light", "dark"]) made.push(await shoot({ screen, size, scheme }));
for (const theme of ["ocean", "grape"])
  for (const [size, scheme] of [[SIZES[0], "light"], [SIZES[0], "dark"], [SIZES[1], "light"]])
    made.push(await shoot({ screen: "dashboard", theme, size, scheme }));

for (const screen of SCREENS)
  for (const size of SIZES) made.push(await shoot({ screen, size, scheme: "light", stock: true }));
// Half a Mac window: the app's web page next to the native drawing.
for (const screen of SCREENS) made.push(await shoot({ screen, size: { name: "half", width: 700, height: 900, scale: 1 }, scheme: "light" }));

await browser.close();
await new Promise((resolve) => server.httpServer.close(resolve));

console.log(`${made.length} screenshots in ${out}`);
if (problems.length > 0) {
  console.error(`\n${problems.length} page problem(s):\n${[...new Set(problems)].join("\n")}`);
  process.exitCode = 1;
}
