import { decideLane, type Extraction } from "./pipeline";
import type { DatePart, Gold } from "./gold";

/** One labelled enquiry and everything routing saw for it. */
export type ScoredRow = {
  id: string;
  gold: Gold;
  /** The model that answered, or null when every model failed and keywords took over. */
  model: string | null;
  input: Parameters<typeof decideLane>[0];
};

const FIELDS = [
  "check_in",
  "check_out",
  "adults",
  "children",
  "guests_total",
  "budget_inr",
] as const;
type Field = (typeof FIELDS)[number];

export const CUTOFFS = Array.from({ length: 10 }, (_, i) => Number((0.5 + 0.05 * i).toFixed(2)));

/** Auto-routed items must be at least this accurate before a cutoff is recommended. */
export const TARGET_AUTO_ACCURACY = 0.95;

function sameDate(gold: DatePart | null, actual: DatePart | null): boolean {
  if (!gold || !actual) return gold === actual;
  return (
    gold.month === actual.month &&
    gold.day === actual.day &&
    (gold.year === null || gold.year === actual.year)
  );
}

function fieldMatches(gold: Gold, extracted: Extraction, field: Field): boolean {
  if (field === "check_in" || field === "check_out") return sameDate(gold[field], extracted[field]);
  return gold[field] === extracted[field];
}

/** Scores a run: model accuracy, complaint recall, field matches and a cutoff sweep. */
export function scoreRun(rows: ScoredRow[]) {
  const answered = rows.filter((row) => row.input.ai);
  const complaints = rows.filter((row) => row.gold.category === "complaint");
  const fields = Object.fromEntries(
    FIELDS.map((field) => [
      field,
      rows.filter((row) => fieldMatches(row.gold, row.input.extracted, field)).length,
    ]),
  ) as Record<Field, number>;

  const sweep = CUTOFFS.map((cutoff) => {
    const auto = rows
      .map((row) => ({ row, route: decideLane(row.input, cutoff) }))
      .filter(({ route }) => route.lane !== "unsorted");
    const autoCorrect = auto.filter(({ row, route }) => route.category === row.gold.category);
    return { cutoff, auto: auto.length, autoCorrect: autoCorrect.length };
  });
  const recommended = sweep.find(
    (row) => row.auto > 0 && row.autoCorrect / row.auto >= TARGET_AUTO_ACCURACY,
  );

  return {
    total: rows.length,
    answered: answered.length,
    modelCorrect: answered.filter((row) => row.input.ai?.category === row.gold.category).length,
    complaints: complaints.length,
    modelComplaintHits: complaints.filter((row) => row.input.ai?.category === "complaint").length,
    alertHits: complaints.filter((row) => decideLane(row.input).gm_alert).length,
    fields,
    sweep,
    recommendedCutoff: recommended?.cutoff ?? null,
  };
}
