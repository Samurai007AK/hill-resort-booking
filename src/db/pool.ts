import pg from "pg";

// DATE stays an ISO string ('2026-11-14'): no timezone shifts. NUMERIC becomes a number.
pg.types.setTypeParser(1082, (v) => v);
pg.types.setTypeParser(1700, parseFloat);

export const LOCAL_DATABASE_URL = "postgres://postgres:postgres@localhost:54329/resort";

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? LOCAL_DATABASE_URL,
  max: 5,
});

/** Runs fn inside BEGIN/COMMIT on one client; rolls back on any throw. */
export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
