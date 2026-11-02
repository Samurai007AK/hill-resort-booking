import { EstatePhoto } from "@/server/guest/photo";
import Link from "next/link";
import { notFound } from "next/navigation";
import { todayIST, addDays } from "@/domain/dates";
import { availability, quoteStay } from "@/server/booking";
import { getRoom, listRooms, plansFor, stayInput } from "@/server/guest/catalog";
import { fits, parseSearch, pickAlternatives, type Option } from "@/server/guest/rules";
import {
  GuestHeader,
  party,
  PriceBreakdown,
  SearchForm,
  searchQuery,
  stayDates,
  Stepper,
} from "@/server/guest/ui";

export const dynamic = "force-dynamic";

export default async function RoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const room = await getRoom(slug);
  if (!room) notFound();
  const { search, error } = parseSearch(await searchParams, todayIST());
  const [plans, stock] = await Promise.all([
    plansFor(room.id),
    availability(room.id, search.checkIn, search.checkOut),
  ]);
  const quotes = await Promise.all(
    plans.map(async (plan) => ({
      plan,
      result: await quoteStay(stayInput(room.id, plan.id, search)),
    })),
  );
  const canFit = fits({ maxAdults: room.max_adults, maxChildren: room.max_children }, search);
  const available = stock.available >= search.qty && canFit;
  const alternatives = !available ? await getAlternatives(room.id, search) : [];
  return (
    <>
      <GuestHeader />
      <main className="container page">
        <div className="flow-bar">
          <Link href={`/?${searchQuery(search)}#stays`} className="text-link">
            All stays
          </Link>
          <Stepper step={1} />
        </div>
        <header className="page-head">
          <h1>{room.name}</h1>
          <p className="lead">
            Up to {party({ adults: room.max_adults, children: room.max_children })} per room.
            Breakfast included with every rate plan.
          </p>
        </header>
        <div className="room-gallery">
          {room.photos.slice(0, 3).map((photo, index) => (
            <EstatePhoto
              key={photo}
              src={photo.replace("w=1600", index === 0 ? "w=1200" : "w=600")}
              alt={`${room.name}, view ${index + 1}`}
              loading={index === 0 ? "eager" : "lazy"}
              fetchPriority={index === 0 ? "high" : undefined}
              sizes={
                index === 0 ? "(max-width: 640px) 100vw, 66vw" : "(max-width: 640px) 50vw, 33vw"
              }
            />
          ))}
        </div>
        <div className="room-intro">
          <p>{room.description}</p>
          <SearchForm search={search} action={`/rooms/${room.id}`} stacked />
        </div>
        {error && (
          <p className="notice room-status" role="alert">
            {error}. Please check the dates below.
          </p>
        )}
        {search.promo && (
          <p className="notice room-status">
            Promo <strong>{search.promo}</strong> is included in this search.{" "}
            <Link
              className="text-link"
              href={`/rooms/${room.id}?${searchQuery({ ...search, promo: undefined })}`}
            >
              Remove promo
            </Link>
          </p>
        )}
        {!available && (
          <section className="notice stack room-status" role="status">
            <h2>
              {canFit ? "These dates have just sold out." : "A little more room for your group."}
            </h2>
            <p>
              {canFit
                ? "Someone else may have booked while you were looking. Try another room or nearby dates."
                : "Choose more rooms or a larger stay to accommodate every guest."}
            </p>
            {alternatives.length > 0 ? (
              <div className="alternatives">
                {alternatives.map((option) => (
                  <Link
                    key={`${option.roomTypeId}-${option.checkIn}`}
                    href={`/rooms/${option.roomTypeId}?${searchQuery({ ...search, checkIn: option.checkIn, checkOut: option.checkOut })}`}
                  >
                    <strong>{option.name}</strong>
                    <span>{stayDates(option.checkIn, option.checkOut)}</span>
                    <span className="availability">{option.available} left for these dates</span>
                  </Link>
                ))}
              </div>
            ) : (
              <Link className="button" href={`/?${searchQuery(search)}`}>
                Find another stay
              </Link>
            )}
          </section>
        )}
        <section className="plans" aria-labelledby="plans-title">
          <div className="section-head">
            <h2 id="plans-title">Choose a rate plan.</h2>
            <p>
              {stayDates(search.checkIn, search.checkOut)}
              <br />
              {party(search)}
            </p>
          </div>
          <div className="plan-grid">
            {quotes.length === 0 ? (
              <section className="card stack">
                <h3>No rate plans are available</h3>
                <Link href="/enquire">Contact the team</Link>
              </section>
            ) : (
              quotes.map(({ plan, result }) => (
                <section className="card plan" key={plan.id}>
                  <div className="stack">
                    <h3>{plan.name}</h3>
                    <p>
                      {plan.refundable
                        ? "Flexible. Breakfast included. Confirm cancellation arrangements with the resort team."
                        : "Save 10%. A lower tariff. No refund after confirmation."}
                    </p>
                  </div>
                  {result.kind === "quote" ? (
                    <>
                      <PriceBreakdown quote={result.quote} qty={search.qty} />
                      {available ? (
                        <Link
                          className="button"
                          href={`/book?room=${room.id}&plan=${plan.id}&${searchQuery(search)}`}
                        >
                          Choose this stay
                        </Link>
                      ) : (
                        <p className="muted">Update your dates or room count to continue.</p>
                      )}
                    </>
                  ) : (
                    <p className="notice" role="status">
                      {result.kind === "promo_invalid"
                        ? `Promo ${search.promo} isn’t valid (${result.reason}). Remove it or choose different dates.`
                        : "This plan isn’t available for your dates."}
                    </p>
                  )}
                </section>
              ))
            )}
          </div>
        </section>
        <p className="muted hold-note">
          Your room is held for ten minutes after you enter your details. Prices and availability
          are checked again at that point.
        </p>
      </main>
    </>
  );
}

async function getAlternatives(
  roomTypeId: string,
  search: ReturnType<typeof parseSearch>["search"],
) {
  const rooms = await listRooms();
  const options: Option[] = await Promise.all(
    rooms.flatMap((room) =>
      (room.id === roomTypeId ? [-2, -1, 1, 2] : [0]).map(async (offset) => {
        const checkIn = addDays(search.checkIn, offset),
          checkOut = addDays(search.checkOut, offset);
        return {
          roomTypeId: room.id,
          checkIn,
          checkOut,
          available: (await availability(room.id, checkIn, checkOut)).available,
        };
      }),
    ),
  );
  return pickAlternatives(
    { ...search, roomTypeId },
    options,
    rooms.map((room) => ({
      id: room.id,
      maxAdults: room.max_adults,
      maxChildren: room.max_children,
    })),
    todayIST(),
  ).map((option) => ({
    ...option,
    name: rooms.find((room) => room.id === option.roomTypeId)?.name ?? option.roomTypeId,
  }));
}
