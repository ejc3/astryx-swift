/**
 * Astryx's `dashboard` template, refactored: its state, sample data and logic, here.
 * The JSX is web/src/templates/dashboard.tsx; the stock copy is web/src/stock/templates/dashboard.tsx.
 * (A stub until the template is refactored.)
 */
import type { TemplateModule } from "../types.ts";

export type DashboardState = Record<string, never>;
export type DashboardView = Record<string, never>;

export const dashboard: TemplateModule<DashboardState, DashboardView> = {
  id: "dashboard",
  astryx: "dashboard",
  title: "Dashboard",
  initial: () => ({}),
  reduce: (s) => s,
  view: () => ({}),
};
