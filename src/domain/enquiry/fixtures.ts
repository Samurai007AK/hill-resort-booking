import { classifyKeywords, extractKeywords, redactPersonalData, type AiResponse } from "./pipeline";
import type { EvalItem } from "./gold";

export const FIXTURE_MODEL = "demo fixture / keyword baseline (not a live model response)";
export function demoFixture(item: EvalItem) {
  const redacted = redactPersonalData(item.text, item.sender_name);
  const keyword = classifyKeywords(redacted);
  const extracted = extractKeywords(redacted);
  const status: "ok" | "fallback" | "off" =
    item.id === "ENQ-4419" ? "fallback" : item.id === "ENQ-4439" ? "off" : "ok";
  const response: AiResponse | null =
    status === "ok"
      ? {
          category: keyword,
          confidence: item.id === "ENQ-4413" ? 0.65 : 0.98,
          extracted,
          reply_template:
            keyword === "room"
              ? "Thank you. {{DATES}} {{GUESTS}} {{TOTAL}} {{AVAILABILITY}}"
              : "Thank you for your enquiry. Our team will review the details and reply.",
        }
      : null;
  return { redacted, keyword, extracted, status, response, model: FIXTURE_MODEL };
}
