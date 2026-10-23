/** The demo screens' saved data (docs/SYNC.md): what each action saves, what a reload draws, and what is refused. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createClient, type AppSnapshot, type Doc, type Mutation, type Node, type Now, type ScreenId } from "../src/index.ts";
import { REPLIES } from "../src/sample.ts";
import { readDoc } from "../src/sync/doc.ts";
import { writesOf } from "../src/sync/mutations.ts";

// Tuesday 2026-10-13, 9:30 AM in UTC-7.
const NOW: Now = { epochMs: Date.UTC(2026, 9, 13, 16, 30), utcOffsetMinutes: -420 };
let now = NOW;
const clock = () => now;
const later = (minutes: number): Now => ({ ...NOW, epochMs: NOW.epochMs + minutes * 60_000 });

type Client = ReturnType<typeof createClient>;
const app = (c: Client) => c.getSnapshot("app") as AppSnapshot;

function nodes(n: Node): Node[] {
  const kids = (x: Node): Node[] => {
    switch (x.kind) {
      case "stack": case "grid": case "card": case "section": return x.children;
      case "split": return [x.primary, x.detail];
      case "banner": case "empty": return x.action ? [x.action] : [];
      default: return [];
    }
  };
  return [n, ...kids(n).flatMap(nodes)];
}
const find = <K extends Node["kind"]>(c: Client, kind: K, id?: string) => nodes(app(c).screen.body).find((n) => n.kind === kind && (id === undefined || (n as { id?: string }).id === id)) as Extract<Node, { kind: K }>;

/** A client on `screen`, recording what it asks the host to save; `doc` is what the host kept from before. */
function open(screen: ScreenId, doc?: unknown, extras = true) {
  now = NOW;
  const c = createClient(clock, { screen, seed: "dev1", extras, ...(doc === undefined ? {} : { doc }) });
  const saved: Mutation[] = [];
  let kept: Doc | undefined;
  c.onSave((m, d) => { saved.push(...m); kept = d; });
  return { c, saved, doc: () => kept };
}
const names = (saved: Mutation[]) => saved.map((m) => m.name);

// --- Inbox -------------------------------------------------------------------------------------

const rows = (c: Client) => find(c, "split").primary && (nodes(find(c, "split").primary).find((n) => n.kind === "list") as Extract<Node, { kind: "list" }>).items;

test("inbox: read, starred and archived are saved by message id, and a reload draws them", () => {
  const { c, saved, doc } = open("inbox");
  const badge = (x: Client) => app(x).nav.find((n) => n.id === "inbox")!.badge;
  assert.equal(badge(c), "3");
  c.dispatch({ type: "press", id: "inbox.select:m2" });
  c.dispatch({ type: "press", id: "inbox.select:m2" });
  c.dispatch({ type: "press", id: "inbox.star:m3" });
  c.dispatch({ type: "press", id: "inbox.archive:m4" });
  assert.deepEqual(saved.map((m) => [m.name, m.args]), [
    ["demo.message", { id: "m2", read: true }],
    ["demo.message", { id: "m3", starred: true }],
    ["demo.message", { id: "m4", archived: true }],
  ]);
  const again = open("inbox", doc());
  assert.equal(badge(again.c), "1");
  assert.deepEqual(rows(again.c)!.map((r) => r.id), ["m1", "m2", "m3", "m5", "m6", "m7"]);
  assert.equal(rows(again.c)!.find((r) => r.id === "m2")!.emphasized, false);
  assert.equal(again.saved.length, 0);
});

test("inbox: Mark all read saves each unread message once; Undo archive saves through a mutation", () => {
  const { c, saved, doc } = open("inbox");
  c.dispatch({ type: "press", id: "inbox.readAll" });
  assert.deepEqual(saved.map((m) => m.args.id), ["m1", "m2", "m4"]);
  c.dispatch({ type: "press", id: "inbox.readAll" });
  assert.equal(saved.length, 3);
  c.dispatch({ type: "press", id: "inbox.archive:m1" });
  c.dispatch({ type: "press", id: "toast.undo" });
  assert.deepEqual(saved.slice(3).map((m) => [m.name, m.args]), [["demo.message", { id: "m1", archived: true }], ["demo.message", { id: "m1", archived: false }]]);
  assert.equal(doc()!.demo_message.m1!.archived, false);
  assert.equal(rows(c)!.length, 7);
  // Mark unread is saved too.
  c.dispatch({ type: "press", id: "inbox.unread:m3" });
  assert.deepEqual(saved.at(-1)!.args, { id: "m3", read: false });
});

test("inbox: the first view is the sample, and nothing is saved by looking", () => {
  const { c, saved } = open("inbox");
  assert.equal(rows(c)!.length, 7);
  assert.deepEqual(rows(c)!.filter((r) => r.emphasized).map((r) => r.id), ["m1", "m2", "m4"]);
  c.dispatch({ type: "set", id: "inbox.tab", value: "starred" });
  c.dispatch({ type: "set", id: "inbox.query", value: "icon" });
  c.dispatch({ type: "press", id: "inbox.back" });
  assert.equal(saved.length, 0);
});

// --- Tasks -------------------------------------------------------------------------------------

const column = (c: Client, id: string) => find(c, "board").columns.find((x) => x.id === id)!.cards.map((x) => x.id);

test("tasks: a card's column is saved by task id, Undo saves the move back, and a reload keeps it", () => {
  const { c, saved, doc } = open("tasks");
  c.dispatch({ type: "press", id: "tasks.forward:t2" });
  assert.deepEqual(saved.map((m) => [m.name, m.args]), [["demo.task", { id: "t2", column: "done" }]]);
  assert.ok(column(c, "done").includes("t2"));
  assert.equal(app(c).toast?.action?.id, "toast.undo");
  c.dispatch({ type: "press", id: "toast.undo" });
  assert.deepEqual(saved.at(-1)!.args, { id: "t2", column: "doing" });
  c.dispatch({ type: "press", id: "tasks.back:t3" });
  assert.deepEqual(saved.at(-1)!.args, { id: "t3", column: "todo" });
  // Moving past either end changes nothing.
  const n = saved.length;
  c.dispatch({ type: "press", id: "tasks.back:t3" });
  c.dispatch({ type: "press", id: "tasks.forward:nope" });
  assert.equal(saved.length, n);
  const again = open("tasks", doc());
  assert.deepEqual(column(again.c, "todo").sort(), ["t1", "t3", "t4", "t5", "t8"]);
  assert.ok(column(again.c, "doing").includes("t2"));
});

// --- Chat --------------------------------------------------------------------------------------

const chatLines = (c: Client) => (app(c).screen.body as Extract<Node, { kind: "chat" }>).messages;
const send = (c: Client, text: string) => { c.dispatch({ type: "set", id: "chat.draft", value: text }); c.dispatch({ type: "press", id: "chat.send" }); };

test("chat: a send saves the line and the canned reply with minted ids and an absolute time", () => {
  const { c, saved } = open("chat");
  send(c, "  Ship it  ");
  assert.equal(saved.length, 1);
  assert.equal(saved[0]!.name, "demo.chatSend");
  assert.deepEqual(saved[0]!.args, { id: "dev1-1", replyId: "dev1-2", text: "Ship it", reply: REPLIES[0], ordinal: 0, at: NOW.epochMs });
  const last = chatLines(c).slice(-2);
  assert.deepEqual(last.map((m) => [m.id, m.author, m.text, m.time]), [["dev1-1", "You", "Ship it", "Now"], ["dev1-2", "Theo", REPLIES[0], "Now"]]);
  // An empty draft sends nothing.
  send(c, "   ");
  assert.equal(saved.length, 1);
});

test("chat: after a reload the lines are still there, drawn with their time of day, and the replies carry on in turn", () => {
  const first = open("chat");
  send(first.c, "one");
  const again = open("chat", first.doc());
  now = later(5);
  again.c.dispatch({ type: "tick" });
  // Five minutes on, "Now" has become the time of day it was sent (9:30 in UTC-7).
  assert.deepEqual(chatLines(again.c).slice(-2).map((m) => [m.text, m.time]), [["one", "9:30 AM"], [REPLIES[0], "9:30 AM"]]);
  send(again.c, "two");
  assert.equal(again.saved[0]!.args.reply, REPLIES[1]);
  assert.equal(again.saved[0]!.args.ordinal, 1);
  assert.deepEqual(chatLines(again.c).slice(-4).map((m) => m.text), ["one", REPLIES[0], "two", REPLIES[1]]);
});

test("a new id after a relaunch skips the ids the saved work already holds", () => {
  const first = open("chat");
  send(first.c, "one");
  const again = open("chat", first.doc());
  send(again.c, "two");
  assert.deepEqual(again.saved[0]!.args.id, "dev1-3");
  assert.deepEqual(again.saved[0]!.args.replyId, "dev1-4");
});

test("chat: lines stay in the order they were sent however their ids sort, and the reply cycle wraps", () => {
  const { c } = open("chat");
  for (let i = 0; i < 12; i++) { now = later(i); send(c, `m${i}`); }
  const mine = chatLines(c).filter((m) => m.mine && m.text.startsWith("m")).map((m) => m.text);
  assert.deepEqual(mine, Array.from({ length: 12 }, (_, i) => `m${i}`));
  const replies = chatLines(c).filter((m) => !m.mine && REPLIES.includes(m.text)).map((m) => m.text);
  assert.deepEqual(replies.slice(0, 7), [...REPLIES, REPLIES[0]!, REPLIES[1]!]);
  // Ids are minted, never `me<n>`.
  assert.ok(chatLines(c).every((m) => !/^(me|re)\d+$/.test(m.id)));
  assert.equal(new Set(chatLines(c).map((m) => m.id)).size, chatLines(c).length);
});

// --- Profile and Settings ----------------------------------------------------------------------

/** The input, switch, select or radio with this id; the fields every one of them may carry. */
const input = (c: Client, id: string) => nodes(app(c).screen.body).find((n) => "id" in n && n.id === id) as unknown as { value: string; error?: string; on: boolean };

test("settings: toggles, selects, bio, density and the theme are saved as they change; a reload shows them", () => {
  const { c, saved, doc } = open("settings");
  c.dispatch({ type: "set", id: "settings.pushNotes", value: true });
  c.dispatch({ type: "set", id: "settings.emailNotes", value: false });
  c.dispatch({ type: "set", id: "settings.digest", value: "daily" });
  c.dispatch({ type: "set", id: "settings.density", value: "compact" });
  c.dispatch({ type: "set", id: "settings.reduceMotion", value: true });
  c.dispatch({ type: "set", id: "settings.bio", value: "Hello" });
  c.dispatch({ type: "set", id: "settings.theme", value: "ocean" });
  assert.deepEqual(saved.map((m) => m.args), [
    { key: "profile.pushNotes", value: true }, { key: "profile.emailNotes", value: false }, { key: "profile.digest", value: "daily" },
    { key: "profile.density", value: "compact" }, { key: "profile.reduceMotion", value: true }, { key: "profile.bio", value: "Hello" }, { key: "app.theme", value: "ocean" },
  ]);
  assert.ok(names(saved).every((n) => n === "settings.set"));
  // Setting what is already shown saves nothing; neither does a value the setting refuses.
  c.dispatch({ type: "set", id: "settings.density", value: "compact" });
  c.dispatch({ type: "set", id: "settings.digest", value: "hourly" });
  assert.equal(saved.length, 7);
  const again = open("settings", doc());
  assert.equal(input(again.c, "settings.pushNotes").on, true);
  assert.equal(input(again.c, "settings.emailNotes").on, false);
  assert.equal(input(again.c, "settings.digest").value, "daily");
  assert.equal(input(again.c, "settings.density").value, "compact");
  assert.equal(input(again.c, "settings.bio").value, "Hello");
  assert.equal(app(again.c).theme.id, "ocean");
  assert.equal((again.c.getSnapshot("theme") as { id: string }).id, "ocean");
  assert.equal(input(again.c, "settings.theme").value, "ocean");
});

test("settings: a name or email that fails its check stays a draft; the saved value is what other screens show", () => {
  const { c, saved, doc } = open("settings");
  c.dispatch({ type: "set", id: "settings.email", value: "maya@" });
  c.dispatch({ type: "set", id: "settings.name", value: "" });
  assert.equal(saved.length, 0);
  assert.equal(input(c, "settings.email").value, "maya@");
  assert.ok(input(c, "settings.email").error);
  assert.ok(input(c, "settings.name").error);
  c.dispatch({ type: "set", id: "settings.email", value: "maya@studio.example" });
  c.dispatch({ type: "set", id: "settings.name", value: "Maya O" });
  assert.deepEqual(saved.map((m) => m.args), [{ key: "profile.email", value: "maya@studio.example" }, { key: "profile.name", value: "Maya O" }]);
  assert.equal(input(c, "settings.email").error, undefined);
  const again = open("profile", doc());
  again.c.dispatch({ type: "set", id: "profile.tab", value: "about" });
  const meta = nodes(app(again.c).screen.body).flatMap((n) => (n.kind === "card" ? n.children : [])).find((n) => n.kind === "metadata") as Extract<Node, { kind: "metadata" }>;
  assert.equal(meta.items.find((i) => i.label === "Email")!.value, "maya@studio.example");
  assert.equal(input(open("settings", doc()).c, "settings.name").value, "Maya O");
});

test("settings: the saved theme beats the host's starting theme, and a theme row from another device applies at once", () => {
  const { doc } = (() => { const o = open("settings"); o.c.dispatch({ type: "set", id: "settings.theme", value: "ember" }); return o; })();
  const c = createClient(clock, { screen: "settings", theme: "grape", doc: doc() });
  assert.equal(app(c).theme.id, "ember");
  const fresh = createClient(clock, { screen: "settings", theme: "grape" });
  assert.equal(app(fresh).theme.id, "grape");
  const told: string[] = [];
  fresh.subscribe((s) => told.push(s));
  fresh.dispatch({ type: "rows", table: "settings_value", rows: [{ id: "app.theme", value: "ocean" }] });
  assert.equal(app(fresh).theme.id, "ocean");
  assert.deepEqual(told, ["app", "theme"]);
  // A malformed theme row is ignored.
  fresh.dispatch({ type: "rows", table: "settings_value", rows: [{ id: "app.theme", value: "no-such-theme" }] });
  assert.equal(app(fresh).theme.id, "ocean");
});

test("profile: following is saved, and a reload shows it; deleting the account is not saved", () => {
  const { c, saved, doc } = open("profile");
  c.dispatch({ type: "press", id: "profile.follow" });
  assert.deepEqual(saved.map((m) => [m.name, m.args]), [["settings.set", { key: "profile.following", value: true }]]);
  assert.equal(app(c).toast?.text, "You're following Maya.");
  const again = open("profile", doc());
  assert.equal(app(again.c).screen.toolbar[0]!.label, "Following");
  again.c.dispatch({ type: "press", id: "profile.follow" });
  assert.equal(app(again.c).screen.toolbar[0]!.label, "Follow");
  assert.deepEqual(again.saved.map((m) => m.args), [{ key: "profile.following", value: false }]);
  const s = open("settings");
  s.c.dispatch({ type: "press", id: "settings.delete" });
  s.c.dispatch({ type: "press", id: "dialog.confirm" });
  s.c.dispatch({ type: "press", id: "settings.restore" });
  assert.equal(s.saved.length, 0);
});

// --- Checkout ----------------------------------------------------------------------------------

const subtitle = (c: Client) => app(c).screen.subtitle;

test("checkout: the cart, the address and the delivery choice are saved; the card never is", () => {
  const { c, saved, doc } = open("checkout");
  c.dispatch({ type: "set", id: "checkout.qty:k2", value: 4 });
  c.dispatch({ type: "set", id: "checkout.qty:k2", value: 4 });
  c.dispatch({ type: "set", id: "checkout.qty:k3", value: 0 });
  c.dispatch({ type: "press", id: "checkout.next" });
  c.dispatch({ type: "set", id: "checkout.name", value: "Ada" });
  c.dispatch({ type: "set", id: "checkout.zip", value: "94a61b2x" });
  c.dispatch({ type: "set", id: "checkout.shipping", value: "express" });
  c.dispatch({ type: "set", id: "checkout.shipping", value: "teleport" });
  c.dispatch({ type: "press", id: "checkout.next" });
  c.dispatch({ type: "set", id: "checkout.card", value: "4242424242424242" });
  c.dispatch({ type: "set", id: "checkout.expiry", value: "12/30" });
  c.dispatch({ type: "set", id: "checkout.cvc", value: "123" });
  assert.deepEqual(saved.map((m) => [m.name, m.args]), [
    ["demo.cart", { id: "k2", quantity: 4 }],
    ["demo.cart", { id: "k3", quantity: 0 }],
    ["demo.shipTo", { field: "name", value: "Ada" }],
    ["demo.shipTo", { field: "zip", value: "94612" }],
    ["demo.shipTo", { field: "shipping", value: "express" }],
  ]);
  const everything = JSON.stringify(doc());
  assert.ok(!everything.includes("4242") && !everything.includes("12/30") && !everything.includes("cvc"));
  assert.deepEqual(Object.keys(doc()!.demo_checkout.ship!).sort(), ["id", "name", "shipping", "zip"]);
  // A reload: the cart and the address are there; the card step is empty again.
  const again = open("checkout", doc());
  assert.equal(subtitle(again.c), "Step 1 of 4: Cart");
  const qty = (id: string) => (nodes(app(again.c).screen.body).find((n) => n.kind === "select" && n.id === `checkout.qty:${id}`) as Extract<Node, { kind: "select" }>).value;
  assert.deepEqual(["k1", "k2", "k3"].map(qty), ["1", "4", "0"]);
  again.c.dispatch({ type: "press", id: "checkout.next" });
  assert.equal(input(again.c, "checkout.name").value, "Ada");
  assert.equal(input(again.c, "checkout.zip").value, "94612");
  assert.equal(input(again.c, "checkout.shipping").value, "express");
  again.c.dispatch({ type: "press", id: "checkout.fill" });
  // Fill with test data saves only the address fields that change.
  assert.deepEqual(again.saved.map((m) => (m.args as { field: string }).field), ["name", "address", "city"]);
  again.c.dispatch({ type: "press", id: "checkout.next" });
  assert.equal(input(again.c, "checkout.card").value, "4242 4242 4242 4242");
});

test("checkout: Start a new order puts the cart and the form back as they were", () => {
  const { c, saved } = open("checkout");
  c.dispatch({ type: "set", id: "checkout.qty:k1", value: 3 });
  c.dispatch({ type: "press", id: "checkout.fill" });
  for (let i = 0; i < 3; i++) c.dispatch({ type: "press", id: "checkout.next" });
  c.dispatch({ type: "press", id: "checkout.place" });
  assert.equal(subtitle(c), "Order confirmed");
  c.dispatch({ type: "press", id: "checkout.restart" });
  c.dispatch({ type: "press", id: "dialog.confirm" });
  assert.equal(saved.at(-1)!.name, "demo.checkoutReset");
  assert.equal(subtitle(c), "Step 1 of 4: Cart");
  const qty = (id: string) => (nodes(app(c).screen.body).find((n) => n.kind === "select" && n.id === `checkout.qty:${id}`) as Extract<Node, { kind: "select" }>).value;
  assert.deepEqual(["k1", "k2", "k3"].map(qty), ["1", "2", "1"]);
  c.dispatch({ type: "press", id: "checkout.next" });
  assert.equal(input(c, "checkout.name").value, "");
  assert.equal(input(c, "checkout.shipping").value, "standard");
});

// --- Refusals, bad rows, stock mode ------------------------------------------------------------

test("every demo mutation refuses what it does not expect", () => {
  const bad: [string, unknown][] = [
    ["demo.message", { id: "m99", read: true }],
    ["demo.message", { id: "m1" }],
    ["demo.message", { id: "m1", read: "yes" }],
    ["demo.message", { id: "m1", read: true, extra: 1 }],
    ["demo.task", { id: "t1", column: "later" }],
    ["demo.task", { id: "zz", column: "done" }],
    ["demo.chatSend", { id: "a", replyId: "a", text: "x", reply: REPLIES[0], ordinal: 0, at: 1 }],
    ["demo.chatSend", { id: "a", replyId: "b", text: " ", reply: REPLIES[0], ordinal: 0, at: 1 }],
    ["demo.chatSend", { id: "a", replyId: "b", text: "x", reply: "anything else", ordinal: 0, at: 1 }],
    ["demo.chatSend", { id: "a", replyId: "b", text: "x", reply: REPLIES[0], ordinal: -1, at: 1 }],
    ["demo.cart", { id: "k1", quantity: 10 }],
    ["demo.cart", { id: "k1", quantity: 1.5 }],
    ["demo.cart", { id: "nope", quantity: 1 }],
    ["demo.shipTo", { field: "card", value: "4242" }],
    ["demo.shipTo", { field: "cvc", value: "123" }],
    ["demo.shipTo", { field: "zip", value: "9461x" }],
    ["demo.shipTo", { field: "shipping", value: "teleport" }],
    ["demo.checkoutReset", { all: true }],
    ["settings.set", { key: "profile.density", value: "huge" }],
    ["settings.set", { key: "profile.name", value: "  " }],
    ["settings.set", { key: "app.theme", value: "plaid" }],
    ["settings.set", { key: "profile.card", value: "4242" }],
  ];
  for (const [name, args] of bad) assert.equal(writesOf(name, args), null, `${name} ${JSON.stringify(args)}`);
  assert.ok(writesOf("demo.checkoutReset", {}));
});

test("rows another device saved are drawn; malformed or unknown ones are ignored", () => {
  const doc = readDoc({
    demo_message: { m2: { id: "m2", read: true }, m3: { id: "m3", read: "maybe" }, mx: { id: "mx", archived: true } },
    demo_task: { t1: { id: "t1", column: "doing" }, t4: { id: "t4", column: "sideways" } },
    demo_cart: { k1: { id: "k1", quantity: 99 }, k2: { id: "k2", quantity: 3 } },
    demo_checkout: { ship: { id: "ship", zip: "abc", shipping: "teleport", city: "Oakland" } },
    demo_chat: { x: { id: "x", author: "nobody", text: "hi", at: 5 }, y: { id: "y", author: "p2", text: "yo", at: 5 } },
    settings_value: { "profile.density": { id: "profile.density", value: "huge" }, "profile.bio": { id: "profile.bio", value: "Hi" } },
  });
  const inbox = open("inbox", doc);
  assert.equal(rows(inbox.c)!.find((r) => r.id === "m2")!.emphasized, false);
  assert.equal(rows(inbox.c)!.find((r) => r.id === "m3")!.emphasized, false);
  assert.equal(rows(inbox.c)!.length, 7);
  const tasks = open("tasks", doc);
  assert.ok(column(tasks.c, "doing").includes("t1"));
  assert.ok(column(tasks.c, "todo").includes("t4"), "a column the board does not have keeps the sample's");
  const chat = open("chat", doc);
  assert.deepEqual(chatLines(chat.c).slice(-1).map((m) => m.text), ["yo"]);
  const checkout = open("checkout", doc);
  const qty = (id: string) => (nodes(app(checkout.c).screen.body).find((n) => n.kind === "select" && n.id === `checkout.qty:${id}`) as Extract<Node, { kind: "select" }>).value;
  assert.deepEqual(["k1", "k2"].map(qty), ["1", "3"]);
  const settings = open("settings", doc);
  assert.equal(input(settings.c, "settings.density").value, "comfortable");
  assert.equal(input(settings.c, "settings.bio").value, "Hi");
});

test("with stock behaviour only (extras off) the demo screens still change in memory, and nothing is saved", () => {
  const { c, saved } = open("inbox", undefined, false);
  c.dispatch({ type: "press", id: "inbox.archive:m1" });
  assert.equal(rows(c)!.length, 6);
  c.dispatch({ type: "set", id: "settings.theme", value: "ocean" });
  assert.equal(app(c).theme.id, "ocean");
  assert.equal(saved.length, 0);
});
