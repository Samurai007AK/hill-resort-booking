import { rmSync } from "node:fs";
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";
import { dropAll, migrate } from "../src/db/migrate";

// Tests get a fresh, migrated database. CI passes DATABASE_URL (a Postgres service);
// locally an embedded Postgres runs on its own port and is deleted afterwards.
export default async function setup() {
  let embedded: EmbeddedPostgres | undefined;
  let url = process.env.DATABASE_URL;
  if (url) {
    // The schema gets dropped, so refuse anything that is not clearly a test database.
    if (!/test/i.test(new URL(url).pathname))
      throw new Error("DATABASE_URL for tests must name a *test* database");
  } else {
    rmSync(".pgdata-test", { recursive: true, force: true }); // left behind if a run was killed
    embedded = new EmbeddedPostgres({
      databaseDir: ".pgdata-test",
      port: 54330,
      user: "postgres",
      password: "postgres",
      persistent: false,
      initdbFlags: ["--encoding=UTF8", "--locale=C"],
      onLog: () => {},
    });
    await embedded.initialise();
    await embedded.start();
    await embedded.createDatabase("resort_test");
    url = "postgres://postgres:postgres@localhost:54330/resort_test";
    process.env.DATABASE_URL = url;
  }

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  await dropAll(client);
  await migrate(client);
  await client.end();

  return async () => {
    await embedded?.stop();
  };
}
