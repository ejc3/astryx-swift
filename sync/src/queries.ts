/**
 * One named query per saved table (docs/SYNC.md): the signed-in person's rows, and nothing else.
 * zero-cache asks the API to turn each name into the query it may run (`/api/zero/query`), with
 * `ctx` from the verified token, so a client cannot widen it. A signed-out caller gets nothing.
 * The query's name is the table's name.
 */
import { TABLES, type TableName } from "@astryx-native/core";
import { defineQueriesWithType, defineQueryWithType } from "@rocicorp/zero";
import { zql, type Context, type Schema } from "./schema.ts";

const defineQuery = defineQueryWithType<Schema, Context>();

// Zero's builder is typed per table; a table chosen at run time is typed loosely here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const from = (t: TableName): any => (zql as any)[t];

function ownRows(t: TableName) {
  return defineQuery(({ ctx }) => (ctx ? from(t).where("owner", ctx.userID) : from(t).where("owner", "").limit(0)));
}

export const queries = defineQueriesWithType<Schema>()(Object.fromEntries(TABLES.map((t) => [t, ownRows(t)])) as Record<TableName, ReturnType<typeof ownRows>>);

/** The query request for one table's rows, as the client subscribes to it. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const tableQuery = (t: TableName) => (queries as any)[t]();
