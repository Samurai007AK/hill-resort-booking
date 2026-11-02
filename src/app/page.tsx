import { EstatePhoto } from "@/server/guest/photo";
import Link from "next/link";
import { todayIST } from "@/domain/dates";
import { fits, parseSearch } from "@/server/guest/rules";
import { listRooms, roomOffer } from "@/server/guest/catalog";
import { GuestHeader, GuestError, money, party, SearchForm, searchQuery } from "@/server/guest/ui";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { search, error } = parseSearch(await searchParams, todayIST());
  const offers = await (async () => {
    try {
      return await Promise.all((await listRooms()).map((room) => roomOffer(room, search)));
    } catch {
      return null;
    }
  })();
  return (
    <>
      <GuestHeader />
      <main>
        <section className="hero" aria-labelledby="hero-title">
          <EstatePhoto
            className="hero-photo"
            src="https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1800&q=75&auto=format&fit=crop"
            alt="Misty green hills surrounding the coffee country"
            fetchPriority="high"
            loading="eager"
            sizes="100vw"
          />
          <div className="container hero-copy">
            <div>
              <h1 id="hero-title">Let the hills set the pace.</h1>
              <p className="lead">Wake to coffee, mist, and a day with nowhere else to be.</p>
              <a href="#stays" className="button light">
                Find your quiet corner
              </a>
            </div>
            <p className="hero-caption">
              Rooms and villas on a coffee estate in Chikkamagaluru, Karnataka.
            </p>
          </div>
        </section>
        <div className="container search-wrap">
          <SearchForm search={search} />
        </div>
        <section className="section container" id="stays" aria-labelledby="stays-title">
          <div className="section-head">
            <h2 id="stays-title">Your place in the plantation.</h2>
            <p>
              Five ways to stay. One unhurried feeling. Breakfast, fresh air, and booking direct.
            </p>
          </div>
          {error && (
            <p className="notice" role="alert">
              {error}. We’ve shown the next available search dates.
            </p>
          )}
          {!offers ? (
            <GuestError title="We couldn’t check availability just now." />
          ) : offers.length === 0 ? (
            <div className="notice stack">
              <h3>New stays are on the way</h3>
              <p>
                Please check back shortly or <Link href="/enquire">send an enquiry</Link>.
              </p>
            </div>
          ) : (
            <ul className="room-list">
              {offers.map(({ room, remaining, quote }) => {
                const canFit = fits(
                  { maxAdults: room.max_adults, maxChildren: room.max_children },
                  search,
                );
                const bookable = remaining >= search.qty && canFit && quote?.kind === "quote";
                const href = `/rooms/${room.id}?${searchQuery(search)}`;
                return (
                  <li className="room-row" key={room.id}>
                    <Link href={href} className="room-photo" tabIndex={-1} aria-hidden="true">
                      <EstatePhoto
                        src={room.photos[0]}
                        alt=""
                        loading="lazy"
                        sizes="(max-width: 640px) 100vw, (max-width: 960px) 40vw, 30vw"
                      />
                    </Link>
                    <div className="room-body">
                      <h3>
                        <Link href={href}>{room.name}</Link>
                      </h3>
                      <p className="room-fit">
                        {room.kind === "villa" ? "Private villa" : "Estate stay"}. Up to{" "}
                        {party({ adults: room.max_adults, children: room.max_children })} per room.
                      </p>
                      <p>{room.description}</p>
                    </div>
                    <div className="room-offer">
                      {quote?.kind === "quote" && (
                        <>
                          <p className="price">{money(quote.quote.grandTotal)}</p>
                          <p className="price-note">
                            for {quote.quote.lines.length} nights,{" "}
                            {search.qty === 1 ? "1 room" : `${search.qty} rooms`}, GST included
                          </p>
                        </>
                      )}
                      <p className={bookable ? "availability" : "availability out"}>
                        {!canFit
                          ? "Choose more rooms for your group"
                          : remaining >= search.qty
                            ? `${remaining} left for your dates`
                            : "Sold out for these dates"}
                      </p>
                      <Link className={bookable ? "button secondary" : "text-link"} href={href}>
                        {bookable ? "Explore stay" : "See options"}
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <section className="section container" aria-label="The estate">
          <dl className="estate-facts">
            <div>
              <dt>Rooms</dt>
              <dd>64</dd>
            </div>
            <div>
              <dt>Villas</dt>
              <dd>12</dd>
            </div>
            <div>
              <dt>Check-in</dt>
              <dd>14:00</dd>
            </div>
            <div>
              <dt>Check-out</dt>
              <dd>11:00</dd>
            </div>
          </dl>
        </section>
        <section className="gather" aria-labelledby="gather-title">
          <div className="container gather-inner">
            <div>
              <h2 id="gather-title">
                Bring your people.
                <br />
                We’ll make room.
              </h2>
              <p>
                A wedding among silver oaks. An offsite with space to think. Tell our team what you
                have in mind.
              </p>
              <Link className="button" href="/enquire">
                Plan a gathering
              </Link>
            </div>
            <EstatePhoto
              className="gather-photo"
              src="https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=1000&q=70&auto=format&fit=crop"
              alt="An outdoor gathering set beneath the trees"
              loading="lazy"
              sizes="(max-width: 960px) 100vw, 55vw"
            />
          </div>
        </section>
      </main>
    </>
  );
}
