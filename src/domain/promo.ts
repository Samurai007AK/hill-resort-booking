import type { Discount } from "./pricing";

export type Promo = Discount & {
  code: string;
  /** Booking-date window, inclusive (A11). */
  validFrom: string;
  validTo: string;
  minNights: number;
  /** null = no limit. */
  maxUses: number | null;
  active: boolean;
};

export type PromoRefusal = "inactive" | "not_yet_valid" | "expired" | "min_nights" | "used_up";
export type PromoCheck = { ok: true } | { ok: false; reason: PromoRefusal };

export function checkPromo(promo: Promo, ctx: { stayNights: number; today: string; usesSoFar: number }): PromoCheck {
  const no = (reason: PromoRefusal): PromoCheck => ({ ok: false, reason });
  if (!promo.active) return no("inactive");
  if (ctx.today < promo.validFrom) return no("not_yet_valid");
  if (ctx.today > promo.validTo) return no("expired");
  if (ctx.stayNights < promo.minNights) return no("min_nights");
  if (promo.maxUses !== null && ctx.usesSoFar >= promo.maxUses) return no("used_up");
  return { ok: true };
}
