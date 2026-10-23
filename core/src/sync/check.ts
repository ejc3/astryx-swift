/**
 * What every area's mutations are made of: argument checks and row writes (mutations.ts).
 * A check refuses anything it does not expect, including extra fields.
 */
import { isOrderKey } from "./order.ts";
import type { ColumnType, Field, TableName, Write } from "./doc.ts";

export type { ColumnType };
export type Args = Record<string, unknown>;

export type MutationDef<A extends Args> = {
  /** The arguments, checked: `null` when they are not acceptable (the mutation is refused). */
  check(args: unknown): A | null;
  writes(args: A): Write[];
};

export const define = <A extends Args>(def: MutationDef<A>): MutationDef<A> => def;

// --- Argument checks -------------------------------------------------------------------------

export const object = (v: unknown): Args | null => (typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Args) : null);
/** Ids are minted by the core ("<seed>-<n>") or are sample ids: short, URL-safe. */
export const isId = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(v);
export const isText = (max: number) => (v: unknown): v is string => typeof v === "string" && v.length <= max;
export const isInstant = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v > 0;
export const isKey = (v: unknown): v is string => typeof v === "string" && v.length <= 64 && isOrderKey(v);
export const oneOf = <T extends string>(values: readonly T[]) => (v: unknown): v is T => typeof v === "string" && (values as readonly string[]).includes(v);

/** Checks `args` field by field; any field that fails refuses the whole mutation. */
export function fields<A extends Args>(args: unknown, checks: NoInfer<{ [K in keyof A]: (v: unknown) => boolean }>): A | null {
  const o = object(args);
  if (!o) return null;
  for (const [k, ok] of Object.entries(checks)) if (!(ok as (v: unknown) => boolean)(o[k])) return null;
  if (Object.keys(o).some((k) => !(k in checks))) return null;
  return o as A;
}

export const put = (table: TableName, id: string, values: Record<string, Field>): Write => ({ table, id, fields: values });

