import { z } from "zod";
import { pool, withTransaction } from "@/db/pool";
import type { Session } from "@/server/session";

export function requireStaff(actor: Session) {
  if (actor.role !== "staff" && actor.role !== "gm") throw new Error("Staff access required");
}
export function requireGm(actor: Session) {
  if (actor.role !== "gm") throw new Error("GM access required");
}

export const InventoryEdit = z
  .object({
    roomTypeId: z.string().min(1).max(64),
    from: z.iso.date(),
    to: z.iso.date(),
    rate: z.coerce.number().int().min(1000).max(500000),
    allotment: z.coerce.number().int().min(0).max(76),
    closed: z.boolean(),
    setMinimum: z.boolean().default(false),
  })
  .refine(
    (x) => x.to >= x.from && Date.parse(x.to) - Date.parse(x.from) <= 30 * 86400000,
    "Choose up to thirty-one nights in date order",
  );
type InventoryResult =
  { kind: "saved"; nights: number } | { kind: "minimum"; night: string; minimum: number };

export async function editInventory(actor: Session, raw: unknown): Promise<InventoryResult> {
  requireStaff(actor);
  const input = InventoryEdit.parse(raw);
  return withTransaction(async (client) => {
    const room = await client.query<{ keys_total: number }>(
      "SELECT keys_total FROM room_types WHERE id=$1 FOR SHARE",
      [input.roomTypeId],
    );
    if (!room.rows[0]) throw new Error("Room type not found");
    if (input.allotment > room.rows[0].keys_total)
      throw new Error(`Allotment exceeds the ${room.rows[0].keys_total} physical keys`);
    await client.query(
      "SELECT night FROM inventory_night WHERE room_type_id=$1 AND night BETWEEN $2 AND $3 ORDER BY night FOR UPDATE",
      [input.roomTypeId, input.from, input.to],
    );
    const { rows } = await client.query<{ night: string; active: number }>(
      "SELECT night,active FROM night_usage WHERE room_type_id=$1 AND night BETWEEN $2 AND $3 ORDER BY night",
      [input.roomTypeId, input.from, input.to],
    );
    const expected = Math.round((Date.parse(input.to) - Date.parse(input.from)) / 86400000) + 1;
    if (rows.length !== expected) throw new Error("Some dates are outside the published calendar");
    const refusal = rows.find((night) => night.active > (input.closed ? 0 : input.allotment));
    if (refusal && !input.setMinimum)
      return { kind: "minimum", night: refusal.night, minimum: refusal.active };
    for (const night of rows) {
      const allotment = input.setMinimum
        ? input.closed
          ? night.active
          : Math.max(input.allotment, night.active)
        : input.allotment;
      const closed = input.closed && night.active === 0;
      await client.query(
        "UPDATE inventory_night SET rate_inr=$3,allotment=$4,closed=$5 WHERE room_type_id=$1 AND night=$2",
        [input.roomTypeId, night.night, input.rate, allotment, closed],
      );
    }
    return { kind: "saved", nights: rows.length };
  });
}

export const PromoInput = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{2,32}$/),
    kind: z.enum(["percent", "flat"]),
    value: z.coerce.number().int().min(1).max(500000),
    validFrom: z.iso.date(),
    validTo: z.iso.date(),
    minNights: z.coerce.number().int().min(1).max(30),
    maxUses: z.number().int().positive().nullable(),
    active: z.boolean(),
  })
  .refine(
    (p) => p.validTo >= p.validFrom && (p.kind !== "percent" || p.value <= 100),
    "Check promo dates and percentage",
  );

export async function savePromo(actor: Session, raw: unknown): Promise<void> {
  requireStaff(actor);
  const p = PromoInput.parse(raw);
  await pool.query(
    `INSERT INTO promo(code,kind,value,valid_from,valid_to,min_nights,max_uses,active)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(code) DO UPDATE SET kind=$2,value=$3,valid_from=$4,valid_to=$5,min_nights=$6,max_uses=$7,active=$8`,
    [p.code, p.kind, p.value, p.validFrom, p.validTo, p.minNights, p.maxUses, p.active],
  );
}

export type InventoryNight = {
  room_type_id: string;
  room_name: string;
  night: string;
  rate_inr: number;
  allotment: number;
  closed: boolean;
  sold: number;
  held: number;
  remaining: number;
  keys_total: number;
};
export async function getInventory(from: string) {
  z.iso.date().parse(from);
  const { rows } = await pool.query<InventoryNight>(
    `SELECT u.*,r.name AS room_name,r.keys_total FROM night_usage u JOIN room_types r ON r.id=u.room_type_id WHERE night >= $1 AND night < $1::date + 30 ORDER BY r.sort_order,night`,
    [from],
  );
  return rows;
}
export type BookingRow = {
  id: string;
  ref: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  room_name: string;
  check_in: string;
  check_out: string;
  qty: number;
  status: string;
  quoted_total: number;
  created_at: Date;
};
export async function listBookings(date?: string) {
  if (date) z.iso.date().parse(date);
  const { rows } = await pool.query<BookingRow>(
    `SELECT b.*,r.name AS room_name FROM reservation b JOIN room_types r ON r.id=b.room_type_id WHERE ($1::date IS NULL OR b.check_in=$1) ORDER BY b.check_in,b.created_at DESC`,
    [date ?? null],
  );
  return rows;
}
function csvCell(value: string | number): string {
  let text = String(value);
  if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export async function bookingsCsv(actor: Session, date: string): Promise<string> {
  requireStaff(actor);
  const rows = await listBookings(z.iso.date().parse(date));
  return [
    "Reference,Guest,Email,Phone,Room,Check in,Check out,Keys,Status,Total INR",
    ...rows.map((r) =>
      [
        r.ref,
        r.guest_name,
        r.guest_email,
        r.guest_phone,
        r.room_name,
        r.check_in,
        r.check_out,
        r.qty,
        r.status,
        r.quoted_total,
      ]
        .map(csvCell)
        .join(","),
    ),
  ].join("\r\n");
}
export async function dashboardMetrics(actor: Session) {
  requireGm(actor);
  const bookings = await pool.query<{
    nights: number;
    revenue: number;
  }>(`SELECT coalesce(sum((check_out-check_in)*qty),0)::int AS nights,
    coalesce(sum((SELECT coalesce(sum((line->>'taxable')::numeric),0) FROM jsonb_array_elements(price_lines) line)),0)::int AS revenue
    FROM reservation WHERE status='confirmed'`);
  const replies = await pool.query<{ median: number | null }>(
    "SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM (first_reply_at-received_at))/60) AS median FROM enquiry WHERE first_reply_at IS NOT NULL",
  );
  const audit = await pool.query<{ n: number }>(
    "SELECT count(*)::int AS n FROM night_usage WHERE active>allotment_effective",
  );
  return {
    directNights: bookings.rows[0].nights,
    commissionAvoided: Math.round(bookings.rows[0].revenue * 0.2),
    medianReplyMinutes: replies.rows[0].median,
    overbookings: audit.rows[0].n,
  };
}
