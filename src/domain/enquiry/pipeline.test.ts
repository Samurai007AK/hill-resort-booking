import { describe, expect, test } from "vitest";
import {
  classifyKeywords,
  extractKeywords,
  redactPersonalData,
  decideLane,
  validateAiResponse,
  resolveDates,
} from "./pipeline";

describe("enquiry guardrails", () => {
  test("redacts contact and government identifiers before classification", () => {
    const safe = redactPersonalData(
      "Ananya Rao mail a@example.com phone +91 98765 43210 Aadhaar 1234 5678 9012 PAN ABCDE1234F passport A1234567",
      "Ananya Rao",
    );
    expect(safe).not.toMatch(/Ananya|a@example|98765|1234|ABCDE|A123/);
    expect(safe).toContain("[REDACTED]");
    expect(redactPersonalData("ananya rao would like to book", "Ananya Rao")).not.toMatch(
      /ananya/i,
    );
  });
  test.each([
    ["Wedding guests lost power, staff were rude, speak to GM", "complaint"],
    ["Pool was green and dirty, even after we reported it twice", "complaint"],
    ["Team of 45 wants a January offsite with a conference hall", "offsite"],
    ["Venue for my sister's wedding in Feb 2027, about 250 guests, 2 nights", "wedding"],
    ["Is a villa free 14-16 Nov for 2 adults and a child?", "room"],
    ["call me pls", "other"],
  ])("classifies %s", (text, expected) => expect(classifyKeywords(text)).toBe(expected));
  test("extracts the brief sample without inventing a year", () => {
    expect(extractKeywords("Is a villa free 14-16 Nov for 2 adults and a child?")).toMatchObject({
      check_in: { month: 11, day: 14, year: null },
      check_out: { month: 11, day: 16, year: null },
      adults: 2,
      children: 1,
      guests_total: 3,
      budget_inr: null,
    });
  });
  test("missing year resolves to next occurrence and asks for confirmation", () => {
    expect(
      resolveDates(
        { month: 1, day: 9, year: null },
        { month: 1, day: 11, year: null },
        "2026-11-02",
      ),
    ).toEqual({ checkIn: "2027-01-09", checkOut: "2027-01-11", assumed: true });
    expect(
      resolveDates(
        { month: 12, day: 30, year: null },
        { month: 1, day: 2, year: null },
        "2026-11-02",
      ),
    ).toEqual({ checkIn: "2026-12-30", checkOut: "2027-01-02", assumed: true });
  });
  test("rejects invented numbers, direct prices and arbitrary template slots", () => {
    const response = {
      category: "room",
      confidence: 0.96,
      extracted: extractKeywords("room 14-16 Nov for 2 adults"),
      reply_template: "Thanks. {{TOTAL}} {{DATES}}",
    };
    expect(validateAiResponse(response, "room 14-16 Nov for 2 adults").success).toBe(true);
    expect(
      validateAiResponse(
        { ...response, reply_template: "Your total is ₹1" },
        "room 14-16 Nov for 2 adults",
      ).success,
    ).toBe(false);
    expect(
      validateAiResponse(
        { ...response, reply_template: "two rooms" },
        "room 14-16 Nov for 2 adults",
      ).success,
    ).toBe(false);
    expect(
      validateAiResponse(
        { ...response, reply_template: "{{SECRET}}" },
        "room 14-16 Nov for 2 adults",
      ).success,
    ).toBe(false);
    expect(
      validateAiResponse(
        { ...response, extracted: { ...response.extracted, adults: 9 } },
        "room 14-16 Nov for 2 adults",
      ).success,
    ).toBe(false);
    expect(
      validateAiResponse(
        {
          ...response,
          extracted: { ...response.extracted, check_in: { month: 2, day: 30, year: 2027 } },
        },
        "room 30 Feb 2027 for 2 adults",
      ).success,
    ).toBe(false);
  });
  test("failure, disagreement, low confidence and injection remain unsorted", () => {
    const extracted = extractKeywords("room 14-16 Nov for 2 adults");
    const base = { keyword: "room" as const, extracted, injection: false };
    expect(decideLane({ ...base, ai: null, status: "fallback" })).toMatchObject({
      lane: "unsorted",
      gm_alert: true,
      owner_team: "reservations",
    });
    expect(
      decideLane({ ...base, ai: { category: "wedding", confidence: 0.98 }, status: "ok" }),
    ).toMatchObject({ lane: "unsorted" });
    expect(
      decideLane({ ...base, ai: { category: "room", confidence: 0.6 }, status: "ok" }),
    ).toMatchObject({ lane: "unsorted" });
    expect(
      decideLane({
        ...base,
        injection: true,
        ai: { category: "room", confidence: 0.98 },
        status: "ok",
      }),
    ).toMatchObject({ lane: "unsorted" });
    expect(
      decideLane({ ...base, ai: { category: "room", confidence: 0.98 }, status: "ok" }),
    ).toMatchObject({ lane: "rooms", gm_alert: false });
  });
  test.each([
    "Your booking is complete and your stay is free of charge.",
    "Your stay is complimentary.",
    "We confirm your reservation.",
    "Rooms are guaranteed available.",
    "Cancellation is free.",
  ])("rejects model promises without digits: %s", (reply_template) => {
    const text = "room 14-16 Nov for 2 adults";
    expect(
      validateAiResponse(
        { category: "room", confidence: 0.99, extracted: extractKeywords(text), reply_template },
        text,
      ).success,
    ).toBe(false);
  });
  test("reversed dates are rejected and cannot auto-route, while missing-year cross-year stays remain valid", () => {
    const text = "room 16-14 Nov 2027 for 2 adults";
    const extracted = extractKeywords(text);
    expect(
      validateAiResponse(
        { category: "room", confidence: 0.99, extracted, reply_template: "Thank you." },
        text,
      ).success,
    ).toBe(false);
    expect(
      decideLane({
        keyword: "room",
        extracted,
        injection: false,
        ai: { category: "room", confidence: 0.99 },
        status: "ok",
      }).lane,
    ).toBe("unsorted");
    expect(resolveDates(extracted.check_in, extracted.check_out, "2026-11-02")).toEqual({
      checkIn: null,
      checkOut: null,
      assumed: false,
    });
    expect(
      resolveDates(
        { month: 12, day: 30, year: null },
        { month: 1, day: 2, year: null },
        "2026-11-02",
      ),
    ).toEqual({ checkIn: "2026-12-30", checkOut: "2027-01-02", assumed: true });
  });
});
