import { describe, expect, it } from "vitest";
import { scoreRun, type ScoredRow } from "./score";
import type { Gold } from "./gold";
import type { Extraction } from "./pipeline";

const none: Extraction = {
  check_in: null,
  check_out: null,
  adults: null,
  children: null,
  guests_total: null,
  budget_inr: null,
  room_type: null,
};
// A room enquiry with every field routing needs, so only confidence decides the lane.
const full: Extraction = {
  ...none,
  check_in: { month: 11, day: 14, year: null },
  check_out: { month: 11, day: 16, year: null },
  guests_total: 3,
};
const gold = (category: Gold["category"], extra: Partial<Gold> = {}): Gold => ({
  category,
  check_in: null,
  check_out: null,
  adults: null,
  children: null,
  guests_total: null,
  budget_inr: null,
  is_injection: false,
  notes: "test",
  ...extra,
});
const row = (
  g: Gold,
  aiCategory: Gold["category"] | null,
  confidence: number | null,
  keyword: Gold["category"] = aiCategory ?? "other",
  extracted: Extraction = none,
): ScoredRow => ({
  id: "ENQ-1",
  gold: g,
  model: aiCategory ? "m" : null,
  input: {
    keyword,
    extracted,
    injection: false,
    ai: aiCategory && confidence !== null ? { category: aiCategory, confidence } : null,
    status: aiCategory ? "ok" : "fallback",
  },
});

describe("scoreRun", () => {
  it("counts model accuracy only over items the model answered", () => {
    const s = scoreRun([
      row(gold("room"), "room", 0.9),
      row(gold("room"), "wedding", 0.9),
      row(gold("offsite"), null, null),
    ]);
    expect(s.answered).toBe(2);
    expect(s.modelCorrect).toBe(1);
  });

  it("raises complaint recall when the keyword rule catches what the model missed", () => {
    const s = scoreRun([
      row(gold("complaint"), "room", 0.99, "complaint"),
      row(gold("complaint"), "complaint", 0.99),
    ]);
    expect(s.complaints).toBe(2);
    expect(s.modelComplaintHits).toBe(1);
    expect(s.alertHits).toBe(2);
  });

  it("matches dates on month and day, and on year only when the label has one", () => {
    const g = gold("room", { check_in: { month: 11, day: 14, year: null } });
    const right = { ...none, check_in: { month: 11, day: 14, year: 2026 } };
    const wrong = { ...none, check_in: { month: 11, day: 15, year: null } };
    expect(scoreRun([row(g, "room", 0.9, "room", right)]).fields.check_in).toBe(1);
    expect(scoreRun([row(g, "room", 0.9, "room", wrong)]).fields.check_in).toBe(0);
  });

  it("sweeps cutoffs: a higher cutoff routes fewer items automatically", () => {
    const s = scoreRun([
      row(gold("room"), "room", 0.8, "room", full),
      row(gold("room"), "wedding", 0.6, "wedding", full),
    ]);
    const at = (t: number) => s.sweep.find((r) => r.cutoff === t)!;
    expect(at(0.5).auto).toBe(2);
    expect(at(0.5).autoCorrect).toBe(1);
    expect(at(0.7).auto).toBe(1);
    expect(at(0.7).autoCorrect).toBe(1);
    expect(at(0.85).auto).toBe(0);
  });

  it("picks the lowest cutoff whose auto-routed accuracy reaches the target", () => {
    const s = scoreRun([
      row(gold("room"), "room", 0.8, "room", full),
      row(gold("room"), "wedding", 0.6, "wedding", full),
    ]);
    expect(s.recommendedCutoff).toBe(0.65);
  });
});
