/**
 * Astryx's `settings` template, refactored: its state, sample data and logic, here.
 * The JSX is web/src/templates/settings.tsx; the stock copy is web/src/stock/templates/settings.tsx.
 *
 * Actions (the "tpl.settings." prefix removed):
 *   press  nav:<label>          choose a section
 *   set    <field>  <string>    username, firstName, lastName, email, currentPw, newPw, confirmPw
 *   set    <toggle> <boolean>   dataExport, adminMembers, twoFactor
 *   set    search   <item id>   the chosen search result ("" clears it)
 *   set    searchQuery <text>   the text in a drawing's own search box (native); it chooses the
 *                               result whose label it spells exactly, else clears the choice
 *
 * Searching: `searchSettings` is the one rule. A query matches a setting whose label contains it,
 * ignoring case, as Astryx's stock template filters it (the text is not trimmed); an empty query
 * matches all; at most `SEARCH_LIMIT` come back, which is Astryx's Typeahead menu size. The web
 * page calls it inside its `SearchSource`; a drawing without a search source reads
 * `view.results`, which is the same function applied to `searchQuery` (all of them once a result
 * is chosen and its label is the text, as a focus on the stock Typeahead lists them all).
 *
 * The password fields start with the stock sample text, so the web copy matches stock. A host
 * draws the core's value (it does not hold a state of its own for them).
 *
 * Saved data (docs/SYNC.md), with extras on. The username, first and last name, email and the
 * three checkboxes are saved as `settings.set` rows, keyed `account.<field>`. What the inputs show
 * is the DRAFT (view state, `drafts`, the last thing set) if there is one, else the saved value,
 * else the stock sample: so after a reload, or on another device, the fields show what was saved.
 * Passwords are never saved: they are drafts only, and nothing reads them back.
 *
 *   press  save.basic | save.advanced   commit the section's changed fields (the web page's Save)
 *   press  commit:<field>               commit one field (Apple platforms, see below)
 *   press  save.password                inert: there is no authentication backend to change a
 *                                       password in, so it does nothing and the view lists it in `inert`
 *
 * Committing writes one `settings.set` per field whose draft differs from the saved (or sample)
 * value, then drops those drafts so the field shows the saved row. A field whose draft the
 * setting refuses (too long) keeps its draft and is not written.
 *
 * Apple platforms (HIG: a settings window has no Save button; a change applies as it is made):
 * the host draws no Save for a group whose save is not in `inert`. A checkbox commits at once:
 * the host sends `set <toggle>` and then `press commit:<toggle>`. A text field commits when
 * editing ends (Return, or focus moving on): the host sends `press commit:<field>` after the
 * last `set` it already sent. The core is the same for every host; only the trigger differs.
 *
 * Without extras (stock Astryx's behaviour only, the parity harness) nothing is saved and every
 * Save and `commit` does nothing, as stock's Save buttons do; the drafts are then just the
 * fields' values.
 */
import type { TemplateIO, TemplateModule } from "../types.ts";
import { COMMON_WORDS, type CommonWords } from "../checkout/words.ts";
import type { Doc } from "../../sync/doc.ts";
import { SETTINGS } from "../../sync/areas/settings.ts";

const NAV_ITEMS = ["Profile", "Account", "Members", "Billing", "Invoices", "API"] as const;

export type SearchItem = { id: string; label: string };

/** Astryx's Typeahead shows at most this many suggestions (its `maxMenuItems`). */
export const SEARCH_LIMIT = 10;

/** The settings a query finds: label contains the query, ignoring case; empty finds all; capped. */
export function searchSettings<T extends SearchItem>(items: readonly T[], query: string): T[] {
  const needle = query.toLowerCase();
  return items.filter((item) => item.label.toLowerCase().includes(needle)).slice(0, SEARCH_LIMIT);
}

const SEARCH_ITEMS: readonly SearchItem[] = [
  { id: "1", label: "Username" },
  { id: "2", label: "First name" },
  { id: "3", label: "Last name" },
  { id: "4", label: "Email address" },
  { id: "5", label: "Change password" },
  { id: "6", label: "Data Export Access" },
  { id: "7", label: "Allow Admin to Add Members" },
  { id: "8", label: "Two-Factor Authentication" },
];

const TEXT_FIELDS = ["username", "firstName", "lastName", "email", "currentPw", "newPw", "confirmPw"] as const;
const TOGGLES = ["dataExport", "adminMembers", "twoFactor"] as const;

/** The fields each Save commits. The password section has no saved fields. */
const SECTION_FIELDS: Record<string, readonly string[]> = {
  "save.basic": ["username", "firstName", "lastName", "email"],
  "save.advanced": TOGGLES,
};
const SAVED_FIELDS: readonly string[] = [...SECTION_FIELDS["save.basic"]!, ...TOGGLES];
const settingKey = (field: string) => `account.${field}`;

/** Stock's three Save buttons do nothing; with extras the password's still does nothing (no auth backend to change one in). */
const INERT_STOCK = ["save.basic", "save.password", "save.advanced"];
const INERT_WITH_EXTRAS = ["save.password"];

export type SettingsState = {
  activeNav: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  currentPw: string;
  newPw: string;
  confirmPw: string;
  dataExport: boolean;
  adminMembers: boolean;
  twoFactor: boolean;
  /** The id of the chosen search result, or null. */
  search: string | null;
  /** The text in a drawing's own search box. */
  searchQuery: string;
  /** The last value set for a field, until it is saved (or set back to what is saved): view state, never synced. */
  drafts: Record<string, string | boolean>;
};

export type SettingsView = {
  navItems: { label: string; isSelected: boolean }[];
  searchItems: SearchItem[];
  search: SearchItem | null;
  /** The text in a drawing's own search box (the web page keeps its own and never sends it). */
  searchQuery: string;
  /** What `searchQuery` finds: `searchSettings`, or every item when the text is the chosen result's label. */
  results: SearchItem[];
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  currentPw: string;
  newPw: string;
  confirmPw: string;
  dataExport: boolean;
  adminMembers: boolean;
  twoFactor: boolean;
  /** The layout numbers both drawings read. */
  rules: SettingsRules;
  /** Controls that do nothing in the stock template and stay inert here: a host draws them disabled. */
  inert: string[];
  /** Every word the page shows: both drawings read them. */
  words: SettingsWords;
};
export type View = SettingsView;

export type SettingsRules = {
  /** The nav becomes tabs above the content at this viewport width and below (px, inclusive). */
  narrowMaxWidth: number;
  /** The page's content never grows wider than this (px). */
  contentMaxWidth: number;
  /** The section list's width beside the content, where there is room for it (px). */
  sidebarWidth: number;
  /** A group's explanation and fields sit side by side when each column can be this wide (px); else they stack. */
  groupColumnMin: number;
};

export type SettingsWords = CommonWords & {
  title: string;
  sections: string;
  searchLabel: string;
  searchPlaceholder: string;
  clearSearch: string;
  save: string;
  basic: { title: string; detail: string; username: string; firstName: string; lastName: string; email: string };
  password: {
    title: string; detail: string; current: string; currentPlaceholder: string; new: string; newPlaceholder: string;
    confirm: string; confirmPlaceholder: string;
  };
  advanced: {
    title: string; detail: string;
    dataExport: string; dataExportDetail: string; adminMembers: string; adminMembersDetail: string;
    twoFactor: string; twoFactorDetail: string;
  };
};

const RULES: SettingsRules = { narrowMaxWidth: 768, contentMaxWidth: 1440, sidebarWidth: 260, groupColumnMin: 320 };

const WORDS: SettingsWords = {
  ...COMMON_WORDS,
  title: "Settings",
  sections: "Settings sections",
  searchLabel: "Search",
  searchPlaceholder: "Search settings...",
  clearSearch: "Clear search",
  save: "Save",
  basic: {
    title: "Basic information",
    detail: "View and update your personal details and account information.",
    username: "Username",
    firstName: "First name",
    lastName: "Last name",
    email: "Email address",
  },
  password: {
    title: "Change password",
    detail: "Update your password to keep your account secure.",
    current: "Verify current password",
    currentPlaceholder: "Current password",
    new: "New password",
    newPlaceholder: "New password",
    confirm: "Confirm password",
    confirmPlaceholder: "Repeat the new password",
  },
  advanced: {
    title: "Advanced settings",
    detail: "Configure detailed account preferences and security options.",
    dataExport: "Data Export Access",
    dataExportDetail: "Allow export of personal data and backups.",
    adminMembers: "Allow Admin to Add Members",
    adminMembersDetail: "Admins can invite and manage members.",
    twoFactor: "Enable Two-Factor Authentication",
    twoFactorDetail: "Require 2FA for added account security.",
  },
};

function results(s: SettingsState): SearchItem[] {
  const chosen = SEARCH_ITEMS.find((item) => item.id === s.search);
  return chosen && s.searchQuery === chosen.label ? SEARCH_ITEMS.map((item) => ({ ...item })) : searchSettings(SEARCH_ITEMS, s.searchQuery);
}

type Value = string | boolean;

/** A field's saved value, when the doc holds one the setting accepts (a malformed row is ignored). */
function savedOf(doc: Doc | undefined, field: string): Value | undefined {
  if (!doc || !SAVED_FIELDS.includes(field)) return undefined;
  const key = settingKey(field);
  const value = doc.settings_value[key]?.value;
  return (typeof value === "string" || typeof value === "boolean") && SETTINGS[key]!(value) ? value : undefined;
}

/** What a field shows: its draft, else the saved value, else the stock sample. */
const shownBy = (s: SettingsState, doc: Doc | undefined) => (field: string): Value =>
  s.drafts[field] ?? savedOf(doc, field) ?? (s as unknown as Record<string, Value>)[field]!;

/** Sets a field's draft; a value equal to what the field would otherwise show clears the draft. */
function draft(s: SettingsState, io: TemplateIO | undefined, field: string, value: Value): SettingsState {
  const base = shownBy({ ...s, drafts: {} }, io?.extras ? io.doc : undefined)(field);
  const others = Object.fromEntries(Object.entries(s.drafts).filter(([k]) => k !== field));
  const drafts = value === base ? others : { ...others, [field]: value };
  const same = Object.keys(drafts).length === Object.keys(s.drafts).length && Object.keys(drafts).every((k) => drafts[k] === s.drafts[k]);
  return same ? s : { ...s, drafts };
}

/** Saves the drafts of `fields` as `settings.set` rows and drops them; a draft the setting refuses stays. */
function commit(s: SettingsState, io: TemplateIO, fields: readonly string[]): SettingsState {
  const saved = fields.filter((field) => {
    const value = s.drafts[field];
    if (value === undefined || !SAVED_FIELDS.includes(field) || !SETTINGS[settingKey(field)]!(value)) return false;
    io.save("settings.set", { key: settingKey(field), value });
    return true;
  });
  return saved.length === 0 ? s : { ...s, drafts: Object.fromEntries(Object.entries(s.drafts).filter(([k]) => !saved.includes(k))) };
}

export const settings: TemplateModule<SettingsState, SettingsView> = {
  id: "settings",
  astryx: "settings",
  title: "Settings",
  initial: () => ({
    activeNav: "Profile",
    username: "nicol43",
    firstName: "Stephanie",
    lastName: "Nicol",
    email: "stephanie_nicol@mail.com",
    currentPw: "password123",
    newPw: "password123",
    confirmPw: "password123",
    dataExport: false,
    adminMembers: false,
    twoFactor: false,
    search: null,
    searchQuery: "",
    drafts: {},
  }),
  reduce(s, action, _now, io) {
    if (action.type === "press") {
      if (action.id.startsWith("nav:")) {
        const label = action.id.slice(4);
        return (NAV_ITEMS as readonly string[]).includes(label) ? { ...s, activeNav: label } : s;
      }
      if (!io?.extras) return s;
      if (action.id.startsWith("commit:")) return commit(s, io, [action.id.slice(7)]);
      const fields = SECTION_FIELDS[action.id];
      return fields ? commit(s, io, fields) : s;
    }
    const { id, value } = action;
    if ((TEXT_FIELDS as readonly string[]).includes(id)) return draft(s, io, id, String(value));
    if ((TOGGLES as readonly string[]).includes(id)) return draft(s, io, id, value === true);
    if (id === "search") {
      const found = SEARCH_ITEMS.find((item) => item.id === String(value));
      return { ...s, search: found ? found.id : null, searchQuery: found ? found.label : "" };
    }
    if (id === "searchQuery") {
      const text = String(value);
      const found = SEARCH_ITEMS.find((item) => item.label === text);
      return { ...s, searchQuery: text, search: found ? found.id : null };
    }
    return s;
  },
  view: (s, _now, doc, extras = true) => {
    const shown = shownBy(s, extras ? doc : undefined);
    return {
      navItems: NAV_ITEMS.map((label) => ({ label, isSelected: s.activeNav === label })),
      searchItems: SEARCH_ITEMS.map((item) => ({ ...item })),
      search: SEARCH_ITEMS.find((item) => item.id === s.search) ?? null,
      searchQuery: s.searchQuery,
      results: results(s),
      username: shown("username") as string,
      firstName: shown("firstName") as string,
      lastName: shown("lastName") as string,
      email: shown("email") as string,
      currentPw: shown("currentPw") as string,
      newPw: shown("newPw") as string,
      confirmPw: shown("confirmPw") as string,
      dataExport: shown("dataExport") as boolean,
      adminMembers: shown("adminMembers") as boolean,
      twoFactor: shown("twoFactor") as boolean,
      rules: RULES,
      inert: extras ? INERT_WITH_EXTRAS : INERT_STOCK,
      words: WORDS,
    };
  },
};
