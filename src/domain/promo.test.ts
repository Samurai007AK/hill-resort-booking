import { expect, test } from "vitest";
import { checkPromo, type Promo } from "./promo";

const promo: Promo = {
  code: "ESTATE2000",
  kind: "flat",
  value: 2000,
  validFrom: "2026-11-01",
  validTo: "2026-12-31",
  minNights: 2,
  maxUses: 10,
  active: true,
};
const ok = { stayNights: 2, today: "2026-11-02", usesSoFar: 0 };

test.each([
  ["valid", promo, ok, { ok: true }],
  ["first day of window", promo, { ...ok, today: "2026-11-01" }, { ok: true }],
  ["last day of window", promo, { ...ok, today: "2026-12-31" }, { ok: true }],
  ["switched off", { ...promo, active: false }, ok, { ok: false, reason: "inactive" }],
  ["before the window", promo, { ...ok, today: "2026-10-31" }, { ok: false, reason: "not_yet_valid" }],
  ["after the window", promo, { ...ok, today: "2027-01-01" }, { ok: false, reason: "expired" }],
  ["stay too short", promo, { ...ok, stayNights: 1 }, { ok: false, reason: "min_nights" }],
  ["used up", promo, { ...ok, usesSoFar: 10 }, { ok: false, reason: "used_up" }],
  ["one use left", promo, { ...ok, usesSoFar: 9 }, { ok: true }],
  ["no use limit", { ...promo, maxUses: null }, { ...ok, usesSoFar: 5000 }, { ok: true }],
] as const)("%s", (_name, p, ctx, expected) => {
  expect(checkPromo(p, ctx)).toEqual(expected);
});
