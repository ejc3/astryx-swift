/**
 * Makes the saved-data tables (from the core's SCHEMA, through sync's `migration`) at start. Safe
 * to run on every start and from two starts at once: it takes a lock, reads what the database
 * has, and runs only what is missing.
 */
import { migration } from "@astryx-native/sync";
import postgres from "postgres";

export async function applySchema(url: string): Promise<string[]> {
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    return await sql.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(hashtextextended('astryx-swift schema', 0))`;
      const rows = await tx<{ table_name: string; column_name: string }[]>`
        SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'`;
      const existing = new Map<string, Set<string>>();
      for (const r of rows) {
        let cols = existing.get(r.table_name);
        if (!cols) existing.set(r.table_name, (cols = new Set()));
        cols.add(r.column_name);
      }
      const statements = migration(existing);
      for (const s of statements) await tx.unsafe(s);
      return statements;
    });
  } finally {
    await sql.end();
  }
}
