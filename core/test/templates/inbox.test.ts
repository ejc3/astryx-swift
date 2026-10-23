import { test } from "node:test";
import assert from "node:assert/strict";
import { inbox, searchRecipients, RECIPIENT_LIMIT, type InboxState } from "../../src/templates/inbox/model.ts";
import type { TemplateAction } from "../../src/templates/types.ts";

const NOW = { epochMs: Date.UTC(2026, 9, 13, 16, 30), utcOffsetMinutes: -420 };
const start = () => inbox.initial(NOW);
const view = (s: InboxState) => inbox.view(s, NOW);
const run = (s: InboxState, ...actions: TemplateAction[]) => actions.reduce((acc, a) => inbox.reduce(acc, a, NOW), s);
const press = (id: string): TemplateAction => ({ type: "press", id });
const set = (id: string, value: string | number | boolean): TemplateAction => ({ type: "set", id, value });
/** A roomy desktop: the list is narrow beside the pane. */
const desktop = (s: InboxState) => run(s, set("surface", 1440), set("list", 480));

test("opens on the whole queue with the top thread open and its newest message expanded", () => {
  const v = view(start());
  assert.equal(v.subtitle.join(""), "3 unread of 9 conversations");
  assert.equal(v.tab, "inbox");
  assert.equal(v.rows.length, 9);
  assert.equal(v.openId, "c-01");
  assert.deepEqual(v.pane?.openMessages, ["c-01"]);
  assert.deepEqual(v.pane?.messages.map((m) => m.id), ["c-01-r1", "c-01-r2", "c-01"]);
});

test("tab badges count unread per tab and leave zeros out", () => {
  assert.deepEqual(view(start()).tabs.map((t) => [t.value, t.badge]), [["inbox", 3], ["escalations", 1], ["waiting", null], ["resolved", 1]]);
});

test("a tab shows its own threads, and an unknown tab changes nothing", () => {
  const s = run(start(), set("tab", "waiting"));
  assert.deepEqual(view(s).rows.map((r) => r.id), ["c-05", "c-06"]);
  assert.equal(view(s).openId, "c-05");
  assert.equal(run(s, set("tab", "nope")), s);
});

test("opening a row opens its thread and resets the expanded messages", () => {
  const s = run(start(), press("open:c-03"));
  assert.equal(view(s).openId, "c-03");
  assert.deepEqual(view(s).pane?.openMessages, ["c-03"]);
});

test("closing the thread keeps it closed, even after changing tab", () => {
  const s = run(start(), press("close"), set("tab", "escalations"));
  assert.equal(view(s).openId, null);
  assert.equal(view(s).pane, null);
});

test("a chosen thread that is not in the tab falls back to the top of that tab", () => {
  const s = run(start(), press("open:c-03"), set("tab", "waiting"));
  assert.equal(view(s).openId, "c-05");
});

test("on a phone nothing opens by default, and an opened thread takes the whole surface", () => {
  const s = run(start(), set("surface", 390));
  assert.equal(view(s).openId, null);
  const open = run(s, press("open:c-02"));
  assert.equal(view(open).mode.isPaneFullWidth, true);
  assert.equal(view(open).openId, "c-02");
});

test("toggling messages sets the expanded set; changing thread resets it", () => {
  const s = run(start(), set("messages", "c-01-r1,c-01"));
  assert.deepEqual(view(s).pane?.openMessages, ["c-01-r1", "c-01"]);
  assert.deepEqual(view(run(s, set("messages", ""))).pane?.openMessages, []);
  assert.deepEqual(view(run(s, press("open:c-02"))).pane?.openMessages, ["c-02"]);
  assert.deepEqual(view(run(s, press("open:c-02"), press("open:c-01"))).pane?.openMessages, ["c-01"]);
});

test("the list stacks below 560px and drops the tags column below 900px", () => {
  const wide = run(desktop(start()), set("list", 1000));
  assert.deepEqual([view(wide).mode.isStacked, view(wide).mode.isTight], [false, false]);
  const mid = run(wide, set("list", 700));
  assert.deepEqual([view(mid).mode.isStacked, view(mid).mode.isTight], [false, true]);
  const narrow = run(wide, set("list", 330));
  assert.deepEqual([view(narrow).mode.isStacked, view(narrow).mode.isTight], [true, true]);
  assert.equal(view(narrow).rows[0]?.actions.length, 2);
  assert.equal(view(wide).rows[0]?.actions.length, 4);
});

test("the trailing column is as wide as the overlaid or the side-by-side contents need", () => {
  const s = run(desktop(start()), set("list", 1000));
  assert.equal(view(s).receivedWidth, Math.max(4 * 28 + 3 * 2, 96) + 24);
  assert.equal(view(run(s, set("touch", true))).receivedWidth, 4 * 28 + 3 * 2 + 4 + 96 + 24);
});

test("row actions are named against the subject", () => {
  const row = view(start()).rows[0]!;
  assert.equal(row.actions[0]?.ariaLabel, "Archive — Checkout returns 502 for EU customers");
  assert.equal(row.priority?.label, "Urgent");
  assert.equal(row.priority?.color, "red");
  assert.equal(row.status, "Unread");
});

test("ticking rows is counted against the visible tab; stacked rows hide the bar", () => {
  const wide = run(desktop(start()), set("list", 1000), set("selection", "c-01,c-05"));
  assert.equal(view(wide).hasSelection, true);
  assert.equal(view(wide).selectionLabel.join(""), "2 conversations selected");
  const waiting = run(wide, set("tab", "waiting"));
  assert.equal(view(waiting).selectionLabel.join(""), "1 conversation selected");
  assert.deepEqual(view(waiting).selectedKeys, ["c-01", "c-05"]);
  const escalations = run(wide, set("tab", "resolved"));
  assert.equal(view(escalations).hasSelection, false);
  assert.equal(view(run(wide, set("list", 330))).hasSelection, false);
});

test("Unselect All clears every tick", () => {
  const s = run(desktop(start()), set("selection", "c-01,c-02"), press("unselectAll"));
  assert.deepEqual(view(s).selectedKeys, []);
  assert.equal(view(s).hasSelection, false);
});

test("an attachment opens in the viewer, pages, and closes", () => {
  const s = run(start(), press("open:c-05"), press("lightbox:c-05:0"), set("lightboxIndex", 2));
  const message = view(s).pane!.messages.find((m) => m.id === "c-05")!;
  assert.equal(message.lightboxIndex, 2);
  assert.equal(message.attachmentsLabel.join(""), "3 attachments");
  assert.equal(view(run(s, press("lightboxClose"))).pane!.messages.every((m) => m.lightboxIndex === null), true);
});

test("a single attachment is singular", () => {
  assert.equal(view(start()).pane!.messages.at(-1)?.attachmentsLabel.join(""), "1 attachment");
  assert.equal(view(start()).pane!.messages[0]?.attachmentsLabel.length, 0);
});

test("Reply addresses the newest sender and prefixes the subject once", () => {
  const s = run(start(), press("reply"));
  const c = view(s).compose;
  assert.equal(c.isOpen, true);
  assert.deepEqual(c.recipients, [{ id: "priya.raman@northwind.example", label: "Priya Raman" }]);
  assert.equal(c.subject, "Re: Checkout returns 502 for EU customers");
  const re = view(run(start(), press("open:c-03"), press("reply"))).compose;
  assert.equal(re.subject, "Re: Bulk export finished but the file is empty");
});

test("Reply all adds the others on the thread, once each, minus the team's own addresses", () => {
  const c = view(run(start(), press("open:c-05"), press("replyAll"))).compose;
  assert.deepEqual(c.recipients.map((r) => r.label), ["Hannah Lindqvist", "Ines Duarte"]);
});

test("closing the sheet keeps the draft; Discard empties it and closes", () => {
  let s = run(start(), press("open:c-05"), press("replyAll"), press("showCc"), set("cc", JSON.stringify([{ id: "a@example.com", label: "a@example.com" }])), set("body", "Hello"));
  s = run(s, set("composeOpen", false));
  assert.equal(view(s).compose.isOpen, false);
  assert.equal(view(s).compose.body, "Hello");
  assert.equal(view(run(s, press("compose"))).compose.isOpen, true);
  const discarded = view(run(s, press("discard"))).compose;
  assert.deepEqual([discarded.isOpen, discarded.body, discarded.subject, discarded.recipients, discarded.cc, discarded.hasCc], [false, "", "", [], [], false]);
});

test("replying on the same thread keeps the body and Cc; another thread starts clean", () => {
  let s = run(start(), press("reply"), press("showCc"), press("showBcc"), set("body", "Draft"));
  const same = view(run(s, set("composeOpen", false), press("reply"))).compose;
  assert.deepEqual([same.body, same.hasCc, same.hasBcc], ["Draft", true, true]);
  s = run(s, set("composeOpen", false), press("open:c-02"), press("reply"));
  const other = view(s).compose;
  assert.deepEqual([other.body, other.hasCc, other.hasBcc, other.subject], ["", false, false, "Re: SSO metadata rotation — need new certificate"]);
});

test("Compose opens the sheet as it was left; subject and recipients are editable", () => {
  const s = run(start(), press("compose"), set("subject", "Hi"), set("recipients", JSON.stringify([{ id: "x@example.com", label: "x@example.com" }])));
  assert.deepEqual([view(s).compose.isOpen, view(s).compose.subject, view(s).compose.recipients.length], [true, "Hi", 1]);
});

test("the directory offers everybody the inbox has heard from", () => {
  const d = view(start()).compose.directory;
  assert.equal(d.length, 9);
  assert.deepEqual(d[0], { id: "priya.raman@northwind.example", label: "Priya Raman" });
});

test("malformed input and unknown ids change nothing", () => {
  const s = start();
  assert.equal(run(s, set("recipients", "not json")), s);
  assert.equal(run(s, set("recipients", JSON.stringify([{ id: 1 }]))), s);
  assert.equal(run(s, set("lightboxIndex", 1)), s);
  assert.equal(run(s, press("nope")), s);
  assert.equal(run(s, set("nope", 1)), s);
  assert.equal(run(s, set("surface", "wide")), s);
  assert.equal(run(s, set("touch", false)), s);
});

test("the view is plain JSON", () => {
  const s = run(desktop(start()), press("open:c-05"), press("reply"));
  assert.deepEqual(JSON.parse(JSON.stringify(view(s))), view(s));
});

test("the view echoes the measured widths, so a host can tell when another host reported last", () => {
  assert.deepEqual(view(start()).mode.measured, { surface: 0, list: 0 });
  assert.deepEqual(view(desktop(start())).mode.measured, { surface: 1440, list: 480 });
  const narrow = view(run(start(), set("surface", 1100), set("list", 391)));
  assert.deepEqual([narrow.mode.isStacked, narrow.mode.isTight, narrow.mode.measured.list], [true, true, 391]);
});

test("a reply starts clean; typed content makes the draft dirty", () => {
  const reply = run(start(), press("reply"));
  assert.equal(view(reply).compose.isDirty, false);
  assert.equal(view(run(reply, set("body", "Thanks"))).compose.isDirty, true);
  assert.equal(view(run(reply, set("body", "   "))).compose.isDirty, false);
  const fresh = run(start(), press("compose"));
  assert.equal(view(fresh).compose.isDirty, false);
  assert.equal(view(run(fresh, set("subject", "Hi"))).compose.isDirty, true);
});

test("the controls with no action behind them are listed as inert (stock: without saving on)", () => {
  const v = inbox.view(start(), NOW, undefined, false);
  for (const id of ["refresh", "archive", "move", "delete", "send", "attach", "link", "image", "emoji"]) assert.ok(v.inert.includes(id), id);
  assert.ok(!v.inert.includes("reply"));
  assert.ok(!v.inert.includes("compose"));
});

// ----- Layout per drawing, content shared -----

test("the breakpoints are in the view, for a drawing that measures its own width", () => {
  const { rules } = view(start()).mode;
  assert.deepEqual([rules.singleSurfaceBelow, rules.stackRowsBelow, rules.tightenColumnsBelow], [900, 560, 900]);
  assert.deepEqual(rules.receivedWidth.wide, { pointer: Math.max(4 * 28 + 3 * 2, 96) + 24, touch: 4 * 28 + 3 * 2 + 4 + 96 + 24 });
  assert.deepEqual(rules.receivedWidth.stacked, { pointer: Math.max(2 * 28 + 2, 96) + 24, touch: 2 * 28 + 2 + 4 + 96 + 24 });
});

test("the received width the measurements give is one of the rules' widths", () => {
  const s = run(desktop(start()), set("list", 1000));
  const { receivedWidth } = view(s).mode.rules;
  assert.equal(view(s).receivedWidth, receivedWidth.wide.pointer);
  assert.equal(view(run(s, set("touch", true))).receivedWidth, receivedWidth.wide.touch);
  const stacked = run(s, set("list", 330));
  assert.equal(view(stacked).receivedWidth, receivedWidth.stacked.pointer);
  assert.equal(view(run(stacked, set("touch", true))).receivedWidth, receivedWidth.stacked.touch);
});

test("every row carries its actions for a wide and for a stacked list, whatever was measured", () => {
  for (const s of [start(), run(desktop(start()), set("list", 330)), run(start(), set("surface", 390), set("list", 388))]) {
    const row = view(s).rows[0]!;
    assert.deepEqual(row.actionsWide.map((a) => a.id), ["archive", "move", "delete", "reply"]);
    assert.deepEqual(row.actionsStacked.map((a) => a.id), ["archive", "delete"]);
    assert.equal(row.actionsWide[0]?.ariaLabel, "Archive — Checkout returns 502 for EU customers");
    assert.equal(row.actionsStacked[1]?.ariaLabel, "Delete — Checkout returns 502 for EU customers");
  }
});

test("the person's choice is reported apart from any width: never chosen, opened, closed", () => {
  const fresh = view(start()).choice;
  assert.deepEqual(fresh, { openIdExplicit: null, isClosed: false, firstVisibleId: "c-01" });
  const opened = view(run(start(), press("open:c-03"))).choice;
  assert.deepEqual(opened, { openIdExplicit: "c-03", isClosed: false, firstVisibleId: "c-01" });
  const closed = view(run(start(), press("close"))).choice;
  assert.deepEqual(closed, { openIdExplicit: null, isClosed: true, firstVisibleId: "c-01" });
  // Opening after closing opens again.
  assert.deepEqual(view(run(start(), press("close"), press("open:c-02"))).choice, { openIdExplicit: "c-02", isClosed: false, firstVisibleId: "c-01" });
});

test("the choice follows the tab: an opened thread on another tab is not explicit there, the first visible one is that tab's", () => {
  const s = run(start(), press("open:c-03"), set("tab", "waiting"));
  assert.deepEqual(view(s).choice, { openIdExplicit: null, isClosed: false, firstVisibleId: "c-05" });
  assert.equal(view(run(s, set("tab", "inbox"))).choice.openIdExplicit, "c-03");
});

test("the choice does not depend on what the web page measured", () => {
  const base = run(start(), press("open:c-02"));
  const phone = run(base, set("surface", 390), set("list", 388));
  const desk = run(base, set("surface", 1440), set("list", 480), set("touch", true));
  assert.deepEqual(view(phone).choice, view(desk).choice);
  assert.deepEqual(view(run(start(), set("surface", 390))).choice, view(run(start(), set("surface", 1440))).choice);
});

test("every visible row has its thread in panes, whichever one the web page has open", () => {
  const phone = view(run(start(), set("surface", 390)));
  assert.equal(phone.pane, null);
  assert.deepEqual(phone.panes.map((p) => p.id), phone.rows.map((r) => r.id));
  const first = phone.panes[0]!;
  assert.deepEqual(first.messages.map((m) => m.id), ["c-01-r1", "c-01-r2", "c-01"]);
  assert.deepEqual(first.openMessages, ["c-01"]);
  assert.deepEqual(view(run(start(), set("tab", "waiting"))).panes.map((p) => p.id), ["c-05", "c-06"]);
});

test("the pane the web page has open is also the matching entry of panes, with its expanded set", () => {
  const s = run(start(), press("open:c-01"), set("messages", "c-01-r1,c-01"));
  const v = view(s);
  assert.deepEqual(v.panes.find((p) => p.id === "c-01"), v.pane);
  assert.deepEqual(v.panes.find((p) => p.id === "c-01")?.openMessages, ["c-01-r1", "c-01"]);
  assert.deepEqual(v.panes.find((p) => p.id === "c-02")?.openMessages, ["c-02"]);
});

test("a viewer's open attachment shows in the thread's pane even when the web page has another thread open", () => {
  const s = run(start(), press("open:c-05"), press("lightbox:c-05:1"));
  const v = view(run(s, set("surface", 390), press("close")));
  assert.equal(v.pane, null);
  assert.equal(v.panes.find((p) => p.id === "c-05")?.messages.find((m) => m.id === "c-05")?.lightboxIndex, 1);
});

test("whether any visible row is ticked is reported apart from the stacking", () => {
  const ticked = run(desktop(start()), set("list", 330), set("selection", "c-01"));
  assert.equal(view(ticked).hasSelection, false);
  assert.equal(view(ticked).hasSelectedRows, true);
  assert.equal(view(run(ticked, set("tab", "resolved"))).hasSelectedRows, false);
  assert.equal(view(run(start(), set("selection", "c-01"))).hasSelectedRows, true);
});

test("the content fields of the view are the same whatever the web page measured", () => {
  const shared = (s: InboxState) => {
    const v = view(s);
    return { choice: v.choice, hasSelectedRows: v.hasSelectedRows, rules: v.mode.rules, rows: v.rows.map((r) => [r.id, r.actionsWide, r.actionsStacked]), selectedKeys: v.selectedKeys, compose: v.compose };
  };
  const base = run(start(), press("open:c-02"), set("selection", "c-01,c-02"), press("reply"));
  assert.deepEqual(shared(run(base, set("surface", 390), set("list", 388))), shared(run(base, set("surface", 1440), set("list", 480), set("touch", true))));
});

test("searchRecipients: label contains the text, ignoring case; chosen people are left out; capped", () => {
  const dir = view(start()).compose.directory;
  const priya = dir[0]!;
  assert.deepEqual(searchRecipients(dir, [], "PRIYA"), [priya]);
  assert.deepEqual(searchRecipients(dir, [priya], "priya"), []);
  // Chosen by id: a different label for the same id is still chosen.
  assert.deepEqual(searchRecipients(dir, [{ id: priya.id, label: "x" }], "priya"), []);
  assert.equal(searchRecipients(dir, [], "").length, dir.length);
  assert.equal(searchRecipients(dir, [priya], "").length, dir.length - 1);
  // Not trimmed, as in the stock source.
  assert.deepEqual(searchRecipients(dir, [], "priya "), [priya]);
  assert.deepEqual(searchRecipients(dir, [], " priya"), []);
  const many = Array.from({ length: RECIPIENT_LIMIT + 3 }, (_, n) => ({ id: `p${n}@example.com`, label: `Person ${n}` }));
  assert.equal(searchRecipients(many, [], "person").length, RECIPIENT_LIMIT);
});

test("each recipients field keeps its own text, and the view's suggestions are searchRecipients of it", () => {
  const people = JSON.stringify([{ id: "priya.raman@northwind.example", label: "Priya Raman" }]);
  let s = run(start(), press("compose"), set("recipients", people), set("recipientsQuery", "priya"), set("ccQuery", "a"));
  const c = view(s).compose;
  assert.deepEqual(c.queries, { recipients: "priya", cc: "a", bcc: "" });
  assert.deepEqual(c.suggestions.recipients, []);
  assert.deepEqual(c.suggestions.cc, searchRecipients(c.directory, c.cc, "a"));
  // Nothing typed finds everybody not chosen in that field; the drawing decides to draw none.
  assert.equal(c.suggestions.bcc.length, c.directory.length);
  assert.equal(c.suggestions.recipients.length, 0);
  s = run(s, set("recipientsQuery", ""));
  assert.equal(view(s).compose.suggestions.recipients.length, c.directory.length - 1);
  // Discarding the draft empties the text too.
  s = run(s, press("discard"));
  assert.deepEqual(view(s).compose.queries, { recipients: "", cc: "", bcc: "" });
});

test("the view carries the layout numbers and the marks the page writes", () => {
  const v = view(start());
  const { listMin, paneMin, paneDefaultShare, messageMeasure, statusGutterWidth } = v.mode.rules;
  assert.deepEqual([listMin, paneMin, messageMeasure, statusGutterWidth], [300, 440, 680, 36]);
  assert.equal(paneDefaultShare, 2 / 3);
  assert.equal(v.text.previewSeparator, "—");
  assert.equal(v.text.overflowMark, "+");
});
