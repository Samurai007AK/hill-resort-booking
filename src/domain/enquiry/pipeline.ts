import { z } from "zod";
import { isIsoDate } from "@/domain/dates";
import { Category, DatePart } from "./gold";

export const Lane = z.enum(["unsorted", "rooms", "events", "complaints"]);
export type Lane = z.infer<typeof Lane>;
export const AI_CUTOFF = 0.95;
export const Extraction = z.strictObject({
  check_in: DatePart.nullable(),
  check_out: DatePart.nullable(),
  adults: z.number().int().min(0).max(10000).nullable(),
  children: z.number().int().min(0).max(10000).nullable(),
  guests_total: z.number().int().min(0).max(10000).nullable(),
  budget_inr: z.number().int().min(0).max(1000000000).nullable(),
  room_type: z
    .enum(["estate-room", "plantation-view-room", "family-suite", "coffee-villa", "pool-villa"])
    .nullable(),
});
export type Extraction = z.infer<typeof Extraction>;
export const AiResponse = z.strictObject({
  category: Category,
  confidence: z.number().min(0).max(1),
  extracted: Extraction,
  reply_template: z.string().min(1).max(2000),
});
export type AiResponse = z.infer<typeof AiResponse>;

export function redactPersonalData(text: string, senderName = ""): string {
  let safe = text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED]")
    .replace(/\b[A-Z]{5}\d{4}[A-Z]\b/gi, "[REDACTED]")
    .replace(/\b[A-Z]\d{7}\b/gi, "[REDACTED]")
    .replace(/\b\d{4}[ -]?\d{4}[ -]?\d{4}\b/g, "[REDACTED]")
    .replace(/(?:\+?91[ -]?)?[6-9]\d{4}[ -]?\d{5}\b/g, "[REDACTED]")
    .replace(/\+\d[\d -]{8,17}\d\b/g, "[REDACTED]");
  if (senderName.trim())
    safe = safe.replace(
      new RegExp(senderName.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"),
      "[REDACTED]",
    );
  return safe;
}

export function isInjection(text: string): boolean {
  return /ignore (?:all |the )?(?:previous |prior )?instructions|system override|note to the ai|do not check the rate|authorised by the general manager/i.test(
    text,
  );
}

export function classifyKeywords(text: string): z.infer<typeof Category> {
  if (
    /complain|refund|unacceptable|poor experience|worst|rude|dirty|cockroach|upset stomach|lost power|no generator|fell in|green and dirty|extra kaat|galat|no reply|hasn.t come back|didn.t work|reported it|manager.*call|speak to.*gm/i.test(
      text,
    )
  )
    return "complaint";
  if (/wedding|married|shaadi|sangeet|engagement|roka|reception|pheras/i.test(text))
    return "wedding";
  if (
    /offsite|conference|boardroom|delegates|team of|leadership|staff.*outing|review meeting|meeting room|corporate/i.test(
      text,
    )
  )
    return "offsite";
  if (
    /room|villa|suite|suit\b|book|stay|breakfast|availability|availabilty|\bavl\b|kamre/i.test(text)
  )
    return "room";
  return "other";
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const monthPattern =
  "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";
const ordinal = "(?:st|nd|rd|th)?";
const monthNumber = (name: string) => MONTHS.indexOf(name.toLowerCase().slice(0, 3)) + 1;
const part = (month: string, day?: string, year?: string): DatePart => ({
  month: monthNumber(month),
  day: day ? Number(day) : null,
  year: year ? Number(year) : null,
});

function extractDates(text: string): { check_in: DatePart | null; check_out: DatePart | null } {
  const isoDates = [...text.matchAll(/\b(20\d{2})-(\d{2})-(\d{2})\b/g)];
  if (isoDates[0])
    return {
      check_in: {
        year: Number(isoDates[0][1]),
        month: Number(isoDates[0][2]),
        day: Number(isoDates[0][3]),
      },
      check_out: isoDates[1]
        ? {
            year: Number(isoDates[1][1]),
            month: Number(isoDates[1][2]),
            day: Number(isoDates[1][3]),
          }
        : null,
    };
  const cross = text.match(
    new RegExp(
      `(\\d{1,2})${ordinal}\\s*(${monthPattern})(?:\\s+(20\\d{2}))?\\s*(?:-|to)\\s*(\\d{1,2})${ordinal}\\s*(${monthPattern})(?:\\s+(20\\d{2}))?`,
      "i",
    ),
  );
  if (cross)
    return {
      check_in: part(cross[2], cross[1], cross[3] || cross[6]),
      check_out: part(cross[5], cross[4], cross[6] || cross[3]),
    };
  const range = text.match(
    new RegExp(
      `(\\d{1,2})${ordinal}\\s*(?:-|to)\\s*(\\d{1,2})${ordinal}\\s*(${monthPattern})(?:\\s+(20\\d{2}))?`,
      "i",
    ),
  );
  if (range)
    return {
      check_in: part(range[3], range[1], range[4]),
      check_out: part(range[3], range[2], range[4]),
    };
  const matches = [
    ...text.matchAll(
      new RegExp(`(\\d{1,2})${ordinal}\\s*(${monthPattern})(?:\\s+(20\\d{2}))?`, "gi"),
    ),
  ];
  const first = matches[0];
  const second = matches[1];
  if (first)
    return {
      check_in: part(first[2], first[1], first[3]),
      check_out: second ? part(second[2], second[1], second[3] || first[3]) : null,
    };
  const month = text.match(new RegExp(`\\b(${monthPattern})\\b(?:\\s+(20\\d{2}))?`, "i"));
  return { check_in: month ? part(month[1], undefined, month[2]) : null, check_out: null };
}

const written: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};
function countFor(text: string, noun: string): number | null {
  const match = text.match(
    new RegExp(
      `\\b(\\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten)\\s+(?:${noun})\\b`,
      "i",
    ),
  );
  return match ? (written[match[1].toLowerCase()] ?? Number(match[1])) : null;
}

export function numericValues(text: string): number[] {
  return [...text.matchAll(/\d[\d,]*(?:\.\d+)?\s*(?:crore|lakhs?|lacs?|[kL](?![a-z]))?/gi)].map(
    (match) => {
      const raw = match[0].replace(/,/g, "").trim();
      const num = parseFloat(raw);
      return Math.round(
        num *
          (/crore/i.test(raw)
            ? 10000000
            : /lakh|lac|l$/i.test(raw)
              ? 100000
              : /k$/i.test(raw)
                ? 1000
                : 1),
      );
    },
  );
}

function partyCounts(text: string) {
  const adults = countFor(text, "adults?");
  const children = countFor(text, "children|child|kids?|bachche");
  const shorthand = text.match(/\b(\d+)\+(\d+)\b/);
  const a = adults ?? (shorthand ? Number(shorthand[1]) : null);
  const c = children ?? (shorthand ? Number(shorthand[2]) : null);
  const head =
    text.match(/(?:team|group) of (\d+)/i) ||
    text.match(
      /(?:for|about|around|with|of|lagbhag)?\s*(\d+)\s*(?:guests|pax|people|ppl|log|delegates|staff)/i,
    );
  return {
    adults: a,
    children: c,
    guests_total: head ? Number(head[1]) : a !== null ? a + (c ?? 0) : c,
  };
}
function roomType(text: string): Extraction["room_type"] {
  const matches: [RegExp, NonNullable<Extraction["room_type"]>][] = [
    [/pool villa/i, "pool-villa"],
    [/coffee villa/i, "coffee-villa"],
    [/plantation view/i, "plantation-view-room"],
    [/family suit/i, "family-suite"],
    [/estate room/i, "estate-room"],
    [/\bvilla/i, "coffee-villa"],
    [/\broom/i, "estate-room"],
  ];
  return matches.find(([pattern]) => pattern.test(text))?.[1] ?? null;
}
function statedBudget(text: string): number | null {
  const match = text.match(
    /budget[^\d]{0,20}(\d[\d,]*(?:\.\d+)?\s*(?:crore|lakhs?|lacs?|[kL](?![a-z]))?)/i,
  );
  return match ? (numericValues(match[1])[0] ?? null) : null;
}
export function extractKeywords(text: string): Extraction {
  const complaint = classifyKeywords(text) === "complaint";
  const party = partyCounts(text);
  return {
    ...extractDates(text),
    ...party,
    guests_total: complaint ? null : party.guests_total,
    budget_inr: complaint || isInjection(text) ? null : statedBudget(text),
    room_type: roomType(text),
  };
}

const numberWords =
  /\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|lakh|crore|million|billion)\b/i;
const SLOTS = ["TOTAL", "NIGHTLY", "GST", "DATES", "GUESTS", "AVAILABILITY"];
function validateTemplate(template: string, ctx: z.RefinementCtx) {
  const prose = template.replace(/\{\{([A-Z_]+)\}\}/g, (_, slot: string) => {
    if (!SLOTS.includes(slot)) ctx.addIssue({ code: "custom", message: "Unknown draft slot" });
    return "";
  });
  if (
    /[\d₹%{}]|\b(?:confirm|confirmed|confirmation|complete|booked|reserved|guaranteed|discount|percent|rupees|free|complimentary|available|cancellation|refund)\b/i.test(
      prose,
    ) ||
    numberWords.test(prose)
  )
    ctx.addIssue({
      code: "custom",
      message: "Draft must use server-filled slots and contain no commercial promises",
    });
}
function calendarDateValid(date: DatePart): boolean {
  if (date.day === null) return true;
  const iso = `${date.year ?? 2000}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
  try {
    return isIsoDate(iso);
  } catch {
    return false;
  }
}
function validateExtracted(e: Extraction, text: string, ctx: z.RefinementCtx) {
  const values = numericValues(text);
  const present = (v: number | null) =>
    v === null || values.includes(v) || (v === 1 && /\b(?:a|an|one)\b/i.test(text));
  for (const value of [e.adults, e.children, e.budget_inr])
    if (!present(value)) ctx.addIssue({ code: "custom", message: "Invented number" });
  if (!present(e.guests_total) && e.guests_total !== (e.adults ?? 0) + (e.children ?? 0))
    ctx.addIssue({ code: "custom", message: "Invented guest total" });
  for (const date of [e.check_in, e.check_out])
    if (date) {
      if (
        !calendarDateValid(date) ||
        !present(date.day) ||
        !present(date.year) ||
        (!new RegExp(`\\b${MONTHS[date.month - 1]}`, "i").test(text) &&
          !values.includes(date.month))
      )
        ctx.addIssue({ code: "custom", message: "Invented or invalid date" });
    }
  if (
    e.check_in?.day &&
    e.check_out?.day &&
    !resolveDates(e.check_in, e.check_out, "2000-01-01").checkOut
  )
    ctx.addIssue({ code: "custom", message: "Departure must be after arrival" });
}
export function validateAiResponse(raw: unknown, text: string) {
  return AiResponse.superRefine((response, ctx) => {
    validateTemplate(response.reply_template, ctx);
    validateExtracted(response.extracted, text, ctx);
  }).safeParse(raw);
}

type DecisionInput = {
  keyword: z.infer<typeof Category>;
  extracted: Extraction;
  injection: boolean;
  ai: { category: z.infer<typeof Category>; confidence: number } | null;
  status: "ok" | "fallback" | "off";
};
function fieldsMissing(category: z.infer<typeof Category>, extracted: Extraction): boolean {
  if (
    extracted.check_in?.day &&
    extracted.check_out?.day &&
    !resolveDates(extracted.check_in, extracted.check_out, "2000-01-01").checkOut
  )
    return true;
  switch (category) {
    case "room":
      return !extracted.check_in?.day || !extracted.check_out?.day || !extracted.guests_total;
    case "wedding":
    case "offsite":
      return !extracted.check_in?.day || !extracted.guests_total;
    case "complaint":
      return false;
    case "other":
      return true;
  }
}
function reviewReason(input: DecisionInput, missing: boolean, cutoff: number): string | null {
  if (input.injection) return "Message contains instruction-like text; staff review needed";
  if (input.status === "off") return "AI switched off; keyword fallback requires review";
  if (input.status !== "ok" || !input.ai) return "AI unavailable; keyword fallback requires review";
  if (input.ai.category !== input.keyword) return "AI and keyword classification disagree";
  if (input.ai.confidence < cutoff) return "Low model confidence";
  if (missing) return "Missing dates or guest count; staff review needed";
  return null;
}
const ownerByCategory = {
  room: "reservations",
  wedding: "sales",
  offsite: "sales",
  complaint: "gm",
  other: null,
} as const;
const laneByCategory = {
  room: "rooms",
  wedding: "events",
  offsite: "events",
  complaint: "complaints",
  other: "unsorted",
} as const;
export function decideLane(
  input: DecisionInput,
  cutoff = AI_CUTOFF,
): {
  category: z.infer<typeof Category>;
  lane: Lane;
  owner_team: (typeof ownerByCategory)[z.infer<typeof Category>];
  gm_alert: boolean;
  reason: string;
} {
  const category = input.ai?.category ?? input.keyword;
  const complaint = category === "complaint" || input.keyword === "complaint";
  const finalCategory = complaint ? "complaint" : category;
  const reason = reviewReason(input, fieldsMissing(category, input.extracted), cutoff);
  const lane: Lane = reason ? "unsorted" : laneByCategory[finalCategory];
  return {
    category: finalCategory,
    lane,
    owner_team: ownerByCategory[finalCategory],
    gm_alert: complaint || input.status !== "ok",
    reason: reason ?? "AI and keyword checks agree",
  };
}

export function resolveDates(
  start: DatePart | null,
  end: DatePart | null,
  today: string,
): { checkIn: string | null; checkOut: string | null; assumed: boolean } {
  const iso = (p: DatePart, year: number) =>
    `${year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
  if (!start?.day) return { checkIn: null, checkOut: null, assumed: false };
  let year = start.year ?? Number(today.slice(0, 4));
  if (!start.year && iso(start, year) < today) year++;
  const checkIn = iso(start, year);
  let checkOut: string | null = null;
  if (end?.day) {
    let endYear = end.year ?? year;
    if (!end.year && end.month < start.month) endYear++;
    checkOut = iso(end, endYear);
  }
  try {
    if (!isIsoDate(checkIn) || (checkOut && !isIsoDate(checkOut)))
      return { checkIn: null, checkOut: null, assumed: false };
  } catch {
    return { checkIn: null, checkOut: null, assumed: false };
  }
  if (checkOut && checkOut <= checkIn) return { checkIn: null, checkOut: null, assumed: false };
  return { checkIn, checkOut, assumed: !start.year || (!!end && !end.year) };
}
