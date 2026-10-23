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
 *
 * With saving on (docs/SYNC.md; core/src/sync/areas/order.ts) four more things work and are
 * saved on the action that makes them (the notes on Save, the others at once):
 *   set    notes <text>           the notes being edited (a draft, view state)
 *   press  notesSave              keep the draft as the order's notes
 *   press  fulfill                mark the next item that is not fulfilled; the status words follow
 *   press  like:<entry id>        like or unlike a timeline entry
 *   press  reply:<entry id>       open (or close) the reply box under an entry
 *   set    replyText <text>       the reply being written (view state)
 *   press  replySend | replyCancel
 * Refund, Restock, Edit, Create label, Send Invoice, Filters, All orders and See all stay inert:
 * there is no backend behind them. Without extras everything is as stock draws it.
 */
import { ago, civilOf, minuteOf, type Now } from "../../format.ts";
import type { Doc } from "../../sync/doc.ts";
import { MAX_ORDER_NOTES, MAX_ORDER_REPLY, ORDER_ACTIVITY_IDS, ORDER_PRODUCT_IDS } from "../../sync/areas/order.ts";
import type { TemplateModule } from "../types.ts";
import { COMMON_WORDS, type CommonWords } from "../checkout/words.ts";

/** One picture stands in for every product. */
const PRODUCT_IMAGE =
  'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20400%20300%22%20preserveAspectRatio%3D%22xMidYMid%20slice%22%3E%3Crect%20width%3D%22400%22%20height%3D%22300%22%20fill%3D%22%23f5f6f8%22%2F%3E%3Cg%20transform%3D%22translate%28200%20150%29%22%20fill%3D%22none%22%20stroke%3D%22%23c2cad6%22%20stroke-width%3D%225%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Crect%20x%3D%22-44%22%20y%3D%22-44%22%20width%3D%2288%22%20height%3D%2288%22%20rx%3D%2216%22%2F%3E%3Ccircle%20cx%3D%2218%22%20cy%3D%22-18%22%20r%3D%222.5%22%20fill%3D%22%23c2cad6%22%20stroke%3D%22none%22%2F%3E%3Cpath%20d%3D%22M-34%2030%20L-8%200%20L10%2018%20L20%208%20L34%2024%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E';

type Product = { id: string; name: string; details: string; price: number; qty: number };

const PRODUCTS: readonly Product[] = [
  { id: ORDER_PRODUCT_IDS[0], name: "Solstice Mug", details: "Glaze: Snow\nFinish: Matte", price: 89.0, qty: 1 },
  { id: ORDER_PRODUCT_IDS[1], name: "Ember Bowl", details: "Glaze: Sage\nSize: 6 in", price: 42.0, qty: 2 },
  { id: ORDER_PRODUCT_IDS[2], name: "Terra Cup", details: "Glaze: Oat\nSize: 14 in", price: 65.0, qty: 1 },
  { id: ORDER_PRODUCT_IDS[3], name: "Dawn Plate Set", details: "Glaze: Charcoal\nCapacity: 3 oz", price: 34.0, qty: 3 },
  { id: ORDER_PRODUCT_IDS[4], name: "Kiln Salad Bowl", details: "Glaze: Snow\nHeight: 8 in", price: 78.0, qty: 1 },
];

const SUBTOTAL = PRODUCTS.reduce((sum, p) => sum + p.price * p.qty, 0);
const DISCOUNT = 15.0;
const SHIPPING = 0;
const TAX_RATE = 0.0825;
const TAX = Math.round((SUBTOTAL - DISCOUNT) * TAX_RATE * 100) / 100;
const TOTAL = SUBTOTAL - DISCOUNT + SHIPPING + TAX;
const fmt = (n: number) => `$${n.toFixed(2)}`;

type Activity = { id: string; type: "event" | "comment" | "update"; user: string; text: string; reactions?: number; time: string; changes?: string[] };

const ACTIVITY: readonly Activity[] = [
  { id: ORDER_ACTIVITY_IDS[0], type: "event", user: "Jane Doe", text: "placed order #1001", reactions: 2, time: "Feb 23 at 9:12 AM" },
  {
    id: ORDER_ACTIVITY_IDS[1],
    type: "comment",
    user: "Alex Rivera",
    text: "Customer requested gift wrapping for the mug & plate set. I've added a note to the packing slip — warehouse team should wrap in recycled kraft paper.",
    reactions: 3,
    time: "Feb 23 at 10:45 AM",
  },
  {
    id: ORDER_ACTIVITY_IDS[2],
    type: "update",
    user: "System",
    text: "has several information changes",
    time: "Feb 23 at 11:30 AM",
    changes: ["Payment verified via Visa ...7482", "Fraud check passed — low risk"],
  },
  { id: ORDER_ACTIVITY_IDS[3], type: "event", user: "Alex Rivera", text: "marked order as ready for fulfillment", reactions: 1, time: "Feb 23 at 2:15 PM" },
];

const SAMPLE_NOTES =
  "Customer is a repeat buyer — 3rd order this quarter. Prefers snow and oat glazes. Requested gift wrapping for the mug set. Ships to a residential address in CA.";

const TABS = ["details", "invoices", "timeline", "customer", "analysis"] as const;

export type OrderState = {
  tab: string;
  /** Wide windows: the side panel is shown. */
  sidePanel: boolean;
  /** Narrow windows: the panel's dialog is open. */
  panelDialog: boolean;
  /** The notes being edited, until Save (saving on only); null shows the saved notes. */
  notesDraft: string | null;
  /** The reply box under a timeline entry, while it is open (saving on only): the entry and the text so far. */
  replying: { id: string; text: string } | null;
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
  /** "Unfulfilled" (stock's word), "Partially fulfilled" or "Fulfilled": it follows the items marked fulfilled. */
  status: string;
  /** The status badge's color: "warning" until every item is fulfilled, then "success". */
  statusVariant: "warning" | "success";
  date: string;
  flag: string;
  products: { id: string; name: string; image: string; lines: string[]; amount: string; unit: (string | number)[]; fulfilled: boolean }[];
  /** The invoice's summary rows. */
  /** Notes and units are lists of parts, drawn one after another (a count, then its unit). */
  summary: { label: string; note: (string | number)[] | null; amount: string; strong: boolean }[];
  paidBy: { label: string; note: string; amount: string };
  /** `reactionsLabel` is what a screen reader says of the reactions: "3 reactions", or "Reactions" with no count. */
  activity: {
    id: string; user: string; text: string; changes: string[] | null; reactions: number | null; reactionsLabel: string; time: string;
    /** The person likes this entry; its reaction count includes the like. */
    liked: boolean;
    /** The replies under the entry, oldest first. */
    replies: { id: string; user: string; text: string; time: string }[];
    /** The reply box, while it is open under this entry. */
    composer: { value: string; canSend: boolean; maxLength: number } | null;
  }[];
  /** The order's notes: the sample's, or the saved ones. */
  notes: string;
  /** With saving on, the notes are a text area with Save: its text so far, whether Save does anything, and the longest allowed. Null draws the notes as plain text. */
  notesEditor: { value: string; canSave: boolean; maxLength: number } | null;
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
  /** Shown under a fulfilled item. */
  fulfilled: string;
  /** The Like control once the entry is liked. */
  liked: string;
  save: string;
  send: string;
  cancel: string;
  /** The reply box's label and placeholder. */
  replyLabel: string;
  replyPlaceholder: string;
  /** The name a reply the person wrote carries. */
  you: string;
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
  fulfilled: "Fulfilled",
  liked: "Liked",
  save: "Save",
  send: "Send",
  cancel: "Cancel",
  replyLabel: "Write a reply",
  replyPlaceholder: "Write a reply…",
  you: "You",
};

const TAB_LABELS: Record<(typeof TABS)[number], string> = {
  details: "Details", invoices: "Invoices", timeline: "Timeline", customer: "Customer", analysis: "Analysis",
};

/** Controls stock leaves inert. Saving turns Fulfill item (while an item is left), Like and Reply on. */
const INERT = ["allOrders", "restock", "edit", "seeAll", "fulfill", "label", "refund", "invoice", "filters", "like", "reply"];

/** What is saved over the sample: notes, fulfilled items, likes and replies. A row that does not fit is ignored. */
type Saved = {
  notes: string;
  fulfilled: Set<string>;
  liked: Set<string>;
  replies: { id: string; item: string; text: string; at: number }[];
};

function savedOf(doc: Doc | undefined, extras: boolean): Saved {
  const saved: Saved = { notes: SAMPLE_NOTES, fulfilled: new Set(), liked: new Set(), replies: [] };
  // Without extras the screen is stock's: nothing saved is drawn.
  if (!doc || !extras) return saved;
  const notes = doc.order_note?.notes?.text;
  if (typeof notes === "string" && notes.length <= MAX_ORDER_NOTES) saved.notes = notes;
  for (const p of PRODUCTS) if (typeof doc.order_item?.[p.id]?.fulfilledAt === "number") saved.fulfilled.add(p.id);
  for (const a of ACTIVITY) if (doc.order_like?.[a.id]?.liked === true) saved.liked.add(a.id);
  for (const row of Object.values(doc.order_reply ?? {})) {
    const { item, text, at } = row;
    if (typeof item !== "string" || !(ORDER_ACTIVITY_IDS as readonly string[]).includes(item)) continue;
    if (typeof text !== "string" || text.trim() === "" || text.length > MAX_ORDER_REPLY || typeof at !== "number" || !Number.isFinite(at)) continue;
    saved.replies.push({ id: row.id, item, text, at });
  }
  saved.replies.sort((x, y) => x.at - y.at || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  return saved;
}

/** "just now", "5m ago", "2h ago", "Yesterday": how long ago a reply was written. */
function agoWords(at: number, now: Now): string {
  const minutes = Math.max(0, Math.floor((now.epochMs - at) / 60_000));
  const when = ago(minutes, civilOf(now), minuteOf(now));
  return when === "Now" ? "just now" : /^\d+[mh]$/.test(when) ? `${when} ago` : when;
}

/** The status words follow how many items are fulfilled. */
function statusOf(fulfilled: number): { status: string; variant: "warning" | "success" } {
  if (fulfilled === 0) return { status: "Unfulfilled", variant: "warning" };
  return fulfilled >= PRODUCTS.length ? { status: "Fulfilled", variant: "success" } : { status: "Partially fulfilled", variant: "warning" };
}

/** "like:a2" -> ["like", "a2"]. */
function splitOnce(id: string): [string, string] {
  const i = id.indexOf(":");
  return i < 0 ? [id, ""] : [id.slice(0, i), id.slice(i + 1)];
}
const isActivityId = (id: string) => ACTIVITY.some((a) => a.id === id);

export const order: TemplateModule<OrderState, OrderView> = {
  id: "order",
  astryx: "detail-page",
  title: "Order detail",
  initial: () => ({ tab: "details", sidePanel: true, panelDialog: false, notesDraft: null, replying: null }),
  reduce(s, action, now, io) {
    const saved = () => savedOf(io?.doc, io?.extras === true);
    if (action.type === "press") {
      if (action.id === "panel:side") return { ...s, sidePanel: !s.sidePanel };
      if (action.id === "panel:dialog") return { ...s, panelDialog: !s.panelDialog };
      // Everything below is beyond stock, and needs saving on.
      if (!io?.extras) return s;
      const [verb, arg] = splitOnce(action.id);
      switch (verb) {
        case "notesSave": {
          if (s.notesDraft === null) return s;
          if (s.notesDraft !== saved().notes) io.save("order.note", { text: s.notesDraft, at: now.epochMs });
          return { ...s, notesDraft: null };
        }
        case "fulfill": {
          const next = PRODUCTS.find((p) => !saved().fulfilled.has(p.id));
          if (next) io.save("order.fulfill", { id: next.id, at: now.epochMs });
          return s;
        }
        case "like":
          if (isActivityId(arg)) io.save("order.like", { id: arg, liked: !saved().liked.has(arg) });
          return s;
        case "reply":
          if (!isActivityId(arg)) return s;
          return { ...s, replying: s.replying?.id === arg ? null : { id: arg, text: "" } };
        case "replyCancel":
          return s.replying ? { ...s, replying: null } : s;
        case "replySend": {
          const text = s.replying?.text.trim() ?? "";
          if (!s.replying || text === "") return s;
          io.save("order.reply", { id: io.mint(), item: s.replying.id, text, at: now.epochMs });
          return { ...s, replying: null };
        }
      }
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
    if (!io?.extras) return s;
    if (action.id === "notes") {
      const text = String(action.value).slice(0, MAX_ORDER_NOTES);
      return text === s.notesDraft ? s : { ...s, notesDraft: text };
    }
    if (action.id === "replyText" && s.replying) {
      const text = String(action.value).slice(0, MAX_ORDER_REPLY);
      return text === s.replying.text ? s : { ...s, replying: { ...s.replying, text } };
    }
    return s;
  },
  view: (s, now, doc, extras = true) => {
    const saved = savedOf(doc, extras);
    const done = PRODUCTS.filter((p) => saved.fulfilled.has(p.id)).length;
    const { status, variant } = statusOf(done);
    // Stock leaves these inert; with saving on they work (Fulfill item only while an item is left).
    const inert = INERT.filter((id) => !extras || (id === "fulfill" ? done >= PRODUCTS.length : id !== "like" && id !== "reply"));
    return {
      tab: s.tab,
      sidePanel: s.sidePanel,
      panelDialog: s.panelDialog,
      number: "#1001",
      itemCount: PRODUCTS.length,
      customerName: "Jane Doe",
      status,
      statusVariant: variant,
      date: "02/23/2026",
      flag: "Needs attention",
      products: PRODUCTS.map((p) => ({
        id: p.id,
        name: p.name,
        image: PRODUCT_IMAGE,
        lines: p.details.split("\n"),
        amount: fmt(p.price * p.qty),
        unit: [fmt(p.price), " ", "×", " ", p.qty],
        fulfilled: saved.fulfilled.has(p.id),
      })),
      summary: [
        { label: "Subtotal", note: [PRODUCTS.length, " items"], amount: fmt(SUBTOTAL), strong: false },
        { label: "Discount", note: ["New customer code: NEW15"], amount: `– ${fmt(DISCOUNT)}`, strong: false },
        { label: "Shipping", note: ["Free shipping (0.0lbs) USPS"], amount: fmt(SHIPPING), strong: false },
        { label: "Tax", note: ["Sales tax (8.25%)"], amount: fmt(TAX), strong: false },
        { label: "Total", note: null, amount: fmt(TOTAL), strong: true },
      ],
      paidBy: { label: "Paid by customer", note: "Visa ...7482", amount: fmt(TOTAL) },
      activity: ACTIVITY.map((a) => {
        const liked = saved.liked.has(a.id);
        const reactions = a.reactions == null && !liked ? null : (a.reactions ?? 0) + (liked ? 1 : 0);
        return {
          id: a.id,
          user: a.user,
          text: a.text,
          changes: a.changes ? [...a.changes] : null,
          reactions,
          reactionsLabel: reactions == null ? "Reactions" : `${reactions} ${reactions === 1 ? "reaction" : "reactions"}`,
          time: a.time,
          liked,
          replies: saved.replies.filter((r) => r.item === a.id).map((r) => ({ id: r.id, user: WORDS.you, text: r.text, time: agoWords(r.at, now) })),
          composer: extras && s.replying?.id === a.id ? { value: s.replying.text, canSend: s.replying.text.trim() !== "", maxLength: MAX_ORDER_REPLY } : null,
        };
      }),
      notes: saved.notes,
      notesEditor: extras ? { value: s.notesDraft ?? saved.notes, canSave: s.notesDraft !== null && s.notesDraft !== saved.notes, maxLength: MAX_ORDER_NOTES } : null,
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
      inert,
      words: WORDS,
      rules: RULES,
    };
  },
};
