// What a person does on the board: pick a sprint, use a card's menu, drag cards between
// columns and within one. Run identically on the stock and the refactored copy.
const card = (page, title) => page.getByRole("heading", { name: title });
// The card's own menu button: the nearest ancestor of its title that holds any button.
const menu = (page, title) => card(page, title).locator("xpath=ancestor::div[.//button][1]").getByRole("button", { name: "Work item actions" });

async function moveViaMenu(page, title, entry) {
  await menu(page, title).click();
  await page.getByRole("menuitem", { name: entry }).click();
}

// Drags a card by its title onto another card's title (dropping above or below its middle)
// or, with a column heading, into that column's empty space.
async function drag(page, title, onto, where = "above") {
  const from = await card(page, title).boundingBox();
  const to = await onto.boundingBox();
  const y = where === "above" ? to.y - 4 : to.y + to.height + 40;
  await page.mouse.move(from.x + 8, from.y + 4);
  await page.mouse.down();
  await page.mouse.move(from.x + 40, from.y + 30, { steps: 4 });
  await page.mouse.move(to.x + 8, y, { steps: 8 });
  await page.mouse.up();
}

export default [
  {
    name: "choose Sprint 002",
    run: async (page) => {
      await page.getByRole("combobox", { name: "Sprint" }).click();
      await page.getByRole("option", { name: "Sprint 002" }).click();
    },
  },
  {
    name: "open a card menu",
    run: async (page) => {
      await menu(page, "Collect feedback from stakeholders").click();
    },
  },
  {
    name: "move a card to In review from its menu",
    run: async (page) => {
      await page.getByRole("menuitem", { name: "Move to In review" }).click();
    },
  },
  {
    name: "move a card to To-do from its menu",
    run: async (page) => {
      await moveViaMenu(page, "Prepare the demo walkthrough", "Move to To-do");
    },
  },
  {
    name: "empty a column",
    run: async (page) => {
      await moveViaMenu(page, "Set up the project workspace", "Move to Done");
      await moveViaMenu(page, "Design the landing page layout", "Move to Done");
    },
  },
  {
    name: "drag a card to the top of another column",
    run: async (page) => {
      await drag(page, "Write the weekly status update", card(page, "Draft project kickoff brief"), "above");
    },
  },
  {
    name: "drag a card below another card",
    run: async (page) => {
      await drag(page, "Review and merge open changes", card(page, "Draft project kickoff brief"), "below");
    },
  },
  {
    name: "drag a card up within its column",
    run: async (page) => {
      await drag(page, "Draft project kickoff brief", card(page, "Write the weekly status update"), "above");
    },
  },
  {
    name: "drag a card into an empty column",
    run: async (page) => {
      await drag(page, "Write the weekly status update", page.getByText("Nothing in progress"), "above");
    },
  },
  {
    name: "pick up a card and put it back",
    run: async (page) => {
      const from = await card(page, "Collect feedback from stakeholders").boundingBox();
      await page.mouse.move(from.x + 8, from.y + 4);
      await page.mouse.down();
      await page.mouse.move(from.x + 8, from.y + 60, { steps: 4 });
      await page.mouse.move(from.x + 8, from.y + 4, { steps: 4 });
      await page.mouse.up();
    },
  },
];
