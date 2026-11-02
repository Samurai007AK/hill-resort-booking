import { describe, expect, test } from "vitest";
import { nightsBetween, priceStay } from "./pricing";

describe("nightsBetween", () => {
  test.each([
    ["2026-11-14", "2026-11-16", ["2026-11-14", "2026-11-15"]],
    ["2026-11-30", "2026-12-02", ["2026-11-30", "2026-12-01"]],
    ["2026-12-31", "2027-01-01", ["2026-12-31"]],
  ])("%s to %s", (a, b, nights) => {
    expect(nightsBetween(a, b)).toEqual(nights);
  });

  test("allows 30 nights", () => {
    expect(nightsBetween("2026-11-01", "2026-12-01")).toHaveLength(30);
  });

  test.each([
    ["same day", "2026-11-14", "2026-11-14"],
    ["check-out before check-in", "2026-11-16", "2026-11-14"],
    ["31 nights", "2026-11-01", "2026-12-02"],
    ["not a real date", "2026-02-30", "2026-03-02"],
    ["not ISO", "14/11/2026", "2026-11-16"],
  ])("rejects %s", (_name, a, b) => {
    expect(() => nightsBetween(a, b)).toThrow(RangeError);
  });
});

const one = (tariff: number) => [{ date: "2026-11-05", tariff }];

describe("priceStay: GST slab per night", () => {
  test.each([
    // tariff, gstRate, gst, total
    [7499, 5, 375, 7874], // 374.95 rounds up
    [7500, 5, 375, 7875], // the line itself is still 5%
    [7501, 18, 1350, 8851], // 1350.18 rounds down
  ])("₹%i a night", (tariff, gstRate, gst, total) => {
    const q = priceStay({ nights: one(tariff), planFactor: 1, qty: 1 });
    expect(q.lines).toEqual([{ date: "2026-11-05", tariff, discount: 0, taxable: tariff, gstRate, gst, total }]);
    expect(q).toMatchObject({ subtotal: tariff, discountTotal: 0, gstTotal: gst, grandTotal: total });
  });

  test("weekday + weekend Estate stay crosses the slab line night by night", () => {
    const q = priceStay({
      nights: [
        { date: "2026-11-05", tariff: 7200 },
        { date: "2026-11-06", tariff: 8200 },
        { date: "2026-11-07", tariff: 8200 },
      ],
      planFactor: 1,
      qty: 1,
    });
    expect(q.lines.map((l) => [l.gstRate, l.gst, l.total])).toEqual([
      [5, 360, 7560],
      [18, 1476, 9676],
      [18, 1476, 9676],
    ]);
    expect(q).toMatchObject({ subtotal: 23600, discountTotal: 0, gstTotal: 3312, grandTotal: 26912 });
  });

  test("a 15% promo pushes ₹8,200 under the line, so the night is taxed at 5%", () => {
    const q = priceStay({ nights: one(8200), planFactor: 1, qty: 1, promo: { kind: "percent", value: 15 } });
    // 8200 - 1230 = 6970; 5% = 348.5 -> 349
    expect(q.lines[0]).toMatchObject({ tariff: 8200, discount: 1230, taxable: 6970, gstRate: 5, gst: 349, total: 7319 });
    expect(q.grandTotal).toBe(7319);
  });

  test("the non-refundable plan (x0.90) is applied before the slab is chosen", () => {
    const q = priceStay({ nights: one(8200), planFactor: 0.9, qty: 1 });
    expect(q.lines[0]).toMatchObject({ tariff: 7380, gstRate: 5, gst: 369, total: 7749 });
  });

  test("qty 2: amounts double, the slab is still chosen on one key's price", () => {
    const q = priceStay({ nights: one(8200), planFactor: 1, qty: 2 });
    expect(q.lines[0]).toMatchObject({ tariff: 8200, discount: 0, taxable: 16400, gstRate: 18, gst: 2952, total: 19352 });
    expect(q).toMatchObject({ subtotal: 16400, gstTotal: 2952, grandTotal: 19352 });
  });
});

describe("priceStay: flat promo per stay", () => {
  test("spread in proportion to each night, remainder on the last night, total exact", () => {
    const nights = ["2026-11-10", "2026-11-11", "2026-11-12"].map((date) => ({ date, tariff: 9500 }));
    const q = priceStay({ nights, planFactor: 1, qty: 1, promo: { kind: "flat", value: 1000 } });
    expect(q.lines.map((l) => l.discount)).toEqual([333, 333, 334]);
    expect(q.discountTotal).toBe(1000);
    expect(q.grandTotal).toBe(q.lines.reduce((s, l) => s + l.total, 0));
  });

  test("ESTATE2000 on a Thu-Fri-Sat Estate stay", () => {
    const q = priceStay({
      nights: [
        { date: "2026-11-05", tariff: 7200 },
        { date: "2026-11-06", tariff: 8200 },
        { date: "2026-11-07", tariff: 8200 },
      ],
      planFactor: 1,
      qty: 1,
      promo: { kind: "flat", value: 2000 },
    });
    // 2000 x 7200/23600 = 610.2 -> 610; 2000 x 8200/23600 = 694.9 -> 695; last = 695
    expect(q.lines.map((l) => [l.discount, l.taxable, l.gstRate, l.gst])).toEqual([
      [610, 6590, 5, 330],
      [695, 7505, 18, 1351],
      [695, 7505, 18, 1351],
    ]);
    expect(q).toMatchObject({ subtotal: 23600, discountTotal: 2000, gstTotal: 3032, grandTotal: 24632 });
  });

  test("covers all keys once, not per key", () => {
    const q = priceStay({ nights: one(9500), planFactor: 1, qty: 2, promo: { kind: "flat", value: 2000 } });
    expect(q.discountTotal).toBe(2000);
    expect(q.lines[0].taxable).toBe(17000);
  });

  test("never discounts below zero", () => {
    const q = priceStay({ nights: one(7200), planFactor: 1, qty: 1, promo: { kind: "flat", value: 99999 } });
    expect(q).toMatchObject({ discountTotal: 7200, gstTotal: 0, grandTotal: 0 });
  });
});
