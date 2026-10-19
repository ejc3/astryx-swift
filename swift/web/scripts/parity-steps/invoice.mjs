// What a person does on the invoice page, by role and accessible name; the same on both copies.
const sortButton = (page, column) => page.getByRole("button", { name: new RegExp(`^Sort(ed)? by ${column}`) });
const filterButton = (page, column) => page.getByRole("button", { name: `Filter ${column}`, exact: true });
// A focus ring fades in on its own clock; typing steps end with the box blurred so both copies are compared at rest.
const popover = (page, column) => page.getByRole("dialog", { name: `Filter ${column}` }).first();

/** Each step ends with the pointer out of the way, so no row sits under it and opens its hover card at a moment of its own. */
const step = (name, run) => ({
  name,
  run: async (page) => {
    await run(page);
    await page.mouse.move(1, 1);
    await page.waitForTimeout(300);
  },
});

export default [
  step("search design", async (page) => { await page.getByRole("textbox", { name: "Search line items" }).fill("design"); await page.getByRole("textbox", { name: "Search line items" }).blur(); }),
  step("search nothing", async (page) => { await page.getByRole("textbox", { name: "Search line items" }).fill("zzz"); await page.getByRole("textbox", { name: "Search line items" }).blur(); }),
  step("clear filters from the empty state", async (page) => { await page.getByRole("button", { name: "Clear filters" }).click(); }),
  step("hourly only", async (page) => { await page.getByRole("radio", { name: "Hourly" }).click(); }),
  step("sort by amount", async (page) => { await sortButton(page, "Amount").click(); }),
  step("sort by amount descending", async (page) => { await sortButton(page, "Amount").click(); }),
  step("sort by description", async (page) => { await sortButton(page, "Description").click(); }),
  step("sort by category", async (page) => { await sortButton(page, "Category").click(); }),
  step("sort by category again", async (page) => { await sortButton(page, "Category").click(); }),
  step("sort cleared", async (page) => { await sortButton(page, "Category").click(); }),
  step(
    "filter description",
    async (page) => {
      await filterButton(page, "Description").click();
      await popover(page, "Description").getByRole("textbox").fill("build");
      await page.getByRole("button", { name: "Apply" }).click();
    },
  ),
  step(
    "filter quantity",
    async (page) => {
      await filterButton(page, "Qty").click();
      await popover(page, "Qty").getByRole("spinbutton").fill("104");
      await page.getByRole("button", { name: "Apply" }).click();
    },
  ),
  step("clear all filters from the banner", async (page) => { await page.getByRole("button", { name: "Clear all filters" }).click(); }),
  step(
    "filter category",
    async (page) => {
      await filterButton(page, "Category").click();
      await popover(page, "Category").getByRole("combobox").click();
      await page.getByRole("option", { name: "Content" }).click();
      await page.getByRole("button", { name: "Apply" }).click();
    },
  ),
  step("all lines again", async (page) => { await page.getByRole("radio", { name: "All lines" }).click(); }),
  {
    name: "hover a row for its card",
    run: async (page) => {
      await page.getByRole("cell", { name: "Content migration" }).hover();
      await page.getByRole("heading", { name: "Content migration" }).waitFor();
      await page.waitForTimeout(500);
    },
  },
  step("pointer away", async () => {}),
];
