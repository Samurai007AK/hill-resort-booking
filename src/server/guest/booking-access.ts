import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getReservation } from "@/server/booking";
import { verifyBookingAccess } from "./access";

export async function privateBooking(id: string) {
  if (!z.uuid().safeParse(id).success) notFound();
  const token = (await cookies()).get(`booking_${id}`)?.value;
  if (!(await verifyBookingAccess(token, id))) notFound();
  const reservation = await getReservation(id);
  if (!reservation) notFound();
  return {
    ...reservation,
    holdExpired: reservation.expiresAt !== null && reservation.expiresAt.getTime() <= Date.now(),
  };
}
