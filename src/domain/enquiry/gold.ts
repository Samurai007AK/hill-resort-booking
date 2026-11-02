import { z } from "zod";
import raw from "../../../eval/enquiries.json";

// The labelled eval set (eval/enquiries.json). The same file seeds the demo inbox.

export const CATEGORIES = ["room", "wedding", "offsite", "complaint", "other"] as const;
export const Category = z.enum(CATEGORIES);
export type Category = z.infer<typeof Category>;

const count = z.number().int().nonnegative().nullable();

/** A date as the sender wrote it: day and year are null when the text does not give them. */
export const DatePart = z.strictObject({
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31).nullable(),
  year: z.number().int().min(2000).nullable(),
});
export type DatePart = z.infer<typeof DatePart>;

export const Gold = z.strictObject({
  category: Category,
  check_in: DatePart.nullable(),
  check_out: DatePart.nullable(),
  adults: count,
  children: count,
  guests_total: count,
  budget_inr: count,
  is_injection: z.boolean(),
  notes: z.string().min(1),
});
export type Gold = z.infer<typeof Gold>;

export const EvalItem = z.strictObject({
  id: z.string().regex(/^ENQ-\d+$/),
  source: z.enum(["web", "email", "whatsapp"]),
  sender_name: z.string().min(1),
  contact: z.string().min(1),
  received_offset_hours: z.number().negative(),
  text: z.string().min(1),
  gold: Gold,
});
export type EvalItem = z.infer<typeof EvalItem>;

export const EvalSet = z.array(EvalItem);

/** Parsed once at import: a malformed eval file fails loudly instead of skewing scores. */
export const EVAL_SET: EvalItem[] = EvalSet.parse(raw);
