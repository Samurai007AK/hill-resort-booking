import { addDays, isIsoDate } from "./dates";

export const MAX_NIGHTS = 30;
/** A night whose discounted tariff (one key) is at or under this is taxed at 5%, above it 18% (A4). */
export const GST_SLAB_LIMIT = 7500;

export type Discount = { kind: "percent" | "flat"; value: number };

export type PriceLine = {
  date: string;
  /** One key, after the rate plan, before discount. */
  tariff: number;
  /** discount, taxable, gst and total cover all keys booked for this night. */
  discount: number;
  taxable: number;
  gstRate: 5 | 18;
  gst: number;
  total: number;
};

export type Quote = {
  lines: PriceLine[];
  subtotal: number;
  discountTotal: number;
  gstTotal: number;
  grandTotal: number;
};

/** The nights of a stay: check-in up to but not including check-out. 1 to 30 nights. */
export function nightsBetween(checkIn: string, checkOut: string): string[] {
  if (!isIsoDate(checkIn) || !isIsoDate(checkOut)) throw new RangeError("dates must be YYYY-MM-DD");
  const nights: string[] = [];
  for (let d = checkIn; d < checkOut; d = addDays(d, 1)) {
    nights.push(d);
    if (nights.length > MAX_NIGHTS) throw new RangeError(`a stay is at most ${MAX_NIGHTS} nights`);
  }
  if (nights.length === 0) throw new RangeError("check-out must be after check-in");
  return nights;
}

const roundHalfUp = (x: number) => Math.floor(x + 0.5 + 1e-9);

/**
 * Prices a stay from the nightly rates (A2, A4, A7, A11). Discount comes off before GST;
 * the GST slab is picked per night on one key's discounted tariff. Every amount is a whole rupee
 * and the totals are exact sums of the lines.
 */
export function priceStay(input: {
  nights: { date: string; tariff: number }[];
  planFactor: number;
  qty: number;
  promo?: Discount;
}): Quote {
  const { qty, promo } = input;
  const base = input.nights.map((n) => ({
    date: n.date,
    tariff: roundHalfUp(n.tariff * input.planFactor),
  }));
  const amounts = base.map((n) => n.tariff * qty);
  const subtotal = amounts.reduce((s, a) => s + a, 0);
  const discounts = discountPerNight(amounts, subtotal, promo);

  const lines = base.map((n, i): PriceLine => {
    const taxable = amounts[i] - discounts[i];
    const gstRate = taxable <= GST_SLAB_LIMIT * qty ? 5 : 18;
    const gst = roundHalfUp((taxable * gstRate) / 100);
    return {
      date: n.date,
      tariff: n.tariff,
      discount: discounts[i],
      taxable,
      gstRate,
      gst,
      total: taxable + gst,
    };
  });
  const sum = (k: "discount" | "gst" | "total") => lines.reduce((s, l) => s + l[k], 0);
  return {
    lines,
    subtotal,
    discountTotal: sum("discount"),
    gstTotal: sum("gst"),
    grandTotal: sum("total"),
  };
}

function discountPerNight(amounts: number[], subtotal: number, promo?: Discount): number[] {
  if (!promo) return amounts.map(() => 0);
  if (promo.kind === "percent") return amounts.map((a) => roundHalfUp((a * promo.value) / 100));
  // Flat, per stay: proportional share per night, rounding remainder on the last night.
  const flat = Math.min(promo.value, subtotal);
  const shares = amounts.map((a) => roundHalfUp((flat * a) / subtotal));
  shares[shares.length - 1] = flat - shares.slice(0, -1).reduce((s, x) => s + x, 0);
  return shares;
}
