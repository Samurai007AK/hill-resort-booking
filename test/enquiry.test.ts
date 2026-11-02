import { beforeEach, expect, test, vi, afterEach } from "vitest";
import { pool } from "./db";
import { seedDemo } from "@/server/seed";
import {
  ingestEnquiry,
  getEnquiry,
  listEnquiries,
  moveEnquiry,
  markEnquirySent,
  rerunEnquiry,
  setAiEnabled,
  getAiEnabled,
  allowPublicEnquiry,
} from "@/server/enquiry/service";
import { extractKeywords } from "@/domain/enquiry/pipeline";
import { POST } from "@/app/api/enquiries/route";
import { randomUUID } from "node:crypto";
import { makeDraft } from "@/server/enquiry/draft";

beforeEach(async () => {
  const client = await pool.connect();
  try {
    await seedDemo(client);
  } finally {
    client.release();
  }
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const input = {
  source: "web",
  senderName: "Test Sender",
  contact: "guest@example.com",
  text: "Is a villa free 14-16 Nov for 2 adults and a child?",
  consent: true,
};

test("seed restores all 32 enquiries and preserves user accounts", async () => {
  expect(await listEnquiries()).toHaveLength(32);
  expect((await getEnquiry("ENQ-4410"))?.enquiry).toMatchObject({
    category: "wedding",
    owner_team: "sales",
  });
  expect((await getEnquiry("ENQ-4435"))?.enquiry.gm_alert).toBe(true);
  expect((await getEnquiry("ENQ-4439"))?.enquiry.lane).toBe("unsorted");
  expect(
    (await pool.query("SELECT count(*)::int AS n FROM users")).rows[0].n,
  ).toBeGreaterThanOrEqual(4);
});
test("AI-off ingest remains available, visibly unsorted, and never fetches", async () => {
  await setAiEnabled(false, "gm@demo.in");
  expect(await getAiEnabled()).toBe(false);
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const item = await ingestEnquiry(input);
  expect(item).toMatchObject({
    category: "room",
    lane: "unsorted",
    owner_team: "reservations",
    ai_status: "off",
    draft_status: "draft",
    first_reply_at: null,
  });
  expect(item.draft).toContain("confirm the year");
  expect(fetch).not.toHaveBeenCalled();
});
test("valid provider response is parsed; only redacted text reaches the network", async () => {
  await setAiEnabled(true, "gm@demo.in");
  vi.stubEnv("APINEX_API_KEY", "test_provider_key");
  const text = `${input.text} Email guest@example.com, phone +91 98765 43210`;
  const fetch = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  category: "room",
                  confidence: 0.98,
                  extracted: extractKeywords(text),
                  reply_template: "Thank you. {{DATES}} {{TOTAL}} {{AVAILABILITY}}",
                }),
              },
            },
          ],
        }),
      ),
  );
  vi.stubGlobal("fetch", fetch);
  const item = await ingestEnquiry({ ...input, text });
  expect(item.ai_status).toBe("ok");
  expect(item.lane).toBe("rooms");
  const request = JSON.stringify(fetch.mock.calls);
  expect(request).not.toContain("guest@example.com");
  expect(request).not.toContain("98765");
  expect(item.draft).not.toContain("{{");
});
test("failed model and malicious prices use a marked fallback and alert GM", async () => {
  await setAiEnabled(true, "gm@demo.in");
  vi.stubEnv("APINEX_API_KEY", "test_provider_key");
  vi.stubEnv("OLLAMA_API_KEY", "");
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    category: "room",
                    confidence: 0.99,
                    extracted: extractKeywords(input.text),
                    reply_template: "Confirmed for ₹1",
                  }),
                },
              },
            ],
          }),
        ),
    ),
  );
  expect(await ingestEnquiry(input)).toMatchObject({
    ai_status: "fallback",
    lane: "unsorted",
    gm_alert: true,
  });
});
test("manual reroute and sent status append audit events without auto-sending", async () => {
  const initial = await getEnquiry("ENQ-4411");
  await moveEnquiry("ENQ-4411", "events", "reservations@demo.in", initial!.enquiry.revision);
  const moved = await getEnquiry("ENQ-4411");
  await markEnquirySent("ENQ-4411", "reservations@demo.in", moved!.enquiry.revision);
  const sent = await getEnquiry("ENQ-4411");
  await markEnquirySent("ENQ-4411", "reservations@demo.in", sent!.enquiry.revision);
  const detail = await getEnquiry("ENQ-4411");
  expect(detail?.enquiry).toMatchObject({
    lane: "events",
    owner_team: "sales",
    draft_status: "sent",
  });
  expect(detail?.enquiry.first_reply_at).toBeInstanceOf(Date);
  expect(detail?.events.filter((e) => e.kind === "marked_sent")).toHaveLength(1);
  expect(detail?.events.some((e) => e.kind === "moved")).toBe(true);
});
test("draft prose is server-owned even when an unsafe legacy model response is stored", async () => {
  const extracted = extractKeywords(input.text);
  await pool.query("UPDATE enquiry SET ai_response=$1::jsonb WHERE id='ENQ-4411'", [
    JSON.stringify({
      category: "room",
      confidence: 0.99,
      extracted,
      reply_template: "Your booking is complete and your stay is free of charge.",
    }),
  ]);
  const draft = await makeDraft(pool, "room", extracted);
  expect(draft).not.toMatch(/booking is complete|free of charge|complimentary/);
  expect(draft).toContain("Thank you for considering the estate.");
});

async function deferredRerun() {
  await setAiEnabled(true, "gm@demo.in");
  vi.stubEnv("APINEX_API_KEY", "test_provider_key");
  vi.stubEnv("OLLAMA_API_KEY", "");
  await pool.query("TRUNCATE ai_cache");
  let release = () => {};
  let notifyStarted = () => {};
  const started = new Promise<void>((resolve) => {
    notifyStarted = resolve;
  });
  const text = input.text;
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      notifyStarted();
      return new Promise<Response>((resolve) => {
        release = () =>
          resolve(
            new Response(
              JSON.stringify({
                choices: [
                  {
                    message: {
                      content: JSON.stringify({
                        category: "room",
                        confidence: 0.98,
                        extracted: extractKeywords(text),
                        reply_template: "Thank you.",
                      }),
                    },
                  },
                ],
              }),
            ),
          );
      });
    }),
  );
  const detail = await getEnquiry("ENQ-4411");
  if (!detail) throw new Error("Seed enquiry missing");
  const pending = rerunEnquiry(detail.enquiry.id, "reservations@demo.in", detail.enquiry.revision);
  await started;
  return { release, pending, revision: detail.enquiry.revision };
}
test("a slow rerun cannot overwrite a staff reroute", async () => {
  const request = await deferredRerun();
  await moveEnquiry("ENQ-4411", "complaints", "gm@demo.in", request.revision);
  request.release();
  await expect(request.pending).rejects.toThrow(/changed/);
  expect((await getEnquiry("ENQ-4411"))?.enquiry).toMatchObject({
    lane: "complaints",
    owner_team: "gm",
    gm_alert: true,
  });
});
test("a slow rerun cannot erase a sent marker and an unseen draft cannot be marked sent", async () => {
  const request = await deferredRerun();
  await markEnquirySent("ENQ-4411", "reservations@demo.in", request.revision);
  request.release();
  await expect(request.pending).rejects.toThrow(/changed/);
  expect((await getEnquiry("ENQ-4411"))?.enquiry.draft_status).toBe("sent");
  const detail = await getEnquiry("ENQ-4413");
  if (!detail) throw new Error("Seed missing");
  await setAiEnabled(false, "gm@demo.in");
  await rerunEnquiry(detail.enquiry.id, "reservations@demo.in", detail.enquiry.revision);
  await expect(
    markEnquirySent(detail.enquiry.id, "reservations@demo.in", detail.enquiry.revision),
  ).rejects.toThrow(/changed/);
  expect((await getEnquiry(detail.enquiry.id))?.enquiry.draft_status).toBe("draft");
});
test("consent and contact are validated at ingest", async () => {
  await expect(ingestEnquiry({ ...input, consent: false })).rejects.toThrow();
  await expect(ingestEnquiry({ ...input, contact: "invalid" })).rejects.toThrow();
});
test("provider failure falls through to Ollama and validated responses are cached", async () => {
  await setAiEnabled(true, "gm@demo.in");
  vi.stubEnv("APINEX_API_KEY", "test_provider_key");
  vi.stubEnv("OLLAMA_API_KEY", "test_fallback_key");
  await pool.query("TRUNCATE ai_cache");
  const text = "Estate room 18-20 Nov for 2 adults and 1 child";
  const fetch = vi.fn(async (url: unknown) =>
    String(url).includes("apinex")
      ? new Response("unavailable", { status: 503 })
      : new Response(
          JSON.stringify({
            message: {
              content: JSON.stringify({
                category: "room",
                confidence: 0.98,
                extracted: extractKeywords(text),
                reply_template: "Thank you. {{DATES}} {{TOTAL}}",
              }),
            },
          }),
        ),
  );
  vi.stubGlobal("fetch", fetch);
  const first = await ingestEnquiry({ ...input, text });
  expect(first.ai_model).toBe("gpt-oss:120b (live)");
  expect(fetch).toHaveBeenCalledTimes(2);
  const second = await ingestEnquiry({ ...input, text });
  expect(second.ai_model).toBe("gpt-oss:120b (cache)");
  expect(fetch).toHaveBeenCalledTimes(2);
});
test("repeating an ingest key returns the original enquiry and audit once", async () => {
  await setAiEnabled(false, "gm@demo.in");
  const idempotencyKey = randomUUID();
  const first = await ingestEnquiry({ ...input, idempotencyKey });
  const second = await ingestEnquiry({ ...input, idempotencyKey });
  expect(second.id).toBe(first.id);
  expect(
    (await getEnquiry(first.id))?.events.filter((event) => event.kind === "received"),
  ).toHaveLength(1);
});
test("public enquiry limit is enforced atomically across concurrent requests", async () => {
  const fingerprint = randomUUID();
  const decisions = await Promise.all(
    Array.from({ length: 8 }, () => allowPublicEnquiry(fingerprint, 10000000)),
  );
  expect(decisions.filter(Boolean)).toHaveLength(5);
  expect(await allowPublicEnquiry(fingerprint, 10600000)).toBe(true);
});
test("public API rejects cross-origin and malformed input and accepts a structured event", async () => {
  const body = {
    senderName: "Demo Event",
    contact: `${randomUUID()}@example.com`,
    text: "Please help us plan a gathering on the lawn",
    enquiryType: "wedding",
    eventDate: "2099-05-01",
    guests: "100",
    budget: "500000",
    consent: true,
    idempotencyKey: randomUUID(),
  };
  const request = (origin: string, data: unknown) =>
    new Request("http://localhost/api/enquiries", {
      method: "POST",
      headers: { origin, "content-type": "application/json", "x-forwarded-for": randomUUID() },
      body: JSON.stringify(data),
    });
  expect((await POST(request("https://elsewhere.example", body))).status).toBe(403);
  expect((await POST(request("http://localhost", { ...body, consent: false }))).status).toBe(400);
  await setAiEnabled(false, "gm@demo.in");
  const response = await POST(request("http://localhost", body));
  expect(response.status).toBe(201);
  const result = await response.json();
  expect((await getEnquiry(result.id))?.enquiry).toMatchObject({
    source: "event_form",
    category: "wedding",
    extracted: {
      check_in: { year: 2099, month: 5, day: 1 },
      guests_total: 100,
      budget_inr: 500000,
    },
  });
});
