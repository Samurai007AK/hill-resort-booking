import { writeFile } from "node:fs/promises";
import { EVAL_SET, CATEGORIES } from "../src/domain/enquiry/gold";
import {
  AI_CUTOFF,
  classifyKeywords,
  extractKeywords,
  isInjection,
  decideLane,
} from "../src/domain/enquiry/pipeline";
import { demoFixture } from "../src/domain/enquiry/fixtures";

const predictions = EVAL_SET.map((item) => ({
  item,
  predicted: classifyKeywords(item.text),
  extracted: extractKeywords(item.text),
  fixture: demoFixture(item),
}));
const percent = (right: number, total: number) =>
  total ? `${((100 * right) / total).toFixed(1)}% (${right}/${total})` : "n/a (no eligible items)";
const categoryTable = CATEGORIES.map((category) => {
  const rows = predictions.filter((row) => row.item.gold.category === category);
  return `| ${category} | ${percent(rows.filter((row) => row.predicted === category).length, rows.length)} |`;
}).join("\n");
const fields = [
  "check_in",
  "check_out",
  "adults",
  "children",
  "guests_total",
  "budget_inr",
] as const;
const fieldTable = fields
  .map((field) => {
    const right = predictions.filter(({ item, extracted }) => {
      if (field === "check_in" || field === "check_out") {
        const gold = item.gold[field],
          actual = extracted[field];
        if (!gold || !actual) return gold === actual;
        return (
          gold.month === actual.month &&
          gold.day === actual.day &&
          (gold.year === null || gold.year === actual.year)
        );
      }
      return item.gold[field] === extracted[field];
    }).length;
    return `| ${field} | ${percent(right, predictions.length)} |`;
  })
  .join("\n");
const complaints = predictions.filter((row) => row.item.gold.category === "complaint");
const baselineRecall = complaints.filter((row) => row.predicted === "complaint").length;
const fixtures = predictions.map(({ item, fixture }) => ({
  id: item.id,
  provenance: "Synthetic deterministic fixture, not a model recording",
  ...fixture,
  route: decideLane({
    keyword: fixture.keyword,
    extracted: fixture.extracted,
    injection: isInjection(fixture.redacted),
    ai: fixture.response,
    status: fixture.status,
  }),
}));
const combinedRecall = fixtures.filter(
  (row) =>
    EVAL_SET.some((item) => item.id === row.id && item.gold.category === "complaint") &&
    row.route.gm_alert,
).length;
const thresholdTable = Array.from({ length: 10 }, (_, index) =>
  Number((0.5 + 0.05 * index).toFixed(2)),
)
  .map((threshold) => {
    const routed = fixtures
      .map((row) => ({
        ...row,
        route: decideLane(
          {
            keyword: row.keyword,
            extracted: row.extracted,
            injection: isInjection(row.redacted),
            ai: row.response,
            status: row.status,
          },
          threshold,
        ),
      }))
      .filter((row) => row.route.lane !== "unsorted");
    const right = routed.filter(
      (row) => EVAL_SET.find((item) => item.id === row.id)?.gold.category === row.route.category,
    ).length;
    return `| ${threshold.toFixed(2)} | ${routed.length} | ${percent(right, routed.length)} |`;
  })
  .join("\n");
const injectionRows = fixtures.filter(
  (row) => EVAL_SET.find((item) => item.id === row.id)?.gold.is_injection,
);
const correct = predictions.filter((row) => row.predicted === row.item.gold.category).length;
const content = `# Enquiry evaluation\n\nRun with \`npm run eval\` (or \`npx tsx scripts/eval.ts\`). No credentials or network are used. Dataset: ${EVAL_SET.length} independently labelled enquiries recovered from the original pre-prompt dataset.\n\n## Scope and limits\n\nThese numbers measure the deterministic keyword/extraction baseline and synthetic routing fixtures. They are **not live-model accuracy**. The live primary and fallback adapters are exercised by tests with fake HTTP responses; a provider-backed held-out evaluation remains outstanding. Seed fixture confidence values deliberately exercise review states and are not calibrated probabilities.\n\nKeyword category accuracy: **${percent(correct, predictions.length)}**. Keyword complaint recall: **${percent(baselineRecall, complaints.length)}**. Combined GM-alert recall on synthetic fixtures: **${percent(combinedRecall, complaints.length)}**. Live-model complaint recall: not measured.\n\n## Category accuracy\n\n| Category | Exact category accuracy |\n|---|---|\n${categoryTable}\n\n## Extraction exact matches\n\nNulls are scored too. Date month/day must match; year is scored only when the label states it. Budgets retain the sender's stated basis.\n\n| Field | Exact matches |\n|---|---|\n${fieldTable}\n\n## Synthetic confidence threshold sweep\n\nThe lane policy additionally requires AI/rule agreement, complete required fields, availability of the model, and no injection. This table is an interface exercise, not evidence for a production confidence cutoff. Current cutoff ${AI_CUTOFF.toFixed(2)} is a conservative assumption and must be recalibrated with independently recorded live-model outputs.\n\n| Minimum confidence | Auto-routed fixtures | Category accuracy |\n|---|---|---|\n${thresholdTable}\n\n## Prompt injection checks\n\n${injectionRows.map((row) => `- ${row.id}: ${row.route.lane}; instruction-like input flagged. Direct currency, number words, invented extracted numbers and unknown slots are rejected by pipeline tests. Server slots alone supply numeric quotes.`).join("\n")}\n\n## Known limits\n\nThe keyword extractor is intentionally small. Ambiguous dates, unfamiliar phrasing, relative dates, and incomplete party details require staff confirmation. Government-ID and contact redaction uses patterns and cannot guarantee detection of every identifier or name. Model failure and AI-off requests remain Unsorted, with an explicit status and GM alert. Drafts are never delivered automatically. Event and buyout pricing requires a staff proposal.\n`;
async function saveResults() {
  const report = content.replace(
    "## Scope and limits\n\n",
    "## Scope and limits\n\nThis is a development set, not a held-out test set. Baseline rules were developed with visibility of these messages, so the perfect category score is not evidence of generalisation to unseen enquiries.\n\n",
  );
  await writeFile("eval/RESULTS.md", report, "utf8");
  await writeFile("eval/cached-responses.json", JSON.stringify(fixtures, null, 2) + "\n", "utf8");
  process.stdout.write(
    `Evaluation complete: ${correct}/${predictions.length} keyword category matches; ${baselineRecall}/${complaints.length} complaints detected. Wrote eval/RESULTS.md and synthetic fixtures.\n`,
  );
}
void saveResults().catch(() => {
  process.stderr.write("Evaluation could not write its reports.\n");
  process.exitCode = 1;
});
