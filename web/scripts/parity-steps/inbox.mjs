// Interactions on the inbox template, done as a person would, by role and accessible name.
// The same script runs on the stock copy and the refactored one, on a desktop and a phone
// viewport (a phone shows the thread instead of the list, so a few steps branch on width).

const isPhone = (page) => page.viewportSize().width < 900;

/** On a phone an open thread replaces the list; the back button brings the list back. */
async function toList(page) {
  const back = page.getByRole("button", { name: "Inbox", exact: true });
  if (await back.count()) await back.click();
}

async function openThread(page, sender) {
  await toList(page);
  await page.getByRole("row", { name: new RegExp(sender) }).click();
}

export default [
  {
    name: "open a thread with earlier messages",
    run: async (page) => openThread(page, "Dana Osei"),
  },
  {
    name: "expand an earlier message",
    run: async (page) => page.getByRole("button", { name: /Marta Nowak.*8:31 AM/ }).click(),
  },
  {
    name: "collapse the newest message",
    run: async (page) => page.getByRole("button", { name: /Dana Osei dana@osei-consulting.example Today at 8:58 AM/ }).click(),
  },
  {
    name: "open a thread with attachments",
    run: async (page) => openThread(page, "Hannah Lindqvist"),
  },
  {
    name: "open an attachment in the viewer",
    run: async (page) => page.getByRole("button", { name: /direction-1-colourful.png/ }).click(),
  },
  {
    name: "page to the next attachment",
    run: async (page) => page.getByRole("button", { name: /next/i }).click(),
  },
  {
    name: "close the viewer",
    run: async (page) => page.keyboard.press("Escape"),
  },
  {
    name: "reply all",
    run: async (page) => page.getByRole("button", { name: "Reply all" }).click(),
  },
  {
    name: "add Cc and Bcc",
    run: async (page) => {
      await page.getByRole("button", { name: "Cc", exact: true }).click();
      await page.getByRole("button", { name: "Bcc", exact: true }).click();
    },
  },
  {
    name: "write the subject and message",
    run: async (page) => {
      await page.getByRole("textbox", { name: "Subject" }).fill("Re: Homepage refresh, we pick the light direction");
      await page.getByRole("textbox", { name: "Message" }).fill("Thanks all.\nWe will go with the light direction.");
    },
  },
  {
    name: "add a typed recipient",
    run: async (page) => {
      const cc = page.getByRole("combobox", { name: "Cc", exact: true });
      await cc.fill("ops@example.com");
      await cc.press("Enter");
    },
  },
  {
    name: "close the composer, keeping the draft",
    run: async (page) => page.getByRole("button", { name: "Close composer" }).click(),
  },
  {
    name: "reopen with Compose",
    run: async (page) => page.getByRole("button", { name: "Compose" }).click(),
  },
  {
    name: "discard the draft",
    run: async (page) => page.getByRole("button", { name: "Discard draft" }).click(),
  },
  {
    name: "compose again from empty",
    run: async (page) => page.getByRole("button", { name: "Compose" }).click(),
  },
  {
    name: "close the empty composer",
    run: async (page) => page.getByRole("button", { name: "Close composer" }).click(),
  },
  {
    name: "reply to a thread",
    run: async (page) => {
      await openThread(page, "Priya Raman");
      await page.getByRole("button", { name: "Reply", exact: true }).click();
    },
  },
  {
    name: "close the composer again",
    run: async (page) => page.getByRole("button", { name: "Close composer" }).click(),
  },
  {
    name: "switch to Escalations",
    run: async (page) => {
      await toList(page);
      await page.getByRole("button", { name: /^Escalations/ }).click();
    },
  },
  {
    name: "switch to Waiting",
    run: async (page) => page.getByRole("button", { name: /^Waiting/ }).click(),
  },
  {
    name: "switch to Resolved",
    run: async (page) => page.getByRole("button", { name: /^Resolved/ }).click(),
  },
  {
    name: "back to Inbox",
    run: async (page) => page.getByRole("button", { name: /^Inbox/ }).click(),
  },
  {
    name: "close the thread",
    run: async (page) => {
      if (isPhone(page)) await openThread(page, "Marcus Feld");
      await page.getByRole("button", { name: isPhone(page) ? "Inbox" : "Close conversation", exact: true }).click();
    },
  },
  {
    name: "tick two rows",
    run: async (page) => {
      if (isPhone(page)) return;
      await page.getByRole("checkbox", { name: /Marcus Feld/ }).click();
      await page.getByRole("checkbox", { name: /Tomás Ibarra/ }).click();
    },
  },
  {
    name: "select all",
    run: async (page) => {
      if (isPhone(page)) return;
      await page.getByRole("checkbox", { name: /select all/i }).click();
    },
  },
  {
    name: "unselect all",
    run: async (page) => {
      if (isPhone(page)) return;
      await page.getByRole("button", { name: "Unselect All" }).click();
    },
  },
  {
    name: "open a thread and narrow the list",
    run: async (page) => {
      await openThread(page, "Sofia Marchetti");
      if (isPhone(page)) return;
      // Dragging the divider with the keyboard widens the pane, so the rows stack again.
      await page.getByRole("separator", { name: "Resize conversation pane" }).focus();
      for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowLeft");
    },
  },
];
