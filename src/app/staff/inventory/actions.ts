"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/server/auth";
import { editInventory } from "@/server/admin/service";

export type InventoryState = { message: string; needsMinimum: boolean };
export async function updateInventory(_: InventoryState, form: FormData): Promise<InventoryState> {
  const actor = await requireRole("staff", "gm");
  try {
    const result = await editInventory(actor, {
      roomTypeId: form.get("roomTypeId"),
      from: form.get("from"),
      to: form.get("to"),
      rate: form.get("rate"),
      allotment: form.get("allotment"),
      closed: form.get("closed") === "on",
      setMinimum: form.get("setMinimum") === "yes",
    });
    if (result.kind === "minimum")
      return {
        message: `${result.night} already has ${result.minimum} sold or held. Nothing changed. Use “Set to minimum” to preserve every committed key; occupied nights stay open.`,
        needsMinimum: true,
      };
    revalidatePath("/staff/inventory");
    revalidatePath("/");
    return { message: `Saved ${result.nights} nightly rates and allotments.`, needsMinimum: false };
  } catch (error) {
    const message =
      error instanceof Error &&
      /^(Room type not found|Allotment exceeds|Some dates are outside)/.test(error.message)
        ? error.message
        : "Check the dates, rate and allotment, then try again. The calendar may have changed; no changes were saved.";
    return { message, needsMinimum: false };
  }
}
