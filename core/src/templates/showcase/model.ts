/**
 * Astryx's `theme-showcase` template, refactored: a store page (nav, hero, three product
 * cards, a checkout form, a support chat, a revenue panel and an inventory table) whose
 * sample data, wording and numbers live here. The JSX is web/src/templates/showcase.tsx;
 * the stock copy is web/src/stock/templates/theme-showcase.tsx.
 *
 * The stock template is a static preview of a theme: every control is controlled with a
 * no-op `onChange`, so typing, picking and checking change nothing on screen. The core
 * keeps that behavior exactly: it holds the form values and answers every action with the
 * same state. (Anything that is only a hover, a focus ring or an open menu belongs to the
 * component, not to the core.) What the core does own is everything shown: the sample
 * data, the money formatting, the low-stock count and the banner that depends on it.
 *
 * Layout choices that depend on the window (the phone layout) stay in the JSX, as in the
 * stock template, where they come from the app shell.
 */
import { grouped, money } from "../../format.ts";
import type { TemplateModule } from "../types.ts";

export type BadgeVariant = "blue" | "cyan" | "green" | "orange" | "pink" | "purple" | "red" | "teal" | "yellow";

type Product = { name: string; description: string; badge: string; badgeVariant: BadgeVariant };
type Tag = { label: string; variant: BadgeVariant };
type InventoryRow = { id: string; name: string; meta: string; available: number; location: string; tags: Tag[]; hasImage: boolean; thumbnailFallback: string; selected: boolean };
type ActivityRow = { id: string; icon: "bag" | "banknote"; label: string; detail: string; amount: number };

/** A neutral placeholder photo; the stock template uses the same one for every slot. */
const PLACEHOLDER_IMAGE =
  "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20400%20300%22%20preserveAspectRatio%3D%22xMidYMid%20slice%22%3E%3Crect%20width%3D%22400%22%20height%3D%22300%22%20fill%3D%22%23f5f6f8%22%2F%3E%3Cg%20transform%3D%22translate%28200%20150%29%22%20fill%3D%22none%22%20stroke%3D%22%23c2cad6%22%20stroke-width%3D%225%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Crect%20x%3D%22-44%22%20y%3D%22-44%22%20width%3D%2288%22%20height%3D%2288%22%20rx%3D%2216%22%2F%3E%3Ccircle%20cx%3D%2218%22%20cy%3D%22-18%22%20r%3D%222.5%22%20fill%3D%22%23c2cad6%22%20stroke%3D%22none%22%2F%3E%3Cpath%20d%3D%22M-34%2030%20L-8%200%20L10%2018%20L20%208%20L34%2024%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E";

const PRODUCTS: Product[] = [
  { name: "Minimalist Watch", description: "Clean design meets everyday durability.", badge: "New", badgeVariant: "blue" },
  { name: "Wireless Headphones", description: "Immersive sound, all-day comfort.", badge: "Popular", badgeVariant: "green" },
  { name: "Canvas Backpack", description: "Water-resistant canvas with a quiet, modern profile.", badge: "Limited", badgeVariant: "yellow" },
];

const INVENTORY: InventoryRow[] = [
  { id: "a", name: "Minimalist Watch", meta: "Stainless steel, sapphire crystal", available: 42, location: "Aisle 3", tags: [{ label: "New", variant: "blue" }], hasImage: true, thumbnailFallback: "M", selected: false },
  { id: "b", name: "Wireless Headphones", meta: "ANC, 30hr battery", available: 128, location: "Aisle 1", tags: [{ label: "Popular", variant: "green" }], hasImage: true, thumbnailFallback: "W", selected: true },
  { id: "c", name: "Canvas Backpack", meta: "Water-resistant, 25L", available: 63, location: "Aisle 2", tags: [{ label: "Limited", variant: "yellow" }], hasImage: true, thumbnailFallback: "C", selected: false },
  { id: "d", name: "Leather Wallet", meta: "Full-grain, RFID blocking", available: 15, location: "Aisle 4", tags: [{ label: "Leather", variant: "yellow" }], hasImage: true, thumbnailFallback: "L", selected: true },
  { id: "e", name: "Travel Tumbler", meta: "Vacuum insulated, 16oz", available: 87, location: "Aisle 5", tags: [{ label: "Drinkware", variant: "green" }], hasImage: true, thumbnailFallback: "T", selected: false },
  { id: "f", name: "Linen Throw", meta: "Heavyweight, oat", available: 24, location: "Aisle 6", tags: [{ label: "Home", variant: "orange" }], hasImage: true, thumbnailFallback: "L", selected: true },
];

const ACTIVITY: ActivityRow[] = [
  { id: "1", icon: "bag", label: "Order #1043", detail: "Placed · 1:59 pm", amount: 248 },
  { id: "2", icon: "banknote", label: "Order #1041", detail: "Refunded · 12:40 pm", amount: -89 },
  { id: "3", icon: "bag", label: "Order #1040", detail: "Placed · 10:30 am", amount: 156 },
  { id: "4", icon: "bag", label: "Order #1038", detail: "Placed · 9:11 am", amount: 412 },
  { id: "5", icon: "bag", label: "Order #1037", detail: "Placed · 8:42 am", amount: 95 },
];

const SHIPPING = [
  { value: "economy", label: "Economy Shipping", description: "Delivered in 5–7 business days", cents: 1200 },
  { value: "standard", label: "Standard Shipping", description: "Delivered in 3–5 business days", cents: 1600 },
  { value: "express", label: "Express Shipping", description: "Delivered in 1–2 business days", cents: 2400 },
];

const PAYMENTS = [
  { value: "card", label: "Pay with card", text: "Card", icon: "card" as const },
  { value: "apple", label: "Pay with Apple Pay", text: "Apple Pay", icon: "smartphone" as const },
  { value: "google", label: "Pay with Google Pay", text: "Google Pay", icon: "wallet" as const },
];

const COUNTRIES = [
  { value: "us", label: "United States" },
  { value: "ca", label: "Canada" },
  { value: "uk", label: "United Kingdom" },
  { value: "de", label: "Germany" },
  { value: "jp", label: "Japan" },
  { value: "au", label: "Australia" },
];

const SUGGESTED_QUESTIONS = ["Reschedule delivery", "Update shipping address", "Start a return"];

const LOW_STOCK_THRESHOLD = 25;

export type ShowcaseState = {
  products: Product[];
  inventory: InventoryRow[];
  activity: ActivityRow[];
  /** The form values. The stock template never lets them change. */
  email: string;
  shipping: string;
  payment: string;
  card: string;
  expiry: string;
  cvc: string;
  country: string;
  saveInfo: boolean;
  search: string;
  chatDraft: string;
};

/** "+$248" or "−$89" (a true minus sign), as the stock template writes an amount. */
function formatAmount(amount: number): string {
  return (amount < 0 ? "−" : "+") + "$" + grouped(Math.abs(amount));
}

export type ChatLine =
  | { kind: "system"; text: string }
  | { kind: "user"; text: string }
  | { kind: "assistant"; paragraphs: string[]; details: ChatDetail[] | null };

export type ChatDetail = {
  label: string;
  description: string;
  end: { kind: "amount"; text: string } | { kind: "badge"; text: string; variant: BadgeVariant } | { kind: "link"; text: string };
};

const CHAT: ChatLine[] = [
  { kind: "system", text: "Today" },
  { kind: "user", text: "Where’s my order?" },
  {
    kind: "assistant",
    paragraphs: [
      "Your order #1043 — the Minimalist Watch and Linen Throw — shipped this morning from the Aisle 3 warehouse and is currently in transit with UPS. It’s on track to arrive at your address by end of day tomorrow.",
      "Let me know if you’d like to reschedule the delivery, redirect it to a pickup point, or start a return once it arrives.",
    ],
    details: null,
  },
  { kind: "user", text: "Can you show me the full details?" },
  {
    kind: "assistant",
    paragraphs: ["Here’s everything I have on order #1043:"],
    details: [
      { label: "Items", description: "Minimalist Watch · Linen Throw", end: { kind: "amount", text: "$248" } },
      { label: "Shipping", description: "UPS Ground", end: { kind: "amount", text: "$12" } },
      { label: "Estimated arrival", description: "Tomorrow by 8pm", end: { kind: "badge", text: "On time", variant: "green" } },
      { label: "Tracking", description: "UPS 1Z 999 AA1 0123 4567 84", end: { kind: "link", text: "Track →" } },
    ],
  },
];

/** The showcase's controls that the stock page wires to nothing; a native host shows them disabled. */
export type InertControl = "navItems" | "navActions" | "signIn" | "addToCart" | "pay" | "suggestions" | "chatActions" | "chatLink" | "attach" | "voice" | "seeAll" | "addItem" | "rowMenu";

export type View = {
  inert: InertControl[];
  nav: {
    label: string;
    heading: string;
    items: { label: string; isSelected: boolean }[];
    actions: { label: string; icon: "search" | "account" | "cart" }[];
    signIn: string;
  };
  hero: { lines: string[]; body: string };
  products: {
    name: string;
    description: string;
    badge: string;
    badgeVariant: BadgeVariant;
    image: string;
    quantity: { label: string; value: number; min: number; max: number };
    addLabel: string;
  }[];
  checkout: {
    heading: string;
    email: { label: string; placeholder: string; value: string };
    shipping: { label: string; description: string; value: string; options: { value: string; label: string; description: string; price: string }[] };
    payment: { label: string; options: { value: string; label: string; text: string; icon: "card" | "smartphone" | "wallet"; isSelected: boolean }[] };
    card: { label: string; placeholder: string; value: string };
    expiry: { label: string; placeholder: string; value: string };
    cvc: { label: string; placeholder: string; value: string };
    country: { label: string; value: string; options: { value: string; label: string }[] };
    saveInfo: { label: string; description: string; value: boolean };
    payLabel: string;
  };
  chat: {
    heading: string;
    actions: { label: string; icon: "download" | "close" }[];
    messages: ChatLine[];
    suggestions: string[];
    composer: { value: string; placeholder: string; attachLabel: string; voiceLabel: string };
  };
  revenue: {
    heading: string;
    kpis: { value: string; label: string }[];
    activityHeading: string;
    seeAll: string;
    items: { id: string; icon: "bag" | "banknote"; label: string; detail: string; amount: string; isMuted: boolean }[];
  };
  inventory: {
    heading: string;
    addLabel: string;
    search: { label: string; placeholder: string; value: string };
    filters: { label: string; placeholder: string; icon: "folder" | "mapPin" | "tag"; options: string[] }[];
    moreFiltersLabel: string;
    viewButtons: { label: string; icon: "list" | "grid" }[];
    /** The low-stock warning, or null when nothing is low. */
    banner: string | null;
    columns: { select: string; item: string; available: string; location: string; tags: string; actions: string };
    rows: {
      id: string;
      selectLabel: string;
      selected: boolean;
      image: string | null;
      fallback: string;
      name: string;
      meta: string;
      available: number;
      location: string;
      tags: Tag[];
    }[];
    rowMenuLabel: string;
    rowMenu: ({ label: string } | { divider: true })[];
  };
};

export type ShowcaseView = View;

export const showcase: TemplateModule<ShowcaseState, View> = {
  id: "showcase",
  astryx: "theme-showcase",
  title: "Theme showcase",
  initial: () => ({
    products: PRODUCTS.map((p) => ({ ...p })),
    inventory: INVENTORY.map((r) => ({ ...r, tags: r.tags.map((t) => ({ ...t })) })),
    activity: ACTIVITY.map((a) => ({ ...a })),
    email: "",
    shipping: "economy",
    payment: "card",
    card: "",
    expiry: "",
    cvc: "",
    country: "us",
    saveInfo: true,
    search: "",
    chatDraft: "",
  }),
  // The stock template ignores every change (see the file comment), so this does too.
  reduce: (s) => s,
  view(s) {
    const lowStock = s.inventory.filter((row) => row.available < LOW_STOCK_THRESHOLD).length;
    return {
      inert: ["navItems", "navActions", "signIn", "addToCart", "pay", "suggestions", "chatActions", "chatLink", "attach", "voice", "seeAll", "addItem", "rowMenu"],
      nav: {
        label: "Theme preview navigation",
        heading: "Studio",
        items: ["Shop", "New In", "Stories", "Help"].map((label, i) => ({ label, isSelected: i === 0 })),
        actions: [
          { label: "Search", icon: "search" },
          { label: "Account", icon: "account" },
          { label: "Cart", icon: "cart" },
        ],
        signIn: "Sign in",
      },
      hero: {
        lines: ["Little joys,", "everywhere you go"],
        body: "We believe the smallest details are the ones that matter most. Turn an ordinary day into something worth remembering.",
      },
      products: s.products.map((p) => ({
        ...p,
        image: PLACEHOLDER_IMAGE,
        quantity: { label: "Quantity", value: 1, min: 1, max: 99 },
        addLabel: "Add to cart",
      })),
      checkout: {
        heading: "Checkout",
        email: { label: "Email", placeholder: "you@studio.com", value: s.email },
        shipping: {
          label: "Shipping method",
          description: "Delivery time may vary based on location and availability.",
          value: s.shipping,
          options: SHIPPING.map((o) => ({ value: o.value, label: o.label, description: o.description, price: money(o.cents) })),
        },
        payment: {
          label: "Payment method",
          options: PAYMENTS.map((o) => ({ ...o, isSelected: o.value === s.payment })),
        },
        card: { label: "Card number", placeholder: "1234 1234 1234 1234", value: s.card },
        expiry: { label: "Expiry", placeholder: "MM / YY", value: s.expiry },
        cvc: { label: "CVC", placeholder: "123", value: s.cvc },
        country: { label: "Country", value: s.country, options: COUNTRIES.map((c) => ({ ...c })) },
        saveInfo: {
          label: "Securely save my information for 1-click checkout",
          description: "Pay faster on Studio and everywhere Link is accepted.",
          value: s.saveInfo,
        },
        payLabel: "Pay now",
      },
      chat: {
        heading: "Studio AI",
        actions: [
          { label: "Export conversation", icon: "download" },
          { label: "Close chat", icon: "close" },
        ],
        messages: CHAT,
        suggestions: SUGGESTED_QUESTIONS,
        composer: { value: s.chatDraft, placeholder: "Ask Studio AI…", attachLabel: "Attach", voiceLabel: "Voice input" },
      },
      revenue: {
        heading: "Revenue",
        kpis: [
          { value: "18K", label: "Monthly revenue" },
          { value: "+12%", label: "Order growth" },
        ],
        activityHeading: "Activity",
        seeAll: "See all",
        items: s.activity.map((a) => ({ id: a.id, icon: a.icon, label: a.label, detail: a.detail, amount: formatAmount(a.amount), isMuted: a.amount < 0 })),
      },
      inventory: {
        heading: "Inventory",
        addLabel: "Add item",
        search: { label: "Search inventory", placeholder: "Type and hit enter…", value: s.search },
        filters: [
          { label: "Categories", placeholder: "Categories", icon: "folder", options: ["Wearables", "Audio", "Bags", "Drinkware", "Home"] },
          { label: "Locations", placeholder: "Locations", icon: "mapPin", options: ["Aisle 1", "Aisle 2", "Aisle 3", "Aisle 4", "Aisle 5", "Aisle 6"] },
          { label: "Tags", placeholder: "Tags", icon: "tag", options: ["New", "Popular", "Limited", "Leather", "Drinkware", "Home"] },
        ],
        moreFiltersLabel: "Filters",
        viewButtons: [
          { label: "List view", icon: "list" },
          { label: "Grid view", icon: "grid" },
        ],
        banner: lowStock > 0 ? `${lowStock} items are running low` : null,
        columns: { select: "", item: "Item", available: "Available", location: "Location", tags: "Tags", actions: "" },
        rows: s.inventory.map((r) => ({
          id: r.id,
          selectLabel: "Select " + r.name,
          selected: r.selected,
          image: r.hasImage ? PLACEHOLDER_IMAGE : null,
          fallback: r.thumbnailFallback,
          name: r.name,
          meta: r.meta,
          available: r.available,
          location: r.location,
          tags: r.tags.map((t) => ({ ...t })),
        })),
        rowMenuLabel: "Row actions",
        rowMenu: [{ label: "Edit" }, { label: "Duplicate" }, { label: "Move to…" }, { divider: true }, { label: "Delete" }],
      },
    };
  },
};
