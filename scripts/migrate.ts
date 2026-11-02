import { pool } from "@/db/pool";
import { migrate } from "@/db/migrate";

async function main() {
  const client = await pool.connect();
  try {
    const applied = await migrate(client);
    console.log(applied.length ? `applied: ${applied.join(", ")}` : "up to date");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
