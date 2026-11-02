"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/server/auth";
import { savePromo } from "@/server/admin/service";

export async function updatePromo(_: string, form: FormData): Promise<string> {
  const actor = await requireRole("staff", "gm");
  try {
    await savePromo(actor, {
      code: form.get("code"),
      kind: form.get("kind"),
      value: form.get("value"),
      validFrom: form.get("validFrom"),
      validTo: form.get("validTo"),
      minNights: form.get("minNights"),
      maxUses: form.get("maxUses") ? Number(form.get("maxUses")) : null,
      active: form.get("active") === "on",
    });
    revalidatePath("/staff/promos");
    return "Promo saved. Recorded uses were preserved.";
  } catch {
    return "Check the code, date range, amount and limits. Percent discounts cannot exceed 100%.";
  }
}
