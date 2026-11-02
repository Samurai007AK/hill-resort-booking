import { randomUUID } from "node:crypto";
import { describe, expect, test } from "vitest";
import type { Session } from "@/server/session";
import { editInventory, savePromo, bookingsCsv, dashboardMetrics } from "@/server/admin/service";
import { insertReservation, makeRoomType, pool } from "./db";

const staff: Session = {
  userId: randomUUID(),
  email: "staff@example.com",
  name: "Staff",
  role: "staff",
  team: "reservations",
};
const guest: Session = { ...staff, role: "guest", team: null };
const gm: Session = { ...staff, role: "gm", team: null };
const nights = [
  { night: "2027-04-01", allotment: 3 },
  { night: "2027-04-02", allotment: 3 },
];

describe("staff inventory boundary", () => {
  test("rejects a guest before writing rates", async () => {
    const { roomTypeId } = await makeRoomType(nights);
    await expect(
      editInventory(guest, {
        roomTypeId,
        from: "2027-04-01",
        to: "2027-04-02",
        rate: 8000,
        allotment: 2,
        closed: false,
      }),
    ).rejects.toThrow("Staff access required");
  });

  test("bulk edit is atomic and reports the minimum when a night has guests", async () => {
    const room = await makeRoomType(nights);
    await insertReservation(pool, {
      ...room,
      checkIn: "2027-04-02",
      checkOut: "2027-04-03",
      qty: 2,
      status: "confirmed",
    });
    expect(
      await editInventory(staff, {
        roomTypeId: room.roomTypeId,
        from: "2027-04-01",
        to: "2027-04-02",
        rate: 8000,
        allotment: 1,
        closed: false,
      }),
    ).toEqual({ kind: "minimum", night: "2027-04-02", minimum: 2 });
    const { rows } = await pool.query(
      "SELECT rate_inr, allotment FROM inventory_night WHERE room_type_id=$1 ORDER BY night",
      [room.roomTypeId],
    );
    expect(rows).toEqual([
      { rate_inr: 9500, allotment: 3 },
      { rate_inr: 9500, allotment: 3 },
    ]);
    expect(
      await editInventory(staff, {
        roomTypeId: room.roomTypeId,
        from: "2027-04-01",
        to: "2027-04-02",
        rate: 8000,
        allotment: 1,
        closed: true,
        setMinimum: true,
      }),
    ).toEqual({ kind: "saved", nights: 2 });
    const changed = await pool.query(
      "SELECT allotment, closed FROM inventory_night WHERE room_type_id=$1 ORDER BY night",
      [room.roomTypeId],
    );
    expect(changed.rows).toEqual([
      { allotment: 0, closed: true },
      { allotment: 2, closed: false },
    ]);
  });

  test("rejects allotments above the physical keys and inverted dates", async () => {
    const { roomTypeId } = await makeRoomType(nights);
    await expect(
      editInventory(staff, {
        roomTypeId,
        from: "2027-04-01",
        to: "2027-04-02",
        rate: 8000,
        allotment: 11,
        closed: false,
      }),
    ).rejects.toThrow("physical keys");
    await expect(
      editInventory(staff, {
        roomTypeId,
        from: "2027-04-02",
        to: "2027-04-01",
        rate: 8000,
        allotment: 1,
        closed: false,
      }),
    ).rejects.toThrow();
  });
});

test("promo updates preserve recorded usage", async () => {
  const promo = {
    code: "ADMIN15",
    kind: "percent",
    value: 15,
    validFrom: "2027-01-01",
    validTo: "2027-12-31",
    minNights: 2,
    maxUses: 10,
    active: true,
  };
  await savePromo(staff, promo);
  await pool.query("UPDATE promo SET uses=3 WHERE code='ADMIN15'");
  await savePromo(staff, { ...promo, value: 20 });
  expect((await pool.query("SELECT value,uses FROM promo WHERE code='ADMIN15'")).rows).toEqual([
    { value: 20, uses: 3 },
  ]);
  await expect(savePromo(guest, promo)).rejects.toThrow("Staff access required");
});

test("daily CSV escapes spreadsheet formulas and includes only that arrival date", async () => {
  const room = await makeRoomType(nights);
  const id = await insertReservation(pool, {
    ...room,
    checkIn: "2027-04-01",
    checkOut: "2027-04-02",
    status: "confirmed",
  });
  await pool.query("UPDATE reservation SET guest_name='=CMD(1)' WHERE id=$1", [id]);
  const csv = await bookingsCsv(staff, "2027-04-01");
  expect(csv).toContain(
    "Reference,Guest,Email,Phone,Room,Check in,Check out,Keys,Status,Total INR",
  );
  expect(csv).toContain("'=CMD(1)");
  expect(await bookingsCsv(staff, "2027-04-03")).not.toContain("CMD(1)");
});

test("GM metrics report the live overbooking audit and reject staff", async () => {
  await expect(dashboardMetrics(staff)).rejects.toThrow("GM access required");
  const metrics = await dashboardMetrics(gm);
  expect(metrics.overbookings).toBe(0);
  expect(metrics.directNights).toBeGreaterThanOrEqual(0);
  expect(metrics.commissionAvoided).toBeGreaterThanOrEqual(0);
});

test("illustrative commission excludes GST from confirmed booking totals", async () => {
  const before = await dashboardMetrics(gm);
  const room = await makeRoomType(nights);
  const id = await insertReservation(pool, {
    ...room,
    checkIn: "2027-04-01",
    checkOut: "2027-04-02",
    status: "confirmed",
  });
  await pool.query("UPDATE reservation SET quoted_total=11800,price_lines=$2 WHERE id=$1", [
    id,
    JSON.stringify([{ taxable: 10000, gst: 1800, total: 11800 }]),
  ]);
  const after = await dashboardMetrics(gm);
  expect(after.commissionAvoided - before.commissionAvoided).toBe(2000);
  expect(after.directNights - before.directNights).toBe(1);
});
