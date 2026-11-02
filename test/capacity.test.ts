import { describe, expect, test } from "vitest";
import { activeCount, insertReservation, makeRoomType, pool } from "./db";

const refusal = (e: unknown) => ({
  code: (e as { code?: string }).code,
  detail: (e as { detail?: string }).detail,
});

async function rejection(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    return refusal(e);
  }
  throw new Error("expected the database to refuse");
}

describe("staff edits cannot undercut what is sold", () => {
  test("lowering the allotment below what is committed is refused, and says how many are committed", async () => {
    const rt = await makeRoomType([{ night: "2027-02-01", allotment: 3 }]);
    await insertReservation(pool, {
      ...rt,
      checkIn: "2027-02-01",
      checkOut: "2027-02-02",
      qty: 2,
      status: "confirmed",
    });

    const err = await rejection(
      pool.query(
        "UPDATE inventory_night SET allotment = 1 WHERE room_type_id = $1 AND night = '2027-02-01'",
        [rt.roomTypeId],
      ),
    );
    expect(err.code).toBe("23514");
    expect(err.detail).toContain("2027-02-01");
    expect(err.detail).toContain("has 2 committed");
  });

  test("lowering to exactly what is committed (set to minimum) is allowed", async () => {
    const rt = await makeRoomType([{ night: "2027-02-01", allotment: 3 }]);
    await insertReservation(pool, {
      ...rt,
      checkIn: "2027-02-01",
      checkOut: "2027-02-02",
      qty: 2,
      status: "confirmed",
    });
    await pool.query("UPDATE inventory_night SET allotment = 2 WHERE room_type_id = $1", [
      rt.roomTypeId,
    ]);
    const { rows } = await pool.query("SELECT remaining FROM night_usage WHERE room_type_id = $1", [
      rt.roomTypeId,
    ]);
    expect(rows).toEqual([{ remaining: 0 }]);
  });

  test("closing a night that has a booking is refused", async () => {
    const rt = await makeRoomType([{ night: "2027-02-01", allotment: 3 }]);
    await insertReservation(pool, { ...rt, checkIn: "2027-02-01", checkOut: "2027-02-02" });
    const err = await rejection(
      pool.query("UPDATE inventory_night SET closed = true WHERE room_type_id = $1", [
        rt.roomTypeId,
      ]),
    );
    expect(err.code).toBe("23514");
    expect(err.detail).toContain("has 1 committed, website allotment 0");
  });

  test("closing an empty night is allowed and stops sales", async () => {
    const rt = await makeRoomType([{ night: "2027-02-01", allotment: 3 }]);
    await pool.query("UPDATE inventory_night SET closed = true WHERE room_type_id = $1", [
      rt.roomTypeId,
    ]);
    const err = await rejection(
      insertReservation(pool, { ...rt, checkIn: "2027-02-01", checkOut: "2027-02-02" }),
    );
    expect(err.code).toBe("23514");
  });
});

describe("holds", () => {
  test("an expired hold no longer blocks the room", async () => {
    const rt = await makeRoomType([{ night: "2027-03-01", allotment: 1 }]);
    await insertReservation(pool, {
      ...rt,
      checkIn: "2027-03-01",
      checkOut: "2027-03-02",
      holdSeconds: -1,
    });
    await insertReservation(pool, { ...rt, checkIn: "2027-03-01", checkOut: "2027-03-02" });
    expect(await activeCount(rt.roomTypeId)).toBe(1);
  });

  test("a live hold blocks the room", async () => {
    const rt = await makeRoomType([{ night: "2027-03-01", allotment: 1 }]);
    await insertReservation(pool, { ...rt, checkIn: "2027-03-01", checkOut: "2027-03-02" });
    const err = await rejection(
      insertReservation(pool, { ...rt, checkIn: "2027-03-01", checkOut: "2027-03-02" }),
    );
    expect(err).toEqual({ code: "23514", detail: expect.stringContaining("Night 2027-03-01") });
  });
});

describe("multi-night stays", () => {
  const nights = [
    { night: "2027-04-01", allotment: 2 },
    { night: "2027-04-02", allotment: 1 },
    { night: "2027-04-03", allotment: 2 },
  ];

  test("need room on every night: one full night refuses the whole stay and names that night", async () => {
    const rt = await makeRoomType(nights);
    await insertReservation(pool, {
      ...rt,
      checkIn: "2027-04-02",
      checkOut: "2027-04-03",
      status: "confirmed",
    });
    const err = await rejection(
      insertReservation(pool, { ...rt, checkIn: "2027-04-01", checkOut: "2027-04-04" }),
    );
    expect(err.detail).toContain("Night 2027-04-02");
    expect(await activeCount(rt.roomTypeId)).toBe(1);
  });

  test("fit when every night has room", async () => {
    const rt = await makeRoomType(nights);
    await insertReservation(pool, { ...rt, checkIn: "2027-04-01", checkOut: "2027-04-04" });
    expect(await activeCount(rt.roomTypeId)).toBe(1);
  });

  test("a night with no inventory row is not for sale", async () => {
    const rt = await makeRoomType([nights[0], nights[2]]);
    const err = await rejection(
      insertReservation(pool, { ...rt, checkIn: "2027-04-01", checkOut: "2027-04-04" }),
    );
    expect(err).toEqual({ code: "23514", detail: expect.stringContaining("Night 2027-04-02 of") });
  });

  test("qty counts keys, not bookings", async () => {
    const rt = await makeRoomType([{ night: "2027-05-01", allotment: 3 }]);
    await insertReservation(pool, { ...rt, checkIn: "2027-05-01", checkOut: "2027-05-02", qty: 2 });
    const err = await rejection(
      insertReservation(pool, { ...rt, checkIn: "2027-05-01", checkOut: "2027-05-02", qty: 2 }),
    );
    expect(err.code).toBe("23514");
  });
});
