/**
 * Astryx's `CalendarShowcase` template, refactored: the selected date and the visible
 * month live here. The JSX is web/src/templates/calendar.tsx; the stock copy is
 * web/src/stock/templates/CalendarShowcase.tsx. The Calendar component draws its own month
 * and weekday labels; the core owns the two inputs that decide what it shows.
 *
 * Actions (ids after the "tpl.calendar." prefix):
 *   set "select"  value: an ISO date "YYYY-MM-DD": the day the person picked
 *   set "focus"   value: an ISO date: the month to show (the first of that month)
 *   set "pick"    value: an ISO date: select it and show its month (what a native tap on a day does,
 *                 whether the day is in the visible month or in a neighboring one)
 * Stepping a month is `set "focus"` with the view's `previous.target` or `next.target`.
 *
 * The view also carries the month the way a native drawing draws it, so no host does date math or
 * speaks English of its own: the title ("April 2026"), the six weeks of seven days from the Sunday on
 * or before the 1st (each day with its number, ISO date, flags and spoken label), and the previous
 * and next months with their spoken labels. The words are English (the core has no locale), the same
 * as the web's Astryx Calendar. The web keeps drawing its own grid from `value` and `focusDate`.
 */
import { civilFromDayNumber, dayNumber, longDate, monthTitle, sameDay, weekday, weekdayInitials, civilOf, type Civil } from "../../format.ts";
import type { TemplateModule } from "../types.ts";

/** An ISO date, "YYYY-MM-DD". */
export type IsoDate = string;

export type CalendarState = {
  /** The selected day. */
  value: IsoDate | null;
  /** A day in the visible month. */
  focusDate: IsoDate;
};

/** Words the native drawing speaks (VoiceOver) or draws (the weekday names); the web's Calendar has its own. */
export type CalendarWords = {
  today: string;
  selected: string;
  previousMonth: string;
  nextMonth: string;
  /** The two-letter weekday names the grid's header shows, Sunday first: "Su" to "Sa". */
  weekdays: string[];
};

/** One cell of the month grid. */
export type CalendarDay = {
  /** The date, "YYYY-MM-DD": what tapping the day sends as `pick`. */
  date: IsoDate;
  /** The day of the month, 1-31: the number drawn in the cell. */
  day: number;
  /** In the visible month; false for the days of the neighboring months the grid pads with. */
  inMonth: boolean;
  selected: boolean;
  today: boolean;
  /** Spoken: "Wednesday, April 15, 2026", with "Today, " first for today. */
  label: string;
  /** For the list form of the month: "Wednesday 15". */
  agendaLabel: string;
};

/** A month the person can step to. */
export type CalendarStep = {
  /** The first of that month, "YYYY-MM-01": the `focus` value that shows it. */
  target: IsoDate;
  /** Spoken: "Previous month, March 2026". */
  label: string;
};

export type View = {
  value: IsoDate | null;
  focusDate: IsoDate;
  words: CalendarWords;
  /** The visible month: "April 2026". */
  title: string;
  /** Six weeks of seven days, Sunday first. */
  weeks: CalendarDay[][];
  previous: CalendarStep;
  next: CalendarStep;
  /** What a screen reader announces when the selection changes: "Selected, Wednesday, April 15, 2026"; null with no selection. */
  selectedAnnouncement: string | null;
};

export type CalendarView = View;

const ISO = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const WORDS: CalendarWords = {
  today: "Today",
  selected: "Selected",
  previousMonth: "Previous month",
  nextMonth: "Next month",
  weekdays: weekdayInitials(),
};

const pad = (n: number, width: number) => String(n).padStart(width, "0");
const iso = (c: Civil): IsoDate => `${pad(c.year, 4)}-${pad(c.month, 2)}-${pad(c.day, 2)}`;
const parse = (d: IsoDate): Civil => ({ year: Number(d.slice(0, 4)), month: Number(d.slice(5, 7)), day: Number(d.slice(8, 10)) });
const sameMonth = (a: Civil, b: Civil) => a.year === b.year && a.month === b.month;
const firstOf = (c: Civil): Civil => ({ year: c.year, month: c.month, day: 1 });

/** The first of the month `n` months from the one `c` is in. */
function shiftMonth(c: Civil, n: number): Civil {
  const index = c.year * 12 + (c.month - 1) + n;
  return { year: Math.floor(index / 12), month: (index % 12 + 12) % 12 + 1, day: 1 };
}

/** "Wednesday, April 15, 2026". */
const fullDate = (c: Civil) => `${longDate(c)}, ${c.year}`;

/** The spoken name of a day: its full date, "Today, " first when it is today. */
function spoken(c: Civil, today: Civil): string {
  return sameDay(c, today) ? `${WORDS.today}, ${fullDate(c)}` : fullDate(c);
}

/** The six weeks that show `month` (any day in it): from the Sunday on or before the 1st. */
export function monthWeeks(month: Civil, selected: Civil | null, today: Civil): CalendarDay[][] {
  const first = firstOf(month);
  const start = dayNumber(first) - weekday(first);
  const weeks: CalendarDay[][] = [];
  for (let w = 0; w < 6; w++) {
    const row: CalendarDay[] = [];
    for (let d = 0; d < 7; d++) {
      const c = civilFromDayNumber(start + w * 7 + d);
      row.push({
        date: iso(c),
        day: c.day,
        inMonth: c.month === month.month && c.year === month.year,
        selected: selected !== null && sameDay(c, selected),
        today: sameDay(c, today),
        label: spoken(c, today),
        agendaLabel: `${WEEKDAY_NAMES[weekday(c)]} ${c.day}`,
      });
    }
    weeks.push(row);
  }
  return weeks;
}

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
    if (action.id === "pick") {
      const focusDate = iso(firstOf(parse(action.value)));
      // A day of the visible month leaves the focus where it is; one of a neighbor moves the view there.
      const moved = sameMonth(parse(action.value), parse(state.focusDate)) ? state.focusDate : focusDate;
      return action.value === state.value && moved === state.focusDate ? state : { ...state, value: action.value, focusDate: moved };
    }
    return state;
  },
  view(state, now) {
    const month = parse(state.focusDate);
    const today = civilOf(now);
    const selected = state.value === null ? null : parse(state.value);
    const previous = shiftMonth(month, -1);
    const next = shiftMonth(month, 1);
    return {
      value: state.value,
      focusDate: state.focusDate,
      words: WORDS,
      title: monthTitle(month.year, month.month),
      weeks: monthWeeks(month, selected, today),
      previous: { target: iso(previous), label: `${WORDS.previousMonth}, ${monthTitle(previous.year, previous.month)}` },
      next: { target: iso(next), label: `${WORDS.nextMonth}, ${monthTitle(next.year, next.month)}` },
      selectedAnnouncement: selected === null ? null : `${WORDS.selected}, ${fullDate(selected)}`,
    };
  },
};
