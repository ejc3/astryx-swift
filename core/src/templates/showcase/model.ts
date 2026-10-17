/**
 * Astryx's `theme-showcase` template, refactored: its state, sample data and logic, here.
 * The JSX is web/src/templates/showcase.tsx; the stock copy is web/src/stock/templates/theme-showcase.tsx.
 * (A stub until the template is refactored.)
 */
import type { TemplateModule } from "../types.ts";

export type ShowcaseState = Record<string, never>;
export type ShowcaseView = Record<string, never>;

export const showcase: TemplateModule<ShowcaseState, ShowcaseView> = {
  id: "showcase",
  astryx: "theme-showcase",
  title: "Theme showcase",
  initial: () => ({}),
  reduce: (s) => s,
  view: () => ({}),
};
