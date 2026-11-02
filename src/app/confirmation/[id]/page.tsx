import Link from "next/link";
import { privateBooking } from "@/server/guest/booking-access";
import { getRoom } from "@/server/guest/catalog";
import { displayDate, GuestFooter, GuestHeader, money } from "@/server/guest/ui";

export const dynamic = "force-dynamic";

export default async function ConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  const reservation = await privateBooking((await params).id);
  const room = await getRoom(reservation.roomTypeId);
  const confirmed = reservation.status === "confirmed";
  return (
    <>
      <GuestHeader />
      <main className="page narrow stack">
        <section className="card stack confirmation-card">
          <span className="badge">
            {confirmed
              ? "BOOKING CONFIRMED"
              : reservation.status === "refund_due"
                ? "REFUND DUE"
                : reservation.status === "held"
                  ? "PAYMENT PENDING"
                  : "BOOKING CANCELLED"}
          </span>
          <p className="eyebrow">{reservation.ref}</p>
          <h1>
            {confirmed
              ? "The hills are calling."
              : reservation.status === "refund_due"
                ? "We couldn’t confirm your room."
                : "Your booking update."}
          </h1>
          <p>
            {confirmed
              ? `Thank you, ${reservation.guestName}. Your test booking is confirmed. Keep this reference for check-in.`
              : reservation.status === "refund_due"
                ? "We could not confirm the room at the quoted terms because availability or the promo limit changed. This booking is marked refund due for the reservations team. This demonstration does not move real money."
                : reservation.status === "held"
                  ? "Your room is held, but the test payment is still needed."
                  : "This booking is no longer active."}
          </p>
          <dl className="price-totals">
            <div>
              <dt>Stay</dt>
              <dd>{room?.name ?? reservation.roomTypeId}</dd>
            </div>
            <div>
              <dt>Check-in</dt>
              <dd>{displayDate(reservation.checkIn)}</dd>
            </div>
            <div>
              <dt>Check-out</dt>
              <dd>{displayDate(reservation.checkOut)}</dd>
            </div>
            <div>
              <dt>Your group</dt>
              <dd>
                {reservation.adults} adults, {reservation.children} children
              </dd>
            </div>
            <div>
              <dt>Rooms</dt>
              <dd>{reservation.qty}</dd>
            </div>
            <div>
              <dt>Total, including GST</dt>
              <dd>{money(reservation.quotedTotal)}</dd>
            </div>
          </dl>
          {reservation.late && (
            <p className="notice">
              Your late test payment was accepted because your room was still available.
            </p>
          )}
          {confirmed && (
            <div className="card">
              <h2>Before you arrive</h2>
              <p>
                Foreign guests provide passport and Form C details at check-in. We never collect
                passport information online.
              </p>
              <p>
                This confirmation is available in this browser for twenty-four hours. Please save
                your reference.
              </p>
            </div>
          )}
          {reservation.status === "held" && (
            <Link className="button" href={`/testpay/${reservation.id}`}>
              Continue to TestPay ↗
            </Link>
          )}
          <Link className="button secondary" href="/">
            Explore another stay
          </Link>
        </section>
      </main>
      <GuestFooter />
    </>
  );
}
