// Shared helpers for tests that hit the real test database. Importing this file
// closes the pool after the file's tests and audits for overbooking after each test.
import { randomUUID } from "node:crypto";
import type { ClientBase, Pool } from "pg";
import { afterAll, afterEach, expect } from "vitest";
import { pool } from "@/db/pool";

export { pool };

// The overbooking audit: after every DB test, no night anywhere may be over its allotment.
afterEach(async () => {
  const { rows } = await pool.query("SELECT * FROM night_usage WHERE active > allotment_effective");
  expect(rows).toEqual([]);
});

afterAll(() => pool.end());

type Night = { night: string; allotment: number; closed?: boolean; rate?: number };

/** A fresh room type (unique id, so test files never collide) with one rate plan and the given nights. */
export async function makeRoomType(nights: Night[], factor = 1) {
  const roomTypeId = `t-${randomUUID().slice(0, 8)}`;
  const ratePlanId = `${roomTypeId}-flex`;
  await pool.query(
    `INSERT INTO room_types (id, name, kind, keys_total, max_adults, max_children, description)
     VALUES ($1, 'Test room', 'room', 10, 3, 2, 'test')`,
    [roomTypeId],
  );
  await pool.query(
    `INSERT INTO rate_plans (id, room_type_id, name, factor, refundable, breakfast) VALUES ($1, $2, 'Flexible', $3, true, true)`,
    [ratePlanId, roomTypeId, factor],
  );
  for (const n of nights) {
    await pool.query(
      `INSERT INTO inventory_night (room_type_id, night, rate_inr, allotment, closed) VALUES ($1, $2, $3, $4, $5)`,
      [roomTypeId, n.night, n.rate ?? 9500, n.allotment, n.closed ?? false],
    );
  }
  return { roomTypeId, ratePlanId };
}

export type Stay = {
  roomTypeId: string;
  ratePlanId: string;
  checkIn: string;
  checkOut: string;
  qty?: number;
  status?: "held" | "confirmed";
  /** Seconds from now; negative = an already expired hold. Default 600 (10 minutes). */
  holdSeconds?: number;
};

/** Plain INSERT of a reservation, the way any code path would write one. */
export async function insertReservation(db: ClientBase | Pool, s: Stay): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO reservation (room_type_id, rate_plan_id, check_in, check_out, qty, status, expires_at,
                              quoted_total, price_lines, guest_name, guest_email, guest_phone, consent_at)
     VALUES ($1, $2, $3, $4, $5, $6, now() + make_interval(secs => $7), 1000, '[]', 'Test Guest', 'guest@example.com', '+91 90000 00000', now())
     RETURNING id`,
    [s.roomTypeId, s.ratePlanId, s.checkIn, s.checkOut, s.qty ?? 1, s.status ?? "held", s.holdSeconds ?? 600],
  );
  return rows[0].id;
}

export async function activeCount(roomTypeId: string): Promise<number> {
  const { rows } = await pool.query<{ n: number }>(
    `SELECT coalesce(sum(qty), 0)::int AS n FROM reservation
     WHERE room_type_id = $1 AND (status = 'confirmed' OR (status = 'held' AND expires_at > now()))`,
    [roomTypeId],
  );
  return rows[0].n;
}
