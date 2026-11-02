// npm run db:reset: drop everything, migrate, seed. Local/dev databases only.
import { pool } from "@/db/pool";
import { dropAll, migrate } from "@/db/migrate";
import { seedDemo } from "@/server/seed";

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("db:reset refuses to run in production");
  const client = await pool.connect();
  try {
    await dropAll(client);
    console.log(`migrated: ${(await migrate(client)).join(", ")}`);
    await seedDemo(client);
    console.log("demo data seeded");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
