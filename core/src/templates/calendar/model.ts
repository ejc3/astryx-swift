/**
 * Astryx's `CalendarShowcase` template, refactored: its state, sample data and logic, here.
 * The JSX is web/src/templates/calendar.tsx; the stock copy is web/src/stock/templates/CalendarShowcase.tsx.
 * (A stub until the template is refactored.)
 */
import type { TemplateModule } from "../types.ts";

export type CalendarState = Record<string, never>;
export type CalendarView = Record<string, never>;

export const calendar: TemplateModule<CalendarState, CalendarView> = {
  id: "calendar",
  astryx: "CalendarShowcase",
  title: "Calendar",
  initial: () => ({}),
  reduce: (s) => s,
  view: () => ({}),
};
