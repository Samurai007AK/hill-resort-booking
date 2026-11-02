import { EstatePhoto } from "@/server/guest/photo";
import Link from "next/link";
import { todayIST } from "@/domain/dates";
import { fits, parseSearch } from "@/server/guest/rules";
import { listRooms, roomOffer } from "@/server/guest/catalog";
import {
  GuestFooter,
  GuestHeader,
  GuestError,
  money,
  SearchForm,
  searchQuery,
} from "@/server/guest/ui";

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
        <section className="hero">
          <EstatePhoto
            src="https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1800&q=75&auto=format&fit=crop"
            alt="Misty green hills surrounding the coffee country"
            fetchPriority="high"
            loading="eager"
            sizes="100vw"
          />
          <div className="hero-content">
            <p className="eyebrow">CHIKKAMAGALURU, KARNATAKA</p>
            <h1>
              Let the hills
              <br />
              <em>set the pace.</em>
            </h1>
            <p>Wake to coffee, mist, and a day with nowhere else to be.</p>
            <a href="#stays" className="button light">
              Find your quiet corner <span aria-hidden="true">↗</span>
            </a>
          </div>
          <span className="hero-caption">A COFFEE ESTATE STAY · ROOMS & VILLAS</span>
        </section>
        <div className="search-wrap">
          <SearchForm search={search} />
        </div>
        <section className="page" id="stays">
          <div className="section-heading">
            <div>
              <p className="eyebrow">ROOM TO SLOW DOWN</p>
              <h2>Your place in the plantation.</h2>
            </div>
            <p>
              Five ways to stay. One unhurried feeling.
              <br />
              Breakfast, fresh air, and booking direct.
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
            <div className="card">
              <h3>New stays are on the way</h3>
              <p>
                Please check back shortly or <Link href="/enquire">send an enquiry</Link>.
              </p>
            </div>
          ) : (
            <div className="room-grid">
              {offers.map(({ room, remaining, quote }) => {
                const canFit = fits(
                  { maxAdults: room.max_adults, maxChildren: room.max_children },
                  search,
                );
                const bookable = remaining >= search.qty && canFit && quote?.kind === "quote";
                return (
                  <article className="room-card" key={room.id}>
                    <Link href={`/rooms/${room.id}?${searchQuery(search)}`} className="room-photo">
                      <EstatePhoto
                        src={room.photos[0]}
                        alt={room.name}
                        loading="lazy"
                        sizes="(max-width: 700px) 100vw, 50vw"
                      />
                      <span className="badge">
                        {room.kind === "villa" ? "PRIVATE VILLA" : "ESTATE STAY"}
                      </span>
                    </Link>
                    <div className="room-card-body">
                      <p className="eyebrow">
                        UP TO {room.max_adults} ADULTS · {room.max_children}{" "}
                        {room.max_children === 1 ? "CHILD" : "CHILDREN"} PER ROOM
                      </p>
                      <h3>
                        <Link href={`/rooms/${room.id}?${searchQuery(search)}`}>{room.name}</Link>
                      </h3>
                      <p>{room.description}</p>
                      <div className="room-card-bottom">
                        <div>
                          {quote?.kind === "quote" && (
                            <>
                              <strong>{money(quote.quote.grandTotal)}</strong>
                              <small>
                                {" "}
                                / {quote.quote.lines.length} nights · {search.qty}{" "}
                                {search.qty === 1 ? "room" : "rooms"} · incl. GST
                              </small>
                            </>
                          )}
                          <p className={bookable ? "availability" : "muted"}>
                            {!canFit
                              ? "Choose more rooms for your group"
                              : remaining >= search.qty
                                ? `${remaining} left for your dates`
                                : "Sold out for these dates"}
                          </p>
                        </div>
                        <Link
                          className="text-link"
                          href={`/rooms/${room.id}?${searchQuery(search)}`}
                        >
                          {bookable ? "Explore stay" : "See options"} ↗
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
        <section className="gather-section page">
          <div>
            <p className="eyebrow">GOOD COMPANY. OPEN SKIES.</p>
            <h2>
              Bring your people.
              <br />
              <em>We’ll make room.</em>
            </h2>
            <p>
              A wedding among silver oaks. An offsite with space to think. Tell our team what you
              have in mind.
            </p>
            <Link className="button" href="/enquire">
              Plan a gathering ↗
            </Link>
          </div>
          <EstatePhoto
            src="https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=1000&q=70&auto=format&fit=crop"
            alt="An outdoor gathering set beneath the trees"
            loading="lazy"
          />
        </section>
      </main>
      <GuestFooter />
    </>
  );
}
