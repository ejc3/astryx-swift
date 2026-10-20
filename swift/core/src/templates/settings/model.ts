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
 */
import type { TemplateModule } from "../types.ts";
import { COMMON_WORDS, type CommonWords } from "../checkout/words.ts";

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
  }),
  reduce(s, action) {
    if (action.type === "press") {
      if (action.id.startsWith("nav:")) {
        const label = action.id.slice(4);
        return (NAV_ITEMS as readonly string[]).includes(label) ? { ...s, activeNav: label } : s;
      }
      return s;
    }
    const { id, value } = action;
    if ((TEXT_FIELDS as readonly string[]).includes(id)) return { ...s, [id]: String(value) };
    if ((TOGGLES as readonly string[]).includes(id)) return { ...s, [id]: value === true };
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
  view: (s) => ({
    navItems: NAV_ITEMS.map((label) => ({ label, isSelected: s.activeNav === label })),
    searchItems: SEARCH_ITEMS.map((item) => ({ ...item })),
    search: SEARCH_ITEMS.find((item) => item.id === s.search) ?? null,
    searchQuery: s.searchQuery,
    results: results(s),
    username: s.username,
    firstName: s.firstName,
    lastName: s.lastName,
    email: s.email,
    currentPw: s.currentPw,
    newPw: s.newPw,
    confirmPw: s.confirmPw,
    dataExport: s.dataExport,
    adminMembers: s.adminMembers,
    twoFactor: s.twoFactor,
    rules: RULES,
    inert: ["save.basic", "save.password", "save.advanced"],
    words: WORDS,
  }),
};
