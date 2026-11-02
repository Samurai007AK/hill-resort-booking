import Link from "next/link";
import { redirect } from "next/navigation";
import { privateBooking } from "@/server/guest/booking-access";
import { getRoom } from "@/server/guest/catalog";
import {
  displayDate,
  GuestFooter,
  GuestHeader,
  money,
  PriceBreakdown,
  Stepper,
} from "@/server/guest/ui";
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
      <main className="page stack">
        <Stepper step={3} />
        <div className="section-heading">
          <div>
            <p className="eyebrow">ONE LAST STEP</p>
            <h1>Your stay is almost here.</h1>
          </div>
          <span className="badge">TEST MODE · NO REAL CHARGE</span>
        </div>
        <div className="checkout-grid">
          <section className="card stack">
            <p className="eyebrow">TESTPAY</p>
            <h2>{money(reservation.quotedTotal)}</h2>
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
          <aside className="card stack">
            <p className="eyebrow">BOOKING {reservation.ref}</p>
            <h2>{room?.name ?? reservation.roomTypeId}</h2>
            <p>
              {displayDate(reservation.checkIn)} – {displayDate(reservation.checkOut)}
              <br />
              {reservation.adults} adults, {reservation.children} children · {reservation.qty} rooms
            </p>
            <p>
              {reservation.guestName}
              <br />
              {reservation.guestEmail}
            </p>
            <PriceBreakdown quote={quote} qty={reservation.qty} />
            <p className="muted small">
              Your contact details are visible only in this browser session and to authorised resort
              staff.
            </p>
          </aside>
        </div>
      </main>
      <GuestFooter />
    </>
  );
}
