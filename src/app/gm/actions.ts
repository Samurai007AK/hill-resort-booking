"use server";
import { revalidatePath } from "next/cache";
import { pool } from "@/db/pool";
import { requireRole } from "@/server/auth";
import { seedDemo } from "@/server/seed";
import { setAiEnabled } from "@/server/enquiry/service";

export async function toggleAi(_: string, form: FormData): Promise<string> {
  const actor = await requireRole("gm");
  try {
    const enabled = form.get("enabled") === "yes";
    await setAiEnabled(enabled, actor.email);
    revalidatePath("/gm");
    return enabled
      ? "AI enabled. New enquiries can use the configured providers."
      : "AI off. New enquiries use the keyword fallback and wait for review.";
  } catch {
    return "The setting could not be saved. Please try again.";
  }
}

export async function resetDemo(_: string, form: FormData): Promise<string> {
  await requireRole("gm");
  if (form.get("confirm") !== "on") return "Confirm the demo reset to continue.";
  const client = await pool.connect();
  try {
    await seedDemo(client);
    revalidatePath("/", "layout");
    return "Demo restored: bookings, rates, promos and enquiries. User accounts were preserved.";
  } catch {
    return "The demo could not be restored. Existing data was preserved; try again.";
  } finally {
    client.release();
  }
}
