// npm run db:start — local Postgres in .pgdata/ on port 54329. Ctrl+C stops it.
import { existsSync } from "node:fs";
import EmbeddedPostgres from "embedded-postgres";

const pg = new EmbeddedPostgres({
  databaseDir: ".pgdata",
  port: 54329,
  user: "postgres",
  password: "postgres",
  persistent: true,
  onLog: () => {},
});

async function main() {
  if (!existsSync(".pgdata")) await pg.initialise();
  await pg.start();
  await pg.createDatabase("resort").catch(() => {}); // already exists after the first run
  console.log("Postgres ready: postgres://postgres:postgres@localhost:54329/resort (Ctrl+C to stop)");
  const stop = async () => {
    await pg.stop();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
