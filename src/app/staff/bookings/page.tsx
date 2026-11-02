import Link from "next/link";
import { z } from "zod";
import { todayIST } from "@/domain/dates";
import { listBookings } from "@/server/admin/service";

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const parsed = z.iso.date().safeParse(params.date);
  const date = parsed.success ? parsed.data : undefined;
  const bookings = await listBookings(date);
  return (
    <div className="stack">
      <div>
        <span className="eyebrow">RESERVATIONS</span>
        <h2>The next arrivals</h2>
        <p>All statuses remain visible so late payments and refunds can be followed up.</p>
      </div>
      <form className="actions">
        <label>
          Arrival date
          <input type="date" name="date" defaultValue={date ?? todayIST()} />
        </label>
        <button className="button secondary">Filter arrivals</button>
        <Link className="button secondary" href="/staff/bookings">
          All bookings
        </Link>
        <a className="button" href={`/staff/bookings/export?date=${date ?? todayIST()}`}>
          Export {date ?? "today’s"} arrivals · CSV
        </a>
      </form>
      {bookings.length ? (
        <div className="table-scroll">
          <table>
            <caption>
              {bookings.length} reservations · newest stays first within arrival date
            </caption>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Guest</th>
                <th>Room</th>
                <th>Stay</th>
                <th>Keys</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <tr key={booking.id}>
                  <th scope="row">{booking.ref}</th>
                  <td>
                    {booking.guest_name}
                    <br />
                    <small>{booking.guest_email}</small>
                  </td>
                  <td>{booking.room_name}</td>
                  <td>
                    {booking.check_in}
                    <br />
                    to {booking.check_out}
                  </td>
                  <td>{booking.qty}</td>
                  <td>₹{booking.quoted_total.toLocaleString("en-IN")}</td>
                  <td>
                    <span className="badge">{booking.status.replaceAll("_", " ")}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <section className="card">
          <h3>No arrivals for this date.</h3>
          <p>Try another day or open all bookings.</p>
        </section>
      )}
    </div>
  );
}
