/**
 * Zero's tables and the Postgres tables behind them, both made from the core's SCHEMA
 * (core/src/sync/doc.ts): a saved table or column is added there and nowhere else.
 *
 * Every table gets `owner` (the signed-in user's id, set by the server from the token, never from
 * a client) and is keyed by (owner, id), so two accounts can hold a row with the same id (a
 * sample row each has changed) without touching each other. Every column but the key may be
 * empty: a row holds only the fields a person set.
 */
import { SCHEMA, TABLES, type ColumnType, type TableName } from "@astryx-native/core";
import { boolean, createBuilder, createSchema, json, number, string, table } from "@rocicorp/zero";

/** Who a query or mutator runs as: the token's subject, set by the API (and by the client for its own optimistic runs). */
export type Context = { userID: string } | undefined;

/** The columns every table has besides the core's: the key. */
export const KEY = ["owner", "id"] as const;

// One builder type for all four, so a column's type can be chosen at run time.
type Column = ReturnType<typeof string>;
const ZERO_COLUMN = { string, number, boolean, json } as unknown as Record<ColumnType, () => Column>;

/**
 * Each core column type in Postgres. A core `number` says nothing about being whole, so it is
 * `double precision`, which holds every safe integer (epoch milliseconds included) exactly.
 */
export const PG_TYPE: Record<ColumnType, string> = { string: "text", number: "double precision", boolean: "boolean", json: "jsonb" };

/** The Postgres name of a column: snake_case (`createdAt` is `created_at`). */
export const pgName = (column: string): string => column.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

const columnsOf = (t: TableName): [string, ColumnType][] => Object.entries(SCHEMA[t]) as [string, ColumnType][];

for (const t of TABLES) {
  if (!/^[a-z][a-z0-9_]*$/.test(t)) throw new Error(`table ${t}: a Postgres table name is lower snake_case`);
  for (const [c] of columnsOf(t)) {
    if ((KEY as readonly string[]).includes(c)) throw new Error(`${t}.${c}: "${c}" is the key every table already has`);
    if (!/^[a-z][A-Za-z0-9]*$/.test(c)) throw new Error(`${t}.${c}: a column name is camelCase`);
  }
}

function zeroTable(t: TableName) {
  const columns: Record<string, Column | ReturnType<Column["optional"]>> = { owner: string(), id: string() };
  for (const [c, type] of columnsOf(t)) {
    const col = ZERO_COLUMN[type]().optional();
    columns[c] = pgName(c) === c ? col : col.from(pgName(c));
  }
  return table(t).columns(columns).primaryKey(...KEY);
}

export const schema = createSchema({ tables: TABLES.map(zeroTable) });
export type Schema = typeof schema;
export const zql = createBuilder(schema);

const q = (name: string) => `"${name}"`;

/**
 * The Postgres statements that make every table, safe to run at every start: a table is made
 * with its key, then each column is added if it is missing, so a column added to SCHEMA later
 * reaches an existing database. Each table has a primary key, which is all zero-cache's logical
 * replication (the publication it makes for `public`) needs.
 */
export const SQL_STATEMENTS: readonly string[] = TABLES.flatMap((t) => [
  `CREATE TABLE IF NOT EXISTS ${q(t)} (${q("owner")} text NOT NULL, ${q("id")} text NOT NULL, PRIMARY KEY (${q("owner")}, ${q("id")}))`,
  ...columnsOf(t).map(([c, type]) => `ALTER TABLE ${q(t)} ADD COLUMN IF NOT EXISTS ${q(pgName(c))} ${PG_TYPE[type]}`),
]);

export const SQL = SQL_STATEMENTS.map((s) => `${s};`).join("\n");

/**
 * Only the statements a database still needs, given the tables and columns it has (Postgres
 * names): a missing table is made whole, a missing column is added, and nothing else is run, so
 * a start against an up-to-date database sends zero-cache no schema change at all.
 */
export function migration(existing: ReadonlyMap<string, ReadonlySet<string>>): string[] {
  return TABLES.flatMap((t) => {
    const have = existing.get(t);
    const cols = columnsOf(t).map(([c, type]) => [pgName(c), PG_TYPE[type]] as const);
    if (!have) return [`CREATE TABLE ${q(t)} (${q("owner")} text NOT NULL, ${q("id")} text NOT NULL, ${cols.map(([c, type]) => `${q(c)} ${type}, `).join("")}PRIMARY KEY (${q("owner")}, ${q("id")}))`];
    return cols.filter(([c]) => !have.has(c)).map(([c, type]) => `ALTER TABLE ${q(t)} ADD COLUMN ${q(c)} ${type}`);
  });
}

// Register the schema and context as Zero's defaults, so Zero's client and server helpers are
// typed with them wherever this package is imported.
declare module "@rocicorp/zero" {
  interface DefaultTypes {
    schema: Schema;
    context: Context;
  }
}
