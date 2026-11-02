import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { ClientBase } from "pg";

const DIR = path.join(process.cwd(), "db", "migrations");

/** Applies db/migrations/NNNN_*.sql in name order, each once, each in its own transaction. */
export async function migrate(client: ClientBase): Promise<string[]> {
  await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
  const done = new Set((await client.query<{ name: string }>("SELECT name FROM schema_migrations")).rows.map((r) => r.name));
  const files = (await readdir(DIR)).filter((f) => f.endsWith(".sql")).sort();
  const applied: string[] = [];
  for (const file of files.filter((f) => !done.has(f))) {
    await client.query("BEGIN");
    try {
      await client.query(await readFile(path.join(DIR, file), "utf8"));
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw new Error(`migration ${file} failed: ${(e as Error).message}`);
    }
    applied.push(file);
  }
  return applied;
}

/** Drops everything in the public schema. Dev reset and tests only. */
export async function dropAll(client: ClientBase): Promise<void> {
  await client.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
}
