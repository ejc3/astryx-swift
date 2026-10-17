import assert from "node:assert/strict";
import { test } from "node:test";
import { createClient, ICONS, SCREENS, type Action, type AppSnapshot, type Node, type Now, type ScreenId } from "../src/index.ts";
import { checks } from "../src/state.ts";

// Tuesday 2026-10-13, 9:30 AM in UTC-7.
const NOW: Now = { epochMs: Date.UTC(2026, 9, 13, 16, 30), utcOffsetMinutes: -420 };
const clock = () => NOW;

function app(c: ReturnType<typeof createClient>): AppSnapshot {
  return c.getSnapshot("app") as AppSnapshot;
}

function go(c: ReturnType<typeof createClient>, screen: ScreenId): AppSnapshot {
  c.dispatch({ type: "navigate", screen });
  return app(c);
}

/** Every node in a tree, depth first. */
function nodes(n: Node): Node[] {
  const out: Node[] = [n];
  const kids = (x: Node): Node[] => {
    switch (x.kind) {
      case "stack": case "grid": case "card": case "section": return x.children;
      case "split": return [x.primary, x.detail];
      case "banner": return x.action ? [x.action] : [];
      case "empty": return x.action ? [x.action] : [];
      default: return [];
    }
  };
  for (const k of kids(n)) out.push(...nodes(k));
  return out;
}

/** Every visible string a node carries. */
function words(n: Node): string[] {
  return Object.entries(n).flatMap(([k, v]) => (typeof v === "string" && !/(^id$|Id$|^kind$|^style$|^tone$|^variant$|^icon$|^axis$|^gap$|^align$|^value$|^size$)/.test(k) ? [v] : []));
}

test("every screen builds, and the same time gives the same snapshot", () => {
  for (const s of SCREENS) {
    const a = go(createClient(clock), s);
    const b = go(createClient(clock), s);
    assert.equal(a.screen.id, s);
    assert.ok(a.screen.title.length > 0);
    assert.deepEqual(a, b);
  }
});

test("every icon a screen names is one the hosts know", () => {
  const c = createClient(clock);
  for (const s of SCREENS) {
    const snap = go(c, s);
    for (const n of nodes(snap.screen.body)) {
      if ("icon" in n && n.icon !== undefined) assert.ok((ICONS as readonly string[]).includes(n.icon), `${s}: ${n.icon}`);
    }
    for (const item of snap.nav) assert.ok((ICONS as readonly string[]).includes(item.icon));
  }
});

test("no node shows an undefined, NaN or empty label", () => {
  const c = createClient(clock);
  for (const s of SCREENS) {
    for (const n of nodes(go(c, s).screen.body)) {
      for (const w of words(n)) assert.doesNotMatch(w, /undefined|NaN|\[object/, `${s} ${n.kind}: ${w}`);
      if (n.kind === "button") assert.ok(n.label.trim().length > 0, `${s}: a button with no label`);
    }
  }
});

test("pressing every button on every screen never throws", () => {
  for (const s of SCREENS) {
    const ids = nodes(go(createClient(clock), s).screen.body).flatMap((n) => ("id" in n && typeof n.id === "string" && (n.kind === "button" || n.kind === "iconButton") ? [n.id] : []));
    for (const id of ids) {
      const c = createClient(clock);
      go(c, s);
      assert.doesNotThrow(() => c.dispatch({ type: "press", id }), `${s}: ${id}`);
      assert.ok(app(c).screen.title.length > 0);
    }
  }
});

test("inbox: search filters, tabs count, archive offers undo and undo restores", () => {
  const c = createClient(clock);
  let snap = go(c, "inbox");
  const list = () => nodes(app(c).screen.body).find((n) => n.kind === "list") as Extract<Node, { kind: "list" }>;
  assert.equal(list().items.length, 7);
  c.dispatch({ type: "set", id: "inbox.query", value: "icon" });
  assert.deepEqual(list().items.map((i) => i.id), ["m2"]);
  c.dispatch({ type: "set", id: "inbox.query", value: "zzz" });
  assert.equal(list().items.length, 0);
  assert.equal(list().empty, 'Nothing matches "zzz".');
  c.dispatch({ type: "set", id: "inbox.query", value: "" });
  c.dispatch({ type: "press", id: "inbox.archive:m1" });
  snap = app(c);
  assert.equal(snap.toast?.text, "Conversation archived.");
  assert.equal(snap.toast?.action?.id, "toast.undo");
  assert.equal(list().items.length, 6);
  c.dispatch({ type: "press", id: "toast.undo" });
  assert.equal(list().items.length, 7);
  assert.equal(app(c).toast, null);
});

test("opening a message reads it, and the nav badge follows", () => {
  const c = createClient(clock);
  go(c, "inbox");
  const badge = () => app(c).nav.find((n) => n.id === "inbox")!.badge;
  assert.equal(badge(), "3");
  c.dispatch({ type: "press", id: "inbox.select:m2" });
  assert.equal(badge(), "2");
  c.dispatch({ type: "press", id: "inbox.readAll" });
  assert.equal(badge(), undefined);
});

test("people: sort toggles direction, the role filter resets the page, selection drives the banner", () => {
  const c = createClient(clock);
  go(c, "people");
  const table = () => nodes(app(c).screen.body).find((n) => n.kind === "table") as Extract<Node, { kind: "table" }>;
  const firstName = () => table().rows[0]!.cells[0]!.text;
  assert.equal(firstName(), "Amara Diallo");
  c.dispatch({ type: "press", id: "people.sort:name" });
  assert.equal(firstName(), "Theo Lindqvist");
  assert.equal(table().columns[0]!.sort, "desc");
  c.dispatch({ type: "press", id: "people.page:next" });
  c.dispatch({ type: "set", id: "people.role", value: "Writer" });
  assert.equal(table().rows.length, 2);
  c.dispatch({ type: "set", id: "people.check:p5", value: true });
  const banner = nodes(app(c).screen.body).find((n) => n.kind === "banner") as Extract<Node, { kind: "banner" }>;
  assert.equal(banner.title, "1 person selected");
  c.dispatch({ type: "press", id: "people.remind" });
  assert.equal(app(c).toast?.text, "Reminder sent to 1 person.");
});

test("checkout: a step with errors is refused and says why; test data passes every step", () => {
  const c = createClient(clock);
  go(c, "checkout");
  c.dispatch({ type: "press", id: "checkout.next" });
  assert.equal(app(c).screen.subtitle, "Step 2 of 4: Shipping");
  c.dispatch({ type: "press", id: "checkout.next" });
  const errors = nodes(app(c).screen.body).flatMap((n) => (n.kind === "textInput" && n.error ? [n.error] : []));
  assert.deepEqual(errors, ["Enter your name.", "Enter a street address.", "Enter a city.", "Enter a ZIP code."]);
  assert.equal(app(c).screen.subtitle, "Step 2 of 4: Shipping");
  c.dispatch({ type: "press", id: "checkout.fill" });
  c.dispatch({ type: "press", id: "checkout.next" });
  c.dispatch({ type: "press", id: "checkout.next" });
  assert.equal(app(c).screen.subtitle, "Step 4 of 4: Review");
  const pay = nodes(app(c).screen.body).find((n) => n.kind === "button" && n.id === "checkout.place") as Extract<Node, { kind: "button" }>;
  // 249 + 2 × 89 + 24 = 451.00; tax 9.25% = 41.72; free shipping.
  assert.equal(pay.label, "Pay $492.72");
  c.dispatch({ type: "press", id: "checkout.place" });
  assert.equal(app(c).screen.subtitle, "Order confirmed");
});

test("card checks: Luhn, expiry against today", () => {
  assert.equal(checks.card("4242 4242 4242 4242"), undefined);
  assert.match(checks.card("4242 4242 4242 4241")!, /doesn't check out/);
  const today = { year: 2026, month: 10, day: 13 };
  assert.equal(checks.expiry("10/26", today), undefined);
  assert.equal(checks.expiry("09/26", today), "This card has expired.");
  assert.equal(checks.expiry("13/30", today), "The month is 01 to 12.");
});

test("calendar: today is marked, months move, a day shows its events", () => {
  const c = createClient(clock);
  go(c, "calendar");
  const cal = () => nodes(app(c).screen.body).find((n) => n.kind === "calendar") as Extract<Node, { kind: "calendar" }>;
  assert.equal(cal().title, "October 2026");
  const today = cal().weeks.flat().filter((d) => d.today);
  assert.deepEqual(today.map((d) => d.label), ["13"]);
  assert.equal(today[0]!.dots.length, 2);
  c.dispatch({ type: "press", id: "calendar.month:previous" });
  c.dispatch({ type: "press", id: "calendar.month:previous" });
  c.dispatch({ type: "press", id: "calendar.month:previous" });
  assert.equal(cal().title, "July 2026");
  c.dispatch({ type: "press", id: "calendar.today" });
  assert.equal(cal().title, "October 2026");
});

test("chat: sending appends the message and a reply, and clears the draft", () => {
  const c = createClient(clock);
  go(c, "chat");
  const chat = () => app(c).screen.body as Extract<Node, { kind: "chat" }>;
  assert.equal(chat().composer.canSend, false);
  c.dispatch({ type: "set", id: "chat.draft", value: "  Ship it  " });
  assert.equal(chat().composer.canSend, true);
  c.dispatch({ type: "press", id: "chat.send" });
  const last = chat().messages.slice(-2);
  assert.deepEqual(last.map((m) => [m.author, m.text, m.mine]), [["You", "Ship it", true], ["Theo", "On it. Give me ten minutes.", false]]);
  assert.equal(chat().composer.value, "");
});

test("choosing a theme changes the theme store and tells its listeners", () => {
  const c = createClient(clock);
  const told: string[] = [];
  c.subscribe((s) => told.push(s));
  c.dispatch({ type: "set", id: "settings.theme", value: "ocean" });
  assert.deepEqual(told, ["app", "theme"]);
  const theme = c.getSnapshot("theme") as { id: string; light: { colors: Record<string, string> } };
  assert.equal(theme.id, "ocean");
  assert.equal(theme.light.colors["color-accent"], "#0F766EFF");
  c.dispatch({ type: "set", id: "settings.theme", value: "no-such-theme" });
  assert.equal((c.getSnapshot("theme") as { id: string }).id, "ocean");
});

test("an action that changes nothing tells nobody", () => {
  const c = createClient(clock);
  let told = 0;
  c.subscribe(() => told++);
  const nothing: Action[] = [{ type: "press", id: "no.such.thing" }, { type: "set", id: "no.such.field", value: 1 }];
  for (const a of nothing) c.dispatch(a);
  assert.equal(told, 0);
});
