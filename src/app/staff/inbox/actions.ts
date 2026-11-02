"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/server/auth";
import {
  ingestEnquiry,
  markEnquirySent,
  moveEnquiry,
  rerunEnquiry,
} from "@/server/enquiry/service";

const Id = z.string().regex(/^ENQ-\d+$/);
const Revision = z.coerce.number().int().positive();
export type MutationState = { message: string; reload: boolean };
function mutationError(error: unknown): MutationState {
  if (
    error instanceof Error &&
    /^(This enquiry changed|This reply was already marked sent|A sent draft|Enquiry not found)/.test(
      error.message,
    )
  )
    return { message: error.message, reload: true };
  return {
    message:
      "We couldn’t save that change. Reload this enquiry to check its latest state before trying again.",
    reload: true,
  };
}
export async function moveTo(_: MutationState, form: FormData): Promise<MutationState> {
  const actor = await requireRole("staff", "gm");
  try {
    const id = Id.parse(form.get("id"));
    const lane = z.enum(["unsorted", "rooms", "events", "complaints"]).parse(form.get("lane"));
    await moveEnquiry(id, lane, actor.email, Revision.parse(form.get("revision")));
    revalidatePath("/staff/inbox");
    revalidatePath("/gm");
    return { message: "Enquiry moved. The owner and audit trail were updated.", reload: false };
  } catch (error) {
    return mutationError(error);
  }
}
export async function markSent(
  id: string,
  reviewedRevision: number,
): Promise<{ ok: boolean; message: string }> {
  const actor = await requireRole("staff", "gm");
  try {
    await markEnquirySent(Id.parse(id), actor.email, Revision.parse(reviewedRevision));
    revalidatePath("/staff/inbox");
    revalidatePath("/gm");
    return { ok: true, message: "Marked sent. The first reply time is recorded." };
  } catch (error) {
    return { ok: false, message: mutationError(error).message };
  }
}
export async function rerun(_: MutationState, form: FormData): Promise<MutationState> {
  const actor = await requireRole("staff", "gm");
  try {
    await rerunEnquiry(Id.parse(form.get("id")), actor.email, Revision.parse(form.get("revision")));
    revalidatePath("/staff/inbox");
    revalidatePath("/gm");
    return { message: "Routing checked again. Review the latest result and draft.", reload: false };
  } catch (error) {
    return mutationError(error);
  }
}
export async function simulate(_: string, form: FormData): Promise<string> {
  await requireRole("staff", "gm");
  try {
    const enquiry = await ingestEnquiry({
      source: form.get("source"),
      senderName: form.get("senderName"),
      contact: form.get("contact"),
      text: form.get("text"),
      consent: true,
    });
    revalidatePath("/staff/inbox");
    revalidatePath("/gm");
    return `${enquiry.id} received. Open its inbox row to review the routing and draft.`;
  } catch {
    return "Could not receive this message. Check the sender, contact and message, then try again.";
  }
}
