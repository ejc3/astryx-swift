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

test("leaving a field shows its error without Continue; the web never sends blur, so it keeps the stock behavior", () => {
  let s = press(start(), "next");
  assert.deepEqual(view(s).errors, {});
  // Typing alone shows nothing; leaving the field shows that field's error, and only that one.
  s = set(s, "email", "ada@");
  assert.deepEqual(view(s).errors, {});
  s = press(s, "blur:email");
  assert.deepEqual(view(s).errors, { email: "Enter an email address for order updates." });
  s = press(s, "blur:firstName");
  assert.deepEqual(view(s).errors, { email: "Enter an email address for order updates.", firstName: "Required" });
  // The step is not marked, and Continue's count stays quiet, until Continue is tried.
  assert.deepEqual(view(s).steps.map((x) => x.hasError), [false, false, false, false]);
  assert.equal(view(s).actions.blocked, null);
  assert.equal(view(s).focusTicket, 0);
  // Fixing the field clears its error; an unknown field or a repeat changes nothing.
  assert.deepEqual(view(set(s, "email", "ada@example.com")).errors, { firstName: "Required" });
  assert.equal(press(s, "blur:nope"), s);
  assert.equal(press(s, "blur:email"), s);
  // Continue then shows every error, as before.
  s = press(s, "next");
  assert.equal(Object.keys(view(s).errors).length, 7);
  assert.equal(view(s).actions.blocked, "7 problems above need fixing first.");
});

test("blur on a step shows only that step's fields; the other step's stay quiet", () => {
  let s = press(start(), "next");
  s = press(s, "blur:cvc");
  assert.deepEqual(view(s).errors, {});
  s = press(set(s, "country", "us"), "back");
  assert.equal(view(s).step, 0);
  assert.deepEqual(view(s).fieldOrder, []);
  assert.deepEqual(view(press(start(), "next")).fieldOrder, ["email", "firstName", "lastName", "address", "apartment", "city", "postalCode"]);
});

test("the view carries the words, per-item labels and spoken step states the native hosts draw", () => {
  const v = view(start());
  assert.equal(v.words.title, "Checkout");
  // The heading says what the screen's navigation title says, so a host with a title bar omits it.
  assert.equal(v.headingRepeatsTitle, true);
  assert.equal(v.words.title, checkout.title);
  assert.equal(v.words.cart.heading, "Review your cart");
  assert.equal(v.words.done, "Done");
  assert.equal(v.items[0]!.removeLabel, "Remove Speckled Stoneware Mug");
  assert.equal(v.items[0]!.quantityLabel, "Quantity of Speckled Stoneware Mug");
  assert.deepEqual(v.steps.map((x) => [x.spoken, x.state]), [
    ["Cart, step 1 of 4", "Current step"],
    ["Shipping, step 2 of 4", ""],
    ["Delivery, step 3 of 4", ""],
    ["Payment, step 4 of 4", ""],
  ]);
});

test("the rules carry the layout numbers the stock page keeps, and the web words are the stock page's", async () => {
  const { readFileSync } = await import("node:fs");
  const stock = readFileSync(new URL("../../../web/src/stock/templates/checkout-wizard.tsx", import.meta.url), "utf8");
  const flat = stock.replace(/\s+/g, " ");
  const v = view(start());
  assert.equal(v.rules.narrowHostAtMost, Number(/const NARROW_HOST_WIDTH = (\d+);/.exec(stock)![1]));
  assert.ok(flat.includes(`contentWidth={${v.rules.contentWidth}}`));
  assert.ok(flat.includes(`width: ${v.rules.summaryWidth},`));
  assert.ok(flat.includes(`max={${v.rules.quantity.max}}`) && flat.includes(`min={${v.rules.quantity.min}}`));
  assert.ok(flat.includes(`width={${v.rules.quantity.fieldWidth}}`));
  assert.ok(flat.includes(`maxLength={${v.rules.noteMaxLength}}`));
  assert.equal(flat.split(`width={${v.rules.shortFieldWidth}}`).length - 1, 2);
  // Astryx's Stepper collapses below this width for each step.
  const stepper = readFileSync(new URL("../../../node_modules/@astryxdesign/core/src/Stepper/Stepper.tsx", import.meta.url), "utf8");
  assert.equal(v.rules.stepperMinStepWidth, Number(/DEFAULT_MIN_STEP_WIDTH = (\d+)/.exec(stepper)![1]));

  const w = v.words;
  const drawn = [
    w.title, w.secureCheckout, w.progress, w.confirmed.title, w.confirmed.heading, w.confirmed.pageDetail,
    w.summary.subtotal, w.summary.tax, w.summary.total, w.summary.title, w.summary.qty,
    w.cart.heading, w.cart.limited, w.cart.remove, w.cart.promoLabel, w.cart.promoPlaceholder, w.cart.apply, w.cart.each,
    ...Object.values({ ...w.shipping }), ...Object.values({ ...w.delivery }), ...Object.values({ ...w.payment }),
  ].filter((word) => word !== w.payment.cvcInfoLabel);
  for (const word of drawn) assert.ok(flat.includes(word), `the stock page does not write "${word}"`);
  assert.ok(flat.includes(`${w.summary.deliverySuffix}`));
});
