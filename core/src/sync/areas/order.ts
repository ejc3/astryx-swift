/**
 * Saved data for the order detail template (core/src/templates/order): the notes, which items are
 * fulfilled, the likes on timeline items, and the replies under them (docs/SYNC.md).
 *
 * Refunds, restocking, labels and invoices have no backend here and stay inert.
 */
import { define, fields, isId, isInstant, isText, oneOf, put } from "../check.ts";

/** The order's items and timeline entries have fixed ids: the sample rows saved rows are laid over. */
export const ORDER_PRODUCT_IDS = ["solstice-mug", "ember-bowl", "terra-cup", "dawn-plate-set", "kiln-salad-bowl"] as const;
export const ORDER_ACTIVITY_IDS = ["a1", "a2", "a3", "a4"] as const;
export const MAX_ORDER_NOTES = 2000;
export const MAX_ORDER_REPLY = 500;

export const tables = {
  /** One row, "notes": the notes' text and when it was last saved. */
  order_note: { text: "string", editedAt: "number" },
  /** One row per item that was fulfilled, by item id: when. */
  order_item: { fulfilledAt: "number" },
  /** One row per timeline entry the person liked, by entry id. */
  order_like: { liked: "boolean" },
  /** One row per reply, by minted id: the entry it answers, its text, and when. */
  order_reply: { item: "string", text: "string", at: "number" },
} as const;

const isProduct = oneOf(ORDER_PRODUCT_IDS);
const isActivity = oneOf(ORDER_ACTIVITY_IDS);

const orderNote = define<{ text: string; at: number }>({
  check: (a) => fields(a, { text: isText(MAX_ORDER_NOTES), at: isInstant }),
  writes: (a) => [put("order_note", "notes", { text: a.text, editedAt: a.at })],
});

const orderFulfill = define<{ id: string; at: number }>({
  check: (a) => fields(a, { id: isProduct, at: isInstant }),
  writes: (a) => [put("order_item", a.id, { fulfilledAt: a.at })],
});

const orderLike = define<{ id: string; liked: boolean }>({
  check: (a) => fields(a, { id: isActivity, liked: (v) => typeof v === "boolean" }),
  writes: (a) => [put("order_like", a.id, { liked: a.liked })],
});

const orderReply = define<{ id: string; item: string; text: string; at: number }>({
  check: (a) => fields(a, { id: isId, item: isActivity, text: (v) => isText(MAX_ORDER_REPLY)(v) && (v as string).trim() !== "", at: isInstant }),
  writes: (a) => [put("order_reply", a.id, { item: a.item, text: a.text.trim(), at: a.at })],
});

export const mutations = {
  "order.note": orderNote,
  "order.fulfill": orderFulfill,
  "order.like": orderLike,
  "order.reply": orderReply,
};
