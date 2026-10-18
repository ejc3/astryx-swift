// What a person would try on the store page. The template is a static theme preview, so
// every control is inert: both copies must show the same page after each attempt.
export default [
  { name: "type an email", run: async (page) => { await page.getByRole("textbox", { name: "Email" }).fill("someone@example.com"); } },
  { name: "choose express shipping", run: async (page) => { await page.getByRole("radio", { name: /Express Shipping/ }).click(); } },
  { name: "choose Apple Pay", run: async (page) => { await page.getByRole("button", { name: /Pay with Apple Pay/ }).or(page.getByRole("radio", { name: /Pay with Apple Pay/ })).first().click(); } },
  { name: "type a card number", run: async (page) => { await page.getByRole("textbox", { name: "Card number" }).fill("4242424242424242"); } },
  { name: "type expiry and CVC", run: async (page) => {
    await page.getByRole("textbox", { name: "Expiry" }).fill("12 / 30");
    await page.getByRole("textbox", { name: "CVC" }).fill("123");
  } },
  { name: "uncheck save my information", run: async (page) => { await page.getByRole("checkbox", { name: /Securely save my information/ }).click(); } },
  { name: "open the country list and pick Japan", run: async (page) => {
    await page.getByRole("combobox", { name: "Country" }).or(page.getByRole("button", { name: /Country/ })).first().click();
    await page.getByRole("option", { name: "Japan" }).click();
  } },
  { name: "pay now", run: async (page) => { await page.getByRole("button", { name: "Pay now" }).click(); } },
  { name: "ask the chat a question", run: async (page) => {
    const box = page.getByRole("textbox", { name: /Ask Studio AI/ });
    await box.fill("Where is my parcel?");
    await box.press("Enter");
  } },
  { name: "press a suggestion", run: async (page) => { await page.getByRole("button", { name: "Start a return" }).click(); } },
  { name: "type in the inventory search", run: async (page) => {
    const box = page.getByRole("textbox", { name: "Search inventory" });
    await box.fill("wallet");
    await box.press("Enter");
  } },
  { name: "check and uncheck inventory rows", run: async (page) => {
    await page.getByRole("checkbox", { name: "Select Minimalist Watch" }).click();
    await page.getByRole("checkbox", { name: "Select Leather Wallet" }).click();
  } },
  { name: "open a row menu", run: async (page) => { await page.getByRole("button", { name: "Row actions" }).first().click(); } },
  { name: "close the row menu", run: async (page) => { await page.keyboard.press("Escape"); } },
];
