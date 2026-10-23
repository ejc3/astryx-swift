/**
 * Saved data for the checkout template: the cart, the shipping address and each placed order
 * (docs/SYNC.md). The cart's prices live here, in whole cents, because a placed order's totals are
 * worked out here from the cart's lines and checked again wherever the mutation runs: a record
 * cannot disagree with the prices. No float is ever saved.
 *
 * What is never saved: a card number, the name on the card, its expiry or its CVC. They stay in
 * the screen that asked for them (the template's view state).
 *
 * How the cart is saved: on each change. An edit is one small row (a quantity, a code, a choice,
 * one address field), so there is no "save" step and nothing is lost when the app closes midway.
 * A person's typed promo text is not the saved code: the saved code is the one that was applied.
 */
import { define, fields, isId, isInstant, isText, oneOf, put } from "../check.ts";
import type { Write } from "../doc.ts";

/** The cart's items: id, name and price in cents. The template adds the pictures and the words. */
export const CHECKOUT_ITEMS = [
  { id: "mug", name: "Speckled Stoneware Mug", cents: 7800 },
  { id: "plate", name: "Stoneware Dinner Plate", cents: 7200 },
  { id: "bowl", name: "Cereal Bowl", cents: 8000 },
] as const;
export const CHECKOUT_ITEM_IDS = CHECKOUT_ITEMS.map((i) => i.id);

/** Promo codes, with the share they take off in basis points (1000 = 10%). */
export const CHECKOUT_PROMOS = [
  { code: "WELCOME10", bp: 1000 },
  { code: "CLAY20", bp: 2000 },
] as const;
export const CHECKOUT_DELIVERY = [
  { value: "standard", cents: 495 },
  { value: "expedited", cents: 995 },
  { value: "overnight", cents: 2495 },
] as const;
/** Tax in basis points, and the amount (after the discount) from which standard delivery is free. */
export const CHECKOUT_TAX_BP = 800;
export const CHECKOUT_FREE_SHIPPING_CENTS = 30000;

export const CHECKOUT_COUNTRIES = ["us", "ca", "uk"] as const;
/** The address fields, and the longest each may be. */
export const CHECKOUT_ADDRESS_FIELDS = { email: 254, firstName: 100, lastName: 100, address: 200, apartment: 100, city: 100, state: 100, postalCode: 20, country: 2 } as const;
export const MAX_QTY = 99;
export const MAX_NOTE = 240;

export const tables = {
  /** One row per item, by item id: how many are in the cart (0 once removed). */
  checkout_line: { qty: "number" },
  /** One row, "cart": the applied promo code ("" for none), the delivery choice, the gift flag and message. */
  checkout_cart: { promo: "string", delivery: "string", gift: "boolean", note: "string" },
  /** One row, "shipping": the address fields. */
  checkout_address: { email: "string", firstName: "string", lastName: "string", address: "string", apartment: "string", city: "string", state: "string", postalCode: "string", country: "string" },
  /** One row per placed order: when, and its totals in integer cents. */
  checkout_order: { at: "number", itemCount: "number", subtotalCents: "number", discountCents: "number", shippingCents: "number", taxCents: "number", totalCents: "number", promo: "string", delivery: "string", gift: "boolean" },
  /** The order's items, one row each: id `<order id>.<item id>`. */
  checkout_order_line: { orderId: "string", item: "string", name: "string", qty: "number", unitCents: "number" },
} as const;

// --- Prices, in whole cents --------------------------------------------------------------------

export type Totals = { itemCount: number; subtotalCents: number; discountCents: number; shippingCents: number; taxCents: number; totalCents: number };

/** `amount * bp / 10000`, rounded half up, in integers. */
const share = (amount: number, bp: number): number => Math.floor((amount * bp + 5000) / 10000);

/** The totals of a cart, as the stock template's page works them out in dollars, but in integer cents. */
export function totalsOf(lines: readonly { item: string; qty: number }[], promo: string, delivery: string): Totals {
  let subtotalCents = 0;
  let itemCount = 0;
  for (const l of lines) {
    subtotalCents += (CHECKOUT_ITEMS.find((i) => i.id === l.item)?.cents ?? 0) * l.qty;
    itemCount += l.qty;
  }
  const discountCents = share(subtotalCents, CHECKOUT_PROMOS.find((p) => p.code === promo)?.bp ?? 0);
  const net = subtotalCents - discountCents;
  const method = CHECKOUT_DELIVERY.find((d) => d.value === delivery) ?? CHECKOUT_DELIVERY[0];
  const shippingCents = net >= CHECKOUT_FREE_SHIPPING_CENTS && delivery === "standard" ? 0 : method.cents;
  const taxCents = share(net, CHECKOUT_TAX_BP);
  return { itemCount, subtotalCents, discountCents, shippingCents, taxCents, totalCents: net + shippingCents + taxCents };
}

// --- Mutations -----------------------------------------------------------------------------------

const isItem = oneOf(CHECKOUT_ITEM_IDS);
const isQty = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= MAX_QTY;
const isPromo = (v: unknown): v is string => v === "" || (typeof v === "string" && CHECKOUT_PROMOS.some((p) => p.code === v));
const isDelivery = oneOf(CHECKOUT_DELIVERY.map((d) => d.value));
const isFlag = (v: unknown): v is boolean => typeof v === "boolean";

const checkoutQty = define<{ item: string; qty: number }>({
  check: (a) => fields(a, { item: isItem, qty: isQty }),
  writes: (a) => [put("checkout_line", a.item, { qty: a.qty })],
});

/** The applied promo code; "" takes it off. */
const checkoutPromo = define<{ code: string }>({
  check: (a) => fields(a, { code: isPromo }),
  writes: (a) => [put("checkout_cart", "cart", { promo: a.code })],
});

const checkoutDelivery = define<{ value: string }>({
  check: (a) => fields(a, { value: isDelivery }),
  writes: (a) => [put("checkout_cart", "cart", { delivery: a.value })],
});

const checkoutGift = define<{ value: boolean }>({
  check: (a) => fields(a, { value: isFlag }),
  writes: (a) => [put("checkout_cart", "cart", { gift: a.value })],
});

const checkoutNote = define<{ text: string }>({
  check: (a) => fields(a, { text: isText(MAX_NOTE) }),
  writes: (a) => [put("checkout_cart", "cart", { note: a.text })],
});

/** One address field. */
const checkoutAddress = define<{ field: keyof typeof CHECKOUT_ADDRESS_FIELDS; value: string }>({
  check: (a) => {
    const o = fields<{ field: keyof typeof CHECKOUT_ADDRESS_FIELDS; value: string }>(a, { field: (v) => typeof v === "string" && Object.keys(CHECKOUT_ADDRESS_FIELDS).includes(v), value: (v) => typeof v === "string" });
    if (!o || o.value.length > CHECKOUT_ADDRESS_FIELDS[o.field]) return null;
    return o.field === "country" && !(CHECKOUT_COUNTRIES as readonly string[]).includes(o.value) ? null : o;
  },
  writes: (a) => [put("checkout_address", "shipping", { [a.field]: a.value })],
});

type Place = { id: string; at: number; lines: { item: string; qty: number }[]; promo: string; delivery: string; gift: boolean };

/** Whether `v` is a list of distinct known items, each with a quantity of at least one. */
const isLines = (v: unknown): v is Place["lines"] => {
  if (!Array.isArray(v) || v.length === 0 || v.length > CHECKOUT_ITEMS.length) return false;
  const seen = new Set<string>();
  for (const l of v as unknown[]) {
    const o = fields<{ item: string; qty: number }>(l, { item: isItem, qty: (q) => isQty(q) && q > 0 });
    if (!o || seen.has(o.item)) return false;
    seen.add(o.item);
  }
  return true;
};

/**
 * Places the order and empties the cart, in one step: the order row and its lines, with totals
 * worked out here in cents (never taken from the caller), then every item's quantity set to 0
 * and the cart's promo, gift flag and message cleared. The delivery choice and the address stay.
 */
const checkoutPlace = define<Place>({
  check: (a) => fields<Place>(a, { id: isId, at: isInstant, lines: isLines, promo: isPromo, delivery: isDelivery, gift: isFlag }),
  writes: (a) => {
    const t = totalsOf(a.lines, a.promo, a.delivery);
    const writes: Write[] = [
      put("checkout_order", a.id, { at: a.at, itemCount: t.itemCount, subtotalCents: t.subtotalCents, discountCents: t.discountCents, shippingCents: t.shippingCents, taxCents: t.taxCents, totalCents: t.totalCents, promo: a.promo, delivery: a.delivery, gift: a.gift }),
    ];
    for (const l of a.lines) {
      const item = CHECKOUT_ITEMS.find((i) => i.id === l.item)!;
      writes.push(put("checkout_order_line", `${a.id}.${l.item}`, { orderId: a.id, item: l.item, name: item.name, qty: l.qty, unitCents: item.cents }));
    }
    for (const i of CHECKOUT_ITEMS) writes.push(put("checkout_line", i.id, { qty: 0 }));
    writes.push(put("checkout_cart", "cart", { promo: "", gift: false, note: "" }));
    return writes;
  },
});

export const mutations = {
  "checkout.qty": checkoutQty,
  "checkout.promo": checkoutPromo,
  "checkout.delivery": checkoutDelivery,
  "checkout.gift": checkoutGift,
  "checkout.note": checkoutNote,
  "checkout.address": checkoutAddress,
  "checkout.place": checkoutPlace,
};
