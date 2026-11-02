import { randomUUID } from "node:crypto";
import { describe, expect, test } from "vitest";
import { priceStay } from "@/domain/pricing";
import { applyPayment, availability, createHold, HoldInput, signPayment, type Reservation } from "@/server/booking";
import { insertReservation, makeRoomType, pool } from "./db";

const NIGHTS = [
  { night: "2027-06-04", allotment: 1, rate: 7200 },
  { night: "2027-06-05", allotment: 1, rate: 8200 },
];

async function setup() {
  const rt = await makeRoomType(NIGHTS);
  const input: HoldInput = {
    ...rt,
    checkIn: "2027-06-04",
    checkOut: "2027-06-06",
    qty: 1,
    adults: 2,
    children: 0,
    guestName: "Asha Rao",
    guestEmail: "asha@example.com",
    guestPhone: "+91 98450 00000",
    consent: true,
    idempotencyKey: randomUUID(),
  };
  return { rt, input };
}

async function hold(input: HoldInput): Promise<Reservation> {
  const r = await createHold(input);
  if (r.kind !== "held") throw new Error(`expected a hold, got ${r.kind}`);
  return r.reservation;
}

function pay(reservation: Reservation, over: { paymentId?: string; amount?: number; status?: "success" | "failed" } = {}) {
  const p = {
    paymentId: over.paymentId ?? `pay_${randomUUID()}`,
    reservationId: reservation.id,
    amount: over.amount ?? reservation.quotedTotal,
    status: over.status ?? ("success" as const),
  };
  return applyPayment({ ...p, signature: signPayment(p) });
}

const expireHold = (id: string) => pool.query("UPDATE reservation SET expires_at = now() - interval '1 minute' WHERE id = $1", [id]);

describe("createHold", () => {
  test("holds the room for 10 minutes at the price from the rate table", async () => {
    const { input } = await setup();
    const r = await hold(input);
    const expected = priceStay({ nights: [{ date: "2027-06-04", tariff: 7200 }, { date: "2027-06-05", tariff: 8200 }], planFactor: 1, qty: 1 });
    expect(r).toMatchObject({ status: "held", quotedTotal: expected.grandTotal, priceLines: expected.lines, late: false });
    expect(r.ref).toMatch(/^CS-[2-9A-Z]{4}$/);
    const minutesLeft = (r.expiresAt!.getTime() - Date.now()) / 60_000;
    expect(minutesLeft).toBeGreaterThan(9);
    expect(minutesLeft).toBeLessThanOrEqual(10);
  });

  test("the same idempotency key twice gives back the first hold, not a second one", async () => {
    const { rt, input } = await setup();
    const a = await hold(input);
    const b = await hold(input);
    expect(b.id).toBe(a.id);
    const { rows } = await pool.query("SELECT count(*)::int AS n FROM reservation WHERE room_type_id = $1", [rt.roomTypeId]);
    expect(rows[0].n).toBe(1);
  });

  test("a full night comes back as sold out, naming the night", async () => {
    const { rt, input } = await setup();
    await insertReservation(pool, { ...rt, checkIn: "2027-06-05", checkOut: "2027-06-06", status: "confirmed" });
    expect(await createHold(input)).toEqual({ kind: "sold_out", night: "2027-06-05" });
  });

  test("a promo is checked and applied before tax", async () => {
    const { input } = await setup();
    await pool.query(
      `INSERT INTO promo (code, kind, value, valid_from, valid_to, min_nights) VALUES ('T15', 'percent', 15, '2020-01-01', '2099-12-31', 1)
       ON CONFLICT (code) DO NOTHING`,
    );
    const r = await hold({ ...input, promoCode: "T15" });
    expect(r.priceLines.map((l) => [l.discount, l.gstRate])).toEqual([
      [1080, 5],
      [1230, 5], // 8,200 - 15% = 6,970: under the line
    ]);
    expect(await createHold({ ...input, idempotencyKey: randomUUID(), promoCode: "NOPE" })).toEqual({
      kind: "promo_invalid",
      reason: "unknown",
    });
  });
});

describe("applyPayment", () => {
  test("a payment confirms the hold; replaying it 3 times changes nothing", async () => {
    const { input } = await setup();
    const r = await hold(input);
    const paymentId = `pay_${randomUUID()}`;
    const results = [await pay(r, { paymentId }), await pay(r, { paymentId }), await pay(r, { paymentId })];
    expect(results.map((x) => x.kind === "applied" && [x.outcome, x.reservationStatus, x.replay])).toEqual([
      ["confirmed", "confirmed", false],
      ["confirmed", "confirmed", true],
      ["confirmed", "confirmed", true],
    ]);
    const { rows } = await pool.query("SELECT count(*)::int AS n FROM payment WHERE reservation_id = $1", [r.id]);
    expect(rows[0].n).toBe(1);
  });

  test("a failure that arrives after the success does not undo the booking", async () => {
    const { input } = await setup();
    const r = await hold(input);
    expect(await pay(r)).toMatchObject({ outcome: "confirmed" });
    expect(await pay(r, { status: "failed" })).toMatchObject({ outcome: "rejected", reservationStatus: "confirmed" });
  });

  test("a failed payment leaves the hold so the guest can try again", async () => {
    const { input } = await setup();
    const r = await hold(input);
    expect(await pay(r, { status: "failed" })).toMatchObject({ outcome: "rejected", reservationStatus: "held" });
    expect(await pay(r)).toMatchObject({ outcome: "confirmed", reservationStatus: "confirmed" });
  });

  test("a late payment is honoured when the room is still free, and flagged late", async () => {
    const { input } = await setup();
    const r = await hold(input);
    await expireHold(r.id);
    expect(await pay(r)).toMatchObject({ outcome: "confirmed", reservationStatus: "confirmed", late: true });
  });

  test("a late payment for a room someone else took becomes refund due", async () => {
    const { rt, input } = await setup();
    const r = await hold(input);
    await expireHold(r.id);
    await hold({ ...input, idempotencyKey: randomUUID(), checkIn: "2027-06-05" }); // takes the last key on the 5th
    expect(await pay(r)).toMatchObject({ outcome: "refund_due", reservationStatus: "refund_due", late: false });
    const { rows } = await pool.query("SELECT outcome FROM payment WHERE reservation_id = $1", [r.id]);
    expect(rows).toEqual([{ outcome: "refund_due" }]);
    expect((await availability(rt.roomTypeId, "2027-06-05", "2027-06-06")).available).toBe(0);
  });

  test("a second, different payment for a paid booking is refund due", async () => {
    const { input } = await setup();
    const r = await hold(input);
    await pay(r);
    expect(await pay(r)).toMatchObject({ outcome: "refund_due", reservationStatus: "confirmed", replay: false });
  });

  test("the wrong amount is rejected and the hold stays", async () => {
    const { input } = await setup();
    const r = await hold(input);
    expect(await pay(r, { amount: r.quotedTotal - 1 })).toMatchObject({ outcome: "rejected", reservationStatus: "held" });
  });

  test("a bad signature is rejected and nothing is stored", async () => {
    const { input } = await setup();
    const r = await hold(input);
    const p = { paymentId: `pay_${randomUUID()}`, reservationId: r.id, amount: r.quotedTotal, status: "success" as const };
    const forged = signPayment({ ...p, amount: 1 });
    expect(await applyPayment({ ...p, signature: forged })).toEqual({ kind: "bad_signature" });
    const { rows } = await pool.query("SELECT status FROM reservation WHERE id = $1", [r.id]);
    expect(rows).toEqual([{ status: "held" }]);
    expect((await pool.query("SELECT 1 FROM payment WHERE reservation_id = $1", [r.id])).rowCount).toBe(0);
  });

  test("an unknown booking id is reported, not thrown", async () => {
    const p = { paymentId: `pay_${randomUUID()}`, reservationId: randomUUID(), amount: 100, status: "success" as const };
    expect(await applyPayment({ ...p, signature: signPayment(p) })).toEqual({ kind: "unknown_reservation" });
  });
});

describe("availability", () => {
  test("is the smallest remaining over the stay, and 0 when a night is missing", async () => {
    const rt = await makeRoomType([
      { night: "2027-07-01", allotment: 3 },
      { night: "2027-07-02", allotment: 2 },
    ]);
    await insertReservation(pool, { ...rt, checkIn: "2027-07-02", checkOut: "2027-07-03" });
    const a = await availability(rt.roomTypeId, "2027-07-01", "2027-07-03");
    expect(a.nights.map((n) => n.remaining)).toEqual([3, 1]);
    expect(a.available).toBe(1);
    expect((await availability(rt.roomTypeId, "2027-07-01", "2027-07-04")).available).toBe(0);
  });
});

describe("HoldInput (form parsing)", () => {
  const form = {
    roomTypeId: "estate-room",
    ratePlanId: "estate-room-flex",
    checkIn: "2027-06-04",
    checkOut: "2027-06-06",
    qty: "2",
    adults: "2",
    children: "0",
    guestName: " Asha Rao ",
    guestEmail: "asha@example.com",
    guestPhone: "+91 98450 00000",
    consent: true,
    promoCode: "",
    idempotencyKey: "0f8b3c3e-1111-4222-8333-944445555666",
  };

  test("coerces form strings, trims, and treats an empty promo as none", () => {
    expect(HoldInput.parse(form)).toMatchObject({ qty: 2, guestName: "Asha Rao", promoCode: undefined });
  });

  test.each([
    ["no consent", { consent: false }],
    ["31 nights", { checkOut: "2027-07-05" }],
    ["check-out before check-in", { checkOut: "2027-06-01" }],
    ["5 keys", { qty: "5" }],
    ["bad email", { guestEmail: "asha" }],
  ])("rejects %s", (_name, bad) => {
    expect(HoldInput.safeParse({ ...form, ...bad }).success).toBe(false);
  });
});
