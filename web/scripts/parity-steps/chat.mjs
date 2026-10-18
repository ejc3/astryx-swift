// What a person does in the chat: type, send, switch the composer mode, open and close the
// document, use its menus. Identical on the stock copy and the refactored one. The page is
// the same at both sizes, but the document is a side panel on a wide window and a dialog on
// a narrow one, so steps that only make sense for one check what is on screen first.
const composer = (page) => page.getByLabel("Message input");
const card = (page) => page.getByRole("button", { name: /^Open JWT Token Refresh/ });
const shown = (locator) => locator.first().isVisible();

export default [
  { name: "type a message", run: async (page) => { await composer(page).click(); await page.keyboard.type("Thanks, that works for me."); } },
  { name: "clear it and type again", run: async (page) => {
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.press("Backspace");
    await page.keyboard.type("Can you ship it today?");
  } },
  { name: "send with the button", run: async (page) => { await page.getByRole("button", { name: "Send" }).click(); await page.waitForTimeout(300); } },
  { name: "type and send with Enter", run: async (page) => { await composer(page).click(); await page.keyboard.type("One more thing."); await page.keyboard.press("Enter"); await page.waitForTimeout(300); } },
  { name: "open the mode menu", run: async (page) => { await page.getByRole("button", { name: "Ask" }).click(); } },
  { name: "choose Edit", run: async (page) => { await page.getByRole("menuitem", { name: "Edit" }).click(); await page.waitForTimeout(200); } },
  { name: "type in Edit mode", run: async (page) => { await composer(page).click(); await page.keyboard.type("Rename the flag."); } },
  { name: "back to Ask", run: async (page) => {
    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByRole("menuitem", { name: "Ask" }).click();
    await page.waitForTimeout(200);
  } },
  { name: "close the document panel", run: async (page) => {
    const close = page.getByRole("button", { name: "Close document" });
    if (await shown(close)) await close.click();
    await page.waitForTimeout(200);
  } },
  { name: "open the document from the card", run: async (page) => { await card(page).click(); await page.waitForTimeout(400); } },
  { name: "open the version menu", run: async (page) => {
    const wide = page.getByRole("button", { name: "v2" });
    const narrow = page.getByRole("button", { name: "Document actions" });
    if (await shown(wide)) await wide.click(); else await narrow.last().click();
    await page.waitForTimeout(200);
  } },
  { name: "dismiss the menu", run: async (page) => { await page.keyboard.press("Escape"); await page.waitForTimeout(200); } },
  { name: "close the document dialog", run: async (page) => {
    const dialog = page.getByRole("dialog");
    if (await shown(dialog)) await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  } },
];
