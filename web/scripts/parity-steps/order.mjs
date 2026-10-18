// What a person does on the order page, by role and accessible name; the same on both copies.
const panelToggle = (page) => page.getByRole("button", { name: /^(Hide|Show) panel$/ });
const closeDialog = async (page) => {
  if ((await page.getByRole("dialog").count()) > 0) {
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "detached" });
  }
};

export default [
  { name: "invoices tab", run: async (page) => { await page.getByRole("tab", { name: "Invoices" }).click(); } },
  { name: "timeline tab", run: async (page) => { await page.getByRole("tab", { name: "Timeline" }).click(); } },
  { name: "details tab", run: async (page) => { await page.getByRole("tab", { name: "Details" }).click(); } },
  { name: "more menu opens", run: async (page) => { await page.getByRole("button", { name: "More" }).click(); } },
  { name: "more menu picks customer", run: async (page) => { await page.getByRole("menuitem", { name: "Customer" }).click(); } },
  { name: "back to details", run: async (page) => { await page.getByRole("tab", { name: "Details" }).click(); } },
  { name: "toggle the panel", run: async (page) => { await panelToggle(page).click(); } },
  { name: "close the panel dialog", run: async (page) => { await closeDialog(page); } },
  { name: "toggle the panel again", run: async (page) => { await panelToggle(page).click(); } },
  { name: "close the dialog again", run: async (page) => { await closeDialog(page); } },
  { name: "click an item", run: async (page) => { await page.getByRole("button", { name: /Ember Bowl/ }).first().click(); } },
  { name: "collapse notes", run: async (page) => { await page.getByRole("button", { name: "Notes" }).click(); } },
  { name: "collapse fraud analysis", run: async (page) => { await page.getByRole("button", { name: "Fraud Analysis" }).click(); } },
];
