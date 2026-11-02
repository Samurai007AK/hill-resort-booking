// Runs on every Vercel build: apply new migrations, and seed demo data only into an empty database,
// so a redeploy never wipes what reviewers have done. The GM's Reset demo reseeds on purpose.
import { pool } from "@/db/pool";
import { migrate } from "@/db/migrate";
import { seedDemo } from "@/server/seed";

async function main() {
  const client = await pool.connect();
  try {
    const applied = await migrate(client);
    console.log(applied.length ? `applied: ${applied.join(", ")}` : "migrations up to date");
    const { rows } = await client.query<{ n: number }>("SELECT count(*)::int AS n FROM room_types");
    if (rows[0].n === 0) {
      await seedDemo(client);
      console.log("empty database: demo data seeded");
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
