import { EstatePhoto } from "@/server/guest/photo";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { todayIST } from "@/domain/dates";
import { availability, quoteStay } from "@/server/booking";
import { getRoom, plansFor, stayInput } from "@/server/guest/catalog";
import { parseSearch, fits } from "@/server/guest/rules";
import {
  GuestHeader,
  party,
  PriceBreakdown,
  searchQuery,
  stayDates,
  Stepper,
} from "@/server/guest/ui";
import { BookingForm } from "./booking-form";

export const dynamic = "force-dynamic";

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const { search, error } = parseSearch(params, todayIST());
  const roomId = typeof params.room === "string" ? params.room : "";
  const planId = typeof params.plan === "string" ? params.plan : "";
  const room = await getRoom(roomId);
  const plan = room ? (await plansFor(room.id)).find((p) => p.id === planId) : null;
  const stock = room ? await availability(room.id, search.checkIn, search.checkOut) : null;
  const result = room && plan ? await quoteStay(stayInput(room.id, plan.id, search)) : null;
  const valid =
    !error &&
    room &&
    plan &&
    stock &&
    stock.available >= search.qty &&
    fits({ maxAdults: room.max_adults, maxChildren: room.max_children }, search);
  return (
    <>
      <GuestHeader />
      <main className="container page">
        <div className="flow-bar">
          {valid && result?.kind === "quote" ? (
            <Link href={`/rooms/${room.id}?${searchQuery(search)}`} className="text-link">
              Change stay
            </Link>
          ) : (
            <span />
          )}
          <Stepper step={2} />
        </div>
        {!valid || result?.kind !== "quote" ? (
          <section className="quiet-page" role="status">
            <h1>Let’s choose your stay again.</h1>
            <p>
              {error ??
                (result?.kind === "promo_invalid"
                  ? `Your promo isn’t valid (${result.reason}).`
                  : "Your dates, room count or rate plan are no longer available.")}
            </p>
            <Link className="button" href={room ? `/rooms/${room.id}?${searchQuery(search)}` : "/"}>
              Back to stays
            </Link>
          </section>
        ) : (
          <>
            <header className="page-head">
              <h1>Make it yours.</h1>
            </header>
            <div className="checkout-grid">
              <BookingForm
                roomTypeId={room.id}
                ratePlanId={plan.id}
                checkIn={search.checkIn}
                checkOut={search.checkOut}
                qty={search.qty}
                adults={search.adults}
                childCount={search.children}
                promoCode={search.promo}
                idempotencyKey={randomUUID()}
              />
              <aside className="card stack" aria-label="Your stay">
                <EstatePhoto
                  className="summary-photo"
                  src={room.photos[0]?.replace("w=1600", "w=700")}
                  alt={room.name}
                  sizes="(max-width: 960px) 100vw, 40vw"
                />
                <div className="stack">
                  <h2>{room.name}</h2>
                  <p>
                    {plan.name}
                    <br />
                    {stayDates(search.checkIn, search.checkOut)}
                    <br />
                    {party(search)}
                  </p>
                </div>
                <PriceBreakdown quote={result.quote} qty={search.qty} />
                <p className="muted small">
                  Adding a promo recalculates the total on the next screen. A ten-minute hold starts
                  when you continue.
                </p>
              </aside>
            </div>
          </>
        )}
      </main>
    </>
  );
}
