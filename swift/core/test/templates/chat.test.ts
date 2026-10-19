import assert from "node:assert/strict";
import { test } from "node:test";
import type { Now } from "../../src/format.ts";
import { chat, type ChatState } from "../../src/templates/chat/model.ts";

const NOW: Now = { epochMs: Date.UTC(2026, 9, 13, 16, 30), utcOffsetMinutes: -420 };
const press = (s: ChatState, id: string) => chat.reduce(s, { type: "press", id }, NOW);
const set = (s: ChatState, id: string, value: string | number | boolean) => chat.reduce(s, { type: "set", id, value }, NOW);
const start = () => chat.initial(NOW);

test("the conversation is the stock one, in order", () => {
  const { items } = chat.view(start(), NOW);
  assert.deepEqual(items.map((i) => i.kind), ["divider", "message", "message", "message", "message", "status", "message", "message", "message", "message"]);
  const senders = items.flatMap((i) => (i.kind === "message" ? [i.sender] : []));
  assert.deepEqual(senders, ["user", "assistant", "user", "assistant", "user", "assistant", "user", "assistant"]);
  const first = items[1]!;
  assert.equal(first.kind === "message" && first.files.join(","), "auth-service.ts,middleware.ts");
  const doc = items[7]!;
  assert.ok(doc.kind === "message" && doc.parts.some((p) => p.kind === "bubble" && p.content.kind === "artifact"));
});

test("times carry an ISO instant and a label", () => {
  const first = chat.view(start(), NOW).items[1]!;
  assert.ok(first.kind === "message");
  const bubble = first.parts[0]!;
  assert.ok(bubble.kind === "bubble");
  assert.deepEqual(bubble.time, { at: "2026-04-29T10:15:00", label: "10:15 AM" });
});

test("tool calls keep their status, and the last one is still running", () => {
  const { items } = chat.view(start(), NOW);
  const last = items[items.length - 1]!;
  assert.ok(last.kind === "message");
  const tools = last.parts.find((p) => p.kind === "tools");
  assert.ok(tools && tools.kind === "tools");
  assert.equal(tools.calls[0]!.status, "running");
  assert.equal(tools.expanded, false);
});

test("the composer mode changes the placeholder and the label", () => {
  let s = start();
  assert.deepEqual([chat.view(s, NOW).composer.placeholder, chat.view(s, NOW).composer.modeLabel], ["Ask anything...", "Ask"]);
  s = set(s, "mode", "edit");
  assert.deepEqual([chat.view(s, NOW).composer.placeholder, chat.view(s, NOW).composer.modeLabel], ["Describe your edit...", "Edit"]);
  assert.equal(set(s, "mode", "nonsense"), s);
});

test("the draft follows typing, and sending sends nowhere", () => {
  let s = set(start(), "draft", "hello");
  assert.equal(chat.view(s, NOW).composer.draft, "hello");
  assert.equal(press(s, "send"), s);
  s = set(s, "draft", "");
  assert.equal(chat.view(s, NOW).composer.draft, "");
});

test("the document opens as a panel or a dialog, and closes", () => {
  let s = start();
  assert.deepEqual([chat.view(s, NOW).artifact.panelOpen, chat.view(s, NOW).artifact.dialogOpen], [true, false]);
  s = press(s, "closeArtifact");
  assert.equal(chat.view(s, NOW).artifact.panelOpen, false);
  s = press(s, "openArtifact:panel");
  assert.equal(chat.view(s, NOW).artifact.panelOpen, true);
  s = press(s, "openArtifact:dialog");
  assert.equal(chat.view(s, NOW).artifact.dialogOpen, true);
  s = set(s, "dialog", false);
  assert.equal(chat.view(s, NOW).artifact.dialogOpen, false);
});

test("the view is plain JSON", () => {
  const v = chat.view(start(), NOW);
  assert.deepEqual(JSON.parse(JSON.stringify(v)), v);
});

test("each tool-call group carries its header, and the delivered word is in the view", () => {
  const view = chat.view(start(), NOW);
  const groups = view.items.flatMap((i) => (i.kind === "message" ? i.parts.filter((p) => p.kind === "tools") : []));
  assert.deepEqual(groups.map((g) => g.kind === "tools" && g.label), ["3 tool calls", "1 tool call", "3 tool calls", "1 tool call"]);
  assert.equal(view.words.delivered, "Delivered");
  assert.ok(view.items.some((i) => i.kind === "message" && i.parts.some((p) => p.kind === "bubble" && p.status === "delivered")));
});

test("a code block carries the header line the stock page draws", () => {
  const codes = chat.view(start(), NOW).items.flatMap((i) =>
    i.kind === "message" ? i.parts.flatMap((p) => (p.kind === "bubble" && p.content.kind === "code" ? [p.content.header] : [])) : [],
  );
  assert.deepEqual(codes, ["middleware.ts — typescript", "middleware.test.ts — typescript"]);
});
