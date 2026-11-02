import { pool } from "@/db/pool";
import { seedDemo } from "@/server/seed";

async function main() {
  const client = await pool.connect();
  try {
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
