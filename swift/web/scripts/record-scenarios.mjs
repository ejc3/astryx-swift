// Records the parity steps of each refactored template as scenarios (core/src/scenarios.ts),
// and proves they replay.
//
//   pnpm --filter ./web record                       record every template that has parity steps
//   pnpm --filter ./web record -- inbox chat         only these (the others stay as they are)
//   pnpm --filter ./web replay                       replay the recorded scenarios on a fresh page
//   pnpm --filter ./web replay -- inbox              only these
//   add --no-build to either to serve dist/ as it is
//
// RECORD runs each step of scripts/parity-steps/<id>.mjs on the refactored page
// (index.html?screen=t.<id>&bare=1) through a recording stand-in for `page`. Every locator
// chain the step uses is kept as data (LocatorOp[]), every gesture (click, fill, check, ...)
// is kept with its target and then done for real, and the core actions the page dispatched
// are kept too (window.__astryxRecord, see web/src/client.ts). Before each gesture the
// in-page driver (public/astryx-drive.js) must resolve the target to the very element
// Playwright found. Output: core/src/scenarios.generated.ts, and a screenshot after each step
// in parity/scenarios/<id>/ (git-ignored) for REPLAY.
//
// REPLAY opens a fresh page per template, performs each recorded step's gestures with
// __astryxDrive.perform in the page, and compares a screenshot after every step with the
// recorded one, pixel for pixel (pixelmatch threshold 0, as parity does). It then does the
// same on the stock copy (its own React state), where every gesture must resolve.
//
// A person's pointer rests where they last used it, and CSS :hover follows the real pointer,
// not events a script sends. So both runs put the real pointer where the recording left it
// before each screenshot; that is the one thing a gesture list does not carry.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { build, preview } from "vite";
import { chromium } from "playwright";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { SCENARIOS, TEMPLATES } from "@astryx-native/core";

const root = fileURLToPath(new URL("..", import.meta.url));
const flags = process.argv.slice(2).filter((a) => a.startsWith("--"));
const only = new Set(process.argv.slice(2).filter((a) => !a.startsWith("--")));
const replayMode = flags.includes("--replay");
const chosen = TEMPLATES.filter((t) => only.size === 0 || only.has(t.id));

const SIZE = { width: 1440, height: 900 };
const STILL = "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}";
const DRIVER = fileURLToPath(new URL("../public/astryx-drive.js", import.meta.url));
const GENERATED = fileURLToPath(new URL("../../core/src/scenarios.generated.ts", import.meta.url));
const SHOTS = fileURLToPath(new URL("../parity/scenarios/", import.meta.url));

// Titles are written per template, from what its steps do.
const TITLES = {
  showcase: "Store: pay, ask the chat, manage inventory",
  dashboard: "Dashboard: chart, views and tables",
  inbox: "Inbox: triage and reply",
  kanban: "Board: sprints and moving cards",
  invoice: "Invoice: search, sort and filter lines",
  calendar: "Calendar: pick days and page months",
  chat: "Chat: ask, edit and open the document",
  checkout: "Checkout: from cart to paying",
  order: "Order: tabs, menus and panels",
  settings: "Settings: edit a profile and search",
};

// ---------------------------------------------------------------------------------------
// One run at a time on this machine, queued behind parity runs: the same lock.
const lock = fileURLToPath(new URL("../.parity-lock", import.meta.url));
for (;;) {
  try {
    mkdirSync(lock);
    writeFileSync(`${lock}/pid`, String(process.pid));
    break;
  } catch {
    let owner = 0;
    try { owner = Number(readFileSync(`${lock}/pid`, "utf8")); } catch { /* being written */ }
    let alive = owner > 0;
    if (alive) { try { process.kill(owner, 0); } catch { alive = false; } }
    if (!alive && owner > 0) { rmSync(lock, { recursive: true, force: true }); continue; }
    await new Promise((r) => setTimeout(r, 3000));
  }
}
process.on("exit", () => { try { if (readFileSync(`${lock}/pid`, "utf8") === String(process.pid)) rmSync(lock, { recursive: true, force: true }); } catch { /* gone */ } });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => process.exit(130));

const own = !flags.includes("--no-build");
const outDir = own ? fileURLToPath(new URL(`../.parity-build/record-${process.pid}/`, import.meta.url)) : fileURLToPath(new URL("../dist/", import.meta.url));
if (own) await build({ root, logLevel: "warn", build: { outDir, emptyOutDir: true } });
if (!existsSync(`${outDir}astryx-drive.js`) || readFileSync(`${outDir}astryx-drive.js`, "utf8") !== readFileSync(DRIVER, "utf8")) {
  console.error("the build does not hold public/astryx-drive.js as it is");
  process.exit(1);
}
const server = await preview({ root, logLevel: "error", build: { outDir }, preview: { port: 0, host: "localhost", strictPort: false } });
const base = server.resolvedUrls?.local[0];
const browser = await chromium.launch({ args: ["--num-raster-threads=1", "--disable-partial-raster", "--disable-gpu"] });

// ---------------------------------------------------------------------------------------
// Pages

/** A fresh page on the fixed clock, as parity opens one. `trackPointer` keeps the last real pointer position. */
async function open(url, problems) {
  const context = await browser.newContext({ viewport: SIZE, deviceScaleFactor: 1, colorScheme: "light", timezoneId: "America/Los_Angeles", locale: "en-US" });
  await context.addInitScript({ path: DRIVER });
  await context.addInitScript(() => {
    const keep = (e) => { if (e.isTrusted) window.__lastPointer = { x: e.clientX, y: e.clientY }; };
    for (const type of ["pointermove", "pointerdown", "mousemove", "mousedown", "mouseup"]) window.addEventListener(type, keep, true);
  });
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date("2026-10-13T09:30:00-07:00"));
  page.on("pageerror", (e) => problems.push(`${url}: ${e.message}`));
  await page.goto(url, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: STILL });
  await page.waitForSelector("#root > *", { state: "attached" });
  await page.evaluate(() => document.fonts.ready);
  return { context, page };
}

/** The page at rest, as parity takes it (see there for why the viewport grows and the wait). */
async function still(page) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  if (height > SIZE.height) await page.setViewportSize({ width: SIZE.width, height });
  const charts = await page.locator(".recharts-surface").count();
  await page.waitForTimeout(charts > 0 ? 2000 : 400);
  return PNG.sync.read(await page.screenshot({ fullPage: true }));
}

const lastPointer = (page) => page.evaluate(() => window.__lastPointer ?? null);

async function stepsFor(id) {
  try {
    return (await import(`./parity-steps/${id}.mjs`)).default;
  } catch (error) {
    if (error?.code === "ERR_MODULE_NOT_FOUND") return [];
    throw error;
  }
}

const sentence = (name) => `${name.charAt(0).toUpperCase()}${name.slice(1)}.`;
const REGEX_SHAPED = /^\/[\s\S]+\/[dimsuv]*$/;
const regexShaped = (s) => REGEX_SHAPED.test(s);

// ---------------------------------------------------------------------------------------
// The recording stand-in for `page`

/** A name as the driver reads it: a string, or "/source/flags" for a regular expression. */
function nameOf(value) {
  if (value instanceof RegExp) return `/${value.source}/${value.flags.replace(/[gy]/g, "")}`;
  return value;
}

/** Keeps a locator chain as data while handing every call on to the real locator. */
function recorder(page, report) {
  // What the current step has done so far.
  let rec = null;
  let last = null; // { target, handle }: where the last gesture happened
  let boxes = []; // bounding boxes asked for, newest last: a mouse move into one hovers it
  let held = false;
  let pos = { x: 0, y: 0 }; // where the real pointer is
  let press = null; // a pointer press in progress: what it started on, and what it might end on
  let moveHover = -1; // index of the hover gesture the last un-pressed mouse move made

  const unwrap = (x) => (x && x.__real ? x.__real : x);
  const inexpressible = (why) => { if (!rec.why) rec.why = why; };

  /** A role/name chain for an element, when its locator has no data form: its accessible role and name, and its place among the like. */
  async function canonical(handle) {
    return handle.evaluate((el, regexish) => {
      const d = window.__astryxDrive;
      const role = d.roleOf(el);
      if (!role) return null;
      const name = d.nameOf(el);
      if (name && new RegExp(regexish).test(name)) return null;
      const link = { by: "role", role, ...(name ? { name, exact: true } : {}) };
      const all = d.resolveAll([link]);
      if (all.length === 1 && all[0] === el) return [link];
      const index = all.indexOf(el);
      return index < 0 ? null : [link, { by: "nth", index }];
    }, REGEX_SHAPED.source);
  }

  /** The driver must resolve `target` to the very element Playwright found. */
  async function verify(handle, target, what, loose = false) {
    const got = await handle.evaluate((el, [t, loose]) => {
      const all = window.__astryxDrive.resolveAll(t, loose);
      return { count: all.length, same: all[0] === el };
    }, [target, loose]);
    if (got.count !== 1 || !got.same) {
      report.mismatches.push(`${report.template} "${rec.name}" ${what}: ${JSON.stringify(target)} resolves to ${got.count} element(s), ${got.same ? "the first is" : "the first is NOT"} Playwright's`);
    }
    report.verified++;
  }

  /** Does `run` for real, keeping `gesture` (built from the handle after the run, or null for none) if the step stays expressible. */
  async function act(loc, what, run, gesture) {
    const handle = await loc.real.elementHandle();
    let target = loc.ops;
    if (!rec.why) {
      if (!target) {
        target = await canonical(handle);
        if (target) report.canonical.push(`${report.template} "${rec.name}" ${what}: ${loc.why} -> ${JSON.stringify(target)}`);
        else inexpressible(`${what}: ${loc.why}, and the element has no role to name it by`);
      }
      if (target) {
        await handle.waitForElementState("visible", { timeout: 5000 }).catch(() => {});
        await verify(handle, target, what, what === "focus");
      }
    }
    const result = await run();
    const g = gesture === undefined ? undefined : await gesture(handle);
    if (target && !rec.why && g) rec.gestures.push({ target, gesture: g });
    if (target) last = { target, handle };
    return result;
  }

  /** The focused element as a target: the last gesture's if it is that element, else its role and name, else :focus. */
  async function focused() {
    const handle = (await page.evaluateHandle(() => document.activeElement)).asElement();
    if (!handle) return null;
    // The last gesture's target, if it still names this element (a name can change with the gesture: "selected").
    if (last && (await handle.evaluate((a, b) => a === b, last.handle))) {
      const still = await handle.evaluate((el, [t]) => { const all = window.__astryxDrive.resolveAll(t, true); return all.length === 1 && all[0] === el; }, [last.target]);
      if (still) return { target: last.target, handle };
    }
    const isBody = await handle.evaluate((el) => el === document.body);
    if (isBody) return { target: [{ by: "css", selector: "body" }], handle };
    const target = (await canonical(handle)) ?? [{ by: "css", selector: ":focus" }];
    await verify(handle, target, "key press on the focused element", true);
    return { target, handle };
  }

  const readValue = (handle) => handle.evaluate((el) => ("value" in el && typeof el.value === "string" ? el.value : el.isContentEditable ? el.innerText : null));

  /** A key pressed on the focused element: kept as a press, or as a fill when it edited a text field. */
  async function key(name, run) {
    const f = rec.why ? null : await focused();
    const before = f ? await readValue(f.handle) : null;
    const result = await run();
    if (!f) return result;
    const after = await readValue(f.handle).catch(() => null);
    const editing = name === "Backspace" || name === "Delete" || /^(Shift\+)?.$/.test(name);
    if (before !== null && after !== null && after !== before && editing) rec.gestures.push({ target: f.target, gesture: { kind: "fill", text: after } });
    else if (before !== null && /^(Control|ControlOrMeta|Meta)\+[a-z]$/i.test(name) && after === before) rec.notes.push(`${name} selects text; not replayed`);
    else rec.gestures.push({ target: f.target, gesture: { kind: "press", key: name } });
    last = { target: f.target, handle: f.handle };
    return result;
  }

  // Locator wrapper -----------------------------------------------------------------------
  function loc(real, ops, why) {
    const self = { real, ops, why };
    const chain = (next, op, whyNot) => loc(next, ops && op ? [...ops, op] : null, ops === null ? why : op ? undefined : whyNot);
    const strip = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
    const api = {
      __real: real,
      __self: self,
      getByRole(role, opts = {}) {
        const extra = Object.keys(opts).filter((k) => !["name", "exact"].includes(k));
        const name = opts.name === undefined ? undefined : nameOf(opts.name);
        const clash = typeof name === "string" && !(opts.name instanceof RegExp) && regexShaped(name);
        return chain(real.getByRole(role, opts), extra.length || clash ? null : strip({ by: "role", role, name, exact: opts.exact }), `getByRole option ${extra.join(",") || "name"} has no data form`);
      },
      getByLabel: (text, opts = {}) => chain(real.getByLabel(text, opts), regexShaped(String(nameOf(text))) && !(text instanceof RegExp) ? null : strip({ by: "label", text: nameOf(text), exact: opts.exact }), "getByLabel text looks like a regular expression"),
      getByText: (text, opts = {}) => chain(real.getByText(text, opts), regexShaped(String(nameOf(text))) && !(text instanceof RegExp) ? null : strip({ by: "text", text: nameOf(text), exact: opts.exact }), "getByText text looks like a regular expression"),
      getByPlaceholder: (text, opts = {}) => chain(real.getByPlaceholder(text, opts), regexShaped(String(nameOf(text))) && !(text instanceof RegExp) ? null : strip({ by: "placeholder", text: nameOf(text), exact: opts.exact }), "getByPlaceholder text looks like a regular expression"),
      getByAltText: (text, opts) => chain(real.getByAltText(text, opts), null, "getByAltText has no data form"),
      getByTitle: (text, opts) => chain(real.getByTitle(text, opts), null, "getByTitle has no data form"),
      getByTestId: (text) => chain(real.getByTestId(text), null, "getByTestId has no data form"),
      locator(selector, opts) {
        const plain = typeof selector === "string" && !opts && !/^(xpath=|\/\/|\.\.|text=|role=|id=|data-testid|css=|internal:)|>>|:(has-text|text|text-is|text-matches|visible|nth-match|light|right-of|left-of|above|below|near)\b/.test(selector.trim());
        return chain(real.locator(unwrap(selector), opts && { ...opts, has: unwrap(opts.has), hasNot: unwrap(opts.hasNot) }), plain ? { by: "css", selector } : null, "this locator() selector has no data form");
      },
      first: () => chain(real.first(), { by: "nth", index: 0 }),
      last: () => chain(real.last(), { by: "nth", index: -1 }),
      nth: (index) => chain(real.nth(index), { by: "nth", index }),
      filter: (opts) => chain(real.filter({ ...opts, has: unwrap(opts?.has), hasNot: unwrap(opts?.hasNot) }), null, "filter() has no data form"),
      or: (other) => chain(real.or(unwrap(other)), null, "or() has no data form"),
      and: (other) => chain(real.and(unwrap(other)), null, "and() has no data form"),

      click(opts = {}) {
        const plain = !opts.modifiers?.length && (opts.button ?? "left") === "left" && !opts.clickCount;
        if (!plain) inexpressible("click with modifiers, another button or a click count");
        return act(self, "click", () => real.click(opts), async () => ({ kind: "click" }));
      },
      dblclick: (opts) => { inexpressible("double click"); return real.dblclick(opts); },
      tap: (opts) => { inexpressible("tap"); return real.tap(opts); },
      async dragTo(to, opts) {
        // Playwright drags from the centre of one element to the centre of the other.
        const dest = to.__self;
        const handle = dest ? await dest.real.elementHandle() : null;
        const target = handle ? (dest.ops ?? (await canonical(handle))) : null;
        if (target && !rec.why) await verify(handle, target, "dragTo destination");
        return act(self, "dragTo", () => real.dragTo(unwrap(to), opts), async () => {
          if (!target) { inexpressible("dragTo destination has no data form and no role"); return null; }
          return { kind: "drag", to: target, edge: "center" };
        });
      },
      fill: (text, opts) => act(self, "fill", () => real.fill(text, opts), async () => ({ kind: "fill", text })),
      clear: (opts) => act(self, "clear", () => real.clear(opts), async () => ({ kind: "fill", text: "" })),
      check: (opts) => act(self, "check", () => real.check(opts), async () => ({ kind: "check" })),
      uncheck: (opts) => act(self, "uncheck", () => real.uncheck(opts), async () => ({ kind: "uncheck" })),
      setChecked: (state, opts) => act(self, "setChecked", () => real.setChecked(state, opts), async () => ({ kind: state ? "check" : "uncheck" })),
      hover: (opts) => act(self, "hover", () => real.hover(opts), async () => ({ kind: "hover" })),
      selectOption(values, opts) {
        const one = Array.isArray(values) ? (values.length === 1 ? values[0] : null) : values;
        const value = typeof one === "string" ? one : one && typeof one === "object" ? (one.value ?? one.label) : undefined;
        if (typeof value !== "string") inexpressible("selectOption of several values or by index");
        return act(self, "selectOption", () => real.selectOption(values, opts), async () => (typeof value === "string" ? { kind: "select", value } : null));
      },
      async press(name, opts) {
        const handle = await real.elementHandle();
        // locator.press focuses the element first, then presses: the same as a gesture on that target.
        await act(self, "focus", async () => handle.evaluate((el) => el.focus()), undefined);
        return key(name, () => real.press(name, opts));
      },
      async type(text, opts) { return typed(self, text, opts, "type"); },
      async pressSequentially(text, opts) { return typed(self, text, opts, "pressSequentially"); },
      async focus(opts) {
        // Focus alone is not a gesture; the key that follows is a press on this target.
        const result = await act(self, "focus", () => real.focus(opts), undefined);
        return result;
      },
      async boundingBox(opts) {
        const box = await real.boundingBox(opts);
        if (box) boxes.push({ box, loc: self });
        return box;
      },
    };
    return new Proxy(api, {
      get(target, prop) {
        if (prop in target) return target[prop];
        const value = real[prop];
        return typeof value === "function" ? value.bind(real) : value;
      },
    });
  }

  /** type / pressSequentially: kept as a fill with what the field holds afterwards. */
  function typed(self, text, opts, what) {
    const real = self.real;
    const run = () => (what === "type" ? real.type(text, opts) : real.pressSequentially(text, opts));
    return act(self, what, run, async (handle) => ({ kind: "fill", text: await readValue(handle) }));
  }

  // Keyboard and mouse ---------------------------------------------------------------------
  const keyboard = {
    press: (name, opts) => key(name, () => page.keyboard.press(name, opts)),
    async type(text, opts) {
      const f = rec.why ? null : await focused();
      const result = await page.keyboard.type(text, opts);
      const after = f ? await readValue(f.handle).catch(() => null) : null;
      if (f && after !== null) { rec.gestures.push({ target: f.target, gesture: { kind: "fill", text: after } }); last = { target: f.target, handle: f.handle }; }
      else inexpressible("typing with nothing editable focused");
      return result;
    },
    async insertText(text) {
      const f = rec.why ? null : await focused();
      const result = await page.keyboard.insertText(text);
      const after = f ? await readValue(f.handle).catch(() => null) : null;
      if (f && after !== null) rec.gestures.push({ target: f.target, gesture: { kind: "fill", text: after } });
      else inexpressible("inserting text with nothing editable focused");
      return result;
    },
    down: (name) => { inexpressible("key held down"); return page.keyboard.down(name); },
    up: (name) => page.keyboard.up(name),
  };

  /** An element asked for by its box, as a target Playwright and the driver agree on (null when it has none). */
  async function prepare(b) {
    const handle = await b.loc.real.elementHandle().catch(() => null);
    if (!handle) return null;
    const target = b.loc.ops ?? (await canonical(handle));
    if (!target) return null;
    await verify(handle, target, "drag end point");
    return { box: b.box, target };
  }
  const inside = (p, b, slack = 0) => p.x >= b.x - slack && p.x <= b.x + b.width + slack && p.y >= b.y - slack && p.y <= b.y + b.height + slack;

  const mouse = {
    async move(x, y, opts) {
      const result = await page.mouse.move(x, y, opts);
      pos = { x, y };
      if (held) { if (press) press.moved = true; return result; }
      // A move into an element asked for by its box hovers that element; any other is the pointer put away.
      const hit = [...boxes].reverse().find((b) => inside({ x, y }, b.box));
      if (hit && !rec.why) {
        const handle = await hit.loc.real.elementHandle().catch(() => null);
        let target = hit.loc.ops;
        if (!target && handle) target = await canonical(handle);
        if (target) {
          if (handle) await verify(handle, target, "hover (mouse move into the element)");
          rec.gestures.push({ target, gesture: { kind: "hover" } });
          moveHover = rec.gestures.length - 1;
          rec.notes.push("a mouse move into an element is a hover at its centre");
          return result;
        }
      }
      if (!rec.why) { rec.gestures.push({ target: [{ by: "css", selector: "body" }], gesture: { kind: "hover" } }); moveHover = rec.gestures.length - 1; }
      return result;
    },
    /** A press on an element asked for by its box, a move, a release on another (or the same): a drag. */
    async down(opts) {
      held = true;
      press = null;
      if (!rec.why) {
        const source = [...boxes].reverse().find((b) => inside(pos, b.box));
        const prepared = source ? await prepare(source) : null;
        if (!prepared) inexpressible("pointer press on something not asked for by its box");
        else {
          // The hover the move to the press point made is part of the press.
          if (moveHover === rec.gestures.length - 1) { rec.gestures.pop(); rec.notes.pop(); }
          const others = (await Promise.all(boxes.filter((b) => b !== source).map(prepare))).filter(Boolean);
          press = { source: prepared, others, moved: false };
        }
      }
      return page.mouse.down(opts);
    },
    async up(opts) {
      held = false;
      const done = press;
      press = null;
      const result = await page.mouse.up(opts);
      if (!done || rec.why) return result;
      if (!done.moved) { inexpressible("pointer press and release without a drag"); return result; }
      // Released near an element asked for by its box (above, below or on it): that is where it was dropped.
      const near = [...done.others].reverse().find((o) => inside(pos, { x: o.box.x, y: o.box.y - 8, width: o.box.width, height: o.box.height + 56 }));
      const dest = near ?? (inside(pos, done.source.box) ? done.source : null);
      if (!dest) { inexpressible("pointer released away from any element asked for by its box"); return result; }
      const edge = pos.y < dest.box.y ? "above" : pos.y > dest.box.y + dest.box.height ? "below" : "center";
      rec.gestures.push({ target: done.source.target, gesture: { kind: "drag", to: dest.target, edge } });
      rec.notes.push("a drag is replayed from the target's top-left corner to a point 4 px above, 40 px below or at the centre of the destination");
      return result;
    },
    click: (x, y, opts) => { inexpressible("click at a position"); return page.mouse.click(x, y, opts); },
    dblclick: (x, y, opts) => { inexpressible("double click at a position"); return page.mouse.dblclick(x, y, opts); },
    wheel: (dx, dy) => { inexpressible("mouse wheel"); return page.mouse.wheel(dx, dy); },
  };

  // The page stand-in ---------------------------------------------------------------------
  const root = loc(page, [], undefined);
  const stand = new Proxy({}, {
    get(_t, prop) {
      if (prop === "keyboard") return keyboard;
      if (prop === "mouse") return mouse;
      if (["getByRole", "getByLabel", "getByText", "getByPlaceholder", "getByAltText", "getByTitle", "getByTestId", "locator"].includes(prop)) return root[prop];
      const value = page[prop];
      return typeof value === "function" ? value.bind(page) : value;
    },
  });

  return {
    page: stand,
    begin(name) { rec = { name, gestures: [], notes: [], why: null }; boxes = []; held = false; press = null; moveHover = -1; return rec; },
    end() { const done = rec; rec = null; return done; },
    forget() { last = null; },
  };
}

// ---------------------------------------------------------------------------------------
// Record

const problems = [];
const shotsOf = (id) => `${SHOTS}${id}/`;
const diffPNG = (a, b) => {
  if (a.width !== b.width || a.height !== b.height) return { size: `${a.width}x${a.height} vs ${b.width}x${b.height}`, diff: null };
  const diff = new PNG({ width: a.width, height: a.height });
  return { diff, pixels: pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0 }) };
};

async function record() {
  const report = { template: "", verified: 0, mismatches: [], canonical: [], actionsOnly: [] };
  const recorded = new Map();
  for (const t of chosen) {
    const steps = await stepsFor(t.id);
    if (steps.length === 0) { console.log(`  ${t.id}: no parity steps`); continue; }
    report.template = t.id;
    const { context, page } = await open(`${base}?screen=t.${t.id}&bare=1&stock=1`, problems);
    const stand = recorder(page, report);
    const dir = shotsOf(t.id);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}0.png`, PNG.sync.write(await still(page)));
    const out = [];
    const pointers = [];
    for (const [i, step] of steps.entries()) {
      await page.evaluate(() => { window.__astryxRecord = []; });
      const rec = stand.begin(step.name);
      let failed = null;
      try { await step.run(stand.page); } catch (error) { failed = error; }
      stand.end();
      const actions = await page.evaluate(() => { const a = window.__astryxRecord; window.__astryxRecord = null; return a; });
      if (failed) { problems.push(`${t.id} step "${step.name}": ${String(failed.message).split("\n")[0]}`); break; }
      const actionsOnly = rec.why !== null;
      if (actionsOnly) report.actionsOnly.push(`${t.id} "${step.name}": ${rec.why}`);
      out.push({ caption: sentence(step.name), gestures: actionsOnly ? [] : rec.gestures, actions });
      pointers.push(await lastPointer(page));
      writeFileSync(`${dir}${i + 1}.png`, PNG.sync.write(await still(page)));
      console.log(`  ${t.id} ${String(i + 1).padStart(2)} ${step.name}: ${actionsOnly ? `actions only (${rec.why})` : `${rec.gestures.length} gesture(s)`}, ${actions.length} action(s)${rec.notes.length && !actionsOnly ? `  [${[...new Set(rec.notes)].join("; ")}]` : ""}`);
    }
    writeFileSync(`${dir}pointers.json`, JSON.stringify(pointers));
    await context.close();
    if (out.length === steps.length) recorded.set(t.id, { id: t.id, template: t.id, title: TITLES[t.id] ?? t.title, steps: out });
  }
  // Scenarios recorded now replace those of the same template; the rest stay, in template order.
  const all = TEMPLATES.map((t) => recorded.get(t.id) ?? SCENARIOS.find((s) => s.id === t.id)).filter(Boolean);
  writeFileSync(GENERATED, `// Generated by web/scripts/record-scenarios.mjs from web/scripts/parity-steps. Do not edit.\nimport type { Scenario } from "./scenarios.ts";\n\nexport const SCENARIOS: Scenario[] = ${JSON.stringify(all, null, 2)};\n`);
  console.log(`\nwrote ${recorded.size} scenario(s) to ${GENERATED}`);
  console.log(`${report.verified} gesture target(s) checked against Playwright; ${report.mismatches.length} mismatch(es)`);
  for (const m of report.mismatches) console.log(`  MISMATCH ${m}`);
  for (const c of report.canonical) console.log(`  canonical ${c}`);
  for (const a of report.actionsOnly) console.log(`  actions only ${a}`);
  return report.mismatches.length === 0;
}

// ---------------------------------------------------------------------------------------
// Replay

/** Performs a scenario's gestures step by step on `page`; returns what each step did. */
async function play(page, scenario, onStep) {
  const results = [];
  const pointers = existsSync(`${shotsOf(scenario.id)}pointers.json`) ? JSON.parse(readFileSync(`${shotsOf(scenario.id)}pointers.json`, "utf8")) : [];
  let pointer = null;
  for (const [i, step] of scenario.steps.entries()) {
    await page.evaluate(() => { window.__astryxRecord = []; window.__astryxDrive.warnings.length = 0; });
    let error = null;
    try { await page.evaluate((g) => window.__astryxDrive.perform(g), step.gestures); } catch (e) { error = String(e.message).split("\n")[0]; }
    if (pointers[i]) pointer = pointers[i];
    if (pointer) await page.mouse.move(pointer.x, pointer.y);
    // A hover card opens after a delay of its own.
    if (step.gestures.some((g) => g.gesture.kind === "hover")) await page.waitForTimeout(1000);
    const actions = await page.evaluate(() => window.__astryxRecord);
    const warnings = await page.evaluate(() => [...window.__astryxDrive.warnings]);
    results.push({ error, actions, warnings, ...(await onStep(i)) });
  }
  return results;
}

async function replay() {
  let allIdentical = true;
  const stockSummary = [];
  for (const t of chosen) {
    const scenario = SCENARIOS.find((s) => s.id === t.id);
    if (!scenario) { console.log(`  ${t.id}: no scenario`); continue; }
    const dir = shotsOf(t.id);
    const reference = (i) => PNG.sync.read(readFileSync(`${dir}${i}.png`));

    // Our page, fresh.
    {
      const { context, page } = await open(`${base}?screen=t.${t.id}&bare=1&stock=1`, problems);
      await still(page); // the recording took the page at rest first, which also sized the viewport
      const results = await play(page, scenario, async (i) => {
        const png = await still(page);
        const d = diffPNG(reference(i + 1), png);
        if (d.diff && d.pixels > 0) { writeFileSync(`${dir}replay-${i + 1}-diff.png`, PNG.sync.write(d.diff)); writeFileSync(`${dir}replay-${i + 1}.png`, PNG.sync.write(png)); }
        return { pixels: d.diff ? d.pixels : null, size: d.size };
      });
      await context.close();
      const bad = results.map((r, i) => ({ r, i })).filter(({ r }) => r.error || r.pixels !== 0);
      const last = results[results.length - 1];
      const identical = !!last && !last.error && last.pixels === 0;
      const actionsOnly = scenario.steps.map((s, i) => ({ s, i })).filter(({ s }) => s.gestures.length === 0 && s.actions.length > 0);
      const firstGap = actionsOnly.length ? actionsOnly[0].i : scenario.steps.length;
      const prefixOk = results.slice(0, firstGap).every((r) => !r.error && r.pixels === 0);
      const sameActions = results.filter((r, i) => JSON.stringify(r.actions) === JSON.stringify(scenario.steps[i].actions)).length;
      console.log(`  ${identical ? "same" : "DIFF"}  ${t.id}: end state ${identical ? "identical" : "differs"}; ${scenario.steps.length - bad.length} of ${scenario.steps.length} steps identical${actionsOnly.length ? `; ${actionsOnly.length} actions-only step(s), first at step ${firstGap + 1}, steps before it ${prefixOk ? "identical" : "NOT identical"}` : ""}; same core actions in ${sameActions} of ${scenario.steps.length}`);
      for (const { r, i } of bad.slice(0, 6)) console.log(`          step ${i + 1} "${scenario.steps[i].caption}": ${r.error ?? (r.size ? `size ${r.size}` : `${r.pixels} pixels`)}`);
      for (const r of results) for (const w of r.warnings) console.log(`          note: ${w}`);
      if (!identical && !(actionsOnly.length && prefixOk && bad.every(({ i }) => i >= firstGap))) allIdentical = false;
    }

    // The stock copy: its own state; every gesture must resolve and nothing may throw.
    {
      const { context, page } = await open(`${base}stock.html?template=${encodeURIComponent(t.astryx)}`, problems);
      await still(page);
      let end = null;
      const results = await play(page, scenario, async () => { end = await still(page); return {}; });
      await context.close();
      const failed = results.map((r, i) => ({ r, i })).filter(({ r }) => r.error);
      const d = diffPNG(reference(scenario.steps.length), end);
      const ambiguous = results.reduce((n, r) => n + r.warnings.length, 0);
      const gestures = scenario.steps.reduce((n, s) => n + s.gestures.length, 0);
      stockSummary.push({ id: t.id, failed: failed.length });
      console.log(`  ${failed.length === 0 ? "same" : "DIFF"}  ${t.id} on stock: ${gestures} gesture(s) in ${scenario.steps.length} steps, ${failed.length === 0 ? "all resolved" : `${failed.length} step(s) failed`}${ambiguous ? `, ${ambiguous} ambiguous` : ""}; end screenshot ${d.diff ? (d.pixels === 0 ? "identical to ours" : `${d.pixels} pixels from ours`) : `size ${d.size}`}`);
      for (const { r, i } of failed.slice(0, 6)) console.log(`          step ${i + 1} "${scenario.steps[i].caption}": ${r.error}`);
    }
  }
  return allIdentical && stockSummary.every((s) => s.failed === 0);
}

// ---------------------------------------------------------------------------------------
let ok = false;
try {
  ok = replayMode ? await replay() : await record();
} finally {
  await browser.close();
  await server.close();
  if (own) rmSync(outDir, { recursive: true, force: true });
}
for (const p of problems) console.log(`  problem: ${p}`);
process.exit(ok && problems.length === 0 ? 0 : 1);
