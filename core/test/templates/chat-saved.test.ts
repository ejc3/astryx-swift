import { test } from "node:test";
import assert from "node:assert/strict";
import { chat } from "../../src/templates/chat/model.ts";
import { emptyDoc, type Doc } from "../../src/sync/doc.ts";
import { writesOf } from "../../src/sync/mutations.ts";
import { harness, type World } from "./harness.ts";

// 9:30 AM where the person is (UTC-7).
const NOW = { epochMs: Date.UTC(2026, 9, 13, 16, 30), utcOffsetMinutes: -420 };
const h = harness(chat, NOW);
type W = World<ReturnType<typeof chat.initial>>;
const view = (w: W, at = NOW) => h.view(w, at);
const sentItems = (w: W, at = NOW) => view(w, at).items.slice(10);
const text = (item: ReturnType<typeof view>["items"][number]) => {
  assert.ok(item.kind === "message");
  const bubble = item.parts[0]!;
  assert.ok(bubble.kind === "bubble" && bubble.content.kind === "text");
  return bubble.content.text;
};
const send = (w: W, draft: string) => h.press(h.set(w, "draft", draft), "send");

test("Send saves the message and draws it after the sample conversation, then empties the draft", () => {
  let w = send(h.start(), "Thanks, that works for me.");
  assert.deepEqual(w.saved.map((m) => [m.name, m.args]), [["chat.send", { id: "dev-1", text: "Thanks, that works for me.", mode: "ask", at: NOW.epochMs }]]);
  assert.equal(view(w).composer.draft, "");
  const [item] = sentItems(w);
  assert.ok(item && item.kind === "message");
  assert.deepEqual([item.id, item.sender, item.files, text(item)], ["dev-1", "user", [], "Thanks, that works for me."]);
  const bubble = item.parts[0]!;
  assert.ok(bubble.kind === "bubble");
  assert.deepEqual([bubble.time, bubble.status], [{ at: "2026-10-13T09:30:00", label: "9:30 AM" }, "delivered"]);
  // The sample conversation is untouched, and the composer mode is saved with the message.
  assert.equal(view(w).items.length, 11);
  w = send(h.set(w, "mode", "edit"), "Rename the flag.");
  assert.equal(w.saved[1]!.args.mode, "edit");
});

test("messages come in the order they were sent", () => {
  const later = { ...NOW, epochMs: NOW.epochMs + 90_000 };
  const second = harness(chat, later);
  let w = send(h.start(), "first");
  w = second.press(second.set(w, "draft", "second"), "send");
  assert.deepEqual(sentItems(w, later).map(text), ["first", "second"]);
  assert.deepEqual(w.saved.map((m) => m.args.id), ["dev-1", "dev-2"]);
});

test("an empty or blank draft sends nothing", () => {
  const w = h.start();
  assert.equal(h.press(w, "send"), w);
  const blank = h.set(w, "draft", "  \n ");
  assert.equal(h.press(blank, "send"), blank);
  assert.deepEqual(blank.saved, []);
});

test("without saving on, Send does what stock does: nothing, and the draft stays for the host to clear", () => {
  const stock = harness(chat, NOW, false);
  const w = stock.set(stock.start(), "draft", "hello");
  assert.equal(stock.press(w, "send"), w);
  assert.equal(stock.view(w).items.length, 10);
  const kept = stock.start({ ...emptyDoc(), chat_message: { x: { id: "x", text: "saved", sentAt: NOW.epochMs, mode: "ask" } } });
  assert.equal(stock.view(kept).items.length, 10);
});

test("messages from another device are drawn; malformed rows are not", () => {
  const doc: Doc = {
    ...emptyDoc(),
    chat_message: {
      b: { id: "b", text: "later", mode: "edit", sentAt: NOW.epochMs },
      a: { id: "a", text: "earlier", mode: "ask", sentAt: NOW.epochMs - 60_000 },
      t: { id: "t", text: "tie", sentAt: NOW.epochMs - 60_000 },
      blank: { id: "blank", text: "   ", sentAt: NOW.epochMs },
      none: { id: "none", sentAt: NOW.epochMs },
      noTime: { id: "noTime", text: "x" },
      badMode: { id: "badMode", text: "x", mode: "shout", sentAt: NOW.epochMs },
    },
  };
  assert.deepEqual(sentItems(h.start(doc)).map(text), ["earlier", "tie", "later"]);
});

test("the arguments of chat.send are checked", () => {
  const ok = { id: "m-1", text: "Hi", mode: "ask", at: 1 };
  assert.deepEqual(writesOf("chat.send", { ...ok, text: " Hi " })![0]!.fields, { text: "Hi", mode: "ask", sentAt: 1 });
  for (const bad of [{ id: "a b" }, { text: "" }, { text: "  " }, { text: "x".repeat(8001) }, { mode: "shout" }, { at: 0 }, { at: 2.5 }, { extra: 1 }]) {
    assert.equal(writesOf("chat.send", { ...ok, ...bad }), null, JSON.stringify(bad).slice(0, 40));
  }
});

test("the view with sent messages is plain JSON", () => {
  const v = view(send(h.start(), "Hi"));
  assert.deepEqual(JSON.parse(JSON.stringify(v)), v);
});
