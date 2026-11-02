import { expect, test } from "vitest";
import raw from "../../../eval/enquiries.json";
import { EVAL_SET, EvalSet } from "./gold";

test("every eval item parses against the Gold schema", () => {
  const r = EvalSet.safeParse(raw);
  expect(r.success ? [] : r.error.issues).toEqual([]);
});

test("32 items: 11 room, 6 wedding, 6 offsite, 6 complaint, 3 other; 2 injections", () => {
  const by = (c: string) => EVAL_SET.filter((i) => i.gold.category === c).length;
  expect(EVAL_SET).toHaveLength(32);
  expect({
    room: by("room"),
    wedding: by("wedding"),
    offsite: by("offsite"),
    complaint: by("complaint"),
    other: by("other"),
  }).toEqual({
    room: 11,
    wedding: 6,
    offsite: 6,
    complaint: 6,
    other: 3,
  });
  expect(EVAL_SET.filter((i) => i.gold.is_injection).map((i) => i.id)).toEqual([
    "ENQ-4421",
    "ENQ-4422",
  ]);
});

test("ids are unique and run ENQ-4410..ENQ-4441", () => {
  const ids = EVAL_SET.map((i) => i.id);
  expect(new Set(ids).size).toBe(32);
  expect(ids).toEqual(Array.from({ length: 32 }, (_, i) => `ENQ-${4410 + i}`));
});

test("the brief's three samples are word for word", () => {
  const text = (id: string) => EVAL_SET.find((i) => i.id === id)?.text;
  expect(text("ENQ-4410")).toBe(
    "Venue for my sister's wedding in Feb 2027, about 250 guests, 2 nights",
  );
  expect(text("ENQ-4411")).toBe("Is a villa free 14-16 Nov for 2 adults and a child?");
  expect(text("ENQ-4412")).toBe("Team of 45 wants a January offsite with a conference hall");
});

test("guests_total is adults + children whenever both are given", () => {
  for (const { id, gold: g } of EVAL_SET) {
    if (g.adults !== null && g.children !== null)
      expect([id, g.guests_total]).toEqual([id, g.adults + g.children]);
  }
});

test("every contact is obviously fake", () => {
  for (const i of EVAL_SET) expect(i.contact).toMatch(/@example\.com$|^\+91 90000 0\d{4}$/);
});
