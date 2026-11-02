import pg from "pg";
import { expect, test } from "vitest";
import { activeCount, insertReservation, makeRoomType, type Stay } from "./db";

const GUESTS = 20;

/**
 * The naive way an app guards stock: count what is sold, then insert if there is room.
 * The sleep widens the gap between check and insert, as a slow network would.
 */
async function holdRooms(client: pg.Client, stay: Stay) {
  const { rows } = await client.query<{ free: number }>(
    `SELECT n.allotment - coalesce((SELECT sum(r.qty) FROM reservation r
        WHERE r.room_type_id = n.room_type_id AND r.check_in <= n.night AND r.check_out > n.night
          AND (r.status = 'confirmed' OR (r.status = 'held' AND r.expires_at > now()))), 0)::int AS free
     FROM inventory_night n WHERE n.room_type_id = $1 AND n.night = $2`,
    [stay.roomTypeId, stay.checkIn],
  );
  if (rows[0].free < (stay.qty ?? 1)) throw Object.assign(new Error("sold out (app check)"), { code: "APP" });
  await client.query("SELECT pg_sleep(0.05)");
  return insertReservation(client, stay);
}

test("20 guests on 20 separate connections race for the last room: exactly one gets it", async () => {
  const { roomTypeId, ratePlanId } = await makeRoomType([{ night: "2027-01-10", allotment: 1 }]);
  const clients = Array.from({ length: GUESTS }, () => new pg.Client({ connectionString: process.env.DATABASE_URL }));
  await Promise.all(clients.map((c) => c.connect()));
  try {
    const stay = { roomTypeId, ratePlanId, checkIn: "2027-01-10", checkOut: "2027-01-11" };
    const results = await Promise.allSettled(clients.map((c) => holdRooms(c, stay)));

    const won = results.filter((r) => r.status === "fulfilled");
    const lost = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(won).toHaveLength(1);
    expect(lost.map((r) => r.reason.code)).toEqual(Array(GUESTS - 1).fill("23514"));
    expect(await activeCount(roomTypeId)).toBe(1);
  } finally {
    await Promise.all(clients.map((c) => c.end()));
  }
});
