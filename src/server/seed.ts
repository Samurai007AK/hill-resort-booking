import bcrypt from "bcryptjs";
import type { ClientBase } from "pg";
import { addDays, isWeekendNight, todayIST } from "@/domain/dates";
import { nightsBetween, priceStay, type Discount } from "@/domain/pricing";

// Demo data (A1-A3, A6, A12). Every date is relative to `today`, so the demo never goes stale.

const photo = (id: string) => `https://images.unsplash.com/photo-${id}?w=1600&q=70&auto=format&fit=crop`;

type RoomTypeSeed = {
  id: string;
  name: string;
  kind: "room" | "villa";
  keys: number;
  allotment: number;
  rate: number;
  weekendRate?: number;
  maxAdults: number;
  maxChildren: number;
  description: string;
  photos: string[];
};

export const ROOM_TYPES: RoomTypeSeed[] = [
  {
    id: "estate-room",
    name: "Estate Room",
    kind: "room",
    keys: 40,
    allotment: 13,
    rate: 7200,
    weekendRate: 8200,
    maxAdults: 2,
    maxChildren: 1,
    description:
      "A calm room in the main estate house, with a queen bed, a reading chair by the window and the smell of coffee drying in the yard below. Breakfast is served on the verandah.",
    photos: ["1611892440504-42a792e24d32", "1505693416388-ac5ce068fe85", "1618773928121-c32242e63f39", "1470071459604-3b5ec3a7fe05", "1447933601403-0c6688de566e"].map(photo),
  },
  {
    id: "plantation-view-room",
    name: "Plantation View Room",
    kind: "room",
    keys: 16,
    allotment: 5,
    rate: 9500,
    maxAdults: 2,
    maxChildren: 1,
    description:
      "Upper-floor rooms with a private balcony over the coffee and pepper slopes. Mornings start in mist; evenings end with the hills turning blue.",
    photos: ["1596394516093-501ba68a0ba6", "1582719478250-c89cae4dc85b", "1506905925346-21bda4d32df4", "1497250681960-ef046c08a56e", "1447752875215-b2761acb3c5d"].map(photo),
  },
  {
    id: "family-suite",
    name: "Family Suite",
    kind: "room",
    keys: 8,
    allotment: 3,
    rate: 12000,
    maxAdults: 3,
    maxChildren: 2,
    description:
      "Two connected rooms, a king bed and twin beds, with a sitting room between them. Room for the children to spread out, a door to close for the grown-ups.",
    photos: ["1595576508898-0ad5c879a061", "1590490360182-c33d57733427", "1522771739844-6a9f6d5f14af", "1509042239860-f550ce710b93", "1441974231531-c6227db76b6e"].map(photo),
  },
  {
    id: "coffee-villa",
    name: "Coffee Villa",
    kind: "villa",
    keys: 8,
    allotment: 3,
    rate: 16000,
    maxAdults: 2,
    maxChildren: 2,
    description:
      "A standalone cottage inside the plantation with a sit-out, a plunge pool and your own coffee bar stocked with beans roasted on the estate.",
    photos: ["1566073771259-6a8506099945", "1578683010236-d716f9a3f461", "1442512595331-e89e73853f31", "1495474472287-4d71bcdd2085", "1511497584788-876760111969"].map(photo),
  },
  {
    id: "pool-villa",
    name: "Pool Villa",
    kind: "villa",
    keys: 4,
    allotment: 1,
    rate: 22000,
    maxAdults: 4,
    maxChildren: 2,
    description:
      "Our largest villa: two bedrooms, a private pool under the silver oaks and a deck facing the valley. Built for slow days and long dinners.",
    photos: ["1520250497591-112f2f40a3f4", "1584132967334-10e028bd69f7", "1602002418082-a4443e081dd1", "1571896349842-33c89424de2d", "1433086966358-54859d0ed716"].map(photo),
  },
];

const RATE_PLANS = [
  { suffix: "flex", name: "Flexible with breakfast", factor: 1, refundable: true, breakfast: true },
  { suffix: "nonref", name: "Non-refundable", factor: 0.9, refundable: false, breakfast: true },
] as const;

export const DEMO_PASSWORD = "demo1234";
export const DEMO_USERS = [
  { email: "guest@demo.in", name: "Demo Guest", role: "guest", team: null },
  { email: "reservations@demo.in", name: "Kavya (Reservations)", role: "staff", team: "reservations" },
  { email: "sales@demo.in", name: "Rohan (Sales)", role: "staff", team: "sales" },
  { email: "gm@demo.in", name: "Meera (GM)", role: "gm", team: null },
] as const;

export const NIGHTS_AHEAD = 180;

/**
 * Resets bookings, payments, rates, allotments and promos to the demo state. Never deletes or
 * changes users: demo users are only added if missing. Enquiries are not touched here; append
 * their seeding to this function. Runs its own transaction, so pass a client not already in one.
 */
export async function seedDemo(client: ClientBase, today: string = todayIST()): Promise<void> {
  await client.query("BEGIN");
  try {
    await seedUsers(client);
    await client.query("TRUNCATE payment, reservation, inventory_night, promo");
    await seedRoomTypes(client);
    await seedInventory(client, today);
    await seedPromos(client, today);
    await seedBookings(client, today);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  }
}

async function seedUsers(client: ClientBase) {
  for (const u of DEMO_USERS) {
    const exists = await client.query("SELECT 1 FROM users WHERE email = $1", [u.email]);
    if (exists.rowCount) continue;
    await client.query("INSERT INTO users (email, name, password_hash, role, team) VALUES ($1, $2, $3, $4, $5)", [
      u.email,
      u.name,
      await bcrypt.hash(DEMO_PASSWORD, 10),
      u.role,
      u.team,
    ]);
  }
}

async function seedRoomTypes(client: ClientBase) {
  for (const [i, t] of ROOM_TYPES.entries()) {
    await client.query(
      `INSERT INTO room_types (id, name, kind, keys_total, max_adults, max_children, description, photos, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET name = $2, kind = $3, keys_total = $4, max_adults = $5, max_children = $6,
         description = $7, photos = $8, sort_order = $9`,
      [t.id, t.name, t.kind, t.keys, t.maxAdults, t.maxChildren, t.description, t.photos, i],
    );
    for (const p of RATE_PLANS) {
      await client.query(
        `INSERT INTO rate_plans (id, room_type_id, name, factor, refundable, breakfast) VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET name = $3, factor = $4, refundable = $5, breakfast = $6`,
        [`${t.id}-${p.suffix}`, t.id, p.name, p.factor, p.refundable, p.breakfast],
      );
    }
  }
}

const rateOn = (t: RoomTypeSeed, night: string) => (t.weekendRate && isWeekendNight(night) ? t.weekendRate : t.rate);

/** Nights taken off sale: Pool Villa maintenance and an Estate Room buyout (offsets from today). */
const CLOSED: { roomTypeId: string; offsets: number[] }[] = [
  { roomTypeId: "pool-villa", offsets: [20, 21] },
  { roomTypeId: "estate-room", offsets: [45] },
];

async function seedInventory(client: ClientBase, today: string) {
  const nights = Array.from({ length: NIGHTS_AHEAD }, (_, i) => addDays(today, i));
  for (const t of ROOM_TYPES) {
    const closed = new Set((CLOSED.find((c) => c.roomTypeId === t.id)?.offsets ?? []).map((o) => addDays(today, o)));
    await client.query(
      `INSERT INTO inventory_night (room_type_id, night, rate_inr, allotment, closed)
       SELECT $1, n, r, $4, c FROM unnest($2::date[], $3::int[], $5::bool[]) AS x(n, r, c)`,
      [t.id, nights, nights.map((n) => rateOn(t, n)), t.allotment, nights.map((n) => closed.has(n))],
    );
  }
}

const PROMOS = (today: string) => [
  { code: "MONSOON15", kind: "percent", value: 15, from: addDays(today, -30), to: addDays(today, 150), minNights: 1, maxUses: null },
  { code: "ESTATE2000", kind: "flat", value: 2000, from: today, to: addDays(today, 90), minNights: 2, maxUses: 50 },
];

async function seedPromos(client: ClientBase, today: string) {
  for (const p of PROMOS(today)) {
    await client.query(
      `INSERT INTO promo (code, kind, value, valid_from, valid_to, min_nights, max_uses) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [p.code, p.kind, p.value, p.from, p.to, p.minNights, p.maxUses],
    );
  }
}

type BookingSeed = {
  type: string;
  plan: "flex" | "nonref";
  in: number; // check-in offset from today
  nights: number;
  qty: number;
  status: "held" | "confirmed" | "cancelled";
  guest: string;
  promo?: string;
  late?: boolean;
};

/** The first Saturday at least 3 days out: the night the Coffee Villa is sold out on the website. */
export function soldOutNight(today: string): string {
  let d = addDays(today, 3);
  while (new Date(`${d}T00:00:00Z`).getUTCDay() !== 6) d = addDays(d, 1);
  return d;
}

function bookings(today: string): BookingSeed[] {
  const sat = Math.round((Date.parse(soldOutNight(today)) - Date.parse(today)) / 86_400_000);
  return [
    { type: "estate-room", plan: "flex", in: 2, nights: 2, qty: 1, status: "confirmed", guest: "Ananya Iyer" },
    { type: "estate-room", plan: "nonref", in: 5, nights: 3, qty: 2, status: "confirmed", guest: "Vikram Shetty" },
    { type: "plantation-view-room", plan: "flex", in: 3, nights: 2, qty: 1, status: "confirmed", guest: "Sneha Kulkarni" },
    { type: "plantation-view-room", plan: "flex", in: 10, nights: 4, qty: 1, status: "confirmed", guest: "Arjun Menon" },
    { type: "family-suite", plan: "flex", in: 1, nights: 1, qty: 1, status: "confirmed", guest: "Farah Khan", late: true },
    { type: "family-suite", plan: "flex", in: 7, nights: 2, qty: 1, status: "confirmed", guest: "Rahul Nair" },
    { type: "family-suite", plan: "nonref", in: 14, nights: 3, qty: 2, status: "confirmed", guest: "Deepa Gowda" },
    // Coffee Villa: 3 on the website, all 3 taken on the Saturday night.
    { type: "coffee-villa", plan: "flex", in: sat - 1, nights: 2, qty: 2, status: "confirmed", guest: "Kiran Hegde" },
    { type: "coffee-villa", plan: "nonref", in: sat, nights: 1, qty: 1, status: "confirmed", guest: "Priya Bhat" },
    { type: "coffee-villa", plan: "flex", in: 25, nights: 2, qty: 1, status: "confirmed", guest: "Nikhil Rao" },
    { type: "pool-villa", plan: "flex", in: 4, nights: 3, qty: 1, status: "confirmed", guest: "Aditi Sharma" },
    { type: "pool-villa", plan: "nonref", in: 30, nights: 2, qty: 1, status: "confirmed", guest: "Sameer Joshi" },
    { type: "plantation-view-room", plan: "nonref", in: 40, nights: 2, qty: 1, status: "confirmed", guest: "Lakshmi Pai", promo: "MONSOON15" },
    { type: "estate-room", plan: "flex", in: 22, nights: 3, qty: 1, status: "confirmed", guest: "Manoj Reddy", promo: "ESTATE2000" },
    { type: "estate-room", plan: "flex", in: 12, nights: 1, qty: 1, status: "held", guest: "Tara D'Souza" },
    { type: "estate-room", plan: "flex", in: 60, nights: 2, qty: 1, status: "cancelled", guest: "Gaurav Patil" },
  ];
}

async function seedBookings(client: ClientBase, today: string) {
  const promos = new Map(PROMOS(today).map((p) => [p.code, { kind: p.kind, value: p.value } as Discount]));
  for (const [i, b] of bookings(today).entries()) {
    const t = ROOM_TYPES.find((x) => x.id === b.type)!;
    const checkIn = addDays(today, b.in);
    const checkOut = addDays(checkIn, b.nights);
    const quote = priceStay({
      nights: nightsBetween(checkIn, checkOut).map((date) => ({ date, tariff: rateOn(t, date) })),
      planFactor: RATE_PLANS.find((p) => p.suffix === b.plan)!.factor,
      qty: b.qty,
      promo: b.promo ? promos.get(b.promo) : undefined,
    });
    const handle = b.guest.toLowerCase().replace(/[^a-z]+/g, ".");
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO reservation (room_type_id, rate_plan_id, check_in, check_out, qty, adults, children, status, expires_at,
                                quoted_total, price_lines, promo_code, guest_name, guest_email, guest_phone, consent_at, late, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 0, $7, CASE WHEN $7 = 'held' THEN now() + interval '10 minutes' END,
               $8, $9, $10, $11, $12, $13, now(), $14, now() - make_interval(days => $15))
       RETURNING id`,
      [
        t.id,
        `${t.id}-${b.plan}`,
        checkIn,
        checkOut,
        b.qty,
        2 * b.qty,
        b.status,
        quote.grandTotal,
        JSON.stringify(quote.lines),
        b.promo ?? null,
        b.guest,
        `${handle}@example.com`,
        `+91 90000 ${String(10000 + i).slice(-5)}`,
        b.late ?? false,
        (i % 6) + 1,
      ],
    );
    if (b.status === "confirmed") {
      await client.query("INSERT INTO payment (payment_id, reservation_id, amount, outcome) VALUES ($1, $2, $3, 'confirmed')", [
        `seed_pay_${i + 1}`,
        rows[0].id,
        quote.grandTotal,
      ]);
      if (b.promo) await client.query("UPDATE promo SET uses = uses + 1 WHERE code = $1", [b.promo]);
    }
  }
}
