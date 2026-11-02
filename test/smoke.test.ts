import { afterAll, expect, test } from "vitest";
import { pool } from "@/db/pool";

afterAll(() => pool.end());

test("test database is reachable and migrated", async () => {
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM schema_migrations");
  expect(rows[0].n).toBeGreaterThanOrEqual(0);
});
