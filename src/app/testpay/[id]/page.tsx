import Link from "next/link";
import { redirect } from "next/navigation";
import { privateBooking } from "@/server/guest/booking-access";
import { getRoom } from "@/server/guest/catalog";
import { GuestHeader, money, party, PriceBreakdown, stayDates, Stepper } from "@/server/guest/ui";
import { PaymentForm } from "./payment-form";

export const dynamic = "force-dynamic";

export default async function TestPayPage({ params }: { params: Promise<{ id: string }> }) {
  const reservation = await privateBooking((await params).id);
  if (reservation.status !== "held") redirect(`/confirmation/${reservation.id}`);
  const room = await getRoom(reservation.roomTypeId);
  const expired = reservation.holdExpired;
  const subtotal = reservation.priceLines.reduce(
    (sum, line) => sum + line.tariff * reservation.qty,
    0,
  );
  const quote = {
    lines: reservation.priceLines,
    subtotal,
    discountTotal: reservation.priceLines.reduce((sum, line) => sum + line.discount, 0),
    gstTotal: reservation.priceLines.reduce((sum, line) => sum + line.gst, 0),
    grandTotal: reservation.quotedTotal,
  };
  return (
    <>
      <GuestHeader />
      <main className="container page">
        <div className="flow-bar">
          <span className="chip">Test mode, no real charge</span>
          <Stepper step={3} />
        </div>
        <header className="page-head">
          <h1>Your stay is almost here.</h1>
        </header>
        <div className="checkout-grid">
          <section className="card stack" aria-labelledby="pay-title">
            <h2 id="pay-title">TestPay</h2>
            <p className="pay-total">{money(reservation.quotedTotal)}</p>
            <p>
              This gateway simulates a payment. It never asks for card details or moves real money.
            </p>
            <p className="notice" role="status">
              {expired
                ? "Your hold has expired. A successful test payment will confirm only if rooms are still free."
                : `Your room is held until ${reservation.expiresAt?.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })} IST.`}
            </p>
            <PaymentForm id={reservation.id} />
            <Link className="text-link" href="/">
              Back to stays
            </Link>
          </section>
          <aside className="card stack" aria-label="Your booking">
            <div className="stack">
              <h2>{room?.name ?? reservation.roomTypeId}</h2>
              <p className="meta">Booking {reservation.ref}</p>
              <p>
                {stayDates(reservation.checkIn, reservation.checkOut)}
                <br />
                {party({
                  adults: reservation.adults,
                  children: reservation.children,
                  qty: reservation.qty,
                })}
              </p>
              <p>
                {reservation.guestName}
                <br />
                {reservation.guestEmail}
              </p>
            </div>
            <PriceBreakdown quote={quote} qty={reservation.qty} />
            <p className="muted small">
              Your contact details are visible only in this browser session and to authorised resort
              staff.
            </p>
          </aside>
        </div>
      </main>
    </>
  );
}
