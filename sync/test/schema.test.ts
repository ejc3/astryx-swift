import assert from "node:assert/strict";
import { test } from "node:test";
import { SCHEMA, TABLES, type ColumnType } from "@astryx-native/core";
import { PG_TYPE, SQL, SQL_STATEMENTS, migration, pgName, schema } from "../src/schema.ts";

const ZERO_TYPE: Record<ColumnType, string> = { string: "string", number: "number", boolean: "boolean", json: "json" };

test("every core table is a Zero table keyed by (owner, id), with every column optional and typed", () => {
  assert.deepEqual(Object.keys(schema.tables).sort(), [...TABLES].sort());
  for (const t of TABLES) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const z = (schema.tables as any)[t];
    assert.deepEqual(z.primaryKey, ["owner", "id"]);
    assert.equal(z.columns.owner.optional, false);
    assert.equal(z.columns.id.optional, false);
    const cols = Object.entries(SCHEMA[t]) as [string, ColumnType][];
    assert.deepEqual(Object.keys(z.columns).sort(), ["id", "owner", ...cols.map(([c]) => c)].sort());
    for (const [c, type] of cols) {
      assert.equal(z.columns[c].type, ZERO_TYPE[type], `${t}.${c}`);
      assert.equal(z.columns[c].optional, true, `${t}.${c}`);
      if (pgName(c) !== c) assert.equal(z.columns[c].serverName, pgName(c));
    }
  }
});

test("Postgres names are snake_case", () => {
  assert.equal(pgName("createdAt"), "created_at");
  assert.equal(pgName("order"), "order");
});

test("the SQL makes every table with its key and every column, quoted (column and order are keywords)", () => {
  for (const t of TABLES) {
    assert.ok(SQL.includes(`CREATE TABLE IF NOT EXISTS "${t}" ("owner" text NOT NULL, "id" text NOT NULL, PRIMARY KEY ("owner", "id"));`), t);
    for (const [c, type] of Object.entries(SCHEMA[t]) as [string, ColumnType][]) assert.ok(SQL.includes(`ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "${pgName(c)}" ${PG_TYPE[type]};`), `${t}.${c}`);
  }
  assert.equal(SQL_STATEMENTS.filter((s) => s.startsWith("CREATE")).length, TABLES.length);
});

test("a migration runs only what is missing", () => {
  const fresh = migration(new Map());
  assert.equal(fresh.length, TABLES.length);
  assert.ok(fresh.every((s) => s.startsWith("CREATE TABLE ") && s.includes('PRIMARY KEY ("owner", "id")')));

  const full = new Map(TABLES.map((t) => [t as string, new Set(["owner", "id", ...Object.keys(SCHEMA[t]).map(pgName)])]));
  assert.deepEqual(migration(full), []);

  const t = TABLES[0]!;
  const [first] = Object.entries(SCHEMA[t])[0]! as [string, ColumnType];
  full.get(t)!.delete(pgName(first));
  assert.deepEqual(migration(full), [`ALTER TABLE "${t}" ADD COLUMN "${pgName(first)}" ${PG_TYPE[(SCHEMA[t] as Record<string, ColumnType>)[first]!]}`]);
});
