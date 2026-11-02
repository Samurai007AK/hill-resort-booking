import { expect, test } from "vitest";
import { addDays, isWeekendNight, todayIST } from "./dates";

test("today is the date in India, not UTC", () => {
  expect(todayIST(new Date("2026-11-01T18:29:00Z"))).toBe("2026-11-01");
  expect(todayIST(new Date("2026-11-01T18:31:00Z"))).toBe("2026-11-02");
});

test("addDays crosses month and year ends", () => {
  expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
});

test.each([
  ["2026-11-05", false], // Thursday
  ["2026-11-06", true], // Friday
  ["2026-11-07", true], // Saturday
  ["2026-11-08", false], // Sunday
])("%s weekend night: %s", (d, expected) => {
  expect(isWeekendNight(d)).toBe(expected);
});
