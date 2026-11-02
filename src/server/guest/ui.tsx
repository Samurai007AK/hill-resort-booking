import Link from "next/link";
import type { Quote } from "@/domain/pricing";
import { todayIST } from "@/domain/dates";
import type { Search } from "./rules";

export const money = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
export const displayDate = (date: string) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** "2 adults, 1 child, 1 room" */
export function party({
  adults,
  children,
  qty,
}: {
  adults: number;
  children: number;
  qty?: number;
}): string {
  const parts = [plural(adults, "adult", "adults"), plural(children, "child", "children")];
  if (qty !== undefined) parts.push(plural(qty, "room", "rooms"));
  return parts.join(", ");
}

export const stayDates = (checkIn: string, checkOut: string) =>
  `${displayDate(checkIn)} to ${displayDate(checkOut)}`;

export function searchQuery(search: Search): string {
  const query = new URLSearchParams({
    in: search.checkIn,
    out: search.checkOut,
    adults: String(search.adults),
    children: String(search.children),
    qty: String(search.qty),
  });
  if (search.promo) query.set("promo", search.promo);
  return query.toString();
}

export function GuestHeader() {
  return (
    <header className="site-header">
      <div className="container site-header-inner">
        <Link href="/" className="wordmark" aria-label="Silver Oaks, home">
          Silver Oaks<span>Coffee estate, Chikkamagaluru</span>
        </Link>
        <nav className="site-nav" aria-label="Main navigation">
          <Link href="/#stays">Stay</Link>
          <Link href="/enquire">Gather</Link>
          <Link href="/login">Sign in</Link>
        </nav>
      </div>
    </header>
  );
}

export function GuestFooter() {
  return (
    <footer className="site-footer">
      <div className="container site-footer-inner">
        <div>
          <Link href="/" className="wordmark">
            Silver Oaks
          </Link>
          <p>A little closer to the hills.</p>
        </div>
        <nav className="footer-links" aria-label="Footer">
          <Link href="/enquire">Plan a gathering</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/login">Team sign in</Link>
        </nav>
        <small className="footer-legal">A demonstration resort. Payments are simulated.</small>
      </div>
    </footer>
  );
}

export function SearchForm({
  search,
  action = "/",
  stacked = false,
}: {
  search: Search;
  action?: string;
  stacked?: boolean;
}) {
  return (
    <form
      action={action}
      className={stacked ? "search-form stacked" : "search-form"}
      aria-label="Find your stay"
    >
      <label>
        Check-in
        <input type="date" name="in" min={todayIST()} defaultValue={search.checkIn} required />
      </label>
      <label>
        Check-out
        <input type="date" name="out" min={todayIST()} defaultValue={search.checkOut} required />
      </label>
      <label>
        Adults
        <input type="number" name="adults" min="1" max="16" defaultValue={search.adults} required />
      </label>
      <label>
        Children
        <input
          type="number"
          name="children"
          min="0"
          max="12"
          defaultValue={search.children}
          required
        />
      </label>
      <label>
        Rooms
        <input type="number" name="qty" min="1" max="4" defaultValue={search.qty} required />
      </label>
      {search.promo && <input type="hidden" name="promo" value={search.promo} />}
      <button className="button" type="submit">
        Find a stay
      </button>
    </form>
  );
}

export function PriceBreakdown({ quote, qty }: { quote: Quote; qty: number }) {
  return (
    <div className="price-breakdown">
      <div className="table-scroll">
        <table>
          <caption>Price per night for {plural(qty, "room", "rooms")}, GST shown per night</caption>
          <thead>
            <tr>
              <th scope="col">Night</th>
              <th scope="col" className="amount">
                After discount
              </th>
              <th scope="col" className="amount">
                GST
              </th>
              <th scope="col" className="amount">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {quote.lines.map((line) => (
              <tr key={line.date}>
                <td>{displayDate(line.date)}</td>
                <td className="amount">{money(line.taxable)}</td>
                <td className="amount">
                  {money(line.gst)}
                  <span className="gst-rate">at {line.gstRate}%</span>
                </td>
                <td className="amount">{money(line.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="price-totals">
        <div>
          <dt>Room tariff</dt>
          <dd>{money(quote.subtotal)}</dd>
        </div>
        {quote.discountTotal > 0 && (
          <div>
            <dt>Promo savings</dt>
            <dd>−{money(quote.discountTotal)}</dd>
          </div>
        )}
        <div>
          <dt>GST</dt>
          <dd>{money(quote.gstTotal)}</dd>
        </div>
        <div className="grand-total">
          <dt>Total for your stay</dt>
          <dd>{money(quote.grandTotal)}</dd>
        </div>
      </dl>
      <p className="muted small">
        GST is calculated per room, per night, after discounts. All amounts are in Indian rupees.
      </p>
    </div>
  );
}

const STEPS = ["Choose your stay", "Your details", "Test payment"];

export function Stepper({ step }: { step: 1 | 2 | 3 }) {
  return (
    <ol className="booking-steps" aria-label="Booking progress">
      {STEPS.map((label, index) => (
        <li
          key={label}
          className={index + 1 === step ? "active" : index + 1 < step ? "done" : ""}
          aria-current={index + 1 === step ? "step" : undefined}
        >
          <span className="step-number">{index + 1}</span>
          {label}
        </li>
      ))}
    </ol>
  );
}

export function GuestError({ title = "We couldn’t load this just now." }: { title?: string }) {
  return (
    <section className="notice stack" role="alert">
      <h2>{title}</h2>
      <p>
        Please try again in a moment. Your booking is only confirmed after a successful test
        payment.
      </p>
      <Link className="button" href="/">
        Back to stays
      </Link>
    </section>
  );
}
