import Link from "next/link";

export default function StaffPage() {
  return (
    <section className="grid" aria-label="Operations">
      <Link className="card stack" href="/staff/inbox">
        <span className="eyebrow">CONVERSATIONS</span>
        <h2>A prompt, thoughtful reply.</h2>
        <p>Review enquiries, check drafts and make sure every guest reaches the right team.</p>
        <span>Open inbox →</span>
      </Link>
      <Link className="card stack" href="/staff/inventory">
        <span className="eyebrow">THE NEXT STAY</span>
        <h2>Keep the calendar in balance.</h2>
        <p>
          Set nightly tariffs, website allotments and dates off sale. Existing guests stay
          protected.
        </p>
        <span>Manage inventory →</span>
      </Link>
      <Link className="card stack" href="/staff/bookings">
        <span className="eyebrow">ARRIVALS</span>
        <h2>Know who’s coming.</h2>
        <p>See reservations and download the daily arrival list for your reservation system.</p>
        <span>View bookings →</span>
      </Link>
    </section>
  );
}
