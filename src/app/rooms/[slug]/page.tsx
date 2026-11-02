import { EstatePhoto } from "@/server/guest/photo";
import Link from "next/link";
import { notFound } from "next/navigation";
import { todayIST, addDays } from "@/domain/dates";
import { availability, quoteStay } from "@/server/booking";
import { getRoom, listRooms, plansFor, stayInput } from "@/server/guest/catalog";
import { fits, parseSearch, pickAlternatives, type Option } from "@/server/guest/rules";
import {
  displayDate,
  GuestFooter,
  GuestHeader,
  PriceBreakdown,
  SearchForm,
  searchQuery,
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
      <main className="page stack">
        <Link href={`/?${searchQuery(search)}#stays`} className="text-link">
          ← All stays
        </Link>
        <Stepper step={1} />
        <div className="section-heading">
          <div>
            <p className="eyebrow">YOUR PLACE IN THE PLANTATION</p>
            <h1>{room.name}</h1>
          </div>
          <p>
            Up to {room.max_adults} adults & {room.max_children} children per room.
            <br />
            Breakfast included with every rate plan.
          </p>
        </div>
        <div className="room-gallery">
          {room.photos.slice(0, 3).map((photo, index) => (
            <EstatePhoto
              key={photo}
              src={photo.replace("w=1600", index === 0 ? "w=1200" : "w=600")}
              alt={`${room.name}, view ${index + 1}`}
              loading={index === 0 ? "eager" : "lazy"}
            />
          ))}
        </div>
        <p className="room-description">{room.description}</p>
        <SearchForm search={search} action={`/rooms/${room.id}`} />
        {error && (
          <p className="notice" role="alert">
            {error}. Please check the dates below.
          </p>
        )}
        {search.promo && (
          <p className="muted">
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
          <section className="card stack" role="status">
            <h2>
              {canFit ? "These dates have just sold out." : "A little more room for your group."}
            </h2>
            <p>
              {canFit
                ? "Someone else may have booked while you were looking. Try another room or nearby dates."
                : "Choose more rooms or a larger stay to accommodate every guest."}
            </p>
            {alternatives.length > 0 ? (
              <div className="grid">
                {alternatives.map((option) => (
                  <Link
                    key={`${option.roomTypeId}-${option.checkIn}`}
                    href={`/rooms/${option.roomTypeId}?${searchQuery({ ...search, checkIn: option.checkIn, checkOut: option.checkOut })}`}
                    className="card"
                  >
                    <strong>{option.name}</strong>
                    <p>
                      {displayDate(option.checkIn)} – {displayDate(option.checkOut)}
                    </p>
                    <span className="text-link">{option.available} left · Explore ↗</span>
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
        <div className="section-heading">
          <div>
            <p className="eyebrow">A STAY, YOUR WAY</p>
            <h2>Choose a rate plan.</h2>
          </div>
          <p>
            {displayDate(search.checkIn)} – {displayDate(search.checkOut)}
            <br />
            {search.adults} adults, {search.children} children · {search.qty} rooms
          </p>
        </div>
        <div className="grid">
          {quotes.length === 0 ? (
            <section className="card">
              <h3>No rate plans are available</h3>
              <Link href="/enquire">Contact the team</Link>
            </section>
          ) : (
            quotes.map(({ plan, result }) => (
              <section className="card stack" key={plan.id}>
                <div>
                  <span className="badge">{plan.refundable ? "FLEXIBLE" : "SAVE 10%"}</span>
                  <h3>{plan.name}</h3>
                  <p>
                    {plan.refundable
                      ? "Breakfast included. Confirm cancellation arrangements with the resort team."
                      : "A lower tariff. No refund after confirmation."}
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
                        Choose this stay ↗
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
        <p className="muted">
          Your room is held for ten minutes after you enter your details. Prices and availability
          are checked again at that point.
        </p>
      </main>
      <GuestFooter />
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
