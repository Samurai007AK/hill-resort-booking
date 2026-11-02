import { describe, expect, test } from "vitest";
import { insertReservation, makeRoomType, pool } from "./db";

// Guards found in review: the inventory table must not accept nonsense even from a direct UPDATE.

async function refusal(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    const err = e as { code?: string; detail?: string };
    return { code: err.code, detail: err.detail };
  }
  throw new Error("expected the database to refuse");
}

const NIGHT = "2027-08-01";

describe("allotment can never exceed the keys the resort has", () => {
  test("an UPDATE above keys_total is refused and names the limit", async () => {
    const rt = await makeRoomType([{ night: NIGHT, allotment: 3 }]); // keys_total 10
    const err = await refusal(
      pool.query("UPDATE inventory_night SET allotment = 11 WHERE room_type_id = $1", [
        rt.roomTypeId,
      ]),
    );
    expect(err.code).toBe("23514");
    expect(err.detail).toContain("only 10 keys");
  });

  test("an INSERT above keys_total is refused too", async () => {
    const rt = await makeRoomType([]);
    const err = await refusal(
      pool.query(
        "INSERT INTO inventory_night (room_type_id, night, rate_inr, allotment) VALUES ($1, $2, 9500, 12)",
        [rt.roomTypeId, NIGHT],
      ),
    );
    expect(err.code).toBe("23514");
  });

  test("exactly keys_total is allowed", async () => {
    const rt = await makeRoomType([{ night: NIGHT, allotment: 3 }]);
    await pool.query("UPDATE inventory_night SET allotment = 10 WHERE room_type_id = $1", [
      rt.roomTypeId,
    ]);
  });
});

describe("a night with guests on it cannot be deleted", () => {
  test("deleting a night with a confirmed booking is refused and says how many are committed", async () => {
    const rt = await makeRoomType([{ night: NIGHT, allotment: 3 }]);
    await insertReservation(pool, {
      ...rt,
      checkIn: NIGHT,
      checkOut: "2027-08-02",
      qty: 2,
      status: "confirmed",
    });
    const err = await refusal(
      pool.query("DELETE FROM inventory_night WHERE room_type_id = $1", [rt.roomTypeId]),
    );
    expect(err.code).toBe("23514");
    expect(err.detail).toContain(`Night ${NIGHT}`);
    expect(err.detail).toContain("2 committed");
  });

  test("deleting an empty night (or one with only an expired hold) is allowed", async () => {
    const rt = await makeRoomType([{ night: NIGHT, allotment: 3 }]);
    await insertReservation(pool, {
      ...rt,
      checkIn: NIGHT,
      checkOut: "2027-08-02",
      holdSeconds: -1,
    });
    const { rowCount } = await pool.query("DELETE FROM inventory_night WHERE room_type_id = $1", [
      rt.roomTypeId,
    ]);
    expect(rowCount).toBe(1);
  });
});

describe("rates stay within sane bounds (A15)", () => {
  test.each([0, 999, 500_001])("₹%i is refused", async (rate) => {
    const rt = await makeRoomType([{ night: NIGHT, allotment: 3 }]);
    const err = await refusal(
      pool.query("UPDATE inventory_night SET rate_inr = $2 WHERE room_type_id = $1", [
        rt.roomTypeId,
        rate,
      ]),
    );
    expect(err.code).toBe("23514");
  });

  test.each([1000, 500_000])("₹%i is allowed", async (rate) => {
    const rt = await makeRoomType([{ night: NIGHT, allotment: 3 }]);
    await pool.query("UPDATE inventory_night SET rate_inr = $2 WHERE room_type_id = $1", [
      rt.roomTypeId,
      rate,
    ]);
  });
});
