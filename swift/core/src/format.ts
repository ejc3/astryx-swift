/**
 * Words for numbers and dates, worked out here so every host shows the same ones. No
 * `Intl`: Hermes and the browsers do not agree on its output, and the core has no locale
 * but its own (US English).
 */

/** A calendar date in the viewer's time zone. `month` is 1-12. */
export type Civil = { year: number; month: number; day: number };

/** The host's clock, as the host read it: the instant and the viewer's offset from UTC. */
export type Now = { epochMs: number; utcOffsetMinutes: number };

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function civilOf(now: Now): Civil {
  const d = new Date(now.epochMs + now.utcOffsetMinutes * 60_000);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** Minutes since local midnight. */
export function minuteOf(now: Now): number {
  const d = new Date(now.epochMs + now.utcOffsetMinutes * 60_000);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/** Days since 1970-01-01 for a civil date, so dates can be compared and added. */
export function dayNumber(c: Civil): number {
  return Math.floor(Date.UTC(c.year, c.month - 1, c.day) / 86_400_000);
}

export function civilFromDayNumber(n: number): Civil {
  const d = new Date(n * 86_400_000);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

export function addDays(c: Civil, days: number): Civil {
  return civilFromDayNumber(dayNumber(c) + days);
}

export function sameDay(a: Civil, b: Civil): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

/** 0 = Sunday. */
export function weekday(c: Civil): number {
  return (((dayNumber(c) + 4) % 7) + 7) % 7;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function monthTitle(year: number, month: number): string {
  return `${MONTHS[month - 1]} ${year}`;
}

export function monthShort(month: number): string {
  return MONTHS[month - 1]!.slice(0, 3);
}

export function weekdayName(c: Civil): string {
  return WEEKDAYS[weekday(c)]!;
}

export function weekdayInitials(): string[] {
  return WEEKDAYS.map((w) => w.slice(0, 2));
}

/** "Oct 14". */
export function shortDate(c: Civil): string {
  return `${monthShort(c.month)} ${c.day}`;
}

/** "Tuesday, October 14". */
export function longDate(c: Civil): string {
  return `${weekdayName(c)}, ${MONTHS[c.month - 1]} ${c.day}`;
}

/** "Today", "Tomorrow", "Yesterday", or "Oct 14" relative to `today`. */
export function relativeDay(c: Civil, today: Civil): string {
  const diff = dayNumber(c) - dayNumber(today);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return shortDate(c);
}

/** A time of day from minutes since midnight: "9:05 AM". */
export function clock(minute: number): string {
  const m = ((minute % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(mm).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** "3m", "2h", "Yesterday", "Oct 12": how long ago something was, as an inbox says it. */
export function ago(minutesAgo: number, today: Civil, minuteNow: number): string {
  if (minutesAgo < 1) return "Now";
  if (minutesAgo < 60) return `${minutesAgo}m`;
  if (minutesAgo < minuteNow) return `${Math.floor(minutesAgo / 60)}h`;
  const daysAgo = Math.floor((minutesAgo - minuteNow) / 1440) + 1;
  return relativeDay(addDays(today, -daysAgo), today);
}

/** 1234567 -> "1,234,567". */
export function grouped(n: number): string {
  const sign = n < 0 ? "-" : "";
  const digits = String(Math.abs(Math.trunc(n)));
  let out = "";
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += ",";
    out += digits[i];
  }
  return sign + out;
}

/** Cents -> "$1,234.50". */
export function money(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.round(cents));
  return `${sign}$${grouped(Math.floor(abs / 100))}.${String(abs % 100).padStart(2, "0")}`;
}

/** 12400 -> "12.4k"; under 1000 as it is. */
export function compact(n: number): string {
  if (Math.abs(n) < 1000) return grouped(n);
  if (Math.abs(n) < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, "")}k`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}

/** 0.1234 -> "12.3%". */
export function percent(fraction: number, digits = 1): string {
  return `${(fraction * 100).toFixed(digits).replace(/\.0+$/, "")}%`;
}

/** "1 message", "3 messages". */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${grouped(n)} ${n === 1 ? one : many}`;
}

/** "Ada Lovelace" -> "AL". */
export function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1]![0] : "")).toUpperCase();
}

/** A stable hue (0-359) for a name, so a person keeps one color everywhere. */
export function hueOf(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}
