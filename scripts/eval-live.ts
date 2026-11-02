// Live-model evaluation over the labelled enquiries.
//   npm run eval:live            calls the real providers (needs keys in .env.local), saves answers
//   npm run eval:live -- --offline   rescores the saved answers, no key or network needed
// Writes eval/live-responses.json (raw answers) and eval/RESULTS-live.md (scores).
import { readFile, writeFile } from "node:fs/promises";
import { EVAL_SET, CATEGORIES } from "../src/domain/enquiry/gold";
import {
  AI_CUTOFF,
  AiResponse,
  classifyKeywords,
  extractKeywords,
  isInjection,
  redactPersonalData,
} from "../src/domain/enquiry/pipeline";
import { scoreRun, TARGET_AUTO_ACCURACY, type ScoredRow } from "../src/domain/enquiry/score";
import { classifyWithProvider, PROMPT_VERSION } from "../src/server/enquiry/provider";

const RESPONSES = "eval/live-responses.json";
const RESULTS = "eval/RESULTS-live.md";
// The apinex key allows 15 requests a minute; pace calls so the primary model is measured, not its 429s.
const PACE_MS = 4500;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Saved = {
  id: string;
  model: string | null;
  ms: number;
  response: AiResponse | null;
  failure: string | null;
};

async function record(): Promise<Saved[]> {
  const saved: Saved[] = [];
  for (const item of EVAL_SET) {
    const started = Date.now();
    const result = await classifyWithProvider(redactPersonalData(item.text, item.sender_name));
    saved.push({
      id: item.id,
      model: result.ok ? result.model : null,
      ms: Date.now() - started,
      response: result.ok ? result.response : null,
      failure: result.ok ? null : result.reason,
    });
    process.stdout.write(result.ok ? "." : "x");
    await sleep(PACE_MS);
  }
  process.stdout.write("\n");
  const file = { prompt_version: PROMPT_VERSION, recorded_at: new Date().toISOString(), saved };
  await writeFile(RESPONSES, JSON.stringify(file, null, 2) + "\n");
  return saved;
}

function toRows(saved: Saved[]): ScoredRow[] {
  return EVAL_SET.map((item) => {
    const answer = saved.find((s) => s.id === item.id);
    const redacted = redactPersonalData(item.text, item.sender_name);
    const response = answer?.response ? AiResponse.parse(answer.response) : null;
    return {
      id: item.id,
      gold: item.gold,
      model: answer?.model ?? null,
      input: {
        keyword: classifyKeywords(redacted),
        extracted: response?.extracted ?? extractKeywords(redacted),
        injection: isInjection(redacted),
        ai: response,
        status: response ? "ok" : "fallback",
      },
    };
  });
}

const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(1)}% (${n}/${d})` : "n/a");

function report(saved: Saved[], recordedAt: string): string {
  const rows = toRows(saved);
  const s = scoreRun(rows);
  const models = [...new Set(saved.map((x) => x.model ?? "none (keyword fallback)"))];
  const latencies = saved
    .filter((x) => x.model)
    .map((x) => x.ms)
    .sort((a, b) => a - b);
  const median = latencies.length ? latencies[Math.floor(latencies.length / 2)] : null;
  const perCategory = CATEGORIES.map((category) => {
    const inCat = rows.filter((r) => r.gold.category === category && r.input.ai);
    const right = inCat.filter((r) => r.input.ai?.category === category).length;
    return `| ${category} | ${pct(right, inCat.length)} |`;
  }).join("\n");
  const misses = rows
    .filter((r) => r.input.ai && r.input.ai.category !== r.gold.category)
    .map((r) => `- ${r.id}: labelled ${r.gold.category}, model said ${r.input.ai?.category}`)
    .join("\n");
  const sweep = s.sweep
    .map(
      (r) =>
        `| ${r.cutoff.toFixed(2)} | ${r.auto} | ${pct(r.autoCorrect, r.auto)} | ${r.auto - r.autoCorrect} |`,
    )
    .join("\n");
  const fields = Object.entries(s.fields)
    .map(([field, right]) => `| ${field} | ${pct(right, s.total)} |`)
    .join("\n");

  return `# Live-model evaluation

Recorded ${recordedAt} with prompt \`${PROMPT_VERSION}\`. Models that answered: ${models.join(", ")}.
Rescore without a key: \`npm run eval:live -- --offline\`. Raw answers: \`${RESPONSES}\`.

This is the same 32-item labelled set used for development, so treat it as a development score, not a held-out one.

## Headline

- The model answered ${pct(s.answered, s.total)} of enquiries${median === null ? "" : `, median ${median} ms`}.
- Model category accuracy (answered items): **${pct(s.modelCorrect, s.answered)}**.
- Complaint recall: model alone ${pct(s.modelComplaintHits, s.complaints)}; with the keyword rule and failure alert (what the GM actually sees) **${pct(s.alertHits, s.complaints)}**.

## Category accuracy by label

| Label | Model accuracy |
|---|---|
${perCategory}

${misses ? `Model mistakes:\n\n${misses}\n` : "No category mistakes.\n"}
## Extraction (model fields, or keyword extraction when the model failed)

| Field | Exact match |
|---|---|
${fields}

## Cutoff sweep

Auto-routed means the enquiry skips the Unsorted lane: model and keywords agree, required fields are present, no injection, and confidence is at or above the cutoff.

| Cutoff | Auto-routed | Auto-routed accuracy | Wrong but auto-routed |
|---|---|---|---|
${sweep}

Lowest cutoff with auto-routed accuracy ≥ ${TARGET_AUTO_ACCURACY * 100}%: **${s.recommendedCutoff ?? "none"}**. Cutoff in the app: ${AI_CUTOFF}.
`;
}

async function main() {
  const offline = process.argv.includes("--offline");
  let saved: Saved[];
  let recordedAt: string;
  if (offline) {
    const file = JSON.parse(await readFile(RESPONSES, "utf8"));
    saved = file.saved;
    recordedAt = file.recorded_at;
  } else {
    if (!process.env.APINEX_API_KEY && !process.env.OLLAMA_API_KEY)
      throw new Error("No AI keys loaded. Run: npm run eval:live (it loads .env.local).");
    saved = await record();
    recordedAt = new Date().toISOString();
  }
  await writeFile(RESULTS, report(saved, recordedAt));
  console.log(`Wrote ${RESULTS}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
