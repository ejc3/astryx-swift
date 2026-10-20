/**
 * Astryx's `detail-page` template, refactored: its state, sample data and logic, here.
 * The JSX is web/src/templates/order.tsx; the stock copy is web/src/stock/templates/detail-page.tsx.
 *
 * Actions (the "tpl.order." prefix removed):
 *   set    tab <value>            the selected tab ("details", "invoices", "timeline", "customer", "analysis")
 *   press  panel:side             show or hide the side panel (wide windows)
 *   press  panel:dialog           open or close the panel's dialog (narrow windows)
 *   set    panelDialog <boolean>  the dialog asked to open or close
 *
 * Which of the two panels is on screen depends on the window's width, which only the host
 * knows, so the state keeps both flags and the host picks.
 */
import type { TemplateModule } from "../types.ts";
import { COMMON_WORDS, type CommonWords } from "../checkout/words.ts";

/** One picture stands in for every product. */
const PRODUCT_IMAGE =
  'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20400%20300%22%20preserveAspectRatio%3D%22xMidYMid%20slice%22%3E%3Crect%20width%3D%22400%22%20height%3D%22300%22%20fill%3D%22%23f5f6f8%22%2F%3E%3Cg%20transform%3D%22translate%28200%20150%29%22%20fill%3D%22none%22%20stroke%3D%22%23c2cad6%22%20stroke-width%3D%225%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Crect%20x%3D%22-44%22%20y%3D%22-44%22%20width%3D%2288%22%20height%3D%2288%22%20rx%3D%2216%22%2F%3E%3Ccircle%20cx%3D%2218%22%20cy%3D%22-18%22%20r%3D%222.5%22%20fill%3D%22%23c2cad6%22%20stroke%3D%22none%22%2F%3E%3Cpath%20d%3D%22M-34%2030%20L-8%200%20L10%2018%20L20%208%20L34%2024%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E';

type Product = { name: string; details: string; price: number; qty: number };

const PRODUCTS: readonly Product[] = [
  { name: "Solstice Mug", details: "Glaze: Snow\nFinish: Matte", price: 89.0, qty: 1 },
  { name: "Ember Bowl", details: "Glaze: Sage\nSize: 6 in", price: 42.0, qty: 2 },
  { name: "Terra Cup", details: "Glaze: Oat\nSize: 14 in", price: 65.0, qty: 1 },
  { name: "Dawn Plate Set", details: "Glaze: Charcoal\nCapacity: 3 oz", price: 34.0, qty: 3 },
  { name: "Kiln Salad Bowl", details: "Glaze: Snow\nHeight: 8 in", price: 78.0, qty: 1 },
];

const SUBTOTAL = PRODUCTS.reduce((sum, p) => sum + p.price * p.qty, 0);
const DISCOUNT = 15.0;
const SHIPPING = 0;
const TAX_RATE = 0.0825;
const TAX = Math.round((SUBTOTAL - DISCOUNT) * TAX_RATE * 100) / 100;
const TOTAL = SUBTOTAL - DISCOUNT + SHIPPING + TAX;
const fmt = (n: number) => `$${n.toFixed(2)}`;

type Activity = { type: "event" | "comment" | "update"; user: string; text: string; reactions?: number; time: string; changes?: string[] };

const ACTIVITY: readonly Activity[] = [
  { type: "event", user: "Jane Doe", text: "placed order #1001", reactions: 2, time: "Feb 23 at 9:12 AM" },
  {
    type: "comment",
    user: "Alex Rivera",
    text: "Customer requested gift wrapping for the mug & plate set. I've added a note to the packing slip — warehouse team should wrap in recycled kraft paper.",
    reactions: 3,
    time: "Feb 23 at 10:45 AM",
  },
  {
    type: "update",
    user: "System",
    text: "has several information changes",
    time: "Feb 23 at 11:30 AM",
    changes: ["Payment verified via Visa ...7482", "Fraud check passed — low risk"],
  },
  { type: "event", user: "Alex Rivera", text: "marked order as ready for fulfillment", reactions: 1, time: "Feb 23 at 2:15 PM" },
];

const TABS = ["details", "invoices", "timeline", "customer", "analysis"] as const;

export type OrderState = {
  tab: string;
  /** Wide windows: the side panel is shown. */
  sidePanel: boolean;
  /** Narrow windows: the panel's dialog is open. */
  panelDialog: boolean;
};

export type OrderView = {
  tab: string;
  sidePanel: boolean;
  panelDialog: boolean;
  /** The order number as the heading shows it. */
  number: string;
  /** How many items the order has: the page says "5 ordered items", "5 items". */
  itemCount: number;
  customerName: string;
  status: string;
  date: string;
  flag: string;
  products: { name: string; image: string; lines: string[]; amount: string; unit: (string | number)[] }[];
  /** The invoice's summary rows. */
  /** Notes and units are lists of parts, drawn one after another (a count, then its unit). */
  summary: { label: string; note: (string | number)[] | null; amount: string; strong: boolean }[];
  paidBy: { label: string; note: string; amount: string };
  /** `reactionsLabel` is what a screen reader says of the reactions: "3 reactions", or "Reactions" with no count. */
  activity: { user: string; text: string; changes: string[] | null; reactions: number | null; reactionsLabel: string; time: string }[];
  notes: string;
  customer: { label: string; value: string }[];
  fraud: { risk: number; riskValue: string; recommendation: string; detail: string };
  /** The tabs in order; the last two sit behind a More menu. */
  tabs: { value: string; label: string; more: boolean }[];
  /** "5 ordered items", the facts line's first fact. */
  itemsLabel: string;
  /** `itemsLabel` as the separate text nodes the stock template draws ("5", " ordered items"): the web page draws these. */
  itemsLabelParts: string[];
  /** Controls that do nothing in the stock template and stay inert here: a host draws them disabled. */
  inert: string[];
  /** The words both drawings write: the web page reads them where Astryx's stock markup has them inline. */
  words: OrderWords;
  /** The layout numbers both drawings keep from Astryx's stock template. */
  rules: OrderRules;
};
export type View = OrderView;

/**
 * Where the page goes narrow, and the sizes it keeps. The stock page asks the viewport
 * (`max-width: 1024px`); a native drawing measures its own pane against `paneNarrowBelow`, so
 * the two thresholds are different numbers for the same decision (the panel beside the page, or
 * a dialog, and the header's buttons beside the facts, or below them). Each drawing compares its own width.
 */
export type OrderRules = {
  /** The web page is narrow when the viewport is at most this wide, in CSS pixels. */
  viewportNarrowAtMost: number;
  /** A drawing that measures its own width is narrow below this, in points: the page and the panel cannot sit side by side. */
  paneNarrowBelow: number;
  /** The page's content is capped at this width. */
  contentWidth: number;
  /** The side panel's width. */
  panelWidth: number;
};

const RULES: OrderRules = { viewportNarrowAtMost: 1024, paneNarrowBelow: 760, contentWidth: 1000, panelWidth: 320 };

export type OrderWords = CommonWords & {
  allOrders: string;
  restock: string;
  edit: string;
  seeAll: string;
  date: string;
  showPanel: string;
  hidePanel: string;
  more: string;
  panelTitle: string;
  items: string;
  fulfillItem: string;
  createLabel: string;
  invoice: string;
  paid: string;
  refund: string;
  sendInvoice: string;
  timeline: string;
  filters: string;
  like: string;
  reply: string;
  reactions: string;
  notes: string;
  showMore: string;
  customer: string;
  fraudAnalysis: string;
  riskLevel: string;
};

const WORDS: OrderWords = {
  ...COMMON_WORDS,
  allOrders: "All orders",
  restock: "Restock",
  edit: "Edit",
  seeAll: "See all",
  date: "Date",
  showPanel: "Show panel",
  hidePanel: "Hide panel",
  more: "More",
  panelTitle: "Order details",
  items: "Items",
  fulfillItem: "Fulfill item",
  createLabel: "Create label",
  invoice: "Invoice",
  paid: "Paid",
  refund: "Refund",
  sendInvoice: "Send Invoice",
  timeline: "Timeline",
  filters: "Filters",
  like: "Like",
  reply: "Reply",
  reactions: "Reactions",
  notes: "Notes",
  showMore: "Show more",
  customer: "Customer",
  fraudAnalysis: "Fraud Analysis",
  riskLevel: "Risk level",
};

const TAB_LABELS: Record<(typeof TABS)[number], string> = {
  details: "Details", invoices: "Invoices", timeline: "Timeline", customer: "Customer", analysis: "Analysis",
};

export const order: TemplateModule<OrderState, OrderView> = {
  id: "order",
  astryx: "detail-page",
  title: "Order detail",
  initial: () => ({ tab: "details", sidePanel: true, panelDialog: false }),
  reduce(s, action) {
    if (action.type === "press") {
      if (action.id === "panel:side") return { ...s, sidePanel: !s.sidePanel };
      if (action.id === "panel:dialog") return { ...s, panelDialog: !s.panelDialog };
      return s;
    }
    if (action.id === "tab") {
      const tab = String(action.value);
      return (TABS as readonly string[]).includes(tab) && tab !== s.tab ? { ...s, tab } : s;
    }
    if (action.id === "panelDialog") {
      const open = action.value === true;
      return open === s.panelDialog ? s : { ...s, panelDialog: open };
    }
    return s;
  },
  view: (s) => ({
    tab: s.tab,
    sidePanel: s.sidePanel,
    panelDialog: s.panelDialog,
    number: "#1001",
    itemCount: PRODUCTS.length,
    customerName: "Jane Doe",
    status: "Unfulfilled",
    date: "02/23/2026",
    flag: "Needs attention",
    products: PRODUCTS.map((p) => ({
      name: p.name,
      image: PRODUCT_IMAGE,
      lines: p.details.split("\n"),
      amount: fmt(p.price * p.qty),
      unit: [fmt(p.price), " ", "×", " ", p.qty],
    })),
    summary: [
      { label: "Subtotal", note: [PRODUCTS.length, " items"], amount: fmt(SUBTOTAL), strong: false },
      { label: "Discount", note: ["New customer code: NEW15"], amount: `– ${fmt(DISCOUNT)}`, strong: false },
      { label: "Shipping", note: ["Free shipping (0.0lbs) USPS"], amount: fmt(SHIPPING), strong: false },
      { label: "Tax", note: ["Sales tax (8.25%)"], amount: fmt(TAX), strong: false },
      { label: "Total", note: null, amount: fmt(TOTAL), strong: true },
    ],
    paidBy: { label: "Paid by customer", note: "Visa ...7482", amount: fmt(TOTAL) },
    activity: ACTIVITY.map((a) => ({
      user: a.user,
      text: a.text,
      changes: a.changes ? [...a.changes] : null,
      reactions: a.reactions ?? null,
      reactionsLabel: a.reactions == null ? "Reactions" : `${a.reactions} ${a.reactions === 1 ? "reaction" : "reactions"}`,
      time: a.time,
    })),
    notes:
      "Customer is a repeat buyer — 3rd order this quarter. Prefers snow and oat glazes. Requested gift wrapping for the mug set. Ships to a residential address in CA.",
    customer: [
      { label: "Name", value: "Jane Doe" },
      { label: "Address", value: "321 Smith Road, CA 38238" },
      { label: "Phone", value: "234-" },
      { label: "Email", value: "janedoe@email.com" },
      { label: "Billing Address", value: "Same as shipping address" },
    ],
    fraud: {
      risk: 15,
      riskValue: "15 percent",
      recommendation: "Recommendation: Fulfill order",
      detail: "There is a low chance that you will receive a chargeback on this order.",
    },
    tabs: TABS.map((value, i) => ({ value, label: TAB_LABELS[value], more: i >= 3 })),
    itemsLabel: `${PRODUCTS.length} ordered items`,
    itemsLabelParts: [String(PRODUCTS.length), " ordered items"],
    // Refund moves money out and cannot be undone: if it is ever wired, it needs a destructive confirmation.
    inert: ["allOrders", "restock", "edit", "seeAll", "fulfill", "label", "refund", "invoice", "filters", "like", "reply"],
    words: WORDS,
    rules: RULES,
  }),
};
