// Interactions with the calendar, done as a person would: pick a day, page through months,
// pick a day in another month, use the keyboard.
const day = (page, name) => page.getByRole("button", { name: new RegExp(name) });

export default [
  { name: "pick April 22", run: async (page) => { await day(page, "April 22, 2026").click(); } },
  { name: "next month", run: async (page) => { await page.getByRole("button", { name: /next month/i }).click(); } },
  { name: "pick May 9", run: async (page) => { await day(page, "May 9, 2026").click(); } },
  { name: "next month again", run: async (page) => { await page.getByRole("button", { name: /next month/i }).click(); } },
  { name: "previous month twice", run: async (page) => {
    await page.getByRole("button", { name: /previous month/i }).click();
    await page.getByRole("button", { name: /previous month/i }).click();
  } },
  { name: "pick April 3", run: async (page) => { await day(page, "April 3, 2026").click(); } },
  { name: "back to March", run: async (page) => {
    await page.getByRole("button", { name: /previous month/i }).click();
    await page.getByRole("button", { name: /previous month/i }).click();
  } },
  { name: "keyboard: arrow across the month start", run: async (page) => {
    await day(page, "March 1, 2026").focus();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("Enter");
  } },
  { name: "keyboard: page down", run: async (page) => {
    await page.keyboard.press("PageDown");
    await page.keyboard.press("Space");
  } },
];
