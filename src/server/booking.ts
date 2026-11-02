import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { pool } from "@/db/pool";
import { todayIST } from "@/domain/dates";
import { nightsBetween, priceStay, type Discount, type PriceLine, type Quote } from "@/domain/pricing";
import { checkPromo, type PromoRefusal } from "@/domain/promo";
import { secret } from "./secrets";

export const HOLD_MINUTES = 10; // A5

function isStay(v: { checkIn: string; checkOut: string }): boolean {
  try {
    nightsBetween(v.checkIn, v.checkOut);
    return true;
  } catch {
    return false;
  }
}
const stayRule = { message: "A stay is 1 to 30 nights", path: ["checkOut"] };

const stayFields = {
  roomTypeId: z.string().min(1).max(64),
  ratePlanId: z.string().min(1).max(64),
  checkIn: z.iso.date(),
  checkOut: z.iso.date(),
  qty: z.coerce.number().int().min(1).max(4),
  promoCode: z
    .string()
    .trim()
    .toUpperCase()
    .max(32)
    .transform((c) => c || undefined) // an empty form field means no promo
    .optional(),
};

/** What a guest picks on the room page. Parse form/query input with this. */
export const StayInput = z.object(stayFields).refine(isStay, stayRule);
export type StayInput = z.infer<typeof StayInput>;

/** Step 2 of booking: the stay plus guest details and DPDP consent. */
export const HoldInput = z
  .object({
    ...stayFields,
    adults: z.coerce.number().int().min(1).max(16),
    children: z.coerce.number().int().min(0).max(12),
    guestName: z.string().trim().min(2).max(100),
    guestEmail: z.email().max(200),
    guestPhone: z.string().trim().regex(/^\+?[\d\s-]{8,18}$/, "Enter a phone number"),
    consent: z.literal(true, "Consent is needed to book"),
    idempotencyKey: z.string().min(8).max(100),
  })
  .refine(isStay, stayRule);
export type HoldInput = z.infer<typeof HoldInput>;

export type Reservation = {
  id: string;
  ref: string;
  roomTypeId: string;
  ratePlanId: string;
  checkIn: string;
  checkOut: string;
  qty: number;
  adults: number;
  children: number;
  status: "held" | "confirmed" | "cancelled" | "refund_due";
  expiresAt: Date | null;
  quotedTotal: number;
  priceLines: PriceLine[];
  promoCode: string | null;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  late: boolean;
  createdAt: Date;
};

export type QuoteResult =
  | { kind: "quote"; quote: Quote }
  | { kind: "sold_out"; night: string }
  | { kind: "promo_invalid"; reason: PromoRefusal | "unknown" }
  | { kind: "invalid"; reason: "past_dates" | "unknown_rate_plan" };

export type HoldResult = { kind: "held"; reservation: Reservation } | Exclude<QuoteResult, { kind: "quote" }>;

/** Prices a stay from the rate table, never from anywhere else. Read-only, no locks. */
export async function quoteStay(input: StayInput): Promise<QuoteResult> {
  if (input.checkIn < todayIST()) return { kind: "invalid", reason: "past_dates" };
  const nights = nightsBetween(input.checkIn, input.checkOut);

  const plan = await pool.query<{ factor: number }>("SELECT factor FROM rate_plans WHERE id = $1 AND room_type_id = $2", [
    input.ratePlanId,
    input.roomTypeId,
  ]);
  if (!plan.rows[0]) return { kind: "invalid", reason: "unknown_rate_plan" };

  const { rows: rates } = await pool.query<{ night: string; rate_inr: number; closed: boolean }>(
    "SELECT night, rate_inr, closed FROM inventory_night WHERE room_type_id = $1 AND night >= $2 AND night < $3",
    [input.roomTypeId, input.checkIn, input.checkOut],
  );
  const rate = new Map(rates.filter((r) => !r.closed).map((r) => [r.night, r.rate_inr]));
  const unsellable = nights.find((n) => !rate.has(n));
  if (unsellable) return { kind: "sold_out", night: unsellable };

  let promo: Discount | undefined;
  if (input.promoCode) {
    const { rows } = await pool.query("SELECT * FROM promo WHERE code = $1", [input.promoCode]);
    const p = rows[0];
    if (!p) return { kind: "promo_invalid", reason: "unknown" };
    const check = checkPromo(
      {
        code: p.code,
        kind: p.kind,
        value: p.value,
        validFrom: p.valid_from,
        validTo: p.valid_to,
        minNights: p.min_nights,
        maxUses: p.max_uses,
        active: p.active,
      },
      { stayNights: nights.length, today: todayIST(), usesSoFar: p.uses },
    );
    if (!check.ok) return { kind: "promo_invalid", reason: check.reason };
    promo = { kind: p.kind, value: p.value };
  }

  const quote = priceStay({
    nights: nights.map((date) => ({ date, tariff: rate.get(date)! })),
    planFactor: plan.rows[0].factor,
    qty: input.qty,
    promo,
  });
  return { kind: "quote", quote };
}

/**
 * Holds rooms for HOLD_MINUTES while the guest pays. One INSERT; the database refuses it when any
 * night is full (23514 -> sold_out). Repeating an idempotencyKey returns the first hold unchanged.
 */
export async function createHold(input: HoldInput): Promise<HoldResult> {
  const existing = await findByIdempotencyKey(input.idempotencyKey);
  if (existing) return { kind: "held", reservation: existing };

  const q = await quoteStay(input);
  if (q.kind !== "quote") return q;

  try {
    const { rows } = await pool.query(
      `INSERT INTO reservation (room_type_id, rate_plan_id, check_in, check_out, qty, adults, children, status, expires_at,
                                quoted_total, price_lines, promo_code, guest_name, guest_email, guest_phone, consent_at, idempotency_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'held', now() + make_interval(mins => $8), $9, $10, $11, $12, $13, $14, now(), $15)
       ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING *`,
      [
        input.roomTypeId,
        input.ratePlanId,
        input.checkIn,
        input.checkOut,
        input.qty,
        input.adults,
        input.children,
        HOLD_MINUTES,
        q.quote.grandTotal,
        JSON.stringify(q.quote.lines),
        input.promoCode ?? null,
        input.guestName,
        input.guestEmail,
        input.guestPhone,
        input.idempotencyKey,
      ],
    );
    // No row only when a concurrent request with the same key inserted first.
    const reservation = rows[0] ? toReservation(rows[0]) : await findByIdempotencyKey(input.idempotencyKey);
    return { kind: "held", reservation: reservation! };
  } catch (e) {
    const err = e as { code?: string; detail?: string };
    if (err.code !== "23514") throw e;
    return { kind: "sold_out", night: err.detail?.match(/Night (\d{4}-\d{2}-\d{2})/)?.[1] ?? input.checkIn };
  }
}

async function findByIdempotencyKey(key: string): Promise<Reservation | null> {
  const { rows } = await pool.query("SELECT * FROM reservation WHERE idempotency_key = $1", [key]);
  return rows[0] ? toReservation(rows[0]) : null;
}

export async function getReservation(id: string): Promise<Reservation | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const { rows } = await pool.query("SELECT * FROM reservation WHERE id = $1", [id]);
  return rows[0] ? toReservation(rows[0]) : null;
}

// ---- Payments (TestPay callback) ----

export const PaymentCallback = z.object({
  paymentId: z.string().min(1).max(100),
  reservationId: z.uuid(),
  amount: z.coerce.number().int(),
  status: z.enum(["success", "failed"]),
  signature: z.string().regex(/^[0-9a-f]{64}$/),
});
export type PaymentCallback = z.infer<typeof PaymentCallback>;

export type PaymentResult =
  | { kind: "bad_signature" }
  | { kind: "unknown_reservation" }
  | {
      kind: "applied";
      outcome: "confirmed" | "refund_due" | "rejected";
      reservationStatus: Reservation["status"];
      late: boolean;
      /** true when this payment id was seen before; nothing changed. */
      replay: boolean;
    };

/** HMAC-SHA256 (hex) over the callback fields, keyed with PAYMENT_WEBHOOK_SECRET. The mock gateway signs with this. */
export function signPayment(p: Omit<PaymentCallback, "signature">): string {
  return createHmac("sha256", secret("PAYMENT_WEBHOOK_SECRET"))
    .update(`${p.paymentId}|${p.reservationId}|${p.amount}|${p.status}`)
    .digest("hex");
}

/** Verifies the signature, then applies the payment in one database call (apply_payment, migration 0003). */
export async function applyPayment(p: PaymentCallback): Promise<PaymentResult> {
  const expected = Buffer.from(signPayment(p), "hex");
  const given = Buffer.from(p.signature, "hex");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { kind: "bad_signature" };
  try {
    const { rows } = await pool.query("SELECT * FROM apply_payment($1, $2, $3, $4)", [
      p.paymentId,
      p.reservationId,
      p.amount,
      p.status === "success",
    ]);
    const r = rows[0];
    return { kind: "applied", outcome: r.outcome, reservationStatus: r.reservation_status, late: r.late, replay: r.replay };
  } catch (e) {
    if ((e as { code?: string }).code === "P0002") return { kind: "unknown_reservation" };
    throw e;
  }
}

// ---- Availability (read-only: may be seconds stale, can never approve a sale) ----

export type Availability = {
  nights: { night: string; rate: number; closed: boolean; remaining: number }[];
  /** Keys bookable for the whole stay: the smallest remaining over its nights; 0 if a night is missing. */
  available: number;
};

export async function availability(roomTypeId: string, checkIn: string, checkOut: string): Promise<Availability> {
  const want = nightsBetween(checkIn, checkOut).length;
  const { rows } = await pool.query<{ night: string; rate_inr: number; closed: boolean; remaining: number }>(
    `SELECT night, rate_inr, closed, remaining FROM night_usage
     WHERE room_type_id = $1 AND night >= $2 AND night < $3 ORDER BY night`,
    [roomTypeId, checkIn, checkOut],
  );
  const nights = rows.map((r) => ({ night: r.night, rate: r.rate_inr, closed: r.closed, remaining: r.remaining }));
  const available = nights.length === want ? Math.min(...nights.map((n) => n.remaining)) : 0;
  return { nights, available };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- a raw pg row
function toReservation(r: any): Reservation {
  return {
    id: r.id,
    ref: r.ref,
    roomTypeId: r.room_type_id,
    ratePlanId: r.rate_plan_id,
    checkIn: r.check_in,
    checkOut: r.check_out,
    qty: r.qty,
    adults: r.adults,
    children: r.children,
    status: r.status,
    expiresAt: r.expires_at,
    quotedTotal: r.quoted_total,
    priceLines: r.price_lines,
    promoCode: r.promo_code,
    guestName: r.guest_name,
    guestEmail: r.guest_email,
    guestPhone: r.guest_phone,
    late: r.late,
    createdAt: r.created_at,
  };
}
