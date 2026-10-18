/**
 * Astryx's `settings` template, refactored: its state, sample data and logic, here.
 * The JSX is web/src/templates/settings.tsx; the stock copy is web/src/stock/templates/settings.tsx.
 *
 * Actions (the "tpl.settings." prefix removed):
 *   press  nav:<label>          choose a section
 *   set    <field>  <string>    username, firstName, lastName, email, currentPw, newPw, confirmPw
 *   set    <toggle> <boolean>   dataExport, adminMembers, twoFactor
 *   set    search   <item id>   the chosen search result ("" clears it)
 */
import type { TemplateModule } from "../types.ts";

const NAV_ITEMS = ["Profile", "Account", "Members", "Billing", "Invoices", "API"] as const;

export type SearchItem = { id: string; label: string };

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
};

export type SettingsView = {
  navItems: { label: string; isSelected: boolean }[];
  searchItems: SearchItem[];
  search: SearchItem | null;
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
};
export type View = SettingsView;

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
      return { ...s, search: found ? found.id : null };
    }
    return s;
  },
  view: (s) => ({
    navItems: NAV_ITEMS.map((label) => ({ label, isSelected: s.activeNav === label })),
    searchItems: SEARCH_ITEMS.map((item) => ({ ...item })),
    search: SEARCH_ITEMS.find((item) => item.id === s.search) ?? null,
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
  }),
};
