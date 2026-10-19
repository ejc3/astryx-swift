// What a person does on the settings page; run identically on the stock and refactored copies.
// The section nav is a list on wide screens and a tab bar on narrow ones.
const nav = (page, name) =>
  page
    .getByRole("tab", { name, exact: true })
    .or(page.getByRole("button", { name, exact: true }))
    .or(page.getByRole("option", { name, exact: true }))
    .or(page.getByRole("link", { name, exact: true }))
    .or(page.getByRole("listitem").filter({ hasText: new RegExp(`^${name}$`) }))
    .first();

export default [
  { name: "choose Billing", run: async (page) => { await nav(page, "Billing").click(); } },
  { name: "choose Profile", run: async (page) => { await nav(page, "Profile").click(); } },
  { name: "edit username", run: async (page) => { await page.getByRole("textbox", { name: "Username" }).fill("ada.lovelace"); } },
  { name: "edit first name", run: async (page) => { await page.getByRole("textbox", { name: "First name" }).fill("Ada"); } },
  { name: "edit email", run: async (page) => { await page.getByRole("textbox", { name: "Email address" }).fill("ada@example.com"); } },
  { name: "change confirm password", run: async (page) => { await page.getByLabel("Confirm password").fill("different"); } },
  { name: "tick data export", run: async (page) => { await page.getByRole("checkbox", { name: "Data Export Access" }).check(); } },
  { name: "tick two-factor", run: async (page) => { await page.getByRole("checkbox", { name: "Enable Two-Factor Authentication" }).check(); } },
  { name: "untick data export", run: async (page) => { await page.getByRole("checkbox", { name: "Data Export Access" }).uncheck(); } },
  { name: "search settings", run: async (page) => { await page.getByRole("combobox", { name: "Search" }).click(); } },
  { name: "type a search", run: async (page) => { await page.getByRole("combobox", { name: "Search" }).fill("pass"); } },
  { name: "choose a result", run: async (page) => { await page.getByRole("option", { name: "Change password" }).click(); } },
];
