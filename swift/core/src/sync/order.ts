/**
 * Order keys: a position in a list as a string, so moving one item writes only that item's row
 * and two devices moving different items never rewrite each other. Keys compare as plain strings
 * (code unit order); `between` makes a key strictly between two others.
 *
 * The algorithm is fractional-indexing's `midpoint` (David Greenspan, CC0), without its integer
 * part: digits are base 36 and a key never ends in "0", so a key always exists between two keys.
 */

const DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz";

function midpoint(a: string, b: string | null): string {
  if (b !== null) {
    let n = 0;
    while ((a[n] ?? "0") === b[n]) n++;
    if (n > 0) return b.slice(0, n) + midpoint(a.slice(n), b.slice(n));
  }
  const digitA = a ? DIGITS.indexOf(a[0]!) : 0;
  const digitB = b !== null ? DIGITS.indexOf(b[0]!) : DIGITS.length;
  if (digitB - digitA > 1) return DIGITS[Math.round((digitA + digitB) / 2)]!;
  if (b !== null && b.length > 1) return b.slice(0, 1);
  return DIGITS[digitA]! + midpoint(a.slice(1), null);
}

/** A key after `before` and before `after`; either may be null (the start or end of the list). */
export function between(before: string | null, after: string | null): string {
  if (before !== null && after !== null && before >= after) throw new Error(`No key between ${before} and ${after}`);
  return midpoint(before ?? "", after);
}

/** Keys for `n` items in a row, evenly spread: the order of sample data that has no keys. */
export function spread(n: number): string[] {
  const keys: string[] = [];
  let last: string | null = null;
  for (let i = 0; i < n; i++) keys.push((last = between(last, null)));
  return keys;
}

/** Whether `key` is a key `between` could have made. */
export const isOrderKey = (key: string): boolean => /^[0-9a-z]*[1-9a-z]$/.test(key);
