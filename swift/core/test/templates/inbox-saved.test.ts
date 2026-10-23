import { test } from "node:test";
import assert from "node:assert/strict";
import { inbox } from "../../src/templates/inbox/model.ts";
import { emptyDoc, type Doc } from "../../src/sync/doc.ts";
import { writesOf } from "../../src/sync/mutations.ts";
import { writePeople } from "../../src/sync/areas/inbox.ts";
import { harness, type World } from "./harness.ts";

// 9:30 AM on Oct 13, 2026 where the person is (UTC-7).
const NOW = { epochMs: Date.UTC(2026, 9, 13, 16, 30), utcOffsetMinutes: -420 };
const h = harness(inbox, NOW);
type W = World<ReturnType<typeof inbox.initial>>;
const start = (doc?: Doc) => h.start(doc);
const view = (w: W, at = NOW) => h.view(w, at);
const ids = (w: W) => view(w).rows.map((r) => r.id);
const press = (w: W, id: string) => h.press(w, id);
const set = (w: W, id: string, value: string | number | boolean) => h.set(w, id, value);
const person = (id: string, label: string) => ({ id, label });
const people = (...p: { id: string; label: string }[]) => JSON.stringify(p);

test("with saving on, the first view is the sample conversations, unchanged", () => {
  const w = start();
  assert.equal(view(w).subtitle.join(""), "3 unread of 9 conversations");
  assert.deepEqual(ids(w), ["c-01", "c-02", "c-03", "c-04", "c-05", "c-06", "c-07", "c-08", "c-09"]);
  assert.equal(view(w).confirm, null);
  assert.deepEqual(w.saved, []);
});

test("the controls that now work are not inert; the rest still are", () => {
  const on = view(start()).inert;
  for (const id of ["archive", "move", "delete", "send"]) assert.ok(!on.includes(id), id);
  for (const id of ["refresh", "attach", "link", "image", "emoji"]) assert.ok(on.includes(id), id);
  const off = inbox.view(inbox.initial(NOW), NOW, undefined, false).inert;
  for (const id of ["refresh", "archive", "move", "delete", "send", "attach", "link", "image", "emoji"]) assert.ok(off.includes(id), id);
});

test("opening an unread thread reads it and saves only that; a read one saves nothing", () => {
  let w = press(start(), "open:c-03");
  assert.deepEqual(w.saved.map((m) => [m.name, m.args]), [["inbox.read", { id: "c-03" }]]);
  assert.equal(view(w).rows.find((r) => r.id === "c-03")!.isUnread, false);
  assert.equal(view(w).rows.find((r) => r.id === "c-03")!.status, null);
  assert.equal(view(w).subtitle.join(""), "2 unread of 9 conversations");
  assert.deepEqual(view(w).tabs.map((t) => [t.value, t.badge]), [["inbox", 2], ["escalations", 1], ["waiting", null], ["resolved", null]]);
  assert.deepEqual(Object.keys(w.doc.inbox_thread), ["c-03"]);
  w = press(w, "open:c-04");
  assert.equal(w.saved.length, 1, "c-04 was already read");
  w = press(w, "open:c-03");
  assert.equal(w.saved.length, 1, "and c-03 is read now");
});

test("without saving on, every control behaves as stock: nothing is asked for", () => {
  const stock = harness(inbox, NOW, false);
  let w = stock.start();
  const seen = w.state;
  for (const id of ["archive:c-01", "delete:c-01", "move:c-01:resolved", "archiveSelected", "deleteSelected", "moveSelected:resolved", "deleteConfirm", "send"]) {
    assert.equal(stock.press(w, id), w, id);
  }
  w = stock.press(w, "open:c-03");
  assert.deepEqual(w.saved, []);
  assert.equal(stock.view(w).rows.find((r) => r.id === "c-03")!.isUnread, true);
  assert.equal(stock.view(w).subtitle.join(""), "3 unread of 9 conversations");
  assert.equal(w.state.confirm, seen.confirm);
  // A doc with saved rows is not drawn.
  const kept = stock.start({ ...emptyDoc(), inbox_thread: { "c-01": { id: "c-01", deleted: true } } });
  assert.equal(stock.view(kept).rows.length, 9);
});

test("Archive hides the thread from every tab and keeps its row", () => {
  let w = press(start(), "archive:c-02");
  assert.ok(!ids(w).includes("c-02"));
  assert.equal(view(w).subtitle.join(""), "2 unread of 8 conversations");
  assert.deepEqual(w.saved.map((m) => [m.name, m.args]), [["inbox.archive", { id: "c-02" }]]);
  assert.equal(w.doc.inbox_thread["c-02"]!.archived, true);
  w = press(w, "archive:zzz");
  assert.equal(w.saved.length, 1, "an unknown thread is ignored");
  for (const tab of ["escalations", "waiting", "resolved"]) assert.ok(!view(set(w, "tab", tab)).rows.some((r) => r.id === "c-02"));
});

test("archiving or deleting the open thread opens the next one, and a phone goes back to the list", () => {
  const wide = set(set(start(), "surface", 1440), "list", 480);
  assert.equal(view(wide).openId, "c-01");
  const gone = press(wide, "archive:c-01");
  assert.equal(view(gone).openId, "c-02");
  assert.deepEqual(view(gone).pane?.openMessages, ["c-02"], "the next thread starts with its newest message open");
  const phone = press(set(start(), "surface", 390), "open:c-02");
  assert.equal(view(phone).openId, "c-02");
  assert.equal(view(press(phone, "archive:c-02")).openId, null);
});

test("Delete asks first; Cancel saves nothing; Delete removes the thread", () => {
  let w = press(start(), "delete:c-01");
  assert.deepEqual(w.saved, []);
  assert.deepEqual(view(w).confirm, {
    title: "Delete this conversation?",
    description: "“Checkout returns 502 for EU customers” will be deleted. This cannot be undone.",
    actionLabel: "Delete",
    cancelLabel: "Cancel",
    actionId: "tpl.inbox.deleteConfirm",
    cancelId: "tpl.inbox.deleteCancel",
  });
  assert.equal(ids(w).length, 9);
  const cancelled = press(w, "deleteCancel");
  assert.equal(view(cancelled).confirm, null);
  assert.deepEqual(cancelled.saved, []);
  w = press(w, "deleteConfirm");
  assert.deepEqual(w.saved.map((m) => [m.name, m.args]), [["inbox.delete", { id: "c-01" }]]);
  assert.ok(!ids(w).includes("c-01"));
  assert.equal(view(w).confirm, null);
  assert.equal(w.doc.inbox_thread["c-01"]!.deleted, true);
  // Answering a question nobody asked does nothing.
  assert.equal(press(w, "deleteConfirm"), w);
  assert.equal(press(w, "deleteCancel"), w);
  assert.equal(press(start(), "delete:zzz").state.confirm, null);
});

test("Move to folder lists the other folders, moves one thread and keeps the tabs honest", () => {
  const row = (w: W, id: string) => view(w).rows.find((r) => r.id === id)!;
  assert.deepEqual(row(start(), "c-01").moveTargets, [
    { label: "Inbox", id: "tpl.inbox.move:c-01:inbox" },
    { label: "Waiting", id: "tpl.inbox.move:c-01:waiting" },
    { label: "Resolved", id: "tpl.inbox.move:c-01:resolved" },
  ]);
  let w = press(start(), "move:c-01:resolved");
  assert.deepEqual(w.saved.map((m) => [m.name, m.args]), [["inbox.move", { id: "c-01", folder: "resolved" }]]);
  assert.ok(!view(set(w, "tab", "escalations")).rows.some((r) => r.id === "c-01"));
  assert.deepEqual(view(set(w, "tab", "resolved")).rows.map((r) => r.id), ["c-01", "c-03", "c-08"]);
  assert.ok(ids(w).includes("c-01"), "the Inbox tab is the whole queue");
  assert.deepEqual(view(w).pane?.moveTargets.map((t) => t.label), ["Inbox", "Escalations", "Waiting"]);
  assert.equal(press(w, "move:c-01:resolved"), w, "already there");
  for (const bad of ["move:c-01:nowhere", "move:zzz:waiting", "move:c-01", "move:"]) assert.equal(press(w, bad), w, bad);
  w = press(w, "move:c-01:inbox");
  assert.equal(w.saved.length, 2);
  assert.ok(!view(set(w, "tab", "resolved")).rows.some((r) => r.id === "c-01"));
});

test("the bulk actions work on the ticked rows of the tab and untick them", () => {
  let w = set(start(), "selection", "c-01,c-02,c-05");
  assert.deepEqual(view(w).bulkMoveTargets.map((t) => t.id), ["inbox", "escalations", "waiting", "resolved"].map((f) => `tpl.inbox.moveSelected:${f}`));
  const moved = press(w, "moveSelected:waiting");
  assert.deepEqual(moved.saved.map((m) => [m.name, m.args]), [["inbox.move", { id: "c-01", folder: "waiting" }], ["inbox.move", { id: "c-02", folder: "waiting" }]]);
  assert.deepEqual(view(moved).selectedKeys, []);
  const archived = press(set(w, "tab", "waiting"), "archiveSelected");
  assert.deepEqual(archived.saved.map((m) => m.args.id), ["c-05"], "only the ticked rows that are on this tab");
  assert.deepEqual(view(archived).selectedKeys, ["c-01", "c-02"]);
  w = press(w, "deleteSelected");
  assert.deepEqual(w.saved, []);
  assert.equal(view(w).confirm!.title, "Delete these conversations?");
  assert.equal(view(w).confirm!.description, "3 conversations will be deleted. This cannot be undone.");
  w = press(w, "deleteConfirm");
  assert.deepEqual(w.saved.map((m) => [m.name, m.args.id]), [["inbox.delete", "c-01"], ["inbox.delete", "c-02"], ["inbox.delete", "c-05"]]);
  assert.deepEqual(view(w).selectedKeys, []);
  assert.equal(ids(w).length, 6);
  // Nothing ticked, nothing to do.
  for (const id of ["archiveSelected", "deleteSelected", "moveSelected:waiting"]) assert.equal(press(start(), id).saved.length, 0, id);
});

function typed(w: W, to: { id: string; label: string }[], subject: string, body: string): W {
  return set(set(set(w, "recipients", people(...to)), "subject", subject), "body", body);
}

test("Send is possible only with a recipient and a message", () => {
  let w = press(start(), "compose");
  assert.equal(view(w).compose.canSend, false);
  assert.equal(press(w, "send"), w);
  w = typed(w, [person("a@example.com", "A")], "Hi", "   ");
  assert.equal(view(w).compose.canSend, false);
  assert.equal(press(w, "send"), w);
  assert.equal(view(typed(w, [], "Hi", "Hello")).compose.canSend, false);
  assert.equal(view(set(w, "body", "Hello")).compose.canSend, true);
});

test("Reply and Send appends the reply to its thread, expanded, and empties the draft", () => {
  let w = press(press(start(), "open:c-05"), "reply");
  w = set(w, "body", "  Thanks, on it.\nWill follow up.  ");
  w = press(w, "send");
  assert.deepEqual(w.saved.map((m) => [m.name, m.args]), [["inbox.reply", {
    id: "dev-1",
    thread: "c-05",
    at: NOW.epochMs,
    to: people(person("h.lindqvist@varda.example", "Hannah Lindqvist")),
    cc: "[]",
    bcc: "[]",
    body: "  Thanks, on it.\nWill follow up.  ",
  }]]);
  const pane = view(w).pane!;
  const last = pane.messages.at(-1)!;
  assert.deepEqual([last.id, last.sender, last.receivedFull, last.body], ["dev-1", "You", "Today at 9:30 AM", ["Thanks, on it.", "Will follow up."]]);
  assert.ok(pane.openMessages.includes("dev-1") && pane.openMessages.includes("c-05"));
  assert.equal(pane.messages.at(-2)!.id, "c-05", "the sample's own message stays where it was");
  const compose = view(w).compose;
  assert.deepEqual([compose.isOpen, compose.body, compose.recipients, compose.subject, compose.canSend], [false, "", [], "", false]);
  assert.equal(ids(w).length, 9, "a reply is not a new conversation");
  // Reply all leaves the person's own address out of the next draft.
  const again = view(press(w, "replyAll")).compose.recipients.map((r) => r.id);
  assert.ok(!again.some((id) => id.endsWith("@support.example")));
  // Two replies come in the order they were sent.
  const later = { ...NOW, epochMs: NOW.epochMs + 60_000 };
  const second = harness(inbox, later);
  const w2 = second.press(second.set(second.press(w, "reply"), "body", "Second"), "send");
  assert.deepEqual(second.view(w2).pane!.messages.slice(-2).map((m) => m.body[0]), ["Thanks, on it.", "Second"]);
});

test("a new message is a new conversation, on top, opened, from the person, to the recipient", () => {
  let w = press(start(), "compose");
  w = typed(w, [person("sam@example.com", "Sam Rivera"), person("lee@example.com", "Lee")], "Lunch on Friday?", "Are you free?\n\nLet me know.");
  w = set(w, "tab", "waiting");
  w = press(w, "send");
  assert.deepEqual(w.saved.map((m) => [m.name, m.args.id, m.args.subject, m.args.at]), [["inbox.compose", "dev-1", "Lunch on Friday?", NOW.epochMs]]);
  const v = view(w);
  assert.equal(v.tab, "inbox");
  assert.deepEqual(v.rows.map((r) => r.id).slice(0, 2), ["dev-1", "c-01"]);
  assert.equal(v.openId, "dev-1");
  const row = v.rows[0]!;
  assert.deepEqual([row.sender, row.subject, row.preview, row.receivedAt, row.isUnread, row.tags, row.priority], ["Sam Rivera", "Lunch on Friday?", "Are you free?", "9:30 AM", false, [], null]);
  const msg = v.pane!.messages;
  assert.equal(msg.length, 1);
  assert.deepEqual([msg[0]!.sender, msg[0]!.senderEmail, msg[0]!.receivedFull, msg[0]!.body], ["You", "you@support.example", "Today at 9:30 AM", ["Are you free?", "Let me know."]]);
  assert.equal(v.subtitle.join(""), "3 unread of 10 conversations");
  assert.deepEqual(v.compose.directory.find((p) => p.id === "sam@example.com"), { id: "sam@example.com", label: "Sam Rivera" });
  // Replying to it goes to the recipient, not to the person.
  assert.deepEqual(view(press(w, "reply")).compose.recipients, [{ id: "sam@example.com", label: "Sam Rivera" }]);
  // A message with no subject says so; a later day words the time as a day.
  const bare = press(typed(press(start(), "compose"), [person("a@example.com", "A")], "  ", "Hi"), "send");
  assert.equal(view(bare).rows[0]!.subject, "(No subject)");
  const nextDay = { ...NOW, epochMs: NOW.epochMs + 26 * 3_600_000 };
  assert.deepEqual([view(bare, nextDay).rows[0]!.receivedAt, view(bare, nextDay).pane!.messages[0]!.receivedFull], ["Yesterday", "Yesterday at 9:30 AM"]);
  // A new conversation can be archived, moved and deleted like any other.
  const moved = press(w, "move:dev-1:waiting");
  assert.deepEqual(view(set(moved, "tab", "waiting")).rows.map((r) => r.id), ["dev-1", "c-05", "c-06"]);
  assert.ok(!ids(press(press(w, "delete:dev-1"), "deleteConfirm")).includes("dev-1"));
  // Newest on top.
  const second = harness(inbox, { ...NOW, epochMs: NOW.epochMs + 60_000 });
  const two = second.press(second.set(second.set(second.press(w, "compose"), "recipients", people(person("b@example.com", "B"))), "body", "Second"), "send");
  assert.deepEqual(second.view(two).rows.slice(0, 2).map((r) => r.id), ["dev-2", "dev-1"]);
});

test("rows from another device are drawn; malformed rows are not", () => {
  const to = writePeople([person("pat@example.com", "Pat Doe")]);
  const doc: Doc = {
    ...emptyDoc(),
    inbox_thread: {
      "c-04": { id: "c-04", unread: true, folder: "escalations" },
      "c-06": { id: "c-06", archived: true },
      "c-07": { id: "c-07", deleted: true },
      "c-08": { id: "c-08", folder: "nowhere", unread: false },
      "x-1": { id: "x-1", subject: "From the phone", to, text: "Hello there", sentAt: NOW.epochMs - 3_600_000, folder: "waiting" },
      "x-2": { id: "x-2", subject: "No recipient", to: "[]", text: "Hello", sentAt: NOW.epochMs },
      "x-3": { id: "x-3", subject: "No text", to, sentAt: NOW.epochMs },
      "x-4": { id: "x-4", subject: "Bad time", to, text: "Hi" },
      "x-5": { id: "x-5", subject: "Bad people", to: "not json", text: "Hi", sentAt: NOW.epochMs },
      "x-6": { id: "x-6", archived: true },
    },
    inbox_message: {
      m1: { id: "m1", thread: "c-02", to, text: "First reply", sentAt: NOW.epochMs - 7_200_000 },
      m2: { id: "m2", thread: "c-02", to, text: "Second reply", sentAt: NOW.epochMs - 3_600_000 },
      m0: { id: "m0", thread: "gone", to, text: "Nobody's", sentAt: NOW.epochMs },
      m3: { id: "m3", thread: "c-02", to, text: "   ", sentAt: NOW.epochMs },
      m4: { id: "m4", thread: "c-02", to: "[]x", text: "Bad", sentAt: NOW.epochMs },
      m5: { id: "m5", to, text: "No thread", sentAt: NOW.epochMs },
    },
  };
  const w = start(doc);
  const v = view(w);
  assert.deepEqual(v.rows.map((r) => r.id), ["x-1", "c-01", "c-02", "c-03", "c-04", "c-05", "c-08", "c-09"]);
  assert.equal(v.rows.find((r) => r.id === "c-04")!.isUnread, true);
  assert.equal(v.rows[0]!.receivedAt, "8:30 AM");
  assert.deepEqual(view(set(w, "tab", "escalations")).rows.map((r) => r.id), ["c-01", "c-04"]);
  assert.deepEqual(view(set(w, "tab", "waiting")).rows.map((r) => r.id), ["x-1", "c-05"]);
  assert.ok(view(set(w, "tab", "resolved")).rows.some((r) => r.id === "c-08"), "an unknown folder keeps the sample's");
  const thread = view(press(w, "open:c-02")).pane!;
  assert.deepEqual(thread.messages.map((m) => m.id), ["c-02", "m1", "m2"]);
  assert.equal(v.subtitle.join(""), "4 unread of 8 conversations");
});

test("the arguments of every mutation are checked", () => {
  const to = writePeople([person("a@example.com", "A")]);
  const ok = (name: string, args: unknown) => writesOf(name, args) !== null;
  assert.ok(ok("inbox.read", { id: "c-01" }));
  assert.ok(ok("inbox.archive", { id: "c-01" }));
  assert.ok(ok("inbox.delete", { id: "c-01" }));
  assert.ok(ok("inbox.move", { id: "c-01", folder: "waiting" }));
  assert.ok(ok("inbox.reply", { id: "m-1", thread: "c-01", at: 1, to, cc: "[]", bcc: "[]", body: "Hi" }));
  assert.ok(ok("inbox.compose", { id: "t-1", at: 1, to, cc: "[]", bcc: "[]", subject: "", body: "Hi" }));
  assert.ok(!ok("inbox.read", { id: "../x" }));
  assert.ok(!ok("inbox.read", { id: "c-01", extra: 1 }));
  assert.ok(!ok("inbox.archive", {}));
  assert.ok(!ok("inbox.move", { id: "c-01", folder: "trash" }));
  assert.ok(!ok("inbox.move", { id: "c-01" }));
  const reply = { id: "m-1", thread: "c-01", at: 1, to, cc: "[]", bcc: "[]", body: "Hi" };
  for (const bad of [{ at: 0 }, { at: 1.5 }, { to: "[]" }, { to: "nope" }, { to: '[{"id":"a"}]' }, { cc: "{}" }, { body: "  " }, { body: "x".repeat(20_001) }, { thread: "a b" }, { to: JSON.stringify(Array.from({ length: 21 }, (_, n) => person(`p${n}@example.com`, "P"))) }]) {
    assert.equal(writesOf("inbox.reply", { ...reply, ...bad }), null, JSON.stringify(bad).slice(0, 40));
  }
  assert.equal(writesOf("inbox.compose", { id: "t-1", at: 1, to, cc: "[]", bcc: "[]", subject: "x".repeat(201), body: "Hi" }), null);
  // The saved fields are trimmed text and numbers.
  assert.deepEqual(writesOf("inbox.compose", { id: "t-1", at: 5, to, cc: "[]", bcc: "[]", subject: " S ", body: " B " })![0]!.fields, { subject: "S", to, cc: "[]", bcc: "[]", text: "B", sentAt: 5, folder: "inbox", unread: false });
});

test("the view with saved data is plain JSON", () => {
  const w = typed(press(start(), "compose"), [person("a@example.com", "A")], "S", "B");
  const v = view(press(press(w, "send"), "delete:c-01"));
  assert.deepEqual(JSON.parse(JSON.stringify(v)), v);
});
