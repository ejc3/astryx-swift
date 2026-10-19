// What a person does on the dashboard: look at the chart, reload, open the "more" views,
// follow the table links, hover rows. Identical on the stock copy and the refactored one.
const move = async (page, locator, fx, fy) => {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + box.width * fx, box.y + box.height * fy);
  await page.waitForTimeout(300);
};

export default [
  { name: "reload", run: async (page) => { await page.getByRole("button", { name: "Reload" }).click(); await page.mouse.move(0, 0); } },
  { name: "hover the active users chart", run: async (page) => { await move(page, page.locator(".recharts-wrapper").first(), 0.4, 0.5); } },
  { name: "hover the chart near the end", run: async (page) => { await move(page, page.locator(".recharts-wrapper").first(), 0.9, 0.5); } },
  { name: "leave the chart", run: async (page) => { await page.mouse.move(2, 2); } },
  { name: "view more demographics", run: async (page) => { await page.getByRole("button", { name: "View more" }).first().click(); await page.mouse.move(2, 2); } },
  { name: "view more engagement", run: async (page) => { await page.getByRole("button", { name: "View more" }).last().click(); await page.mouse.move(2, 2); } },
  { name: "hover a page row", run: async (page) => { await move(page, page.getByRole("row", { name: /\/pricing/ }), 0.5, 0.5); } },
  { name: "hover an event row", run: async (page) => { await move(page, page.getByRole("row", { name: /form_submit/ }), 0.5, 0.5); } },
  { name: "focus the all pages link", run: async (page) => { await page.getByRole("link", { name: "All pages" }).focus(); await page.mouse.move(2, 2); } },
  { name: "follow the all events link", run: async (page) => { await page.getByRole("link", { name: "All events" }).click(); await page.mouse.move(2, 2); } },
];
