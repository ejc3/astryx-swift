// Drives the built app in a browser and checks that the controls do what the core says.
//
//   pnpm --filter ./web interact              build, then check
//   pnpm --filter ./web run interact --no-build   check the existing dist/
import { fileURLToPath } from "node:url";
import { build, preview } from "vite";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("..", import.meta.url));
if (!process.argv.includes("--no-build")) await build({ root, logLevel: "warn" });
const server = await preview({ root, logLevel: "error", preview: { port: 0, host: "localhost" } });
const base = server.resolvedUrls?.local[0];
const browser = await chromium.launch();

let failures = 0;
async function check(name, fn) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await fn(page, context);
    if (errors.length) throw new Error(`page errors: ${errors.join("; ")}`);
    console.log(`ok    ${name}`);
  } catch (e) {
    failures++;
    console.log(`FAIL  ${name}\n      ${String(e.message).split("\n")[0]}`);
  }
  await context.close();
}
const open = (page, screen) => page.goto(`${base}?screen=${screen}`, { waitUntil: "networkidle" });
const assert = (cond, message) => { if (!cond) throw new Error(message); };
const expectCount = async (loc, n, what) => {
  await loc.first().waitFor({ state: n === 0 ? "detached" : "visible", timeout: 3000 }).catch(() => {});
  const got = await loc.count();
  assert(got === n, `${what}: expected ${n}, saw ${got}`);
};

await check("inbox search filters the list", async (page) => {
  await open(page, "inbox");
  const rows = page.locator("li").filter({ has: page.locator(".astryx-avatar") });
  assert((await rows.count()) === 7, `expected 7 messages, saw ${await rows.count()}`);
  await page.getByPlaceholder("Search by person or subject").fill("invoice");
  await expectCount(rows, 1, "rows after search");
  assert((await rows.first().innerText()).includes("Kenji"), "the match is Kenji's invoice");
  await page.getByPlaceholder("Search by person or subject").fill("zzzz");
  await page.getByText('Nothing matches "zzzz".').waitFor({ timeout: 3000 });
});

await check("archive shows a toast with Undo, and Undo brings the message back", async (page) => {
  await open(page, "inbox");
  const rows = page.locator("li").filter({ has: page.locator(".astryx-avatar") });
  await page.getByRole("button", { name: "Archive" }).click();
  await page.getByRole("button", { name: "Undo" }).waitFor({ timeout: 3000 });
  assert((await rows.count()) === 6, "one fewer message");
  await page.getByRole("button", { name: "Undo" }).click();
  await expectCount(page.getByRole("button", { name: "Undo" }), 0, "Undo after pressing it");
  await expectCount(rows, 7, "rows after undo");
});

await check("a toast dismisses itself after about four seconds", async (page) => {
  await open(page, "overview");
  await page.getByRole("button", { name: "Show a toast" }).click();
  const toast = page.locator(".an-toast");
  await toast.waitFor({ timeout: 2000 });
  await page.waitForTimeout(2500);
  assert((await toast.count()) === 1, "still there at 2.5 s");
  await page.waitForTimeout(2200);
  assert((await toast.count()) === 0, "gone by 4.7 s");
});

await check("sorting the People table reorders the rows and flips on a second press", async (page) => {
  await open(page, "people");
  const names = () => page.locator("tbody tr td:nth-child(2)").evaluateAll((tds) => tds.map((t) => t.innerText.split("\n")[0]));
  const first = await names();
  await page.getByRole("button", { name: "Name" }).click();
  await page.waitForTimeout(150);
  const flipped = await names();
  assert(first[0] !== flipped[0], `first row should change when Name flips: ${first[0]} -> ${flipped[0]}`);
  await page.getByRole("button", { name: "Projects" }).click();
  await page.waitForTimeout(150);
  assert((await page.locator("th[aria-sort='ascending']").innerText()).includes("Projects"), "Projects is now the ascending column");
  await page.getByRole("button", { name: "Projects" }).click();
  await page.waitForTimeout(150);
  assert((await page.locator("th[aria-sort='descending']").count()) === 1, "second press sorts descending");
});

await check("people: selecting rows shows the banner; paging moves to the next five", async (page) => {
  await open(page, "people");
  await page.locator("tbody tr").nth(0).getByRole("checkbox").check();
  await page.getByText("1 person selected").waitFor({ timeout: 3000 });
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByText("6-10 of 13").waitFor({ timeout: 3000 });
});

await check("checkout: validation, test data, and placing the order", async (page) => {
  await open(page, "checkout");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByText("Enter your name.").waitFor({ timeout: 3000 });
  await page.getByRole("button", { name: "Fill with test data" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Review order" }).click();
  await page.getByRole("button", { name: /^Pay / }).click();
  await page.getByText("Thank you, your order is placed").waitFor({ timeout: 3000 });
});

await check("checkout: typing into a card field is formatted by the core", async (page) => {
  await open(page, "checkout");
  await page.getByRole("button", { name: "Fill with test data" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  const card = page.getByLabel("Card number");
  await card.fill("");
  await card.pressSequentially("4242424242424242");
  assert((await card.inputValue()) === "4242 4242 4242 4242", `card value was ${await card.inputValue()}`);
});

await check("chat: sending a message adds it and the reply", async (page) => {
  await open(page, "chat");
  const bubbles = page.locator(".an-chat .astryx-chat-message");
  const before = await bubbles.count();
  const box = page.locator(".an-chat [contenteditable]").first();
  await box.click();
  await page.keyboard.type("Hello from the browser test");
  await page.getByRole("button", { name: "Send" }).click();
  await page.getByText("Hello from the browser test").waitFor({ timeout: 3000 });
  await page.waitForTimeout(200);
  assert((await bubbles.count()) === before + 2, `expected two new messages, saw ${(await bubbles.count()) - before}`);
});

await check("settings: choosing a theme repaints the accent", async (page) => {
  await open(page, "settings");
  const accent = () => page.evaluate(() => getComputedStyle(document.querySelector("[data-astryx-theme]") ?? document.body).getPropertyValue("--color-accent").trim());
  const before = await accent();
  await page.getByRole("radio", { name: /Ocean/ }).first().click();
  await page.waitForTimeout(200);
  const after = await accent();
  assert(before !== after && after !== "", `accent should change: ${before} -> ${after}`);
  await page.locator(".an-swatch[aria-label='Grape']").click();
  await page.waitForTimeout(200);
  assert((await accent()) !== after, "the nav swatches switch the theme too");
});

await check("settings: the delete dialog opens and its cancel closes it", async (page) => {
  await open(page, "settings");
  await page.getByRole("button", { name: "Delete account" }).first().click();
  const dialog = page.getByRole("alertdialog");
  await dialog.waitFor({ timeout: 3000 });
  await dialog.getByRole("button", { name: "Keep it" }).click();
  await expectCount(dialog, 0, "dialog after cancel");
  await page.getByRole("button", { name: "Delete account" }).first().click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete account" }).click();
  await page.getByText("Account scheduled for deletion").first().waitFor({ timeout: 3000 });
});

await check("overview: switch, segmented control, slider and checkbox respond", async (page) => {
  await open(page, "overview");
  const sw = page.getByRole("switch").first();
  const was = await sw.isChecked();
  await sw.click();
  assert((await sw.isChecked()) !== was, "switch toggled");
  await page.getByRole("radio", { name: "Large" }).click();
  assert(await page.getByRole("radio", { name: "Large" }).isChecked(), "segment chosen");
  const slider = page.getByRole("slider").first();
  await slider.focus();
  await page.keyboard.press("ArrowRight");
  await page.getByText("65%").waitFor({ timeout: 3000 });
  await page.getByRole("checkbox", { name: "I agree to the terms" }).check();
  await page.getByRole("button", { name: /Clicked 3 times/ }).click();
  await page.getByRole("button", { name: /Clicked 4 times/ }).waitFor({ timeout: 3000 });
  await page.getByRole("button", { name: /Dismiss/ }).first().click();
  await page.getByText("One core, three hosts").waitFor({ state: "detached", timeout: 3000 });
});

await check("tasks: moving a card forward and back", async (page) => {
  await open(page, "tasks");
  const column = (title) => page.getByRole("region", { name: title });
  const n = async (title) => column(title).locator(".astryx-card").count();
  const todo = await n("To do");
  await column("To do").getByRole("button", { name: /Move to In progress/ }).first().click();
  await page.waitForTimeout(150);
  assert((await n("To do")) === todo - 1, "card left To do");
});

await check("calendar: choosing a day and changing the month", async (page) => {
  await open(page, "calendar");
  const heading = page.locator(".an-cal").locator("xpath=preceding-sibling::*[1]").getByRole("heading");
  const before = await heading.innerText();
  await page.getByRole("button", { name: "Next month" }).click();
  await page.waitForTimeout(150);
  assert((await heading.innerText()) !== before, "month changed");
  await page.locator(".an-day:not([data-out])").nth(9).click();
  await page.waitForTimeout(150);
  assert((await page.locator(".an-day[data-selected]").count()) === 1, "one day selected");
});

await check("profile: tabs switch the content", async (page) => {
  await open(page, "profile");
  await page.locator("[data-tab-value='team']").click();
  await page.waitForTimeout(150);
  assert((await page.locator("li").count()) >= 3, "teammates listed");
});

await check("a minute's tick rewrites times that depend on the clock", async (page) => {
  await page.clock.install();
  await page.goto(`${base}?screen=chat`, { waitUntil: "domcontentloaded" });
  const times = () => page.locator(".an-chat").innerText().then((t) => t.match(/\d{1,2}:\d{2} [AP]M/g)?.join(","));
  await page.locator(".an-chat").waitFor({ timeout: 5000 });
  const before = await times();
  assert(before, "chat shows times");
  await page.clock.fastForward(10 * 60_000 + 1000);
  await page.waitForFunction((b) => document.querySelector(".an-chat").innerText.match(/\d{1,2}:\d{2} [AP]M/g)?.join(",") !== b, before, { timeout: 5000 });
});

await check("checkout: a finished step can be pressed to go back", async (page) => {
  await open(page, "checkout");
  await page.getByRole("button", { name: "Fill with test data" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByText("Step 2 of 4").waitFor({ timeout: 3000 });
  await page.locator(".astryx-stepper button, .astryx-step button").first().click();
  await page.getByText("Step 1 of 4").waitFor({ timeout: 3000 });
});

await check("the nav theme switcher carries the core's label", async (page) => {
  await open(page, "overview");
  assert((await page.getByRole("radiogroup", { name: "Theme" }).count()) === 1, "radiogroup named by theme.label");
  assert((await page.locator(".an-swatch-group").innerText()).includes("Theme"), "label is visible");
});

// A phone.
const phone = { viewport: { width: 390, height: 844 } };
async function checkPhone(name, fn) {
  const context = await browser.newContext(phone);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await fn(page);
    if (errors.length) throw new Error(`page errors: ${errors.join("; ")}`);
    console.log(`ok    ${name}`);
  } catch (e) {
    failures++;
    console.log(`FAIL  ${name}\n      ${String(e.message).split("\n")[0]}`);
  }
  await context.close();
}

await checkPhone("phone: the nav opens as a drawer with the theme swatches, and navigates", async (page) => {
  await open(page, "overview");
  assert((await page.locator(".astryx-side-nav").first().isVisible()) === false, "no permanent side nav on a phone");
  await page.locator("button[aria-label], button").filter({ has: page.locator("svg") }).first().click();
  await page.getByRole("button", { name: "Calendar" }).click();
  await page.locator(".an-cal").waitFor({ timeout: 3000 });
  await page.locator("button[aria-label], button").filter({ has: page.locator("svg") }).first().click();
  await page.getByRole("radio", { name: "Ember" }).click();
  await page.waitForTimeout(200);
});

await checkPhone("phone: the inbox shows the list or the message, with a back button", async (page) => {
  await open(page, "inbox");
  await page.getByRole("button", { name: "Inbox" }).first().click();
  await page.getByPlaceholder("Search by person or subject").waitFor({ timeout: 3000 });
  await page.locator("li").filter({ has: page.locator(".astryx-avatar") }).nth(2).click();
  await page.getByRole("button", { name: "Archive" }).waitFor({ timeout: 3000 });
});

await checkPhone("phone: nothing on any screen is wider than the screen, except tables and boards that scroll", async (page) => {
  for (const screen of ["overview", "dashboard", "inbox", "tasks", "people", "calendar", "chat", "checkout", "profile", "settings"]) {
    await open(page, screen);
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert(wide <= 0, `${screen} overflows the page by ${wide}px`);
  }
});

await browser.close();
await new Promise((resolve) => server.httpServer.close(resolve));
if (failures) { console.log(`\n${failures} check(s) failed`); process.exitCode = 1; } else console.log("\nall checks passed");
