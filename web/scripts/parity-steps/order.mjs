// What a person does on the order page, by role and accessible name; the same on both copies.
const panelToggle = (page) => page.getByRole("button", { name: /^(Hide|Show) panel$/ });
const closeDialog = async (page) => {
  if ((await page.getByRole("dialog").count()) > 0) {
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "detached" });
  }
};

/** Each step ends with the pointer out of the way, and gives an opening or closing section time to settle. */
const step = (name, run) => ({
  name,
  run: async (page) => {
    await run(page);
    await page.mouse.move(1, 1);
    await page.waitForTimeout(500);
  },
});

export default [
  step("invoices tab", async (page) => { await page.getByRole("button", { name: "Invoices", exact: true }).click(); }),
  step("timeline tab", async (page) => { await page.getByRole("button", { name: "Timeline", exact: true }).click(); }),
  step("details tab", async (page) => { await page.getByRole("button", { name: "Details", exact: true }).click(); }),
  step("more menu opens", async (page) => { await page.getByRole("button", { name: "More", exact: true }).click(); }),
  step("more menu picks customer", async (page) => { await page.getByRole("menuitemradio", { name: "Customer" }).click(); }),
  step("back to details", async (page) => { await page.getByRole("button", { name: "Details", exact: true }).click(); }),
  step("click an item", async (page) => { await page.getByRole("button", { name: /Ember Bowl/ }).first().click(); }),
  step("toggle the panel", async (page) => { await panelToggle(page).click(); }),
  step("close the panel dialog", async (page) => { await closeDialog(page); }),
  step("toggle the panel again", async (page) => { await panelToggle(page).click(); }),
  step("collapse notes", async (page) => { await page.getByRole("button", { name: "Notes", exact: true }).click(); }),
  step("collapse fraud analysis", async (page) => { await page.getByRole("button", { name: "Fraud Analysis" }).click(); }),
  step("expand notes again", async (page) => { await page.getByRole("button", { name: "Notes", exact: true }).click(); }),
  step("close the dialog at the end", async (page) => { await closeDialog(page); }),
];
