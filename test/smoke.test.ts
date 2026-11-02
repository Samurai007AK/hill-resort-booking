import { afterAll, expect, test } from "vitest";
import { pool } from "@/db/pool";

afterAll(() => pool.end());

test("migrations created the core tables", async () => {
  const { rows } = await pool.query("SELECT to_regclass('reservation') AS r, to_regclass('inventory_night') AS n");
  expect(rows[0]).toEqual({ r: "reservation", n: "inventory_night" });
});
