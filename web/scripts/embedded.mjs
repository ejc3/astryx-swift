// Checks the page's embedded mode with a stand-in for the native app's web view.
//
// The "host" here is a REAL core client running in Node. A fake `window.webkit.messageHandlers.astryx`
// in the page relays the page's messages to it, and the host pushes snapshots back through
// `window.__astryx.receive`, exactly as the Swift side does. The dist/ files are served from a
// made-up origin and a sub-path, which also proves the build has no absolute asset paths.
//
//   npm run embedded -w web              build, then check
//   npm run embedded -w web -- --no-build   check the existing dist/
import { readFileSync, existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { chromium } from "playwright";
import { createClient } from "@astryx-native/core";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = join(root, "dist");
if (!process.argv.includes("--no-build")) await build({ root, logLevel: "warn" });

const ORIGIN = "http://app.test";
const PREFIX = "/bundle/";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json" };

const html = readFileSync(join(dist, "index.html"), "utf8");
let failures = 0;
const assert = (cond, message) => { if (!cond) throw new Error(message); };
async function check(name, fn) {
  try { await fn(); console.log(`ok    ${name}`); } catch (e) { failures++; console.log(`FAIL  ${name}\n      ${String(e.message).split("\n")[0]}`); }
}

await check("the build uses relative asset paths and no crossorigin attributes", async () => {
  assert(/src="\.\/assets\/[^"]+\.js"/.test(html), "script src is ./assets/...");
  assert(/href="\.\/assets\/[^"]+\.css"/.test(html), "stylesheet href is ./assets/...");
  assert(!/crossorigin/.test(html), "no crossorigin attribute");
  assert(!/(src|href)="\//.test(html), "no root-relative paths");
  const stock = readFileSync(join(dist, "stock.html"), "utf8");
  assert(/src="\.\/assets\/[^"]+\.js"/.test(stock) && !/crossorigin/.test(stock) && !/(src|href)="\//.test(stock), "stock.html is relative too");
});

const browser = await chromium.launch();

/** A page in a fake web view, wired to a real core client in this process. */
async function webview({ width = 390, height = 844, start = {} } = {}) {
  const now = () => ({ epochMs: Date.now(), utcOffsetMinutes: -new Date().getTimezoneOffset() });
  const host = createClient(now, start);
  const received = []; // what the page sent, in order
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await context.route(`${ORIGIN}${PREFIX}**`, (route) => {
    const path = new URL(route.request().url()).pathname.slice(PREFIX.length) || "index.html";
    const file = normalize(join(dist, path));
    if (!file.startsWith(dist) || !existsSync(file)) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ status: 200, contentType: TYPES[extname(file)] ?? "application/octet-stream", body: readFileSync(file) });
  });

  let open = false;
  const push = (store) => open && page.evaluate(([s, json]) => window.__astryx.receive(s, json), [store, JSON.stringify(host.getSnapshot(store))]).catch(() => {});
  host.subscribe((store) => { void push(store); });
  await page.exposeFunction("__toHost", (message) => {
    received.push(message);
    if (message.type === "ready") { open = true; void push("app"); void push("theme"); }
    else if (message.type === "dispatch") host.dispatch(message.action);
  });
  await page.addInitScript(() => {
    window.webkit = { messageHandlers: { astryx: { postMessage: (m) => window.__toHost(JSON.parse(JSON.stringify(m))) } } };
  });
  return { host, page, received, errors, context, url: `${ORIGIN}${PREFIX}index.html`, ready: () => open };
}

await check("blank until the host's first snapshot, then drawn from host-pushed snapshots", async () => {
  const w = await webview();
  // Hold the host's reply: the page asks, and nothing is drawn until it is answered.
  await w.page.goto(w.url, { waitUntil: "load" });
  await w.page.waitForFunction(() => window.__astryx !== undefined);
  await w.page.waitForSelector("main", { timeout: 5000 });
  assert(w.received[0]?.type === "ready", `first message is ready: ${JSON.stringify(w.received[0])}`);
  assert(w.received.filter((m) => m.type === "ready").length === 1, "ready is sent once");
  const title = await w.page.locator("h1").first().innerText();
  assert(title === w.host.getSnapshot("app").screen.title, `page title ${title} comes from the host's snapshot`);
  assert(w.errors.length === 0, `page errors: ${w.errors}`);
  await w.context.close();
});

await check("nothing is drawn, and no English, before the first snapshot", async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await context.route(`${ORIGIN}${PREFIX}**`, (route) => {
    const path = new URL(route.request().url()).pathname.slice(PREFIX.length) || "index.html";
    return route.fulfill({ status: 200, contentType: TYPES[extname(path)] ?? "text/html", body: readFileSync(join(dist, path)) });
  });
  await page.addInitScript(() => { window.webkit = { messageHandlers: { astryx: { postMessage: () => {} } } }; });
  await page.goto(`${ORIGIN}${PREFIX}index.html`, { waitUntil: "load" });
  await page.waitForTimeout(500);
  const text = (await page.locator("body").innerText()).trim();
  assert(text === "", `body text should be empty, was ${JSON.stringify(text)}`);
  await context.close();
});

await check("a click in the page reaches the host's client as a dispatch of the action object", async () => {
  const w = await webview();
  await w.page.goto(w.url);
  await w.page.waitForSelector("main");
  await w.page.locator("button").filter({ has: w.page.locator("svg") }).first().click(); // nav drawer
  // The demo inbox: the nav lists the Astryx templates (their own Inbox among them) above the demos.
  await w.page.getByRole("button", { name: "Inbox" }).last().click();
  await w.page.waitForFunction(() => document.querySelector("h1")?.textContent === "Inbox");
  const dispatches = w.received.filter((m) => m.type === "dispatch");
  assert(dispatches.some((m) => m.action.type === "navigate" && m.action.screen === "inbox"), `saw ${JSON.stringify(dispatches)}`);
  assert(dispatches.every((m) => typeof m.action === "object"), "the action is an object, not a string");
  assert(w.host.getSnapshot("app").current === "inbox", "the host's client moved");
  await w.page.getByRole("button", { name: "Inbox" }).first().click(); // phone: back from the open message to the list
  await w.page.getByPlaceholder("Search by person or subject").fill("invoice");
  await w.page.waitForFunction(() => document.querySelectorAll("li .astryx-avatar").length === 1);
  assert(w.host.getSnapshot("app").screen.body.kind === "split", "the host's client holds the search too");
  await w.context.close();
});

await check("a change made on the host's client re-renders the page", async () => {
  const w = await webview();
  await w.page.goto(w.url);
  await w.page.waitForSelector("main");
  w.host.dispatch({ type: "navigate", screen: "calendar" });
  await w.page.locator(".an-cal").waitFor({ timeout: 3000 });
  w.host.dispatch({ type: "press", id: "calendar.month:next" });
  const title = w.host.getSnapshot("app").screen.body;
  assert(title.kind === "grid", "calendar body");
  await w.page.waitForFunction((t) => document.querySelector(".an-cal")?.getAttribute("aria-label") === t, w.host.getSnapshot("app").screen.body.children[0].children[0].title);
  await w.context.close();
});

await check("the theme follows the snapshot, set from the page or from the host", async () => {
  const w = await webview();
  await w.page.goto(w.url);
  await w.page.waitForSelector("main");
  const accent = () => w.page.evaluate(() => getComputedStyle(document.querySelector("[data-astryx-theme]")).getPropertyValue("--color-accent").trim());
  const before = await accent();
  w.host.dispatch({ type: "set", id: "settings.theme", value: "ember" });
  await w.page.waitForFunction((b) => getComputedStyle(document.querySelector("[data-astryx-theme]")).getPropertyValue("--color-accent").trim() !== b, before);
  const ember = await accent();
  await w.page.locator("button").filter({ has: w.page.locator("svg") }).first().click();
  await w.page.locator(".an-swatch[aria-label='Grape']").click();
  await w.page.waitForFunction((b) => getComputedStyle(document.querySelector("[data-astryx-theme]")).getPropertyValue("--color-accent").trim() !== b, ember);
  assert(w.host.getSnapshot("app").theme.id === "grape", "the host's client holds the theme the page chose");
  await w.context.close();
});

await check("the page never sends tick in embedded mode; the toast timeout goes through the host", async () => {
  const w = await webview({ start: { screen: "overview" } });
  await w.page.clock.install();
  await w.page.goto(w.url);
  await w.page.waitForSelector("main");
  await w.page.clock.fastForward(130_000);
  assert(!w.received.some((m) => m.type === "dispatch" && m.action.type === "tick"), "no tick after two minutes");
  await w.page.getByRole("button", { name: "Show a toast" }).click();
  await w.page.locator(".an-toast").waitFor({ timeout: 3000 });
  await w.page.clock.fastForward(4500);
  await w.page.locator(".an-toast").waitFor({ state: "detached", timeout: 3000 });
  assert(w.received.some((m) => m.type === "dispatch" && m.action.type === "dismissToast"), "dismissToast reached the host");
  assert(w.host.getSnapshot("app").toast === null, "the host's toast is gone");
  await w.context.close();
});

await check("a toast that offers Undo is not timed out: it stays until a person acts", async () => {
  const w = await webview({ start: { screen: "inbox" } });
  await w.page.clock.install();
  await w.page.goto(w.url);
  await w.page.waitForSelector("main");
  w.host.dispatch({ type: "press", id: "inbox.archive:m1" });
  await w.page.locator(".an-toast").waitFor({ timeout: 3000 });
  await w.page.clock.fastForward(30_000);
  assert(await w.page.locator(".an-toast").isVisible(), "the Undo toast is still on screen after 30 s");
  assert(!w.received.some((m) => m.type === "dispatch" && m.action.type === "dismissToast"), "no dismissToast was sent");
  await w.context.close();
});

await check("the stock page switches template on window.__astryxStock.show, with no reload", async () => {
  const context = await browser.newContext({ viewport: { width: 1000, height: 800 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await context.route(`${ORIGIN}${PREFIX}**`, (route) => {
    const path = new URL(route.request().url()).pathname.slice(PREFIX.length) || "index.html";
    const file = normalize(join(dist, path));
    if (!file.startsWith(dist) || !existsSync(file)) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ status: 200, contentType: TYPES[extname(file)] ?? "application/octet-stream", body: readFileSync(file) });
  });
  await page.goto(`${ORIGIN}${PREFIX}stock.html?template=kanban-board`);
  await page.getByText("Sprint Board").first().waitFor({ timeout: 8000 });
  await page.evaluate(() => { window.marker = 1; });
  await page.evaluate(() => window.__astryxStock.show("settings"));
  await page.getByText("Account", { exact: false }).first().waitFor({ timeout: 8000 });
  assert((await page.getByText("Sprint Board").count()) === 0, "the board is gone");
  await page.evaluate(() => window.__astryxStock.show("calendar"));
  await page.getByText("April 2026").waitFor({ timeout: 8000 });
  await page.evaluate(() => window.__astryxStock.show("no-such-template"));
  await page.getByText("Little joys").waitFor({ timeout: 8000 }); // the first template
  assert((await page.evaluate(() => window.marker)) === 1, "no reload");
  assert(errors.length === 0, `page errors: ${errors}`);
  await context.close();
});

// Small widths: a phone filling the screen, and a half-window on a Mac.
for (const width of [390, 600, 760, 900]) {
  await check(`${width}px: every screen fits the width and draws`, async () => {
    const w = await webview({ width, height: 800 });
    await w.page.goto(w.url);
    await w.page.waitForSelector("main");
    for (const screen of ["overview", "dashboard", "inbox", "tasks", "people", "calendar", "chat", "checkout", "profile", "settings"]) {
      w.host.dispatch({ type: "navigate", screen });
      await w.page.waitForFunction((id) => document.title.length > 0 && document.querySelector("main") !== null, screen);
      await w.page.waitForTimeout(80);
      const over = await w.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert(over <= 0, `${screen} overflows by ${over}px`);
    }
    assert(w.errors.length === 0, `page errors: ${w.errors}`);
    await w.context.close();
  });
}

await browser.close();
if (failures) { console.log(`\n${failures} check(s) failed`); process.exitCode = 1; } else console.log("\nall checks passed");
