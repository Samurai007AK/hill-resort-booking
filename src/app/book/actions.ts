"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHold, HoldInput } from "@/server/booking";
import { getRoom } from "@/server/guest/catalog";
import { createBookingAccess } from "@/server/guest/access";
import { fits, normalizePhone } from "@/server/guest/rules";

export type BookingState = { error: string } | undefined;

export async function bookStay(_previous: BookingState, form: FormData): Promise<BookingState> {
  const rawPhone = form.get("guestPhone");
  const phone = typeof rawPhone === "string" ? normalizePhone(rawPhone) : null;
  if (!phone)
    return {
      error: "Enter a valid Indian mobile or an international number with its + country code.",
    };
  const input = HoldInput.safeParse({
    ...Object.fromEntries(form),
    guestPhone: phone,
    consent: form.get("consent") === "on",
  });
  if (!input.success)
    return { error: input.error.issues[0]?.message ?? "Please check your booking details." };
  let reservationId: string;
  try {
    const room = await getRoom(input.data.roomTypeId);
    if (!room || !fits({ maxAdults: room.max_adults, maxChildren: room.max_children }, input.data))
      return {
        error: "Your group needs more rooms. Please go back and choose a suitable room count.",
      };
    const result = await createHold({ ...input.data, guestPhone: phone });
    if (result.kind === "sold_out")
      return {
        error: `This stay just sold out on ${result.night}. Go back to choose another room or nearby dates.`,
      };
    if (result.kind === "promo_invalid")
      return {
        error: `That promo cannot be used (${result.reason}). Try another code or leave it blank.`,
      };
    if (result.kind === "invalid")
      return {
        error: "Those dates or that rate plan are no longer available. Choose your stay again.",
      };
    reservationId = result.reservation.id;
    (await cookies()).set(`booking_${reservationId}`, await createBookingAccess(reservationId), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 86400,
    });
  } catch {
    return {
      error:
        "We couldn’t reserve your room just now. Please try again; submitting twice will not create a second hold.",
    };
  }
  redirect(`/testpay/${reservationId}`);
}
