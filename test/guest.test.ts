import { randomUUID } from "node:crypto";
import { describe, expect, test } from "vitest";
import { applyPayment, createHold, getReservation, signPayment } from "@/server/booking";
import { getRoom, listRooms, roomOffer } from "@/server/guest/catalog";
import { createBookingAccess, verifyBookingAccess } from "@/server/guest/access";
import { makeRoomType, pool } from "./db";

describe("guest booking journey", () => {
  test("a displayed stay can be held and paid at the same tax-inclusive total", async () => {
    const { roomTypeId, ratePlanId } = await makeRoomType([
      { night: "2027-06-04", allotment: 1, rate: 7200 },
      { night: "2027-06-05", allotment: 1, rate: 8200 },
    ]);
    const room = await getRoom(roomTypeId);
    expect(room).not.toBeNull();
    if (!room) throw new Error("Room should be visible to guests");
    expect((await listRooms()).some((item) => item.id === roomTypeId)).toBe(true);
    const search = {
      checkIn: "2027-06-04",
      checkOut: "2027-06-06",
      qty: 1,
      adults: 2,
      children: 1,
    };
    const offer = await roomOffer(room, search);
    expect(offer.remaining).toBe(1);
    expect(offer.quote).toMatchObject({
      kind: "quote",
      quote: { grandTotal: 17236, gstTotal: 1836 },
    });
    const held = await createHold({
      ...search,
      roomTypeId,
      ratePlanId,
      guestName: "Example Guest",
      guestEmail: "guest@example.com",
      guestPhone: "+91 98450 12345",
      consent: true,
      idempotencyKey: randomUUID(),
    });
    if (held.kind !== "held") throw new Error("Displayed stay should be held");
    expect(held.reservation.quotedTotal).toBe(17236);
    expect((await roomOffer(room, search)).remaining).toBe(0);
    const access = await createBookingAccess(held.reservation.id);
    expect(await verifyBookingAccess(access, held.reservation.id)).toBe(true);
    expect(await verifyBookingAccess(access, randomUUID())).toBe(false);
    const payment = {
      paymentId: `guest-test-${randomUUID()}`,
      reservationId: held.reservation.id,
      amount: held.reservation.quotedTotal,
      status: "success",
    } satisfies Parameters<typeof signPayment>[0];
    const callback = { ...payment, signature: signPayment(payment) };
    expect(await applyPayment(callback)).toMatchObject({
      kind: "applied",
      outcome: "confirmed",
      replay: false,
    });
    expect(await applyPayment(callback)).toMatchObject({
      kind: "applied",
      outcome: "confirmed",
      replay: true,
    });
    expect(await getReservation(held.reservation.id)).toMatchObject({
      status: "confirmed",
      quotedTotal: 17236,
      adults: 2,
      children: 1,
    });
  });

  test("closed or incompletely priced nights cannot be offered as available", async () => {
    const { roomTypeId } = await makeRoomType([
      { night: "2027-06-04", allotment: 2, closed: true },
    ]);
    const room = await getRoom(roomTypeId);
    if (!room) throw new Error("Room should exist");
    const offer = await roomOffer(room, {
      checkIn: "2027-06-04",
      checkOut: "2027-06-06",
      qty: 1,
      adults: 2,
      children: 0,
    });
    expect(offer.remaining).toBe(0);
    expect(offer.quote).toEqual({ kind: "sold_out", night: "2027-06-04" });
    expect(await getRoom("missing-room")).toBeNull();
    const { rows } = await pool.query(
      "SELECT count(*)::int AS count FROM reservation WHERE room_type_id = $1",
      [roomTypeId],
    );
    expect(rows[0].count).toBe(0);
  });
});
