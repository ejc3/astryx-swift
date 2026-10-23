/**
 * Saved data for the demo screens (Inbox, Tasks, Messages, Checkout; the Profile and Settings
 * screens save through `settings.set`, areas/settings.ts). Tables are prefixed `demo_` so they
 * never meet a template's own. A row is the fields a person changed, laid over the sample row
 * with the same id (docs/SYNC.md); the sample rows themselves are never written.
 *
 *   demo_message   a sample message's read, starred and archived flags, by message id
 *   demo_task      a sample task's column, by task id
 *   demo_chat      lines the person sent and the canned replies to them: author, text, absolute time
 *   demo_cart      a product's quantity in the cart, by product id
 *   demo_checkout  the one row "ship": the shipping address and the delivery choice
 *
 * Never saved: the card number, its expiry and its security code (they stay in the screen).
 */
import { define, fields, isId, isInstant, isText, oneOf, put } from "../check.ts";
import type { Field } from "../doc.ts";
import { CART_QUANTITIES, MESSAGES, PRODUCTS, REPLIES, SHIPPING, TASKS } from "../../sample.ts";

export const tables = {
  demo_message: { read: "boolean", starred: "boolean", archived: "boolean" },
  demo_task: { column: "string" },
  demo_chat: { author: "string", text: "string", at: "number", reply: "number" },
  demo_cart: { quantity: "number" },
  demo_checkout: { name: "string", address: "string", city: "string", zip: "string", shipping: "string" },
} as const;

export const TASK_COLUMNS = ["todo", "doing", "done"] as const;
/** The demo checkout's address row. */
export const SHIP_ROW = "ship";
export const SHIP_FIELDS = ["name", "address", "city", "zip", "shipping"] as const;
export const MAX_QUANTITY = 9;
export const MAX_LINE = 1000;

const isFlag = (v: unknown): v is boolean | undefined => v === undefined || typeof v === "boolean";
const knownId = (ids: readonly string[]) => oneOf(ids);

const message = define<{ id: string; read?: boolean; starred?: boolean; archived?: boolean }>({
  check: (a) => {
    const o = fields<{ id: string; read?: boolean; starred?: boolean; archived?: boolean }>(a, { id: knownId(MESSAGES.map((m) => m.id)), read: isFlag, starred: isFlag, archived: isFlag });
    return o && (o.read !== undefined || o.starred !== undefined || o.archived !== undefined) ? o : null;
  },
  writes: (a) => {
    const flags: Record<string, Field> = {};
    for (const k of ["read", "starred", "archived"] as const) if (a[k] !== undefined) flags[k] = a[k]!;
    return [put("demo_message", a.id, flags)];
  },
});

const task = define<{ id: string; column: string }>({
  check: (a) => fields(a, { id: knownId(TASKS.map((t) => t.id)), column: oneOf(TASK_COLUMNS) }),
  writes: (a) => [put("demo_task", a.id, { column: a.column })],
});

/** One send is two lines: the person's, and the canned reply `REPLIES[ordinal % n]` a moment after it. */
const chatSend = define<{ id: string; replyId: string; text: string; reply: string; ordinal: number; at: number }>({
  check: (a) => {
    const o = fields<{ id: string; replyId: string; text: string; reply: string; ordinal: number; at: number }>(a, {
      id: isId, replyId: isId, text: (v) => isText(2000)(v) && (v as string).trim() !== "", reply: oneOf(REPLIES), ordinal: (v) => Number.isSafeInteger(v) && (v as number) >= 0, at: isInstant,
    });
    return o && o.id !== o.replyId ? o : null;
  },
  // The reply is stamped one millisecond later, so the two lines keep their order wherever they are sorted.
  writes: (a) => [
    put("demo_chat", a.id, { author: "p1", text: a.text.trim(), at: a.at }),
    put("demo_chat", a.replyId, { author: "p2", text: a.reply, at: a.at + 1, reply: a.ordinal }),
  ],
});

const cart = define<{ id: string; quantity: number }>({
  check: (a) => fields(a, { id: knownId(PRODUCTS.map((p) => p.id)), quantity: (v) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= MAX_QUANTITY }),
  writes: (a) => [put("demo_cart", a.id, { quantity: a.quantity })],
});

/** One field of the shipping address, or the delivery choice. */
const shipTo = define<{ field: string; value: string }>({
  check: (a) => {
    const o = fields<{ field: string; value: string }>(a, { field: oneOf(SHIP_FIELDS), value: isText(MAX_LINE) });
    if (!o) return null;
    if (o.field === "shipping") return SHIPPING.some((x) => x.value === o.value) ? o : null;
    if (o.field === "zip") return /^\d{0,5}$/.test(o.value) ? o : null;
    return o.value.length <= 120 ? o : null;
  },
  writes: (a) => [put("demo_checkout", SHIP_ROW, { [a.field]: a.value })],
});

/** "Start a new order": the cart back to its first three items, the form cleared. */
const checkoutReset = define<Record<string, never>>({
  check: (a) => fields(a, {}),
  writes: () => [
    ...Object.entries(CART_QUANTITIES).map(([id, quantity]) => put("demo_cart", id, { quantity })),
    put("demo_checkout", SHIP_ROW, { name: "", address: "", city: "", zip: "", shipping: SHIPPING[0]!.value }),
  ],
});

export const mutations = {
  "demo.message": message,
  "demo.task": task,
  "demo.chatSend": chatSend,
  "demo.cart": cart,
  "demo.shipTo": shipTo,
  "demo.checkoutReset": checkoutReset,
};
