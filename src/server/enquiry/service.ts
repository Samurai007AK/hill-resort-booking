import { createHash } from "node:crypto";
import type { ClientBase } from "pg";
import { z } from "zod";
import { pool, withTransaction } from "@/db/pool";
import { EVAL_SET, Category } from "@/domain/enquiry/gold";
import { demoFixture } from "@/domain/enquiry/fixtures";
import {
  AiResponse,
  Extraction,
  Lane,
  classifyKeywords,
  extractKeywords,
  redactPersonalData,
  isInjection,
  decideLane,
  screenAiResponse,
  validateAiResponse,
} from "@/domain/enquiry/pipeline";
import liveResponses from "../../../eval/live-responses.json";
import { classifyWithProvider, DEFAULT_MODEL, PROMPT_VERSION } from "./provider";
import { makeDraft } from "./draft";
export { Lane } from "@/domain/enquiry/pipeline";

export const IngestInput = z.object({
  source: z.enum(["web", "email", "whatsapp", "event_form"]),
  senderName: z.string().trim().min(2).max(100),
  contact: z
    .string()
    .trim()
    .max(200)
    .refine(
      (value) => z.email().safeParse(value).success || /^\+?[\d -]{8,18}$/.test(value),
      "Enter an email address or phone number",
    ),
  text: z.string().trim().min(5).max(12000),
  consent: z.literal(true),
  idempotencyKey: z.uuid().optional(),
});
const EnquirySchema = z.object({
  id: z.string(),
  source: z.enum(["web", "email", "whatsapp", "event_form"]),
  sender_name: z.string().nullable(),
  contact: z.string().nullable(),
  raw_text: z.string(),
  redacted_text: z.string(),
  received_at: z.date(),
  category: Category.nullable(),
  confidence: z.number().nullable(),
  extracted: Extraction.nullable(),
  lane: Lane,
  owner_team: z.enum(["reservations", "sales", "gm"]).nullable(),
  gm_alert: z.boolean(),
  ai_status: z.enum(["ok", "fallback", "off"]).nullable(),
  ai_reason: z.string().nullable(),
  ai_model: z.string().nullable(),
  ai_response: z.unknown().nullable(),
  draft: z.string().nullable(),
  draft_status: z.enum(["draft", "sent"]).nullable(),
  first_reply_at: z.date().nullable(),
  revision: z.number().int().positive(),
});
export type Enquiry = z.infer<typeof EnquirySchema>;
const EventSchema = z.object({
  id: z.coerce.string(),
  enquiry_id: z.string(),
  at: z.date(),
  actor: z.string(),
  kind: z.string(),
  detail: z.record(z.string(), z.unknown()),
});
export type EnquiryEvent = z.infer<typeof EventSchema>;
const EnquiryId = z.string().regex(/^ENQ-\d{4,12}$/);
const hash = (model: string, text: string) =>
  createHash("sha256").update(`${model}\0${PROMPT_VERSION}\0${text}`).digest("hex");

export async function listEnquiries(lane?: Lane): Promise<Enquiry[]> {
  const { rows } = lane
    ? await pool.query("SELECT * FROM enquiry WHERE lane=$1 ORDER BY received_at DESC", [
        Lane.parse(lane),
      ])
    : await pool.query("SELECT * FROM enquiry ORDER BY received_at DESC");
  return z.array(EnquirySchema).parse(rows);
}
export async function getEnquiry(
  id: string,
): Promise<{ enquiry: Enquiry; events: EnquiryEvent[] } | null> {
  const parsed = EnquiryId.safeParse(id);
  if (!parsed.success) return null;
  const { rows } = await pool.query("SELECT * FROM enquiry WHERE id=$1", [parsed.data]);
  if (!rows[0]) return null;
  const events = await pool.query(
    "SELECT * FROM enquiry_event WHERE enquiry_id=$1 ORDER BY at,id",
    [id],
  );
  return { enquiry: EnquirySchema.parse(rows[0]), events: z.array(EventSchema).parse(events.rows) };
}
export async function getAiEnabled(): Promise<boolean> {
  const { rows } = await pool.query<{ value: unknown }>(
    "SELECT value FROM settings WHERE key='ai_enabled'",
  );
  return rows[0]?.value !== false;
}
export async function setAiEnabled(enabled: boolean, actor: string): Promise<void> {
  z.string().min(1).parse(actor);
  await pool.query(
    "INSERT INTO settings(key,value) VALUES('ai_enabled',$1::jsonb) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    [JSON.stringify(z.boolean().parse(enabled))],
  );
}

async function cachedClassification(text: string) {
  const models = [
    process.env.AI_PRIMARY_MODEL || DEFAULT_MODEL,
    "gpt-oss:120b",
    "beam",
    "gpt-oss:20b",
  ];
  for (const model of models) {
    const { rows } = await pool.query<{ response: unknown }>(
      "SELECT response FROM ai_cache WHERE hash=$1",
      [hash(model, text)],
    );
    if (rows[0]) {
      const parsed = validateAiResponse(rows[0].response, text);
      if (parsed.success)
        return { ok: true as const, response: parsed.data, notes: [], model, cache: true };
    }
  }
  const result = await classifyWithProvider(text);
  if (!result.ok) return result;
  await pool.query(
    "INSERT INTO ai_cache(hash,model,prompt_version,response) VALUES($1,$2,$3,$4::jsonb) ON CONFLICT(hash) DO NOTHING",
    [hash(result.model, text), result.model, PROMPT_VERSION, JSON.stringify(result.response)],
  );
  return { ...result, cache: false };
}
type Analysis = {
  extracted: Extraction;
  response: AiResponse | null;
  status: "ok" | "fallback" | "off";
  model: string;
  redacted: string;
  reason: string;
  route: ReturnType<typeof decideLane>;
  /** The model's own wording, used only when it passed screening and agrees with the route. */
  draftTemplate: string | null;
};
async function analyse(text: string, sender: string): Promise<Analysis> {
  const redacted = redactPersonalData(text, sender);
  const keyword = classifyKeywords(redacted);
  const enabled = await getAiEnabled();
  const result = enabled
    ? await cachedClassification(redacted)
    : { ok: false as const, reason: "AI switched off" };
  const status = !enabled ? "off" : result.ok ? "ok" : "fallback";
  const response = result.ok ? result.response : null;
  const extracted = response?.extracted ?? extractKeywords(redacted);
  const injection = isInjection(redacted);
  const route = decideLane({ keyword, extracted, injection, ai: response, status });
  const notes = result.ok ? result.notes : [];
  return {
    draftTemplate:
      response && !injection && response.category === route.category
        ? response.reply_template
        : null,
    redacted,
    extracted,
    response,
    status,
    model: result.ok ? `${result.model} (${result.cache ? "cache" : "live"})` : "keyword fallback",
    route,
    reason: result.ok ? [route.reason, ...notes].join(". ") : `${route.reason}. ${result.reason}`,
  };
}
async function appendEvent(
  db: Pick<ClientBase, "query">,
  id: string,
  actor: string,
  kind: string,
  detail: Record<string, unknown>,
) {
  await db.query(
    "INSERT INTO enquiry_event(enquiry_id,actor,kind,detail) VALUES($1,$2,$3,$4::jsonb)",
    [id, actor, kind, JSON.stringify(detail)],
  );
}
async function insertEnquiry(
  db: Pick<ClientBase, "query">,
  input: z.infer<typeof IngestInput>,
  analysis: Analysis,
  id?: string,
  offsetHours = 0,
): Promise<Enquiry> {
  const draft = await makeDraft(
    db,
    analysis.route.category,
    analysis.extracted,
    analysis.draftTemplate,
  );
  const { rows } = await db.query(
    `INSERT INTO enquiry(id,source,sender_name,contact,raw_text,redacted_text,received_at,category,confidence,extracted,lane,owner_team,gm_alert,ai_status,ai_reason,ai_model,ai_response,draft,draft_status,consent_at,idempotency_key)
    VALUES(COALESCE($1,'ENQ-'||nextval('enquiry_seq')),$2,$3,$4,$5,$6,now()+make_interval(hours=>$7),$8,$9,$10::jsonb,$11,$12,$13,$14,$15,$16,$17::jsonb,$18,'draft',now(),$19)
    ON CONFLICT(idempotency_key) DO NOTHING RETURNING *`,
    [
      id ?? null,
      input.source,
      input.senderName,
      input.contact,
      input.text,
      analysis.redacted,
      offsetHours,
      analysis.route.category,
      analysis.response?.confidence ?? null,
      JSON.stringify(analysis.extracted),
      analysis.route.lane,
      analysis.route.owner_team,
      analysis.route.gm_alert,
      analysis.status,
      analysis.reason,
      analysis.model,
      JSON.stringify(analysis.response),
      draft,
      input.idempotencyKey ?? null,
    ],
  );
  if (rows[0]) {
    await appendEvent(db, rows[0].id, "system", "received", { source: input.source });
    await appendEvent(db, rows[0].id, "router", "classified", {
      lane: analysis.route.lane,
      category: analysis.route.category,
      model: analysis.model,
      reason: analysis.reason,
    });
    return EnquirySchema.parse(rows[0]);
  }
  const existing = await db.query("SELECT * FROM enquiry WHERE idempotency_key=$1", [
    input.idempotencyKey,
  ]);
  return EnquirySchema.parse(existing.rows[0]);
}
export async function ingestEnquiry(raw: unknown): Promise<Enquiry> {
  const input = IngestInput.parse(raw);
  if (input.idempotencyKey) {
    const { rows } = await pool.query("SELECT * FROM enquiry WHERE idempotency_key=$1", [
      input.idempotencyKey,
    ]);
    if (rows[0]) return EnquirySchema.parse(rows[0]);
  }
  const analysis = await analyse(input.text, input.senderName);
  return withTransaction((client) => insertEnquiry(client, input, analysis));
}
const STALE_ENQUIRY =
  "This enquiry changed. Reload it and review the current draft before continuing.";
const Revision = z.number().int().positive();
export async function moveEnquiry(
  id: string,
  lane: Lane,
  actor: string,
  reviewedRevision: number,
): Promise<void> {
  EnquiryId.parse(id);
  Lane.parse(lane);
  Revision.parse(reviewedRevision);
  const owner = { unsorted: null, rooms: "reservations", events: "sales", complaints: "gm" }[lane];
  await withTransaction(async (client) => {
    const result = await client.query(
      "UPDATE enquiry SET lane=$2,owner_team=$3,gm_alert=gm_alert OR $2='complaints',revision=revision+1 WHERE id=$1 AND revision=$4 RETURNING id",
      [id, lane, owner, reviewedRevision],
    );
    if (!result.rowCount) throw new Error(STALE_ENQUIRY);
    await appendEvent(client, id, actor, "moved", {
      lane,
      owner_team: owner,
      reviewed_revision: reviewedRevision,
    });
  });
}
export async function markEnquirySent(
  id: string,
  actor: string,
  reviewedRevision: number,
): Promise<void> {
  EnquiryId.parse(id);
  Revision.parse(reviewedRevision);
  await withTransaction(async (client) => {
    const current = await client.query<{ revision: number; draft_status: string | null }>(
      "SELECT revision,draft_status FROM enquiry WHERE id=$1 FOR UPDATE",
      [id],
    );
    if (current.rows[0]?.revision !== reviewedRevision) throw new Error(STALE_ENQUIRY);
    if (current.rows[0].draft_status === "sent") return;
    const result = await client.query(
      "UPDATE enquiry SET draft_status='sent',first_reply_at=COALESCE(first_reply_at,now()),revision=revision+1 WHERE id=$1 AND revision=$2 AND draft IS NOT NULL RETURNING id",
      [id, reviewedRevision],
    );
    if (!result.rowCount) throw new Error("No draft is available to mark sent.");
    await appendEvent(client, id, actor, "marked_sent", {
      delivery: "Copied and manually marked sent; no message delivery integration",
      reviewed_revision: reviewedRevision,
    });
  });
}
export async function rerunEnquiry(
  id: string,
  actor: string,
  reviewedRevision: number,
): Promise<void> {
  Revision.parse(reviewedRevision);
  const detail = await getEnquiry(id);
  if (!detail) throw new Error("Enquiry not found");
  if (detail.enquiry.revision !== reviewedRevision) throw new Error(STALE_ENQUIRY);
  if (detail.enquiry.draft_status === "sent")
    throw new Error("This reply was already marked sent. Its sent record is preserved.");
  const a = await analyse(detail.enquiry.raw_text, detail.enquiry.sender_name ?? "");
  const draft = await makeDraft(pool, a.route.category, a.extracted, a.draftTemplate);
  await withTransaction(async (client) => {
    const result = await client.query(
      `UPDATE enquiry SET category=$2,confidence=$3,extracted=$4::jsonb,lane=$5,owner_team=$6,gm_alert=gm_alert OR $7,ai_status=$8,ai_reason=$9,ai_model=$10,ai_response=$11::jsonb,draft=$12,draft_status='draft',revision=revision+1 WHERE id=$1 AND revision=$13 AND draft_status IS DISTINCT FROM 'sent' RETURNING id`,
      [
        id,
        a.route.category,
        a.response?.confidence ?? null,
        JSON.stringify(a.extracted),
        a.route.lane,
        a.route.owner_team,
        a.route.gm_alert,
        a.status,
        a.reason,
        a.model,
        JSON.stringify(a.response),
        draft,
        reviewedRevision,
      ],
    );
    if (!result.rowCount) throw new Error(STALE_ENQUIRY);
    await appendEvent(client, id, actor, "rerun", {
      model: a.model,
      reason: a.reason,
      reviewed_revision: reviewedRevision,
    });
  });
}

const SIMULATED_FAILURES = new Set(["ENQ-4419", "ENQ-4439"]);
const RecordedRun = z.object({
  saved: z.array(z.object({ id: z.string(), model: z.string().nullable(), response: z.unknown() })),
});
const recordedRun = RecordedRun.safeParse(liveResponses);
function recordedAnswer(id: string, redacted: string) {
  const saved = recordedRun.success ? recordedRun.data.saved.find((s) => s.id === id) : undefined;
  if (!saved?.model || !saved.response) return null;
  const screened = screenAiResponse(saved.response, redacted);
  return screened.ok ? { model: saved.model, response: screened.response } : null;
}

export async function seedEnquiries(client: ClientBase): Promise<void> {
  await client.query("TRUNCATE enquiry_event,enquiry");
  await client.query("SELECT setval('enquiry_seq',4442,false)");
  await client.query(
    "INSERT INTO settings(key,value) VALUES('ai_enabled','true') ON CONFLICT(key) DO UPDATE SET value='true'",
  );
  for (const item of EVAL_SET) {
    const fixture = demoFixture(item);
    const { redacted, keyword } = fixture;
    // Prefer the real recorded model answer, so the demo inbox is exactly what eval measured.
    // ENQ-4419 and ENQ-4439 stay as the simulated outage and AI-off examples.
    const recorded = SIMULATED_FAILURES.has(item.id) ? null : recordedAnswer(item.id, redacted);
    const status = recorded ? "ok" : fixture.status;
    const response = recorded?.response ?? fixture.response;
    const extracted = response?.extracted ?? fixture.extracted;
    const model = recorded ? `${recorded.model} (recorded run)` : fixture.model;
    const route = decideLane({
      keyword,
      extracted,
      injection: isInjection(redacted),
      ai: response,
      status,
    });
    const analysis: Analysis = {
      redacted,
      extracted,
      response,
      status,
      model,
      reason: recorded ? route.reason : `Demo fixture; ${route.reason}`,
      route,
      draftTemplate:
        response && !isInjection(redacted) && response.category === route.category
          ? response.reply_template
          : null,
    };
    await insertEnquiry(
      client,
      {
        source: item.source,
        senderName: item.sender_name,
        contact: item.contact,
        text: item.text,
        consent: true,
      },
      analysis,
      item.id,
      item.received_offset_hours,
    );
  }
}

export async function allowPublicEnquiry(fingerprint: string, now = Date.now()): Promise<boolean> {
  const bucket = Math.floor(now / 600000);
  const result = await pool.query<{ hits: number }>(
    `INSERT INTO enquiry_rate_limit(fingerprint,bucket,hits) VALUES($1,$2,1) ON CONFLICT(fingerprint,bucket) DO UPDATE SET hits=enquiry_rate_limit.hits+1 RETURNING hits`,
    [fingerprint, bucket],
  );
  await pool.query("DELETE FROM enquiry_rate_limit WHERE bucket<$1", [bucket - 2]);
  return result.rows[0].hits <= 5;
}
