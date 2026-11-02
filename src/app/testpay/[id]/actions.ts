"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { pool } from "@/db/pool";
import { applyPayment, signPayment } from "@/server/booking";
import { privateBooking } from "@/server/guest/booking-access";

export type PaymentState = { error: string } | undefined;
const PaymentChoice = z.object({ id: z.uuid(), mode: z.enum(["pay", "fail", "late"]) });

export async function testPayment(_previous: PaymentState, form: FormData): Promise<PaymentState> {
  const choice = PaymentChoice.safeParse(Object.fromEntries(form));
  if (!choice.success) return { error: "Please choose a test payment option." };
  const reservation = await privateBooking(choice.data.id);
  if (reservation.status !== "held") redirect(`/confirmation/${reservation.id}`);
  try {
    if (choice.data.mode === "late")
      await pool.query(
        "UPDATE reservation SET expires_at = now() - interval '1 second' WHERE id = $1 AND status = 'held'",
        [reservation.id],
      );
    const payment = {
      paymentId: `testpay_${reservation.id}_${choice.data.mode}`,
      reservationId: reservation.id,
      amount: reservation.quotedTotal,
      status: choice.data.mode === "fail" ? "failed" : "success",
    } satisfies Parameters<typeof signPayment>[0];
    const result = await applyPayment({ ...payment, signature: signPayment(payment) });
    if (result.kind !== "applied")
      return { error: "Payment could not be verified. Please try again." };
    if (result.outcome === "rejected")
      return {
        error:
          "Test payment declined. No money was taken. Try the successful payment option while your hold is active.",
      };
  } catch {
    return { error: "TestPay could not process that attempt. It is safe to retry." };
  }
  redirect(`/confirmation/${reservation.id}`);
}
