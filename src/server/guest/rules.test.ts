import { describe, expect, test } from "vitest";
import {
  fits,
  keysNeeded,
  normalizePhone,
  parseSearch,
  pickAlternatives,
  type Option,
} from "./rules";

describe("normalizePhone", () => {
  test.each([
    ["98450 12345", "+91 98450 12345"],
    ["+91 98450-12345", "+91 98450 12345"],
    ["+919845012345", "+91 98450 12345"],
    ["09845012345", "+91 98450 12345"],
    ["91 6000000000", "+91 60000 00000"],
    ["(+91) 7000 000 000", "+91 70000 00000"],
    ["+44 20 7946 0958", "+442079460958"], // a foreign guest
    ["+1 415 555 0100", "+14155550100"],
  ])("accepts %s as %s", (raw, want) => {
    expect(normalizePhone(raw)).toBe(want);
  });

  test.each([
    ["12345 67890"], // Indian mobiles start 6-9
    ["98450 1234"], // 9 digits
    ["98450 123456"], // 11 digits
    ["+91 12345 67890"],
    ["+91 98450 1234"],
    ["4155550100"], // foreign numbers need their + country code
    ["+44 123"],
    ["call me"],
    [""],
  ])("rejects %s", (raw) => {
    expect(normalizePhone(raw)).toBeNull();
  });
});

describe("parseSearch", () => {
  const today = "2026-11-02";

  test("no params: tomorrow for 2 nights, 2 adults, 1 room", () => {
    expect(parseSearch({}, today)).toEqual({
      search: { checkIn: "2026-11-03", checkOut: "2026-11-05", adults: 2, children: 0, qty: 1 },
    });
  });

  test("reads the shared URL, first value wins, promo upper-cased", () => {
    expect(
      parseSearch(
        {
          in: "2026-12-24",
          out: "2026-12-27",
          adults: ["3", "9"],
          children: "1",
          qty: "2",
          promo: " monsoon15 ",
        },
        today,
      ),
    ).toEqual({
      search: {
        checkIn: "2026-12-24",
        checkOut: "2026-12-27",
        adults: 3,
        children: 1,
        qty: 2,
        promo: "MONSOON15",
      },
    });
  });

  test("today is a valid check-in", () => {
    expect(parseSearch({ in: today, out: "2026-11-03" }, today).error).toBeUndefined();
  });

  test.each([
    ["a past check-in", { in: "2026-11-01", out: "2026-11-03" }, "Check-in can't be in the past"],
    [
      "check-out before check-in",
      { in: "2026-11-10", out: "2026-11-09" },
      "Check-out must be after check-in",
    ],
    ["same day", { in: "2026-11-10", out: "2026-11-10" }, "Check-out must be after check-in"],
    ["31 nights", { in: "2026-11-10", out: "2026-12-11" }, "A stay can be at most 30 nights"],
    ["not a date", { in: "2026-02-30", out: "2026-03-02" }, "Pick valid dates"],
  ])("%s falls back to the default dates with a message", (_name, sp, error) => {
    const r = parseSearch(sp, today);
    expect(r.error).toBe(error);
    expect(r.search).toMatchObject({ checkIn: "2026-11-03", checkOut: "2026-11-05" });
  });

  test("guest counts and rooms are clamped to what can be booked", () => {
    expect(parseSearch({ adults: "0", children: "-2", qty: "9" }, today).search).toMatchObject({
      adults: 1,
      children: 0,
      qty: 4,
    });
    expect(parseSearch({ adults: "lots", children: "99" }, today).search).toMatchObject({
      adults: 2,
      children: 12,
    });
  });
});

describe("fits / keysNeeded", () => {
  const estate = { maxAdults: 2, maxChildren: 1 };
  test.each([
    [2, 1, 1, true],
    [3, 0, 1, false],
    [3, 0, 2, true],
    [2, 2, 1, false],
    [2, 2, 2, true],
  ])("%i adults + %i children in %i Estate Room(s): %s", (adults, children, qty, ok) => {
    expect(fits(estate, { qty, adults, children })).toBe(ok);
  });

  test("keysNeeded is the fewest keys that sleep everyone", () => {
    expect(keysNeeded(estate, { adults: 2, children: 0 })).toBe(1);
    expect(keysNeeded(estate, { adults: 5, children: 1 })).toBe(3);
    expect(keysNeeded(estate, { adults: 2, children: 3 })).toBe(3);
    expect(keysNeeded({ maxAdults: 4, maxChildren: 0 }, { adults: 2, children: 1 })).toBe(Infinity);
  });
});

describe("pickAlternatives (sold-out suggestions)", () => {
  const today = "2026-11-02";
  const rooms = [
    { id: "coffee-villa", maxAdults: 2, maxChildren: 2 },
    { id: "estate-room", maxAdults: 2, maxChildren: 1 },
    { id: "family-suite", maxAdults: 3, maxChildren: 2 },
    { id: "pool-villa", maxAdults: 4, maxChildren: 2 },
  ];
  const wanted = {
    roomTypeId: "coffee-villa",
    checkIn: "2026-11-14",
    checkOut: "2026-11-16",
    qty: 1,
    adults: 2,
    children: 1,
  };
  const opt = (
    roomTypeId: string,
    checkIn: string,
    checkOut: string,
    available: number,
  ): Option => ({
    roomTypeId,
    checkIn,
    checkOut,
    available,
  });

  test("alternates the same room on the nearest free dates with other rooms on the same dates", () => {
    const options = [
      opt("coffee-villa", "2026-11-15", "2026-11-17", 0), // +1 still full
      opt("coffee-villa", "2026-11-13", "2026-11-15", 1), // -1
      opt("coffee-villa", "2026-11-16", "2026-11-18", 2), // +2
      opt("coffee-villa", "2026-11-12", "2026-11-14", 2), // -2
      opt("estate-room", "2026-11-14", "2026-11-16", 5),
      opt("family-suite", "2026-11-14", "2026-11-16", 1),
    ];
    expect(pickAlternatives(wanted, options, rooms, today)).toEqual([
      opt("coffee-villa", "2026-11-13", "2026-11-15", 1),
      opt("estate-room", "2026-11-14", "2026-11-16", 5),
      opt("coffee-villa", "2026-11-16", "2026-11-18", 2), // +2 before -2: later dates win a tie
    ]);
  });

  test("never suggests the sold-out stay itself, too few keys, past dates, or a room the group does not fit", () => {
    const options = [
      opt("coffee-villa", "2026-11-14", "2026-11-16", 3), // the stay the guest already has on screen
      opt("coffee-villa", "2026-11-01", "2026-11-03", 3), // starts yesterday
      opt("estate-room", "2026-11-14", "2026-11-16", 1), // 2 adults + 2 children do not fit one Estate Room
      opt("pool-villa", "2026-11-14", "2026-11-16", 0),
      opt("family-suite", "2026-11-14", "2026-11-16", 2),
    ];
    expect(pickAlternatives({ ...wanted, children: 2 }, options, rooms, today)).toEqual([
      opt("family-suite", "2026-11-14", "2026-11-16", 2),
    ]);
  });

  test("needs enough keys for the whole party", () => {
    const options = [
      opt("coffee-villa", "2026-11-15", "2026-11-17", 1),
      opt("coffee-villa", "2026-11-13", "2026-11-15", 2),
    ];
    expect(pickAlternatives({ ...wanted, qty: 2 }, options, rooms, today)).toEqual([
      opt("coffee-villa", "2026-11-13", "2026-11-15", 2),
    ]);
  });

  test("nothing free gives an empty list", () => {
    expect(
      pickAlternatives(wanted, [opt("estate-room", "2026-11-14", "2026-11-16", 0)], rooms, today),
    ).toEqual([]);
  });

  test("at most three", () => {
    const options = [1, 2, 3, 7].map((s) =>
      opt("coffee-villa", `2026-11-${14 + s}`, `2026-11-${16 + s}`, 1),
    );
    expect(pickAlternatives(wanted, options, rooms, today)).toHaveLength(3);
  });
});
