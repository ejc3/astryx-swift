import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  checkout,
  type CheckoutState,
} from '../../src/templates/checkout/model.ts';
import {harness, type World} from './harness.ts';

const NOW = {epochMs: Date.UTC(2026, 9, 13, 16, 30), utcOffsetMinutes: -420};
// The harness runs the template as the core does: view state, the saved doc, the mutations asked for.
const run = harness(checkout, NOW);
type W = World<CheckoutState>;
const start = () => run.start();
const view = (w: W) => run.view(w);
const press = (w: W, id: string) => run.press(w, id);
const set = (w: W, id: string, value: string | number | boolean) =>
  run.set(w, id, value);
const setAll = (w: W, fields: Record<string, string>) =>
  Object.entries(fields).reduce((acc, [k, v]) => set(acc, k, v), w);

const ADDRESS = {
  email: 'ada@example.com',
  firstName: 'Ada',
  lastName: 'Lovelace',
  address: '1 Main St',
  city: 'Portland',
  state: 'Oregon',
  postalCode: '97201',
};
const CARD = {
  cardNumber: '4242 4242 4242 4242',
  cardName: 'Ada Lovelace',
  expiry: '12/29',
  cvc: '123',
};

test('starts on the cart with the stock items and totals', () => {
  const v = view(start());
  assert.equal(v.step, 0);
  assert.deepEqual(
    v.steps.map(s => s.label),
    ['Cart', 'Shipping', 'Delivery', 'Payment'],
  );
  assert.deepEqual(
    v.items.map(i => [i.name, i.qty, i.priceEach, i.lineTotal]),
    [
      ['Speckled Stoneware Mug', 2, '$78.00', '$156.00'],
      ['Stoneware Dinner Plate', 1, '$72.00', '$72.00'],
      ['Cereal Bowl', 1, '$80.00', '$80.00'],
    ],
  );
  assert.equal(v.summary.subtotal, '$308.00');
  assert.equal(v.summary.itemCount, '4 items');
  assert.equal(v.summary.shipping, 'Free');
  assert.equal(v.summary.tax, '$24.64');
  assert.equal(v.summary.total, '$332.64');
  assert.equal(v.summary.trigger, 'Order summary · $332.64');
  assert.equal(v.summary.freeShippingTitle, null);
  assert.equal(v.actions.backLabel, 'Continue shopping');
  assert.equal(v.actions.nextLabel, 'Continue');
  assert.equal(v.delivery.options[0]!.price, 'Free');
  assert.deepEqual(v.errors, {});
});

test('quantities change the totals; removing the last item blocks Continue', () => {
  let s = set(start(), 'qty:mug', 1);
  assert.equal(view(s).summary.subtotal, '$230.00');
  assert.equal(
    view(s).summary.freeShippingTitle,
    '$70.00 away from free standard shipping',
  );
  assert.equal(view(s).summary.shipping, '$4.95');
  assert.equal(view(s).delivery.options[0]!.price, '$4.95');
  s = press(s, 'remove:plate');
  assert.deepEqual(
    view(s).items.map(i => i.id),
    ['mug', 'bowl'],
  );
  s = press(press(s, 'remove:mug'), 'remove:bowl');
  assert.equal(view(s).items.length, 0);
  assert.equal(view(s).summary.itemCount, '0 items');
  const blocked = press(s, 'next');
  assert.equal(view(blocked).step, 0);
  assert.equal(view(blocked).errors.items, 'Your cart is empty.');
  assert.equal(
    view(blocked).actions.blocked,
    'One problem above needs fixing first.',
  );
  assert.equal(view(blocked).steps[0]!.hasError, true);
  assert.equal(view(blocked).focusTicket, 1);
});

test('promo codes: typing, checking, applying', () => {
  let s = set(start(), 'promo', 'welcome10');
  assert.deepEqual(view(s).promo.status, {
    type: 'warning',
    message: 'Press Apply to check this code.',
  });
  s = press(s, 'apply');
  assert.deepEqual(view(s).promo.status, {
    type: 'success',
    message: 'WELCOME10 · 10% off applied.',
  });
  assert.equal(view(s).summary.promoLabel, 'WELCOME10 · 10% off');
  assert.equal(view(s).summary.discount, '−$30.80');
  // 277.20 + 4.95 shipping (under the free-shipping line now) + 22.18 tax
  assert.equal(view(s).summary.shipping, '$4.95');
  assert.equal(view(s).summary.total, '$304.33');
  s = set(s, 'promo', 'nope');
  assert.equal(view(s).summary.promoLabel, null);
  s = press(s, 'apply');
  assert.deepEqual(view(s).promo.status, {
    type: 'warning',
    message: 'That promo code is not valid.',
  });
  assert.equal(view(set(s, 'promo', '')).promo.status, null);
});

test('invalid shipping submit shows every error and asks for focus', () => {
  let s = press(start(), 'next');
  assert.equal(view(s).step, 1);
  assert.deepEqual(view(s).errors, {});
  s = press(s, 'next');
  const v = view(s);
  assert.equal(v.step, 1);
  assert.deepEqual(v.errors, {
    email: 'Enter an email address for order updates.',
    firstName: 'Required',
    lastName: 'Required',
    address: 'Required',
    city: 'Required',
    state: 'Required',
    postalCode: 'Enter a 5-digit ZIP code, with an optional 4-digit suffix.',
  });
  assert.equal(v.actions.blocked, '7 problems above need fixing first.');
  assert.deepEqual(
    v.steps.map(x => x.hasError),
    [false, true, false, false],
  );
  assert.equal(v.focusTicket, 1);
});

test('errors clear as fields are fixed, and the country changes the rules', () => {
  let s = press(press(start(), 'next'), 'next');
  s = setAll(s, ADDRESS);
  assert.deepEqual(view(s).errors, {});
  assert.equal(view(s).steps[1]!.hasError, false);
  s = set(s, 'country', 'ca');
  assert.equal(view(s).shipping.hasState, false);
  assert.equal(view(s).shipping.postalLabel, 'Postal code');
  assert.equal(view(s).shipping.postalPlaceholder, 'K1A 0B1');
  assert.equal(
    view(s).errors.postalCode,
    'Enter a Canadian postal code, for example K1A 0B1.',
  );
  assert.equal(
    view(set(s, 'postalCode', 'k1a 0b1')).errors.postalCode,
    undefined,
  );
  s = set(s, 'country', 'uk');
  assert.equal(view(s).shipping.postalLabel, 'Postcode');
  assert.equal(
    view(set(s, 'postalCode', 'SW1A 1AA')).errors.postalCode,
    undefined,
  );
});

test('the full journey: delivery, gift, payment, pay', () => {
  let s = setAll(press(start(), 'next'), ADDRESS);
  s = press(s, 'next');
  assert.equal(view(s).step, 2);
  assert.equal(view(s).actions.backLabel, 'Back');
  s = set(s, 'delivery', 'overnight');
  assert.equal(view(s).summary.deliveryLabel, 'Overnight');
  assert.equal(view(s).summary.shipping, '$24.95');
  assert.equal(view(s).delivery.noteLabel, 'Delivery instructions');
  s = set(s, 'isGift', true);
  assert.equal(view(s).delivery.noteLabel, 'Gift message');
  assert.equal(
    view(s).delivery.notePlaceholder,
    'Happy birthday — hope these get plenty of use.',
  );
  assert.equal(
    view(s).delivery.noteDescription,
    'Printed on a card. Prices are left off the packing slip.',
  );
  s = press(s, 'next');
  assert.equal(view(s).step, 3);
  assert.equal(view(s).actions.nextLabel, 'Pay $357.59');
  s = press(s, 'next');
  assert.deepEqual(view(s).errors, {
    cardNumber: 'Enter the full card number.',
    cardName: 'Enter the name printed on the card.',
    expiry: 'Use MM/YY.',
    cvc: '3 or 4 digits.',
  });
  assert.equal(view(s).isComplete, false);
  s = setAll(s, CARD);
  assert.deepEqual(view(s).errors, {});
  s = set(s, 'billingMatches', false);
  assert.equal(view(s).payment.billingMatches, false);
  s = press(s, 'next');
  assert.equal(view(s).isComplete, true);
  assert.equal(
    view(s).confirmation,
    'This local example completed an order for $357.59. No payment was sent.',
  );
});

test('overnight outside the US blocks the delivery step', () => {
  let s = setAll(press(start(), 'next'), {
    ...ADDRESS,
    country: 'ca',
    postalCode: 'K1A 0B1',
  });
  s = press(s, 'next');
  s = press(set(s, 'delivery', 'overnight'), 'next');
  assert.equal(view(s).step, 2);
  assert.equal(
    view(s).errors.delivery,
    'Overnight delivery is only available in the US.',
  );
});

test('back never goes below the cart; goto checks every step on the way', () => {
  assert.equal(view(press(start(), 'back')).step, 0);
  let s = press(start(), 'goto:3');
  // Cart is fine, shipping is empty: stopped at shipping, with its errors showing.
  assert.equal(view(s).step, 1);
  assert.equal(Object.keys(view(s).errors).length, 7);
  assert.equal(view(s).focusTicket, 1);
  s = setAll(s, ADDRESS);
  s = press(s, 'goto:3');
  assert.equal(view(s).step, 3);
  assert.deepEqual(view(s).errors, {});
  assert.equal(view(press(s, 'goto:0')).step, 0);
  assert.equal(press(s, 'goto:9'), s);
});

test('the view is plain JSON', () => {
  const v = view(press(press(start(), 'next'), 'next'));
  assert.deepEqual(JSON.parse(JSON.stringify(v)), v);
});

test('leaving a field shows its error without Continue; the web never sends blur, so it keeps the stock behavior', () => {
  let s = press(start(), 'next');
  assert.deepEqual(view(s).errors, {});
  // Typing alone shows nothing; leaving the field shows that field's error, and only that one.
  s = set(s, 'email', 'ada@');
  assert.deepEqual(view(s).errors, {});
  s = press(s, 'blur:email');
  assert.deepEqual(view(s).errors, {
    email: 'Enter an email address for order updates.',
  });
  s = press(s, 'blur:firstName');
  assert.deepEqual(view(s).errors, {
    email: 'Enter an email address for order updates.',
    firstName: 'Required',
  });
  // The step is not marked, and Continue's count stays quiet, until Continue is tried.
  assert.deepEqual(
    view(s).steps.map(x => x.hasError),
    [false, false, false, false],
  );
  assert.equal(view(s).actions.blocked, null);
  assert.equal(view(s).focusTicket, 0);
  // Fixing the field clears its error; an unknown field or a repeat changes nothing.
  assert.deepEqual(view(set(s, 'email', 'ada@example.com')).errors, {
    firstName: 'Required',
  });
  assert.equal(press(s, 'blur:nope'), s);
  assert.equal(press(s, 'blur:email'), s);
  // Continue then shows every error, as before.
  s = press(s, 'next');
  assert.equal(Object.keys(view(s).errors).length, 7);
  assert.equal(view(s).actions.blocked, '7 problems above need fixing first.');
});

test("blur on a step shows only that step's fields; the other step's stay quiet", () => {
  let s = press(start(), 'next');
  s = press(s, 'blur:cvc');
  assert.deepEqual(view(s).errors, {});
  s = press(set(s, 'country', 'us'), 'back');
  assert.equal(view(s).step, 0);
  assert.deepEqual(view(s).fieldOrder, []);
  assert.deepEqual(view(press(start(), 'next')).fieldOrder, [
    'email',
    'firstName',
    'lastName',
    'address',
    'apartment',
    'city',
    'postalCode',
  ]);
});

test('the view carries the words, per-item labels and spoken step states the native hosts draw', () => {
  const v = view(start());
  assert.equal(v.words.title, 'Checkout');
  // The heading says what the screen's navigation title says, so a host with a title bar omits it.
  assert.equal(v.headingRepeatsTitle, true);
  assert.equal(v.words.title, checkout.title);
  assert.equal(v.words.cart.heading, 'Review your cart');
  assert.equal(v.words.done, 'Done');
  assert.equal(v.items[0]!.removeLabel, 'Remove Speckled Stoneware Mug');
  assert.equal(v.items[0]!.quantityLabel, 'Quantity of Speckled Stoneware Mug');
  assert.deepEqual(
    v.steps.map(x => [x.spoken, x.state]),
    [
      ['Cart, step 1 of 4', 'Current step'],
      ['Shipping, step 2 of 4', ''],
      ['Delivery, step 3 of 4', ''],
      ['Payment, step 4 of 4', ''],
    ],
  );
});

test("the rules carry the layout numbers the stock page keeps, and the web words are the stock page's", async () => {
  const {readFileSync} = await import('node:fs');
  const stock = readFileSync(
    new URL(
      '../../../web/src/stock/templates/checkout-wizard.tsx',
      import.meta.url,
    ),
    'utf8',
  );
  const flat = stock.replace(/\s+/g, ' ');
  const v = view(start());
  assert.equal(
    v.rules.narrowHostAtMost,
    Number(/const NARROW_HOST_WIDTH = (\d+);/.exec(stock)![1]),
  );
  assert.ok(flat.includes(`contentWidth={${v.rules.contentWidth}}`));
  assert.ok(flat.includes(`width: ${v.rules.summaryWidth},`));
  assert.ok(
    flat.includes(`max={${v.rules.quantity.max}}`) &&
      flat.includes(`min={${v.rules.quantity.min}}`),
  );
  assert.ok(flat.includes(`width={${v.rules.quantity.fieldWidth}}`));
  assert.ok(flat.includes(`maxLength={${v.rules.noteMaxLength}}`));
  assert.equal(flat.split(`width={${v.rules.shortFieldWidth}}`).length - 1, 2);
  // Astryx's Stepper collapses below this width for each step.
  const stepper = readFileSync(
    new URL(
      '../src/Stepper/Stepper.tsx',
      import.meta.resolve('@astryxdesign/core'),
    ),
    'utf8',
  );
  assert.equal(
    v.rules.stepperMinStepWidth,
    Number(/DEFAULT_MIN_STEP_WIDTH = (\d+)/.exec(stepper)![1]),
  );

  const w = v.words;
  const drawn = [
    w.title,
    w.secureCheckout,
    w.progress,
    w.confirmed.title,
    w.confirmed.heading,
    w.confirmed.pageDetail,
    w.summary.subtotal,
    w.summary.tax,
    w.summary.total,
    w.summary.title,
    w.summary.qty,
    w.cart.heading,
    w.cart.limited,
    w.cart.remove,
    w.cart.promoLabel,
    w.cart.promoPlaceholder,
    w.cart.apply,
    w.cart.each,
    ...Object.values({...w.shipping}),
    ...Object.values({...w.delivery}),
    ...Object.values({...w.payment}),
  ].filter(word => word !== w.payment.cvcInfoLabel);
  for (const word of drawn)
    assert.ok(flat.includes(word), `the stock page does not write "${word}"`);
  assert.ok(flat.includes(`${w.summary.deliverySuffix}`));
});

// --- Saved data (docs/SYNC.md) -------------------------------------------------------------------

import {applyWrites, emptyDoc, type Doc} from '../../src/sync/doc.ts';
import {writesOf} from '../../src/sync/mutations.ts';
import {totalsOf} from '../../src/sync/areas/checkout.ts';

const names = (w: W) => w.saved.map(m => m.name);
/** A doc another device made: rows put straight into a table. */
const docWith = (
  tables: Record<
    string,
    Record<string, Record<string, string | number | boolean>>
  >,
): Doc => {
  const doc = emptyDoc() as unknown as Record<string, Record<string, unknown>>;
  for (const [t, rows] of Object.entries(tables))
    for (const [id, row] of Object.entries(rows)) doc[t]![id] = {id, ...row};
  return doc as unknown as Doc;
};
const SHIPPED = {...ADDRESS, country: 'us'};

test('each cart edit is saved as it is made, and the view follows the saved data', () => {
  let w = set(start(), 'qty:mug', 1);
  assert.deepEqual(w.saved, [
    {name: 'checkout.qty', args: {item: 'mug', qty: 1}},
  ]);
  assert.equal(view(w).summary.subtotal, '$230.00');
  w = press(w, 'remove:plate');
  assert.deepEqual(w.saved.at(-1), {
    name: 'checkout.qty',
    args: {item: 'plate', qty: 0},
  });
  assert.deepEqual(
    view(w).items.map(i => i.id),
    ['mug', 'bowl'],
  );
  w = set(set(w, 'promo', 'clay20'), 'promo', 'clay20');
  assert.deepEqual(
    names(w).slice(2),
    [],
    'typing a code saves nothing until Apply',
  );
  w = press(w, 'apply');
  assert.deepEqual(w.saved.at(-1), {
    name: 'checkout.promo',
    args: {code: 'CLAY20'},
  });
  assert.equal(view(w).summary.promoLabel, 'CLAY20 · 20% off');
  w = set(w, 'promo', 'x');
  assert.deepEqual(w.saved.at(-1), {name: 'checkout.promo', args: {code: ''}});
  assert.equal(view(w).summary.promoLabel, null);
  w = set(
    set(set(w, 'delivery', 'expedited'), 'isGift', true),
    'deliveryNote',
    'Enjoy!',
  );
  assert.deepEqual(
    w.saved.slice(-3).map(m => [m.name, m.args]),
    [
      ['checkout.delivery', {value: 'expedited'}],
      ['checkout.gift', {value: true}],
      ['checkout.note', {text: 'Enjoy!'}],
    ],
  );
  assert.deepEqual(
    [view(w).delivery.value, view(w).delivery.isGift, view(w).delivery.note],
    ['expedited', true, 'Enjoy!'],
  );
});

test('the address is saved a field at a time, and a relaunch draws it', () => {
  const w = setAll(press(start(), 'next'), SHIPPED);
  assert.deepEqual(
    w.saved.map(m => m.args.field),
    [
      'email',
      'firstName',
      'lastName',
      'address',
      'city',
      'state',
      'postalCode',
    ],
  );
  assert.deepEqual(view(w).errors, {});
  // A new session over the same saved doc: the cart step, the address filled in.
  const again = {...start(), doc: w.doc};
  assert.equal(view(again).step, 0);
  const next = press(again, 'next');
  assert.deepEqual(
    [
      view(next).shipping.email,
      view(next).shipping.city,
      view(next).shipping.state,
      view(next).shipping.postalCode,
    ],
    ['ada@example.com', 'Portland', 'Oregon', '97201'],
  );
  assert.deepEqual(view(next).errors, {});
  // Setting what is already saved asks for nothing.
  const same = set(next, 'city', 'Portland');
  assert.equal(same, next);
});

test('the cart, promo and delivery come back after a relaunch', () => {
  let w = set(set(start(), 'qty:mug', 4), 'delivery', 'overnight');
  w = press(set(w, 'promo', 'welcome10'), 'apply');
  const again = {...start(), doc: w.doc};
  const v = view(again);
  assert.equal(v.items[0]!.qty, 4);
  assert.equal(v.promo.value, 'WELCOME10');
  assert.deepEqual(v.promo.status, {
    type: 'success',
    message: 'WELCOME10 · 10% off applied.',
  });
  assert.equal(v.delivery.value, 'overnight');
  // Apply again with the saved code shown changes nothing saved.
  assert.deepEqual(press(again, 'apply').saved, []);
});

test('a card is never saved: not its number, name, expiry or CVC', () => {
  let w = setAll(press(start(), 'next'), SHIPPED);
  w = press(press(w, 'next'), 'next');
  const card = {
    cardNumber: '5555 4444 3333 2222',
    cardName: 'Zed Q Cardholder',
    expiry: '09/31',
    cvc: '8675',
  };
  w = press(setAll(w, card), 'next');
  assert.equal(view(w).isComplete, true);
  const saved = JSON.stringify([w.doc, w.saved]);
  for (const secret of Object.values(card))
    assert.ok(!saved.includes(secret), `${secret} was saved`);
  assert.ok(w.saved.every(m => m.name.startsWith('checkout.')));
  assert.deepEqual(
    Object.keys(w.doc)
      .filter(t => Object.keys(w.doc[t as keyof Doc]).length > 0)
      .sort(),
    [
      'checkout_address',
      'checkout_cart',
      'checkout_line',
      'checkout_order',
      'checkout_order_line',
    ],
  );
});

function placed(extras = true) {
  const r = harness(checkout, NOW, extras);
  const fill = (w: W, fields: Record<string, string>) =>
    Object.entries(fields).reduce((acc, [k, v]) => r.set(acc, k, v), w);
  let w = fill(r.press(r.start(), 'next'), SHIPPED);
  w = r.press(r.set(r.press(w, 'next'), 'delivery', 'expedited'), 'next');
  w = r.press(r.set(w, 'isGift', true), 'next');
  w = r.press(fill(w, CARD), 'next');
  return {r, w};
}

test('the last Continue places an order record in cents and empties the cart', () => {
  const {r, w} = placed();
  assert.equal(r.view(w).isComplete, true);
  const place = w.saved.filter(m => m.name === 'checkout.place');
  assert.deepEqual(place, [
    {
      name: 'checkout.place',
      args: {
        id: 'dev-1',
        at: NOW.epochMs,
        lines: [
          {item: 'mug', qty: 2},
          {item: 'plate', qty: 1},
          {item: 'bowl', qty: 1},
        ],
        promo: '',
        delivery: 'expedited',
        gift: true,
      },
    },
  ]);
  // $308.00 + $9.95 expedited + $24.64 tax (free shipping is for standard delivery only).
  assert.deepEqual(w.doc.checkout_order['dev-1'], {
    id: 'dev-1',
    at: NOW.epochMs,
    itemCount: 4,
    subtotalCents: 30800,
    discountCents: 0,
    shippingCents: 995,
    taxCents: 2464,
    totalCents: 34259,
    promo: '',
    delivery: 'expedited',
    gift: true,
  });
  assert.deepEqual(w.doc.checkout_order_line['dev-1.mug'], {
    id: 'dev-1.mug',
    orderId: 'dev-1',
    item: 'mug',
    name: 'Speckled Stoneware Mug',
    qty: 2,
    unitCents: 7800,
  });
  assert.deepEqual(
    Object.values(w.doc.checkout_line).map(l => l.qty),
    [0, 0, 0],
  );
  assert.deepEqual(
    [
      w.doc.checkout_cart.cart!.promo,
      w.doc.checkout_cart.cart!.gift,
      w.doc.checkout_cart.cart!.note,
    ],
    ['', false, ''],
  );
  assert.equal(
    w.doc.checkout_cart.cart!.delivery,
    'expedited',
    'the delivery choice stays',
  );
  assert.equal(
    w.doc.checkout_address.shipping!.city,
    'Portland',
    'the address stays',
  );
  // The confirmation and the summary still show the order that was placed.
  const v = r.view(w);
  assert.equal(
    v.confirmation,
    'This local example completed an order for $342.59. No payment was sent.',
  );
  assert.equal(v.summary.total, '$342.59');
  assert.equal(v.items.length, 3);
  assert.equal(v.refillLabel, null);
  // Pressing Continue again does not place a second order.
  assert.equal(
    r.press(w, 'next').saved.filter(m => m.name === 'checkout.place').length,
    1,
  );
});

test('after an order the cart is empty on a relaunch, and Refill cart puts the sample items back', () => {
  const {r, w} = placed();
  const again = {...r.start(w.doc)};
  const v = r.view(again);
  assert.equal(v.items.length, 0);
  assert.equal(v.refillLabel, 'Refill cart');
  assert.equal(v.summary.itemCount, '0 items');
  assert.equal(
    r.view(r.press(again, 'next')).errors.items,
    'Your cart is empty.',
  );
  const refilled = r.press(again, 'refill');
  assert.deepEqual(
    r.view(refilled).items.map(i => [i.id, i.qty]),
    [
      ['mug', 2],
      ['plate', 1],
      ['bowl', 1],
    ],
  );
  assert.equal(r.view(refilled).refillLabel, null);
  // A cart with items has no refill; pressing it does nothing.
  assert.equal(r.press(refilled, 'refill'), refilled);
});

test("without extras (stock's behaviour) no order is placed, the cart stays, and nothing new shows", () => {
  const {r, w} = placed(false);
  const v = r.view(w);
  assert.equal(v.isComplete, true);
  assert.equal(
    v.confirmation,
    'This local example completed an order for $342.59. No payment was sent.',
  );
  assert.ok(!w.saved.some(m => m.name === 'checkout.place'));
  assert.equal(Object.keys(w.doc.checkout_order).length, 0);
  assert.deepEqual(
    v.items.map(i => i.qty),
    [2, 1, 1],
  );
  // Stock's remove-everything dead end has no refill without extras.
  let e = r.start();
  for (const id of ['mug', 'plate', 'bowl']) e = r.press(e, `remove:${id}`);
  assert.equal(r.view(e).refillLabel, null);
  assert.equal(r.press(e, 'refill'), e);
  // The edits themselves still move the screen, in memory, as stock's own state does.
  assert.equal(
    r.view(r.set(r.start(), 'qty:mug', 1)).summary.subtotal,
    '$230.00',
  );
});

test('the cents a mutation records are the amounts the page shows, for every cart', () => {
  const cents = (text: string) =>
    Math.round(Number(text.replace(/[^0-9.]/g, '')) * 100);
  for (const mug of [0, 1, 2, 5, 10])
    for (const plate of [0, 1, 3])
      for (const bowl of [0, 1, 7]) {
        if (mug + plate + bowl === 0) continue;
        for (const promo of ['', 'WELCOME10', 'CLAY20'])
          for (const delivery of ['standard', 'expedited', 'overnight']) {
            let w = start();
            for (const [id, qty] of [
              ['mug', mug],
              ['plate', plate],
              ['bowl', bowl],
            ] as const)
              w = set(w, `qty:${id}`, qty);
            w = set(w, 'delivery', delivery);
            if (promo) w = press(set(w, 'promo', promo), 'apply');
            const v = view(w);
            const lines = [
              {item: 'mug', qty: mug},
              {item: 'plate', qty: plate},
              {item: 'bowl', qty: bowl},
            ].filter(l => l.qty > 0);
            const t = totalsOf(lines, promo, delivery);
            const where = `${mug}/${plate}/${bowl} ${promo} ${delivery}`;
            assert.equal(t.subtotalCents, cents(v.summary.subtotal), where);
            assert.equal(
              t.discountCents,
              promo ? cents(v.summary.discount) : 0,
              where,
            );
            assert.equal(
              t.shippingCents,
              v.summary.shipping === 'Free' ? 0 : cents(v.summary.shipping),
              where,
            );
            assert.equal(t.taxCents, cents(v.summary.tax), where);
            assert.equal(t.totalCents, cents(v.summary.total), where);
            assert.equal(
              t.totalCents,
              t.subtotalCents - t.discountCents + t.shippingCents + t.taxCents,
            );
          }
      }
});

test('mutations refuse what they do not expect, and place works the totals out itself', () => {
  const refused = (name: string, args: unknown) =>
    assert.equal(writesOf(name, args), null, `${name} ${JSON.stringify(args)}`);
  refused('checkout.qty', {item: 'vase', qty: 1});
  refused('checkout.qty', {item: 'mug', qty: 1.5});
  refused('checkout.qty', {item: 'mug', qty: -1});
  refused('checkout.qty', {item: 'mug', qty: 100});
  refused('checkout.qty', {item: 'mug', qty: 1, extra: true});
  refused('checkout.promo', {code: 'FREE'});
  refused('checkout.delivery', {value: 'drone'});
  refused('checkout.gift', {value: 'yes'});
  refused('checkout.note', {text: 'x'.repeat(241)});
  refused('checkout.address', {field: 'cardNumber', value: '4242'});
  refused('checkout.address', {field: 'country', value: 'fr'});
  refused('checkout.address', {field: 'city', value: 'x'.repeat(101)});
  const good = {
    id: 'o1',
    at: 1,
    lines: [{item: 'mug', qty: 1}],
    promo: '',
    delivery: 'standard',
    gift: false,
  };
  assert.ok(writesOf('checkout.place', good));
  refused('checkout.place', {...good, totalCents: 1});
  refused('checkout.place', {...good, lines: []});
  refused('checkout.place', {
    ...good,
    lines: [
      {item: 'mug', qty: 1},
      {item: 'mug', qty: 1},
    ],
  });
  refused('checkout.place', {...good, lines: [{item: 'mug', qty: 0}]});
  refused('checkout.place', {
    ...good,
    lines: [{item: 'mug', qty: 1, unitCents: 1}],
  });
  refused('checkout.place', {...good, at: 0});
  const doc = applyWrites(
    emptyDoc(),
    writesOf('checkout.place', {
      ...good,
      promo: 'CLAY20',
      lines: [{item: 'bowl', qty: 3}],
    })!,
  );
  assert.deepEqual(
    [
      doc.checkout_order.o1!.subtotalCents,
      doc.checkout_order.o1!.discountCents,
      doc.checkout_order.o1!.totalCents,
    ],
    [24000, 4800, 19200 + 495 + 1536],
  );
  for (const row of [
    ...Object.values(doc.checkout_order),
    ...Object.values(doc.checkout_order_line),
  ]) {
    for (const [k, v] of Object.entries(row))
      if (typeof v === 'number')
        assert.ok(Number.isSafeInteger(v), `${k} is not an integer`);
  }
});

test('rows from another device are drawn, and malformed rows are ignored', () => {
  const doc = docWith({
    checkout_line: {
      mug: {qty: 5},
      plate: {qty: 500},
      bowl: {qty: 1.5},
      vase: {qty: 3},
    },
    checkout_cart: {
      cart: {
        promo: 'BOGUS',
        delivery: 'drone',
        gift: true,
        note: 'x'.repeat(300),
      },
    },
    checkout_address: {
      shipping: {
        email: 'bo@example.com',
        country: 'zz',
        city: 7 as unknown as string,
        state: 'Texas',
      },
    },
  });
  const w = {...start(), doc};
  const v = view(w);
  assert.deepEqual(
    v.items.map(i => [i.id, i.qty]),
    [
      ['mug', 5],
      ['plate', 1],
      ['bowl', 1],
    ],
    "bad quantities keep the sample's",
  );
  assert.equal(v.summary.promoLabel, null);
  assert.equal(v.delivery.value, 'standard');
  assert.equal(v.delivery.isGift, true);
  assert.equal(v.delivery.note, '');
  const next = view(press(w, 'next'));
  assert.deepEqual(
    [
      next.shipping.email,
      next.shipping.country,
      next.shipping.city,
      next.shipping.state,
    ],
    ['bo@example.com', 'us', '', 'Texas'],
  );
  assert.deepEqual(JSON.parse(JSON.stringify(next)), next);
});
