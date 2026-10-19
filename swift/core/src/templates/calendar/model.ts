/**
 * Astryx's `CalendarShowcase` template, refactored: the selected date and the visible
 * month live here. The JSX is web/src/templates/calendar.tsx; the stock copy is
 * web/src/stock/templates/CalendarShowcase.tsx. The Calendar component draws its own month
 * and weekday labels; the core owns the two inputs that decide what it shows.
 *
 * Actions (ids after the "tpl.calendar." prefix):
 *   set "select"  value: an ISO date "YYYY-MM-DD": the day the person picked
 *   set "focus"   value: an ISO date: the month to show (the first of that month)
 */
import type { TemplateModule } from "../types.ts";

/** An ISO date, "YYYY-MM-DD". */
export type IsoDate = string;

export type CalendarState = {
  /** The selected day. */
  value: IsoDate | null;
  /** A day in the visible month. */
  focusDate: IsoDate;
};

/** Words only the native drawing speaks (VoiceOver); the web ignores them. */
export type CalendarWords = {
  today: string;
  selected: string;
  previousMonth: string;
  nextMonth: string;
};

export type View = {
  value: IsoDate | null;
  focusDate: IsoDate;
  words: CalendarWords;
};

export type CalendarView = View;

const ISO = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

const WORDS: CalendarWords = { today: "Today", selected: "Selected", previousMonth: "Previous month", nextMonth: "Next month" };

export const calendar: TemplateModule<CalendarState, View> = {
  id: "calendar",
  astryx: "CalendarShowcase",
  title: "Calendar",
  // The stock template opens on April 15, 2026, whatever today is.
  initial: () => ({ value: "2026-04-15", focusDate: "2026-04-15" }),
  reduce(state, action) {
    if (action.type !== "set" || typeof action.value !== "string" || !ISO.test(action.value)) return state;
    if (action.id === "select") return action.value === state.value ? state : { ...state, value: action.value };
    if (action.id === "focus") return action.value === state.focusDate ? state : { ...state, focusDate: action.value };
    return state;
  },
  view: (state) => ({ value: state.value, focusDate: state.focusDate, words: WORDS }),
};
