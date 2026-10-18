import { test } from "node:test";
import assert from "node:assert/strict";
import { checkout, type CheckoutState } from "../../src/templates/checkout/model.ts";

const NOW = { epochMs: Date.UTC(2026, 9, 13, 16, 30), utcOffsetMinutes: -420 };
const start = () => checkout.initial(NOW);
const view = (s: CheckoutState) => checkout.view(s, NOW);
const press = (s: CheckoutState, id: string) => checkout.reduce(s, { type: "press", id }, NOW);
const set = (s: CheckoutState, id: string, value: string | number | boolean) => checkout.reduce(s, { type: "set", id, value }, NOW);
const setAll = (s: CheckoutState, fields: Record<string, string>) => Object.entries(fields).reduce((acc, [k, v]) => set(acc, k, v), s);

const ADDRESS = { email: "ada@example.com", firstName: "Ada", lastName: "Lovelace", address: "1 Main St", city: "Portland", state: "Oregon", postalCode: "97201" };
const CARD = { cardNumber: "4242 4242 4242 4242", cardName: "Ada Lovelace", expiry: "12/29", cvc: "123" };

test("starts on the cart with the stock items and totals", () => {
  const v = view(start());
  assert.equal(v.step, 0);
  assert.deepEqual(v.steps.map((s) => s.label), ["Cart", "Shipping", "Delivery", "Payment"]);
  assert.deepEqual(v.items.map((i) => [i.name, i.qty, i.priceEach, i.lineTotal]), [
    ["Speckled Stoneware Mug", 2, "$78.00", "$156.00"],
    ["Stoneware Dinner Plate", 1, "$72.00", "$72.00"],
    ["Cereal Bowl", 1, "$80.00", "$80.00"],
  ]);
  assert.equal(v.summary.subtotal, "$308.00");
  assert.equal(v.summary.itemCount, "4 items");
  assert.equal(v.summary.shipping, "Free");
  assert.equal(v.summary.tax, "$24.64");
  assert.equal(v.summary.total, "$332.64");
  assert.equal(v.summary.trigger, "Order summary · $332.64");
  assert.equal(v.summary.freeShippingTitle, null);
  assert.equal(v.actions.backLabel, "Continue shopping");
  assert.equal(v.actions.nextLabel, "Continue");
  assert.equal(v.delivery.options[0]!.price, "Free");
  assert.deepEqual(v.errors, {});
});

test("quantities change the totals; removing the last item blocks Continue", () => {
  let s = set(start(), "qty:mug", 1);
  assert.equal(view(s).summary.subtotal, "$230.00");
  assert.equal(view(s).summary.freeShippingTitle, "$70.00 away from free standard shipping");
  assert.equal(view(s).summary.shipping, "$4.95");
  assert.equal(view(s).delivery.options[0]!.price, "$4.95");
  s = press(s, "remove:plate");
  assert.deepEqual(view(s).items.map((i) => i.id), ["mug", "bowl"]);
  s = press(press(s, "remove:mug"), "remove:bowl");
  assert.equal(view(s).items.length, 0);
  assert.equal(view(s).summary.itemCount, "0 items");
  const blocked = press(s, "next");
  assert.equal(view(blocked).step, 0);
  assert.equal(view(blocked).errors.items, "Your cart is empty.");
  assert.equal(view(blocked).actions.blocked, "One problem above needs fixing first.");
  assert.equal(view(blocked).steps[0]!.hasError, true);
  assert.equal(view(blocked).focusTicket, 1);
});

test("promo codes: typing, checking, applying", () => {
  let s = set(start(), "promo", "welcome10");
  assert.deepEqual(view(s).promo.status, { type: "warning", message: "Press Apply to check this code." });
  s = press(s, "apply");
  assert.deepEqual(view(s).promo.status, { type: "success", message: "WELCOME10 · 10% off applied." });
  assert.equal(view(s).summary.promoLabel, "WELCOME10 · 10% off");
  assert.equal(view(s).summary.discount, "−$30.80");
  // 277.20 + 4.95 shipping (under the free-shipping line now) + 22.18 tax
  assert.equal(view(s).summary.shipping, "$4.95");
  assert.equal(view(s).summary.total, "$304.33");
  s = set(s, "promo", "nope");
  assert.equal(view(s).summary.promoLabel, null);
  s = press(s, "apply");
  assert.deepEqual(view(s).promo.status, { type: "warning", message: "That promo code is not valid." });
  assert.equal(view(set(s, "promo", "")).promo.status, null);
});

test("invalid shipping submit shows every error and asks for focus", () => {
  let s = press(start(), "next");
  assert.equal(view(s).step, 1);
  assert.deepEqual(view(s).errors, {});
  s = press(s, "next");
  const v = view(s);
  assert.equal(v.step, 1);
  assert.deepEqual(v.errors, {
    email: "Enter an email address for order updates.",
    firstName: "Required",
    lastName: "Required",
    address: "Required",
    city: "Required",
    state: "Required",
    postalCode: "Enter a 5-digit ZIP code, with an optional 4-digit suffix.",
  });
  assert.equal(v.actions.blocked, "7 problems above need fixing first.");
  assert.deepEqual(v.steps.map((x) => x.hasError), [false, true, false, false]);
  assert.equal(v.focusTicket, 1);
});

test("errors clear as fields are fixed, and the country changes the rules", () => {
  let s = press(press(start(), "next"), "next");
  s = setAll(s, ADDRESS);
  assert.deepEqual(view(s).errors, {});
  assert.equal(view(s).steps[1]!.hasError, false);
  s = set(s, "country", "ca");
  assert.equal(view(s).shipping.hasState, false);
  assert.equal(view(s).shipping.postalLabel, "Postal code");
  assert.equal(view(s).shipping.postalPlaceholder, "K1A 0B1");
  assert.equal(view(s).errors.postalCode, "Enter a Canadian postal code, for example K1A 0B1.");
  assert.equal(view(set(s, "postalCode", "k1a 0b1")).errors.postalCode, undefined);
  s = set(s, "country", "uk");
  assert.equal(view(s).shipping.postalLabel, "Postcode");
  assert.equal(view(set(s, "postalCode", "SW1A 1AA")).errors.postalCode, undefined);
});

test("the full journey: delivery, gift, payment, pay", () => {
  let s = setAll(press(start(), "next"), ADDRESS);
  s = press(s, "next");
  assert.equal(view(s).step, 2);
  assert.equal(view(s).actions.backLabel, "Back");
  s = set(s, "delivery", "overnight");
  assert.equal(view(s).summary.deliveryLabel, "Overnight");
  assert.equal(view(s).summary.shipping, "$24.95");
  assert.equal(view(s).delivery.noteLabel, "Delivery instructions");
  s = set(s, "isGift", true);
  assert.equal(view(s).delivery.noteLabel, "Gift message");
  assert.equal(view(s).delivery.notePlaceholder, "Happy birthday — hope these get plenty of use.");
  assert.equal(view(s).delivery.noteDescription, "Printed on a card. Prices are left off the packing slip.");
  s = press(s, "next");
  assert.equal(view(s).step, 3);
  assert.equal(view(s).actions.nextLabel, "Pay $357.59");
  s = press(s, "next");
  assert.deepEqual(view(s).errors, {
    cardNumber: "Enter the full card number.",
    cardName: "Enter the name printed on the card.",
    expiry: "Use MM/YY.",
    cvc: "3 or 4 digits.",
  });
  assert.equal(view(s).isComplete, false);
  s = setAll(s, CARD);
  assert.deepEqual(view(s).errors, {});
  s = set(s, "billingMatches", false);
  assert.equal(view(s).payment.billingMatches, false);
  s = press(s, "next");
  assert.equal(view(s).isComplete, true);
  assert.equal(view(s).confirmation, "This local example completed an order for $357.59. No payment was sent.");
});

test("overnight outside the US blocks the delivery step", () => {
  let s = setAll(press(start(), "next"), { ...ADDRESS, country: "ca", postalCode: "K1A 0B1" });
  s = press(s, "next");
  s = press(set(s, "delivery", "overnight"), "next");
  assert.equal(view(s).step, 2);
  assert.equal(view(s).errors.delivery, "Overnight delivery is only available in the US.");
});

test("back never goes below the cart; goto checks every step on the way", () => {
  assert.equal(view(press(start(), "back")).step, 0);
  let s = press(start(), "goto:3");
  // Cart is fine, shipping is empty: stopped at shipping, with its errors showing.
  assert.equal(view(s).step, 1);
  assert.equal(Object.keys(view(s).errors).length, 7);
  assert.equal(view(s).focusTicket, 1);
  s = setAll(s, ADDRESS);
  s = press(s, "goto:3");
  assert.equal(view(s).step, 3);
  assert.deepEqual(view(s).errors, {});
  assert.equal(view(press(s, "goto:0")).step, 0);
  assert.equal(press(s, "goto:9"), s);
});

test("the view is plain JSON", () => {
  const v = view(press(press(start(), "next"), "next"));
  assert.deepEqual(JSON.parse(JSON.stringify(v)), v);
});
