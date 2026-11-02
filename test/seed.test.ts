import { expect, test } from "vitest";
import { addDays, todayIST } from "@/domain/dates";
import { availability } from "@/server/booking";
import { DEMO_USERS, NIGHTS_AHEAD, ROOM_TYPES, seedDemo, soldOutNight } from "@/server/seed";
import { pool } from "./db";

const count = async (sql: string) =>
  (await pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${sql}`)).rows[0].n;

async function seed() {
  const client = await pool.connect();
  try {
    await seedDemo(client);
  } finally {
    client.release();
  }
}

test("seeding twice gives the same demo, and never deletes or changes users", async () => {
  await pool.query(
    `INSERT INTO users (email, name, password_hash, role) VALUES ('keep-me@demo.in', 'Keep', 'x', 'guest') ON CONFLICT DO NOTHING`,
  );
  await seed();
  const users = (await pool.query("SELECT id, email, password_hash FROM users ORDER BY email"))
    .rows;
  const before = {
    bookings: await count("reservation"),
    nights: await count("inventory_night"),
    promos: await count("promo"),
  };

  await seed();

  expect(
    (await pool.query("SELECT id, email, password_hash FROM users ORDER BY email")).rows,
  ).toEqual(users);
  expect(users.map((u) => u.email)).toEqual(
    expect.arrayContaining([...DEMO_USERS.map((u) => u.email), "keep-me@demo.in"]),
  );
  expect({
    bookings: await count("reservation"),
    nights: await count("inventory_night"),
    promos: await count("promo"),
  }).toEqual(before);
  expect(before).toEqual({ bookings: 16, nights: ROOM_TYPES.length * NIGHTS_AHEAD, promos: 2 });
  expect(await count("enquiry")).toBe(32);
  expect(
    (
      await pool.query(
        "SELECT id FROM enquiry WHERE id IN ('ENQ-4410','ENQ-4411','ENQ-4412') ORDER BY id",
      )
    ).rows,
  ).toEqual([{ id: "ENQ-4410" }, { id: "ENQ-4411" }, { id: "ENQ-4412" }]);
});

test("the keys add up to 76 and every room type has photos and two rate plans", async () => {
  expect(ROOM_TYPES.reduce((s, t) => s + t.keys, 0)).toBe(76);
  const { rows } = await pool.query(
    `SELECT t.id, cardinality(t.photos) AS photos, count(p.*)::int AS plans
     FROM room_types t JOIN rate_plans p ON p.room_type_id = t.id WHERE t.id NOT LIKE 't-%' GROUP BY t.id`,
  );
  expect(rows).toHaveLength(5);
  for (const r of rows) {
    expect(r.photos).toBeGreaterThanOrEqual(4);
    expect(r.plans).toBe(2);
  }
});

test("demo state: Coffee Villa sold out on one night, weekend Estate rate, closed nights", async () => {
  const sat = soldOutNight(todayIST());
  expect((await availability("coffee-villa", sat, addDays(sat, 1))).available).toBe(0);
  expect((await availability("coffee-villa", addDays(sat, 1), addDays(sat, 2))).available).toBe(3);

  const fri = addDays(sat, -1);
  const { rows } = await pool.query(
    "SELECT night, rate_inr FROM inventory_night WHERE room_type_id = 'estate-room' AND night IN ($1, $2, $3)",
    [addDays(sat, -2), fri, sat],
  );
  expect(rows.map((r) => r.rate_inr).sort()).toEqual([7200, 8200, 8200]);

  expect(await count("inventory_night WHERE closed")).toBe(3);
  expect(await count("payment")).toBe(14);
  expect((await pool.query("SELECT code, uses FROM promo ORDER BY code")).rows).toEqual([
    { code: "ESTATE2000", uses: 1 },
    { code: "MONSOON15", uses: 1 },
  ]);
});
