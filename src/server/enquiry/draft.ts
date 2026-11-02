import type { ClientBase } from "pg";
import { todayIST } from "@/domain/dates";
import { nightsBetween, priceStay } from "@/domain/pricing";
import { resolveDates, type Extraction } from "@/domain/enquiry/pipeline";

const rupees = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
const TEMPLATES = {
  room: "Thank you for considering the estate. {{DATES}} {{GUESTS}} {{NIGHTLY}} {{GST}} {{TOTAL}} {{AVAILABILITY}}",
  wedding:
    "Thank you for considering our lawns for your celebration. Our sales team will prepare a proposal after confirming your event dates and guest count.",
  offsite:
    "Thank you for considering an estate offsite. Our sales team will confirm your dates, group size, meeting space and accommodation needs before preparing a proposal.",
  complaint:
    "Thank you for telling us about your experience. The General Manager has been alerted and will review the matter with the team. Please share your booking reference so we can investigate.",
  other: "Thank you for getting in touch. Could you share a little more about how we can help?",
};

type Rates = { night: string; rate_inr: number; remaining: number };
async function priceSlots(
  db: Pick<ClientBase, "query">,
  extracted: Extraction,
  dates: ReturnType<typeof resolveDates>,
) {
  const defaults = {
    NIGHTLY: "",
    GST: "",
    TOTAL: "A quote will follow once we confirm the stay details.",
    AVAILABILITY: "Availability is only secured when you create a booking hold.",
  };
  if (!dates.checkIn || !dates.checkOut || dates.checkIn < todayIST()) return defaults;
  let nights: string[];
  try {
    nights = nightsBetween(dates.checkIn, dates.checkOut);
  } catch {
    return defaults;
  }
  const roomId = extracted.room_type ?? "estate-room";
  const { rows: rooms } = await db.query<{
    name: string;
    max_adults: number;
    max_children: number;
  }>("SELECT name,max_adults,max_children FROM room_types WHERE id=$1", [roomId]);
  const room = rooms[0];
  if (!room) return defaults;
  if (extracted.adults === null || extracted.children === null) return defaults;
  const qty = Math.max(
    1,
    Math.ceil(extracted.adults / room.max_adults),
    room.max_children
      ? Math.ceil(extracted.children / room.max_children)
      : extracted.children > 0
        ? Infinity
        : 1,
  );
  if (qty > 4)
    return {
      ...defaults,
      AVAILABILITY: "Your group needs a tailored accommodation plan from our team.",
    };
  const { rows } = await db.query<Rates>(
    "SELECT night,rate_inr,remaining FROM night_usage WHERE room_type_id=$1 AND night >= $2 AND night < $3 ORDER BY night",
    [roomId, dates.checkIn, dates.checkOut],
  );
  if (rows.length !== nights.length) return defaults;
  const quote = priceStay({
    nights: rows.map((row) => ({ date: row.night, tariff: row.rate_inr })),
    planFactor: 1,
    qty,
  });
  const available = rows.every((row) => row.remaining >= qty);
  return {
    NIGHTLY: `${room.name}, ${qty} key(s), flexible breakfast plan: ${quote.lines.map((line) => `${line.date}: ${rupees(line.taxable)} before GST`).join("; ")}.`,
    GST: `GST by night: ${quote.lines.map((line) => `${line.date}: ${line.gstRate}% (${rupees(line.gst)})`).join("; ")}.`,
    TOTAL: `Indicative stay total from the current rate table: ${rupees(quote.grandTotal)} including GST.`,
    AVAILABILITY: available
      ? "Currently available; no room is held by this enquiry. Book online to secure a hold."
      : "The requested stay is not currently available. Our team can suggest alternatives.",
  };
}

export async function makeDraft(
  db: Pick<ClientBase, "query">,
  category: keyof typeof TEMPLATES,
  extracted: Extraction,
  /** A screened model draft with slots; the standard wording is used when absent. */
  aiTemplate: string | null = null,
): Promise<string> {
  const dates = resolveDates(extracted.check_in, extracted.check_out, todayIST());
  const slots = {
    DATES: dates.checkIn
      ? `Requested dates: ${dates.checkIn}${dates.checkOut ? ` to ${dates.checkOut}` : ""}.`
      : "Please share your exact arrival and departure dates.",
    GUESTS:
      extracted.guests_total !== null
        ? `Party size: ${extracted.guests_total}.`
        : "Please confirm the number of adults and children.",
    ...(await priceSlots(db, extracted, dates)),
  };
  const template = aiTemplate ?? TEMPLATES[category];
  let draft = template.replace(/\{\{([A-Z_]+)\}\}/g, (_, slot: string) =>
    slot in slots ? slots[slot as keyof typeof slots] : "",
  );
  if (
    category === "room" &&
    !draft.includes("current rate table") &&
    slots.TOTAL.startsWith("Indicative")
  )
    draft += ` ${slots.NIGHTLY} ${slots.GST} ${slots.TOTAL} ${slots.AVAILABILITY}`;
  if (dates.assumed)
    draft +=
      " The year was inferred as the next occurrence; please confirm the year before we proceed.";
  if (category === "room" && (extracted.adults === null || extracted.children === null))
    draft += " Please confirm the adults and children, including whether there are no children.";
  if ((extracted.guests_total ?? 0) > 152)
    draft +=
      " Your headcount exceeds a working assumption of two guests per key across our 76 keys. Our team can discuss a buyout and nearby stays; accommodation is not confirmed.";
  return draft.replace(/\s+/g, " ").trim();
}
