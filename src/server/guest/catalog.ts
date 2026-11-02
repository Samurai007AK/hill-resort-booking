import { z } from "zod";
import { pool } from "@/db/pool";
import { availability, quoteStay, type QuoteResult } from "@/server/booking";
import type { Search } from "./rules";

const RoomRow = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["room", "villa"]),
  max_adults: z.number().int().positive(),
  max_children: z.number().int().nonnegative(),
  description: z.string(),
  photos: z.array(z.string()),
});
export type Room = z.infer<typeof RoomRow>;
const PlanRow = z.object({
  id: z.string(),
  name: z.string(),
  factor: z.number(),
  refundable: z.boolean(),
  breakfast: z.boolean(),
});
export type Plan = z.infer<typeof PlanRow>;

export async function listRooms(): Promise<Room[]> {
  const result = await pool.query(
    "SELECT id, name, kind, max_adults, max_children, description, photos FROM room_types ORDER BY sort_order",
  );
  return z.array(RoomRow).parse(result.rows);
}

export async function getRoom(id: string): Promise<Room | null> {
  const result = await pool.query(
    "SELECT id, name, kind, max_adults, max_children, description, photos FROM room_types WHERE id = $1",
    [id],
  );
  return result.rows[0] ? RoomRow.parse(result.rows[0]) : null;
}

export async function plansFor(roomTypeId: string): Promise<Plan[]> {
  const result = await pool.query(
    "SELECT id, name, factor, refundable, breakfast FROM rate_plans WHERE room_type_id = $1 ORDER BY factor DESC",
    [roomTypeId],
  );
  return z.array(PlanRow).parse(result.rows);
}

export function stayInput(roomTypeId: string, ratePlanId: string, search: Search) {
  return {
    roomTypeId,
    ratePlanId,
    checkIn: search.checkIn,
    checkOut: search.checkOut,
    qty: search.qty,
    promoCode: search.promo,
  };
}

export async function roomOffer(
  room: Room,
  search: Search,
): Promise<{ room: Room; remaining: number; quote: QuoteResult | null; plan: Plan | null }> {
  const [plans, stock] = await Promise.all([
    plansFor(room.id),
    availability(room.id, search.checkIn, search.checkOut),
  ]);
  const plan = plans[0] ?? null;
  return {
    room,
    remaining: stock.available,
    quote: plan ? await quoteStay(stayInput(room.id, plan.id, search)) : null,
    plan,
  };
}
