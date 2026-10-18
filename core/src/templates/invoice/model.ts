/**
 * Astryx's `table-page` template, refactored: its state, sample data and logic, here.
 * The JSX is web/src/templates/invoice.tsx; the stock copy is web/src/stock/templates/table-page.tsx.
 *
 * One list of invoice lines, narrowed three ways (the search box, the billing-basis toggle and
 * the column filters) and sorted by a column; the figures under the table follow the rows left.
 *
 * Actions (the "tpl.invoice." prefix removed):
 *   set    query <string>           the search box
 *   set    basis <"all"|"hourly">   the billing-basis toggle
 *   set    filter:<column> <value>  a column filter: description (text), category (a category key),
 *                                   quantity (a number)
 *   press  unfilter:<column>        clear one column filter
 *   set    sort "<column>:<direction>"  sort by a column ("ascending" or "descending"); "" clears it
 *   press  clear                    clear the search box, the toggle and every column filter
 */
import { grouped, money } from "../../format.ts";
import type { TemplateModule } from "../types.ts";

type LineCategory = "design" | "development" | "content" | "project";
type BillingBasis = "hourly" | "fixed";

type Line = {
  id: string;
  description: string;
  category: LineCategory;
  basis: BillingBasis;
  /** Hours booked on an hourly line, or units delivered on a fixed-fee one. */
  quantity: number;
  /** Integer cents. */
  unitPriceCents: number;
};

const CATEGORY_LABEL: Record<LineCategory, string> = {
  design: "Design",
  development: "Development",
  content: "Content",
  project: "Project management",
};
const CATEGORIES = ["design", "development", "content", "project"] as const;

const LINES: readonly Line[] = [
  { id: "li-01", description: "Discovery workshop", category: "design", basis: "fixed", quantity: 1, unitPriceCents: 240_000 },
  { id: "li-02", description: "Stakeholder interviews", category: "design", basis: "hourly", quantity: 12, unitPriceCents: 14_500 },
  { id: "li-03", description: "User research synthesis", category: "design", basis: "hourly", quantity: 18, unitPriceCents: 14_500 },
  { id: "li-04", description: "Wireframes — key templates", category: "design", basis: "hourly", quantity: 34, unitPriceCents: 14_500 },
  { id: "li-05", description: "Visual design system", category: "design", basis: "fixed", quantity: 1, unitPriceCents: 680_000 },
  { id: "li-06", description: "Page designs — 14 templates", category: "design", basis: "hourly", quantity: 62, unitPriceCents: 14_500 },
  { id: "li-07", description: "Prototype & usability testing", category: "design", basis: "hourly", quantity: 22, unitPriceCents: 14_500 },
  { id: "li-08", description: "Frontend build — component library", category: "development", basis: "hourly", quantity: 88, unitPriceCents: 16_500 },
  { id: "li-09", description: "Frontend build — page templates", category: "development", basis: "hourly", quantity: 104, unitPriceCents: 16_500 },
  { id: "li-10", description: "CMS setup & content modelling", category: "development", basis: "hourly", quantity: 40, unitPriceCents: 16_500 },
  { id: "li-11", description: "Search & filtering integration", category: "development", basis: "hourly", quantity: 26, unitPriceCents: 16_500 },
  { id: "li-12", description: "Analytics & tag manager setup", category: "development", basis: "hourly", quantity: 10, unitPriceCents: 16_500 },
  { id: "li-13", description: "Accessibility audit & remediation", category: "development", basis: "fixed", quantity: 1, unitPriceCents: 320_000 },
  { id: "li-14", description: "Cross-browser QA", category: "development", basis: "hourly", quantity: 24, unitPriceCents: 13_500 },
  { id: "li-15", description: "Copywriting — 14 pages", category: "content", basis: "hourly", quantity: 36, unitPriceCents: 12_500 },
  { id: "li-16", description: "Content migration", category: "content", basis: "hourly", quantity: 28, unitPriceCents: 9_500 },
  { id: "li-17", description: "Stock photography licences", category: "content", basis: "fixed", quantity: 24, unitPriceCents: 1_800 },
  { id: "li-18", description: "Project management — 12 weeks", category: "project", basis: "fixed", quantity: 12, unitPriceCents: 85_000 },
  { id: "li-19", description: "Training & handover session", category: "project", basis: "fixed", quantity: 2, unitPriceCents: 120_000 },
];

type Row = Line & { amountCents: number };

const ROWS: readonly Row[] = LINES.map((item) => ({ ...item, amountCents: item.quantity * item.unitPriceCents }));

/** Invoice-wide, so a line's share does not move when the view is filtered. */
const INVOICE_SUBTOTAL_CENTS = ROWS.reduce((sum, item) => sum + item.amountCents, 0);

const BASIS_FILTERS = [
  { value: "all", label: "All lines" },
  { value: "hourly", label: "Hourly" },
] as const;

const TAX_RATE = 0.0875;

const INVOICE_DETAILS = [
  { label: "Billed to", value: "Brightwater Coffee Co." },
  { label: "Project", value: "Website redesign" },
  { label: "Issue date", value: "Mar 31, 2026" },
  { label: "Due date", value: "Apr 30, 2026" },
  { label: "Payment terms", value: "Net 30" },
  { label: "Purchase order", value: "PO-4471" },
];

// ---- sorting -------------------------------------------------------------------------------

/**
 * `a.localeCompare(b)` in US English for the text on this page: letters compare without regard
 * to case, spaces and punctuation come before digits and digits before letters, and a tie is
 * broken lowercase first. (The browsers' collation is not available in the core.)
 */
const PUNCTUATION = " _-—,;:!?.'\"()[]{}@*/\\&#%`^+<=>|~$";

function weight(ch: string): number {
  const p = PUNCTUATION.indexOf(ch);
  if (p >= 0) return p;
  if (ch >= "0" && ch <= "9") return 100 + ch.charCodeAt(0);
  const lower = ch.toLowerCase();
  return lower !== ch.toUpperCase() ? 1000 + lower.charCodeAt(0) : 200 + ch.charCodeAt(0);
}

function compareText(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const d = weight(a[i]!) - weight(b[i]!);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  if (a.length !== b.length) return a.length < b.length ? -1 : 1;
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) return a[i] === a[i]!.toLowerCase() ? -1 : 1;
  }
  return 0;
}

export type SortKey = "description" | "category" | "quantity" | "unitPrice" | "amount";
const SORT_KEYS: readonly SortKey[] = ["description", "category", "quantity", "unitPrice", "amount"];

/** Numeric columns compare the integers, text columns the words a reader sees. */
const COMPARATORS: Record<SortKey, (a: Row, b: Row) => number> = {
  description: (a, b) => compareText(a.description, b.description),
  category: (a, b) => compareText(CATEGORY_LABEL[a.category], CATEGORY_LABEL[b.category]),
  quantity: (a, b) => a.quantity - b.quantity,
  unitPrice: (a, b) => a.unitPriceCents - b.unitPriceCents,
  amount: (a, b) => a.amountCents - b.amountCents,
};

// ---- state ---------------------------------------------------------------------------------

export type Direction = "ascending" | "descending";
type Filters = { description?: string; category?: LineCategory; quantity?: number };
type FilterColumn = keyof Filters;
const FILTER_COLUMNS: readonly FilterColumn[] = ["description", "category", "quantity"];

export type InvoiceState = {
  query: string;
  basis: "all" | BillingBasis;
  filters: Filters;
  sort: { key: SortKey; direction: Direction } | null;
};

export type InvoiceRowView = {
  id: string;
  description: string;
  category: string;
  quantity: string;
  rate: string;
  amount: string;
  /** What the row's hover card says. */
  card: { category: string; billing: string; calculation: string; amount: string; share: string };
};

export type InvoiceView = {
  title: string;
  details: { label: string; value: string }[];
  basisFilters: { value: string; label: string }[];
  basis: string;
  query: string;
  /** The column filter popovers' values, by column. */
  filters: Record<string, string | number>;
  categories: { value: string; label: string }[];
  sort: { sortKey: string; direction: Direction }[];
  /** The rows to show, filtered and sorted. */
  rows: InvoiceRowView[];
  /** Shown instead of the table when no row survives. */
  empty: { title: string; description: string } | null;
  totals: { label: string; value: string; emphasis: "muted" | "strong" | null }[];
  /** Shown under the table when the figures describe a subset. */
  banner: { title: string; description: string } | null;
};
export type View = InvoiceView;

function visibleRows(s: InvoiceState): Row[] {
  const { description, category, quantity } = s.filters;
  const term = s.query.trim().toLowerCase();
  return ROWS.filter(
    (r) =>
      (description === undefined || r.description.toLowerCase().includes(description.toLowerCase())) &&
      (category === undefined || r.category === category) &&
      (quantity === undefined || r.quantity === quantity) &&
      (s.basis === "all" || r.basis === s.basis) &&
      (term === "" || r.description.toLowerCase().includes(term)),
  );
}

function sorted(rows: Row[], sort: InvoiceState["sort"]): Row[] {
  if (!sort) return rows;
  const cmp = COMPARATORS[sort.key];
  return [...rows].sort((a, b) => (sort.direction === "ascending" ? cmp(a, b) : -cmp(a, b)));
}

function withFilter(s: InvoiceState, column: FilterColumn, value: string | number | null): InvoiceState {
  const rest = Object.fromEntries(Object.entries(s.filters).filter(([key]) => key !== column)) as Filters;
  if (value === null) return { ...s, filters: rest };
  switch (column) {
    case "description":
      return typeof value === "string" && value !== "" ? { ...s, filters: { ...rest, description: value } } : s;
    case "category":
      return (CATEGORIES as readonly unknown[]).includes(value) ? { ...s, filters: { ...rest, category: value as LineCategory } } : s;
    case "quantity":
      return typeof value === "number" && Number.isFinite(value) ? { ...s, filters: { ...rest, quantity: value } } : s;
  }
}

export const invoice: TemplateModule<InvoiceState, InvoiceView> = {
  id: "invoice",
  astryx: "table-page",
  title: "Invoice",
  initial: () => ({ query: "", basis: "all", filters: {}, sort: null }),
  reduce(s, action) {
    if (action.type === "press") {
      if (action.id === "clear") return { ...s, query: "", basis: "all", filters: {} };
      if (action.id.startsWith("unfilter:")) {
        const column = action.id.slice(9);
        return (FILTER_COLUMNS as readonly string[]).includes(column) ? withFilter(s, column as FilterColumn, null) : s;
      }
      return s;
    }
    const { id, value } = action;
    if (id === "query") return { ...s, query: String(value) };
    if (id === "basis") return value === "all" || value === "hourly" ? { ...s, basis: value } : s;
    if (id.startsWith("filter:")) {
      const column = id.slice(7);
      return (FILTER_COLUMNS as readonly string[]).includes(column) && typeof value !== "boolean" ? withFilter(s, column as FilterColumn, value) : s;
    }
    if (id === "sort") {
      if (value === "") return { ...s, sort: null };
      const [key, direction] = String(value).split(":");
      return (SORT_KEYS as readonly string[]).includes(key!) && (direction === "ascending" || direction === "descending")
        ? { ...s, sort: { key: key as SortKey, direction } }
        : s;
    }
    return s;
  },
  view(s) {
    const visible = visibleRows(s);
    const rows = sorted(visible, s.sort);
    const subtotalCents = visible.reduce((sum, item) => sum + item.amountCents, 0);
    const taxCents = Math.round(subtotalCents * TAX_RATE);
    const totalCents = subtotalCents + taxCents;
    // Filter presence, not row count: a filter that matches every line still makes the totals a view.
    const activeFilterCount = (s.query.trim() === "" ? 0 : 1) + Object.keys(s.filters).length + (s.basis === "all" ? 0 : 1);
    return {
      title: "Invoice INV-2043",
      details: INVOICE_DETAILS.map((d) => ({ ...d })),
      basisFilters: BASIS_FILTERS.map((f) => ({ ...f })),
      basis: s.basis,
      query: s.query,
      filters: { ...s.filters },
      categories: CATEGORIES.map((value) => ({ value, label: CATEGORY_LABEL[value] })),
      sort: s.sort ? [{ sortKey: s.sort.key, direction: s.sort.direction }] : [],
      rows: rows.map((item) => ({
        id: item.id,
        description: item.description,
        category: CATEGORY_LABEL[item.category],
        quantity: grouped(item.quantity),
        rate: money(item.unitPriceCents),
        amount: money(item.amountCents),
        card: {
          category: CATEGORY_LABEL[item.category],
          billing: item.basis === "hourly" ? "Hourly" : "Fixed fee",
          calculation: `${grouped(item.quantity)} × ${money(item.unitPriceCents)}`,
          amount: money(item.amountCents),
          share: `${((item.amountCents / INVOICE_SUBTOTAL_CENTS) * 100).toFixed(1)}%`,
        },
      })),
      empty: visible.length === 0 ? { title: "No matching line items", description: "No line on this invoice matches the current filters." } : null,
      totals: [
        { label: "Subtotal", value: money(subtotalCents), emphasis: null },
        { label: "Tax (8.75%)", value: money(taxCents), emphasis: "muted" },
        { label: "Total due", value: money(totalCents), emphasis: "strong" },
      ],
      banner:
        visible.length > 0 && activeFilterCount > 0
          ? {
              title: "Filtered view — these totals are partial",
              description: `Showing ${visible.length} of ${ROWS.length} lines. The subtotal, tax, and total due above cover only the lines currently visible.`,
            }
          : null,
    };
  },
};
