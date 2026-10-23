/**
 * Saved data: what a person made or changed, kept apart from view state (docs/SYNC.md).
 *
 * A `Doc` holds, per table, the person's saved rows by id. What a screen draws is the table's
 * sample rows with the saved rows laid over them: a saved row's fields replace the sample row's
 * (a field left out keeps the sample value), a row marked `deleted` is gone, and saved rows with
 * no sample row are new records. Sample rows nobody touched are never saved anywhere.
 *
 * Rows change only through writes, and writes come only from mutations (mutations.ts). The same
 * writes are applied here, by Zero's client and by the server, so every copy agrees.
 */

import { AREA_TABLES } from "./mutations.ts";

/** A saved field: plain JSON scalars only, so a row is one Postgres row with typed columns. */
export type Field = string | number | boolean | null;

/** A saved row: its id and the fields the person set. `deleted` hides a sample row. */
export type Row = { id: string; deleted?: boolean } & { [field: string]: Field | undefined };

/** A saved column's type. `json` holds any `Field` (a setting's value). Every column but `id` may be empty. */
export type ColumnType = "string" | "number" | "boolean" | "json";

/**
 * Every table that holds saved data and its columns, and nothing else: a write to another table
 * or column is refused. The sync layer makes Zero's schema and the Postgres tables from this list
 * (each also gets `owner`, set by the server). The tables are declared by area, in ./areas.
 */
export const SCHEMA = AREA_TABLES satisfies Record<string, Record<string, ColumnType>>;

export type TableName = keyof typeof SCHEMA;
export const TABLES = Object.keys(SCHEMA) as TableName[];

/** Whether `value` fits column `name` of `table`. */
export function fitsColumn(table: TableName, name: string, value: Field): boolean {
  const type = (SCHEMA[table] as Record<string, ColumnType>)[name];
  if (type === undefined) return false;
  return value === null || type === "json" || typeof value === type;
}
export const isTable = (name: string): name is TableName => (TABLES as readonly string[]).includes(name);

export type Doc = { readonly [T in TableName]: Readonly<Record<string, Row>> };

export const emptyDoc = (): Doc => Object.fromEntries(TABLES.map((t) => [t, {}])) as unknown as Doc;

/** A row write: `put` sets the given fields on the row, making it if it is new. */
export type Write = { table: TableName; id: string; fields: Record<string, Field> };

/** Applies writes in order; returns `doc` itself when nothing changed. A write to an unknown column throws: that is a bug in a mutation. */
export function applyWrites(doc: Doc, writes: readonly Write[]): Doc {
  let next = doc;
  for (const w of writes) {
    for (const [k, v] of Object.entries(w.fields)) if (!fitsColumn(w.table, k, v)) throw new Error(`${w.table}.${k} cannot hold ${JSON.stringify(v)}`);
    const table = next[w.table];
    const before = table[w.id];
    const after: Row = { ...before, ...w.fields, id: w.id };
    if (before && Object.keys(after).every((k) => before[k] === after[k])) continue;
    next = { ...next, [w.table]: { ...table, [w.id]: after } };
  }
  return next;
}

/** Replaces a table with rows a sync source sent (Zero's live query): the server's copy wins. */
export function replaceTable(doc: Doc, table: TableName, rows: readonly Row[]): Doc {
  return { ...doc, [table]: Object.fromEntries(rows.map((r) => [r.id, r])) };
}

/**
 * The rows a screen draws: `sample` with `saved` laid over it, in sample order, then the new
 * rows in id order. `null` and `undefined` fields keep the sample's value.
 */
export function overlay<T extends { id: string }>(sample: readonly T[], saved: Readonly<Record<string, Row>>, fromRow: (row: Row) => T | null): T[] {
  const out: T[] = [];
  const seen = new Set<string>();
  for (const s of sample) {
    seen.add(s.id);
    const row = saved[s.id];
    if (!row) { out.push(s); continue; }
    if (row.deleted) continue;
    const merged: Record<string, unknown> = { ...s };
    for (const [k, v] of Object.entries(row)) if (v !== null && v !== undefined) merged[k] = v;
    out.push(merged as T);
  }
  for (const id of Object.keys(saved).sort()) {
    if (seen.has(id)) continue;
    const row = saved[id]!;
    if (row.deleted) continue;
    const made = fromRow(row);
    if (made) out.push(made);
  }
  return out;
}

/** Checks a doc read from storage: unknown tables and malformed rows are dropped, never trusted. */
export function readDoc(value: unknown): Doc {
  const doc = emptyDoc() as Record<TableName, Record<string, Row>>;
  if (typeof value !== "object" || value === null) return doc;
  for (const [table, rows] of Object.entries(value as Record<string, unknown>)) {
    if (!isTable(table) || typeof rows !== "object" || rows === null) continue;
    for (const [id, row] of Object.entries(rows as Record<string, unknown>)) {
      if (typeof row !== "object" || row === null || (row as Row).id !== id) continue;
      const kept: Row = { id };
      for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
        if (k === "id" || v === undefined) continue;
        if ((v === null || ["string", "number", "boolean"].includes(typeof v)) && fitsColumn(table, k, v as Field)) kept[k] = v as Field;
      }
      doc[table][id] = kept;
    }
  }
  return doc;
}
