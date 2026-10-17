// The refactor's test: each refactored template (index.html?screen=t.<id>&bare=1, on the
// core) against its stock copy (stock.html?template=<astryx name>, on its own React state),
// screenshot for screenshot, in Chromium and WebKit, light and dark, desktop and phone.
// Every pixel must match. Diffs go to web/parity/ (git-ignored).
//
//   npm run parity -w web                    build, then compare every template
//   npm run parity -w web -- dashboard chat  only these
//   npm run parity -w web -- --no-build
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { build, preview } from "vite";
import { chromium, webkit } from "playwright";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { TEMPLATES } from "@astryx-native/core";

const root = fileURLToPath(new URL("..", import.meta.url));
const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const only = new Set(args);
const chosen = TEMPLATES.filter((t) => only.size === 0 || only.has(t.id));

const SIZES = [
  { name: "desktop", width: 1440, height: 900, scale: 1 },
  { name: "phone", width: 390, height: 844, scale: 2 },
];
const SCHEMES = ["light", "dark"];
const ENGINES = [["chromium", chromium], ["webkit", webkit]];

// Nothing that moves or blinks: the two copies are compared at rest.
const STILL = "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}";

// A build of its own, so several runs at once (one per template being refactored) do not
// overwrite each other's dist/. `--no-build` serves dist/ as it is.
const own = !process.argv.includes("--no-build");
const outDir = own ? fileURLToPath(new URL(`../.parity-build/${process.pid}/`, import.meta.url)) : fileURLToPath(new URL("../dist/", import.meta.url));
if (own) await build({ root, logLevel: "warn", build: { outDir, emptyOutDir: true } });
const out = fileURLToPath(new URL(`../parity/${only.size ? [...only].join("-") : "all"}/`, import.meta.url));
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const server = await preview({ root, logLevel: "error", build: { outDir }, preview: { port: 0, host: "localhost", strictPort: false } });
const base = server.resolvedUrls?.local[0];

/**
 * A template's interaction steps, if it has any: scripts/parity-steps/<id>.mjs exports
 * `[{ name, run: async (page) => {...} }]`, done as a person would (clicks, typing, by role
 * and accessible name), the same on both copies. Both must match after every step.
 */
async function stepsFor(id) {
  try {
    return (await import(`./parity-steps/${id}.mjs`)).default;
  } catch (error) {
    if (error?.code === "ERR_MODULE_NOT_FOUND") return [];
    throw error;
  }
}

/** Opens `url` and returns screenshots: at rest, then after each step. */
async function shots(browser, url, size, scheme, steps, problems) {
  // The same fixed clock for both copies, so any date a template shows is the same.
  const context = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: size.scale, colorScheme: scheme, timezoneId: "America/Los_Angeles", locale: "en-US" });
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date("2026-10-13T09:30:00-07:00"));
  page.on("pageerror", (e) => problems.push(`${url}: ${e.message}`));
  await page.goto(url, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: STILL });
  await page.waitForSelector("#root > *", { state: "attached" });
  await page.evaluate(() => document.fonts.ready);
  const still = async () => {
    await page.waitForTimeout(400);
    return PNG.sync.read(await page.screenshot({ fullPage: true }));
  };
  const out = [{ name: "rest", png: await still() }];
  for (const step of steps) {
    try {
      await step.run(page);
      out.push({ name: step.name, png: await still() });
    } catch (error) {
      problems.push(`${url} step "${step.name}": ${error.message.split("\n")[0]}`);
      break;
    }
  }
  await context.close();
  return out;
}

const rows = [];
const problems = [];
for (const [engine, type] of ENGINES) {
  const browser = await type.launch();
  for (const t of chosen) {
    const steps = await stepsFor(t.id);
    for (const size of SIZES) for (const scheme of SCHEMES) {
      const stockShots = await shots(browser, `${base}stock.html?template=${encodeURIComponent(t.astryx)}`, size, scheme, steps, problems);
      const ourShots = await shots(browser, `${base}?screen=t.${t.id}&bare=1`, size, scheme, steps, problems);
      for (let i = 0; i < Math.max(stockShots.length, ourShots.length); i++) {
        const stock = stockShots[i]?.png, ours = ourShots[i]?.png;
        const name = `${t.id}-${engine}-${size.name}-${scheme}-${i}-${(stockShots[i] ?? ourShots[i]).name.replace(/[^a-z0-9]+/gi, "_")}`;
        let differing;
        if (!stock || !ours) differing = "one copy could not do this step";
        else if (stock.width !== ours.width || stock.height !== ours.height) {
          differing = `size ${stock.width}x${stock.height} vs ${ours.width}x${ours.height}`;
          writeFileSync(`${out}${name}-stock.png`, PNG.sync.write(stock));
          writeFileSync(`${out}${name}-ours.png`, PNG.sync.write(ours));
        } else {
          const diff = new PNG({ width: stock.width, height: stock.height });
          const n = pixelmatch(stock.data, ours.data, diff.data, stock.width, stock.height, { threshold: 0 });
          differing = n === 0 ? "" : `${n} pixels`;
          if (n > 0) {
            writeFileSync(`${out}${name}-diff.png`, PNG.sync.write(diff));
            writeFileSync(`${out}${name}-stock.png`, PNG.sync.write(stock));
            writeFileSync(`${out}${name}-ours.png`, PNG.sync.write(ours));
          }
        }
        rows.push({ name, differing });
        console.log(`${differing === "" ? "  same" : "  DIFF"}  ${name}${differing ? `  ${differing}` : ""}`);
      }
    }
  }
  await browser.close();
}
await server.close();
if (own) rmSync(outDir, { recursive: true, force: true });
for (const p of problems) console.log(`  page error: ${p}`);
const bad = rows.filter((r) => r.differing !== "");
console.log(`${rows.length - bad.length} of ${rows.length} identical${bad.length ? `; diffs in ${out}` : ""}`);
process.exit(bad.length === 0 && problems.length === 0 ? 0 : 1);
