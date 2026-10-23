/**
 * Astryx's `checkout-wizard` template, refactored: its state, sample data and logic, here.
 * The JSX is web/src/templates/checkout.tsx; the stock copy is web/src/stock/templates/checkout-wizard.tsx.
 *
 * Actions (the "tpl.checkout." prefix removed):
 *   press  next | back | apply | goto:<step> | remove:<item id>
 *   set    qty:<item id> <number>
 *   set    promo, email, firstName, lastName, address, apartment, city, state, postalCode, country,
 *          delivery, deliveryNote, cardNumber, cardName, expiry, cvc  <string>
 *   set    isGift, billingMatches  <boolean>
 *   press  blur:<field>   the person left a text field: its error may show now, before Continue
 *                         (the web page never sends it, so the web copy is unchanged)
 *
 * Totals are worked out in dollars as floats and shown with toFixed(2), exactly as the stock
 * template does, so every figure matches it to the cent.
 *
 * Saved data (docs/SYNC.md; core/src/sync/areas/checkout.ts): the cart (a quantity per item, the
 * applied promo code, the delivery choice, the gift flag and message), the shipping address
 * fields, and each placed order. They are saved on each change: an edit is one small row, so
 * there is nothing to "save". The step, what was attempted or left, validation, the promo text
 * being typed and the card details (never saved) are view state.
 *
 * Placing the order (the last Continue, "Pay") writes an order record, with its totals in integer
 * cents worked out by the mutation from the same prices, and empties the cart. Without extras
 * (stock's behaviour only) nothing is placed or emptied: stock only shows the confirmation.
 * A cart that an order emptied can be refilled (extras only): stock has no way to add an item.
 */
import type { Doc } from "../../sync/doc.ts";
import {
  CHECKOUT_ADDRESS_FIELDS, CHECKOUT_COUNTRIES, CHECKOUT_DELIVERY, CHECKOUT_FREE_SHIPPING_CENTS, CHECKOUT_ITEMS, CHECKOUT_PROMOS, CHECKOUT_TAX_BP,
  MAX_NOTE, MAX_QTY,
} from "../../sync/areas/checkout.ts";
import type { TemplateModule } from "../types.ts";
import { COMMON_WORDS, type CommonWords } from "./words.ts";

// Product artwork: the same inline placeholder for every item, as the Astryx CLI scaffolds it.
const PLACEHOLDER = "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20400%20300%22%20preserveAspectRatio%3D%22xMidYMid%20slice%22%3E%3Crect%20width%3D%22400%22%20height%3D%22300%22%20fill%3D%22%23f5f6f8%22%2F%3E%3Cg%20transform%3D%22translate%28200%20150%29%22%20fill%3D%22none%22%20stroke%3D%22%23c2cad6%22%20stroke-width%3D%225%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Crect%20x%3D%22-44%22%20y%3D%22-44%22%20width%3D%2288%22%20height%3D%2288%22%20rx%3D%2216%22%2F%3E%3Ccircle%20cx%3D%2218%22%20cy%3D%22-18%22%20r%3D%222.5%22%20fill%3D%22%23c2cad6%22%20stroke%3D%22none%22%2F%3E%3Cpath%20d%3D%22M-34%2030%20L-8%200%20L10%2018%20L20%208%20L34%2024%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E";

type CartItem = { id: string; name: string; variant: string; price: number; qty: number; src: string; isLimited: boolean };

// Names and prices come from the saved-data area (whole cents there; dollars here, as stock writes them).
const SAMPLE_CART: Record<string, { variant: string; qty: number; isLimited: boolean }> = {
  mug: { variant: "Hand-thrown · 12 oz", qty: 2, isLimited: false },
  plate: { variant: "Reactive glaze · 10 in", qty: 1, isLimited: false },
  bowl: { variant: "Speckled clay · 6 in", qty: 1, isLimited: true },
};
const CART_ITEMS: readonly CartItem[] = CHECKOUT_ITEMS.map((i) => ({ id: i.id, name: i.name, price: i.cents / 100, src: PLACEHOLDER, ...SAMPLE_CART[i.id]! }));

type StepIcon = "cart" | "pin" | "truck" | "card";
const STEPS: readonly { label: string; icon: StepIcon }[] = [
  { label: "Cart", icon: "cart" },
  { label: "Shipping", icon: "pin" },
  { label: "Delivery", icon: "truck" },
  { label: "Payment", icon: "card" },
];

const COUNTRIES = [
  { value: "us", label: "United States" },
  { value: "ca", label: "Canada" },
  { value: "uk", label: "United Kingdom" },
];

const US_STATES = ["California", "Illinois", "Massachusetts", "New York", "Oregon", "Texas", "Washington"];

const DELIVERY_META: Record<string, { label: string; window: string }> = {
  standard: { label: "Standard", window: "3–7 business days" },
  expedited: { label: "Expedited", window: "1–2 business days" },
  overnight: { label: "Overnight", window: "Next business day by 5pm" },
};
const DELIVERY_OPTIONS = CHECKOUT_DELIVERY.map((d) => ({ value: d.value, ...DELIVERY_META[d.value]!, price: d.cents / 100 }));

// Promo codes the store would validate server-side.
const PROMOS: readonly { code: string; label: string; rate: number }[] = CHECKOUT_PROMOS.map((p) => ({ code: p.code, label: `${p.code} · ${p.bp / 100}% off`, rate: p.bp / 10000 }));
const promoOf = (code: string | null) => PROMOS.find((p) => p.code === code);

const TAX_RATE = CHECKOUT_TAX_BP / 10000;
const FREE_SHIPPING_THRESHOLD = CHECKOUT_FREE_SHIPPING_CENTS / 100;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type PostalRule = { label: string; placeholder: string; pattern: RegExp; error: string };
const POSTAL_CODE_RULES: Record<string, PostalRule> = {
  us: {
    label: "ZIP code",
    placeholder: "10001",
    pattern: /^\d{5}(?:-\d{4})?$/,
    error: "Enter a 5-digit ZIP code, with an optional 4-digit suffix.",
  },
  ca: {
    label: "Postal code",
    placeholder: "K1A 0B1",
    pattern: /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ -]?\d[ABCEGHJ-NPRSTV-Z]\d$/i,
    error: "Enter a Canadian postal code, for example K1A 0B1.",
  },
  uk: {
    label: "Postcode",
    placeholder: "SW1A 1AA",
    pattern: /^(?:GIR\s?0AA|[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})$/i,
    error: "Enter a UK postcode, for example SW1A 1AA.",
  },
};

const money = (n: number) => `$${n.toFixed(2)}`;

// The footer summarises rather than quoting a field's message.
const blockedMessage = (count: number) => (count === 1 ? "One problem above needs fixing first." : `${count} problems above need fixing first.`);

const ADDRESS_FIELDS = ["email", "firstName", "lastName", "address", "apartment", "city", "state", "postalCode", "country"] as const;
type AddressField = (typeof ADDRESS_FIELDS)[number];
/** The card's fields: view state only, never saved. */
const CARD_FIELDS = ["cardNumber", "cardName", "expiry", "cvc"] as const;
type CardField = (typeof CARD_FIELDS)[number];
const TEXT_FIELDS = [...ADDRESS_FIELDS, "deliveryNote", ...CARD_FIELDS] as const;

/** The cart, as it was when the order was placed: the confirmation and the summary keep showing it after the cart is emptied. */
type PlacedCart = { quantities: Record<string, number>; appliedPromo: string | null; delivery: string; isGift: boolean; deliveryNote: string };

/** The view state: the step, what was tried, validation, the promo text being typed and the card. The cart and the address are saved data. */
export type CheckoutState = {
  step: number;
  /** Steps whose Continue (or a jump past them) has been tried, in the order tried. */
  attempted: number[];
  /** Text fields the person has left, in the order they left them: their errors show without Continue. */
  touched: string[];
  isComplete: boolean;
  /** The promo code being typed; null shows the saved code. */
  promoInput: string | null;
  promoWasChecked: boolean;
  billingMatches: boolean;
  /** Bumped when the page should move focus to the first invalid field of the current step. */
  focusTicket: number;
  /** Set when the order is placed. */
  placed: PlacedCart | null;
} & Record<CardField, string>;

/** The saved cart and address (or, once the order is placed, the placed cart): everything the logic reads. */
type Saved = PlacedCart & Record<AddressField, string>;
/** The view state with the saved data under it. */
type Live = CheckoutState & Saved;

const isQtyValue = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= MAX_QTY;
const textOf = (v: unknown, max: number): string | null => (typeof v === "string" && v.length <= max ? v : null);

/** The saved data laid over the sample cart. A row that does not fit is ignored, so a bad row from another device draws nothing odd. */
function savedOf(doc: Doc | undefined): Saved {
  const cart = doc?.checkout_cart?.cart;
  const address = doc?.checkout_address?.shipping;
  const promo = cart?.promo;
  const delivery = cart?.delivery;
  const country = address?.country;
  const field = (name: AddressField): string => {
    if (name === "country") return typeof country === "string" && (CHECKOUT_COUNTRIES as readonly string[]).includes(country) ? country : "us";
    return textOf(address?.[name], CHECKOUT_ADDRESS_FIELDS[name]) ?? "";
  };
  return {
    quantities: Object.fromEntries(CART_ITEMS.map((item) => {
      const qty = doc?.checkout_line?.[item.id]?.qty;
      return [item.id, isQtyValue(qty) ? qty : item.qty];
    })),
    appliedPromo: typeof promo === "string" && promoOf(promo) ? promo : null,
    delivery: typeof delivery === "string" && DELIVERY_OPTIONS.some((o) => o.value === delivery) ? delivery : "standard",
    isGift: cart?.gift === true,
    deliveryNote: textOf(cart?.note, MAX_NOTE) ?? "",
    email: field("email"), firstName: field("firstName"), lastName: field("lastName"), address: field("address"), apartment: field("apartment"),
    city: field("city"), state: field("state"), postalCode: field("postalCode"), country: field("country"),
  };
}

function liveOf(s: CheckoutState, doc: Doc | undefined): Live {
  const saved = savedOf(doc);
  return { ...s, ...saved, ...(s.placed ?? {}) };
}

type Errors = Record<string, string>;

function itemsOf(s: Live) {
  return CART_ITEMS.map((item) => ({ ...item, qty: s.quantities[item.id] ?? item.qty })).filter((item) => item.qty > 0);
}

/** The sums, in dollars as floats and exactly as stock works them out. */
function pricing(s: Live) {
  const items = itemsOf(s);
  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const promo = promoOf(s.appliedPromo);
  const discount = promo ? subtotal * promo.rate : 0;
  const deliveryOption = DELIVERY_OPTIONS.find((o) => o.value === s.delivery) ?? DELIVERY_OPTIONS[0]!;
  const shipping = subtotal - discount >= FREE_SHIPPING_THRESHOLD && s.delivery === "standard" ? 0 : deliveryOption.price;
  const tax = (subtotal - discount) * TAX_RATE;
  const total = subtotal - discount + shipping + tax;
  const itemCount = items.reduce((sum, item) => sum + item.qty, 0);
  return { items, subtotal, promo, discount, deliveryOption, shipping, tax, total, itemCount };
}

function errorsByStep(s: Live): Errors[] {
  const cart: Errors = {};
  if (itemsOf(s).length === 0) cart.items = "Your cart is empty.";

  const shipping: Errors = {};
  if (!EMAIL_PATTERN.test(s.email)) shipping.email = "Enter an email address for order updates.";
  if (!s.firstName.trim()) shipping.firstName = "Required";
  if (!s.lastName.trim()) shipping.lastName = "Required";
  if (!s.address.trim()) shipping.address = "Required";
  if (!s.city.trim()) shipping.city = "Required";
  if (s.country === "us" && !s.state) shipping.state = "Required";
  const rule = POSTAL_CODE_RULES[s.country] ?? POSTAL_CODE_RULES.us!;
  if (!rule.pattern.test(s.postalCode.trim())) shipping.postalCode = rule.error;

  const delivery: Errors = {};
  if (s.delivery === "overnight" && s.country !== "us") delivery.delivery = "Overnight delivery is only available in the US.";

  const payment: Errors = {};
  if (s.cardNumber.replace(/\s/g, "").length < 15) payment.cardNumber = "Enter the full card number.";
  if (!s.cardName.trim()) payment.cardName = "Enter the name printed on the card.";
  if (!/^\d{2}\s?\/\s?\d{2}$/.test(s.expiry.trim())) payment.expiry = "Use MM/YY.";
  if (!/^\d{3,4}$/.test(s.cvc.trim())) payment.cvc = "3 or 4 digits.";

  return [cart, shipping, delivery, payment];
}

const shownErrors = (s: Live, errors: Errors[], index: number): Errors => (s.attempted.includes(index) ? errors[index]! : {});

/** What the current step shows: all its errors once Continue was tried, else only those of fields the person left. */
function visibleErrors(s: Live, errors: Errors[], index: number): Errors {
  if (s.attempted.includes(index)) return errors[index]!;
  return Object.fromEntries(Object.entries(errors[index]!).filter(([field]) => s.touched.includes(field)));
}
const count = (e: Errors) => Object.keys(e).length;

function markAttempted(s: CheckoutState, indices: number[]): number[] {
  const next = [...s.attempted];
  for (const i of indices) if (!next.includes(i)) next.push(i);
  return next;
}

function goNext(s: CheckoutState, live: Live): CheckoutState {
  const attempted = markAttempted(s, [s.step]);
  if (count(errorsByStep(live)[s.step]!) > 0) return { ...s, attempted, focusTicket: s.focusTicket + 1 };
  if (s.step === STEPS.length - 1) return { ...s, attempted, isComplete: true };
  return { ...s, attempted, step: s.step + 1 };
}

function goTo(s: CheckoutState, live: Live, index: number): CheckoutState {
  if (index <= s.step) return { ...s, step: index };
  const errors = errorsByStep(live);
  const checked: number[] = [];
  let firstInvalid: number | null = null;
  for (let candidate = s.step; candidate < index; candidate += 1) {
    checked.push(candidate);
    if (count(errors[candidate]!) > 0) {
      firstInvalid = candidate;
      break;
    }
  }
  const attempted = markAttempted(s, checked);
  if (firstInvalid != null) return { ...s, attempted, step: firstInvalid, focusTicket: s.focusTicket + 1 };
  return { ...s, attempted, step: index };
}

export type CheckoutView = {
  step: number;
  isLastStep: boolean;
  isComplete: boolean;
  /** Changes when focus should move to the first invalid field of the current step. */
  focusTicket: number;
  /** What a screen reader says of each step: "Shipping, step 2 of 4", and its state ("Current step, Has problems"). */
  steps: { label: string; icon: StepIcon; hasError: boolean; spoken: string; state: string }[];
  /** The errors showing for the current step, by field: all of them once Continue was tried, else those of fields the person left. */
  errors: Record<string, string>;
  /** The current step's text fields in the order they sit on the page: the Return key moves along it. */
  fieldOrder: string[];
  items: {
    id: string; name: string; variant: string; src: string; qty: number; isLimited: boolean; priceEach: string; lineTotal: string;
    /** "Remove <name>" and "Quantity of <name>", for a screen reader. */
    removeLabel: string; quantityLabel: string;
  }[];
  /**
   * With saving on, a cart an order emptied has a way back: the label of the button that puts the sample
   * items in again (press `refill`). Null otherwise, and always null without extras (stock has no such button).
   */
  refillLabel: string | null;
  summary: {
    itemCount: string;
    trigger: string;
    subtotal: string;
    promoLabel: string | null;
    discount: string;
    /** The method alone: the page adds " delivery" as its own text, as the stock markup does. */
    deliveryLabel: string;
    shipping: string;
    tax: string;
    total: string;
    freeShippingTitle: string | null;
  };
  actions: { blocked: string | null; backLabel: string; nextLabel: string };
  promo: { value: string; status: { type: "success" | "warning"; message: string } | null };
  shipping: {
    email: string; firstName: string; lastName: string; country: string; address: string; apartment: string;
    city: string; state: string; postalCode: string;
    countries: { value: string; label: string }[];
    states: string[];
    hasState: boolean;
    postalLabel: string;
    postalPlaceholder: string;
  };
  delivery: {
    value: string;
    options: { value: string; label: string; window: string; price: string }[];
    isGift: boolean;
    note: string;
    noteLabel: string;
    notePlaceholder: string;
    noteDescription: string;
  };
  payment: { cardNumber: string; cardName: string; expiry: string; cvc: string; billingMatches: boolean };
  confirmation: string;
  /** The words both drawings write: the web page reads them where Astryx's stock markup has them inline. */
  words: CheckoutWords;
  /** The layout numbers both drawings keep from Astryx's stock template. */
  rules: CheckoutRules;
  /**
   * True when the page's own heading says what the screen's navigation title already says: a host
   * with a title bar draws the title there and leaves the heading out. (The web page keeps its heading.)
   */
  headingRepeatsTitle: boolean;
};
export type View = CheckoutView;

/**
 * The layout numbers the stock page keeps and the native drawing repeats. Only thresholds and
 * fixed sizes are shared; each drawing measures its own widths and compares them with these.
 */
export type CheckoutRules = {
  /** The page stacks (summary first, one-column name rows) when its host is at most this wide, in points. */
  narrowHostAtMost: number;
  /** The page's content is capped at this width. */
  contentWidth: number;
  /** The order summary's width beside the form (a wide host). */
  summaryWidth: number;
  /**
   * The step indicator collapses to bars and the current step's name when each of its steps would get
   * less than this much of the form column. (Astryx's own Stepper holds the same number as its default;
   * the web page leaves the choice to it, the native drawing reads this.)
   */
  stepperMinStepWidth: number;
  /** A line item's quantity: the least, the most, and the field's width. */
  quantity: { min: number; max: number; fieldWidth: number };
  /** The delivery note's length limit. */
  noteMaxLength: number;
  /** The expiry and CVC fields' width. */
  shortFieldWidth: number;
};

const RULES: CheckoutRules = {
  narrowHostAtMost: 900,
  contentWidth: 1000,
  summaryWidth: 360,
  stepperMinStepWidth: 112,
  quantity: { min: 0, max: 10, fieldWidth: 96 },
  noteMaxLength: 240,
  shortFieldWidth: 140,
};

export type CheckoutWords = CommonWords & {
  /** The page heading (the stock page writes it inline). */
  title: string;
  secureCheckout: string;
  progress: string;
  cart: {
    heading: string; limited: string; remove: string; promoLabel: string; promoPlaceholder: string; apply: string; quantity: string;
    /** The button that fills an emptied cart again (shown only with saving on). */
    refill: string;
    /** Follows a unit price: "$78.00 each". */
    each: string;
  };
  shipping: {
    heading: string; detail: string; email: string; emailPlaceholder: string; emailHint: string; firstName: string; lastName: string;
    country: string; address: string; addressPlaceholder: string; apartment: string; city: string; state: string; statePlaceholder: string;
  };
  delivery: { heading: string; detail: string; method: string; gift: string };
  payment: {
    heading: string; detail: string; cardNumber: string; cardNumberPlaceholder: string; cardName: string; expiry: string;
    expiryPlaceholder: string; cvc: string; cvcPlaceholder: string; cvcInfoLabel: string; cvcInfo: string; billingMatches: string;
    billingTitle: string; billingDetail: string;
  };
  confirmed: {
    title: string; heading: string;
    /** The ending's sentence for a host that has an app's state to speak of. */
    detail: string;
    /** The stock page's own sentence, which speaks of "this page's component state": the web drawing writes it. */
    pageDetail: string;
  };
  summary: { title: string; subtotal: string; deliverySuffix: string; tax: string; total: string; qty: string };
};

const TITLE = "Checkout";

const WORDS: CheckoutWords = {
  ...COMMON_WORDS,
  title: TITLE,
  secureCheckout: "Secure checkout",
  progress: "Checkout progress",
  cart: {
    heading: "Review your cart", limited: "Limited", remove: "Remove", promoLabel: "Promo code", promoPlaceholder: "WELCOME10",
    apply: "Apply", quantity: "Quantity", each: "each", refill: "Refill cart",
  },
  shipping: {
    heading: "Where should it go?",
    detail: "Delivery options and tax are calculated from this address.",
    email: "Email",
    emailPlaceholder: "you@example.com",
    emailHint: "Order confirmation and tracking go here.",
    firstName: "First name",
    lastName: "Last name",
    country: "Country",
    address: "Street address",
    addressPlaceholder: "123 Main Street",
    apartment: "Apartment, suite, etc.",
    city: "City",
    state: "State",
    statePlaceholder: "Select state",
  },
  delivery: {
    heading: "How fast do you need it?",
    detail: "Estimates run from the day the order ships, usually 1–3 business days after you place it.",
    method: "Delivery method",
    gift: "This is a gift",
  },
  payment: {
    heading: "Payment",
    detail: "This template validates payment details and completes locally. No card is charged.",
    cardNumber: "Card number",
    cardNumberPlaceholder: "4242 4242 4242 4242",
    cardName: "Name on card",
    expiry: "Expiry",
    expiryPlaceholder: "MM/YY",
    cvc: "CVC",
    cvcPlaceholder: "123",
    cvcInfoLabel: "About CVC",
    cvcInfo: "Three digits on the back of the card, or four on the front for American Express.",
    billingMatches: "Billing address matches the shipping address",
    billingTitle: "Connect a billing-address step",
    billingDetail: "This local example does not collect a separate billing address or send payment. Add that flow with your payment provider.",
  },
  confirmed: {
    title: "Order confirmed",
    heading: "Thanks for your order",
    detail: "The order is recorded in the app's state, so the template ends in a real, reviewable outcome.",
    pageDetail: "The completion is stored in this page's component state so the template ends in a real, reviewable outcome.",
  },
  summary: { title: "Order summary", subtotal: "Subtotal", deliverySuffix: "delivery", tax: "Estimated tax", total: "Total", qty: "Qty" },
};

/** The text fields of each step in the order they sit on the page (the select menus are not text fields). */
const FIELD_ORDER: Record<number, readonly string[]> = {
  1: ["email", "firstName", "lastName", "address", "apartment", "city", "postalCode"],
  3: ["cardNumber", "cardName", "expiry", "cvc"],
};

export const checkout: TemplateModule<CheckoutState, CheckoutView> = {
  id: "checkout",
  astryx: "checkout-wizard",
  title: TITLE,
  initial: () => ({
    step: 0,
    attempted: [],
    touched: [],
    isComplete: false,
    promoInput: null,
    promoWasChecked: false,
    billingMatches: true,
    cardNumber: "",
    cardName: "",
    expiry: "",
    cvc: "",
    focusTicket: 0,
    placed: null,
  }),

  reduce(s, action, now, io) {
    const live = liveOf(s, io?.doc);
    // A saved change is asked for only when it differs from what is saved (typing the same letter twice writes once).
    const save = io ? io.save : () => {};
    if (action.type === "press") {
      const [verb, arg = ""] = splitOnce(action.id);
      switch (verb) {
        case "next": {
          const next = goNext(s, live);
          if (!next.isComplete || s.isComplete) return next;
          // The last Continue: with saving on, the order is recorded and the cart emptied. The cart as it
          // was stays with the view state, so the confirmation and the summary still show what was bought.
          const { quantities, appliedPromo, delivery, isGift, deliveryNote } = live;
          if (io?.extras) {
            const lines = itemsOf(live).map((i) => ({ item: i.id, qty: i.qty }));
            save("checkout.place", { id: io.mint(), at: now.epochMs, lines, promo: appliedPromo ?? "", delivery, gift: isGift });
          }
          return { ...next, placed: { quantities, appliedPromo, delivery, isGift, deliveryNote } };
        }
        case "back":
          return { ...s, step: Math.max(0, s.step - 1) };
        case "goto": {
          const index = Number(arg);
          return Number.isInteger(index) && index >= 0 && index < STEPS.length ? goTo(s, live, index) : s;
        }
        case "apply": {
          const code = (s.promoInput ?? live.appliedPromo ?? "").trim().toUpperCase();
          const applied = promoOf(code) ? code : null;
          if (applied !== live.appliedPromo) save("checkout.promo", { code: applied ?? "" });
          return { ...s, promoWasChecked: code.length > 0 };
        }
        case "blur":
          return (TEXT_FIELDS as readonly string[]).includes(arg) && !s.touched.includes(arg) ? { ...s, touched: [...s.touched, arg] } : s;
        case "remove":
          if (CART_ITEMS.some((item) => item.id === arg) && live.quantities[arg] !== 0) save("checkout.qty", { item: arg, qty: 0 });
          return s;
        case "refill":
          // Only with saving on, and only for a cart with nothing in it.
          if (io?.extras && itemsOf(live).length === 0 && !s.isComplete) for (const item of CART_ITEMS) save("checkout.qty", { item: item.id, qty: item.qty });
          return s;
        default:
          return s;
      }
    }
    const { id, value } = action;
    if ((CARD_FIELDS as readonly string[]).includes(id)) return { ...s, [id]: String(value) };
    if ((ADDRESS_FIELDS as readonly string[]).includes(id)) {
      const field = id as AddressField;
      const text = String(value);
      if (text.length > CHECKOUT_ADDRESS_FIELDS[field] || (field === "country" && !(CHECKOUT_COUNTRIES as readonly string[]).includes(text))) return s;
      if (text !== live[field]) save("checkout.address", { field, value: text });
      return s;
    }
    switch (id) {
      case "deliveryNote": {
        const text = String(value).slice(0, MAX_NOTE);
        if (text !== live.deliveryNote) save("checkout.note", { text });
        return s;
      }
      case "promo":
        // Typing takes the applied code off until Apply is pressed again.
        if (live.appliedPromo !== null) save("checkout.promo", { code: "" });
        return { ...s, promoInput: String(value), promoWasChecked: false };
      case "delivery":
        if (DELIVERY_OPTIONS.some((o) => o.value === value) && value !== live.delivery) save("checkout.delivery", { value });
        return s;
      case "isGift":
        if ((value === true) !== live.isGift) save("checkout.gift", { value: value === true });
        return s;
      case "billingMatches":
        return { ...s, billingMatches: value === true };
    }
    const [verb, arg = ""] = splitOnce(id);
    if (verb === "qty" && CART_ITEMS.some((item) => item.id === arg)) {
      const n = Number(value);
      if (!Number.isFinite(n)) return s;
      const qty = Math.max(0, Math.min(MAX_QTY, Math.round(n)));
      if (qty !== live.quantities[arg]) save("checkout.qty", { item: arg, qty });
    }
    return s;
  },

  view(s, _now, doc, extras = true) {
    const live = liveOf(s, doc);
    const { items, subtotal, promo, discount, deliveryOption, shipping, tax, total, itemCount } = pricing(live);
    const rule = POSTAL_CODE_RULES[live.country] ?? POSTAL_CODE_RULES.us!;
    const promoText = s.promoInput ?? live.appliedPromo ?? "";

    const all = errorsByStep(live);
    const errors = visibleErrors(live, all, s.step);
    const isLastStep = s.step === STEPS.length - 1;

    let promoStatus: CheckoutView["promo"]["status"] = null;
    if (promo) promoStatus = { type: "success", message: `${promo.label} applied.` };
    else if (promoText.trim() && s.promoWasChecked) promoStatus = { type: "warning", message: "That promo code is not valid." };
    else if (promoText.trim()) promoStatus = { type: "warning", message: "Press Apply to check this code." };

    return {
      step: s.step,
      isLastStep,
      isComplete: s.isComplete,
      focusTicket: s.focusTicket,
      steps: STEPS.map((step, i) => {
        const hasError = count(shownErrors(live, all, i)) > 0;
        return {
          label: step.label,
          icon: step.icon,
          hasError,
          spoken: `${step.label}, step ${i + 1} of ${STEPS.length}`,
          state: [i === s.step ? "Current step" : null, hasError ? "Has problems" : null].filter(Boolean).join(", "),
        };
      }),
      errors,
      fieldOrder: [...(FIELD_ORDER[s.step] ?? [])],
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        variant: item.variant,
        src: item.src,
        qty: item.qty,
        isLimited: item.isLimited,
        priceEach: money(item.price),
        lineTotal: money(item.price * item.qty),
        removeLabel: `Remove ${item.name}`,
        quantityLabel: `Quantity of ${item.name}`,
      })),
      refillLabel: extras && items.length === 0 && !s.isComplete ? WORDS.cart.refill : null,
      summary: {
        itemCount: `${itemCount} ${itemCount === 1 ? "item" : "items"}`,
        trigger: `Order summary · ${money(total)}`,
        subtotal: money(subtotal),
        promoLabel: promo ? promo.label : null,
        discount: `−${money(discount)}`,
        deliveryLabel: deliveryOption.label,
        shipping: shipping === 0 ? "Free" : money(shipping),
        tax: money(tax),
        total: money(total),
        freeShippingTitle:
          subtotal - discount < FREE_SHIPPING_THRESHOLD ? `${money(FREE_SHIPPING_THRESHOLD - (subtotal - discount))} away from free standard shipping` : null,
      },
      actions: {
        blocked: count(shownErrors(live, all, s.step)) > 0 ? blockedMessage(count(shownErrors(live, all, s.step))) : null,
        backLabel: s.step === 0 ? "Continue shopping" : "Back",
        nextLabel: isLastStep ? `Pay ${money(total)}` : "Continue",
      },
      promo: { value: promoText, status: promoStatus },
      shipping: {
        email: live.email,
        firstName: live.firstName,
        lastName: live.lastName,
        country: live.country,
        address: live.address,
        apartment: live.apartment,
        city: live.city,
        state: live.state,
        postalCode: live.postalCode,
        countries: COUNTRIES.map((c) => ({ ...c })),
        states: [...US_STATES],
        hasState: live.country === "us",
        postalLabel: rule.label,
        postalPlaceholder: rule.placeholder,
      },
      delivery: {
        value: live.delivery,
        options: DELIVERY_OPTIONS.map((o) => ({
          value: o.value,
          label: o.label,
          window: o.window,
          price: o.value === "standard" && subtotal - discount >= FREE_SHIPPING_THRESHOLD ? "Free" : money(o.price),
        })),
        isGift: live.isGift,
        note: live.deliveryNote,
        noteLabel: live.isGift ? "Gift message" : "Delivery instructions",
        notePlaceholder: live.isGift ? "Happy birthday — hope these get plenty of use." : "Leave with the neighbour at number 14.",
        noteDescription: live.isGift
          ? "Printed on a card. Prices are left off the packing slip."
          : "Passed to the carrier where they support it.",
      },
      payment: { cardNumber: s.cardNumber, cardName: s.cardName, expiry: s.expiry, cvc: s.cvc, billingMatches: s.billingMatches },
      confirmation: `This local example completed an order for ${money(total)}. No payment was sent.`,
      words: WORDS,
      rules: RULES,
      headingRepeatsTitle: WORDS.title === TITLE,
    };
  },
};

/** "goto:2" -> ["goto", "2"]. */
function splitOnce(id: string): [string, string?] {
  const i = id.indexOf(":");
  return i < 0 ? [id] : [id.slice(0, i), id.slice(i + 1)];
}
