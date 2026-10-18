// What a person does in the checkout wizard; run identically on the stock and refactored copies.
const button = (page, name) => page.getByRole("button", { name, exact: true });
const field = (page, name) => page.getByRole("textbox", { name });
const next = (page) => button(page, "Continue").or(page.getByRole("button", { name: /^Pay \$/ })).click();

export default [
  { name: "change quantity", run: async (page) => { await page.getByRole("spinbutton", { name: "Quantity of Speckled Stoneware Mug" }).fill("1"); await page.keyboard.press("Enter"); } },
  { name: "promo not checked", run: async (page) => { await field(page, "Promo code").fill("nonsense"); } },
  { name: "promo invalid", run: async (page) => { await button(page, "Apply").click(); } },
  { name: "promo applied", run: async (page) => { await field(page, "Promo code").fill("welcome10"); await button(page, "Apply").click(); } },
  { name: "remove the plate", run: async (page) => { await page.getByRole("button", { name: "Remove" }).nth(1).click(); } },
  { name: "to shipping and invalid submit", run: async (page) => { await next(page); await next(page); } },
  { name: "fill contact", run: async (page) => {
      await field(page, "Email").fill("ada@example.com");
      await field(page, "First name").fill("Ada");
      await field(page, "Last name").fill("Lovelace");
  } },
  { name: "fill address with a bad ZIP", run: async (page) => {
      await field(page, "Street address").fill("1 Main Street");
      await field(page, "City").fill("Portland");
      await field(page, "ZIP code").fill("9720");
  } },
  { name: "choose state and fix ZIP", run: async (page) => {
      await page.getByRole("combobox", { name: "State" }).click();
      await page.getByRole("option", { name: "Oregon" }).click();
      await field(page, "ZIP code").fill("97201");
  } },
  { name: "to delivery, overnight", run: async (page) => { await next(page); await page.getByRole("radio", { name: /Overnight/ }).check(); } },
  { name: "gift message", run: async (page) => { await page.getByRole("checkbox", { name: "This is a gift" }).check(); await page.getByRole("textbox", { name: "Gift message" }).fill("Enjoy!"); } },
  { name: "to payment, invalid submit", run: async (page) => { await next(page); await next(page); } },
  { name: "back to delivery", run: async (page) => { await button(page, "Back").click(); } },
  { name: "to payment, fill card", run: async (page) => {
      await next(page);
      await field(page, "Card number").fill("4242 4242 4242 4242");
      await field(page, "Name on card").fill("Ada Lovelace");
      await field(page, "Expiry").fill("12/29");
      await field(page, "CVC").fill("123");
  } },
  { name: "billing differs", run: async (page) => { await page.getByRole("checkbox", { name: /Billing address matches/ }).uncheck(); } },
  { name: "pay", run: next },
];
