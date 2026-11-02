import Link from "next/link";
import { requireRole } from "@/server/auth";
import { logout } from "@/app/login/actions";
import { dashboardMetrics } from "@/server/admin/service";
import { getAiEnabled, listEnquiries } from "@/server/enquiry/service";
import { Controls } from "./controls";

export default async function GmPage() {
  const actor = await requireRole("gm");
  const [metrics, enabled, enquiries] = await Promise.all([
    dashboardMetrics(actor),
    getAiEnabled(),
    listEnquiries(),
  ]);
  const alerts = enquiries.filter((enquiry) => enquiry.gm_alert);
  return (
    <main className="container app screen">
      <header className="app-head">
        <div className="stack">
          <Link href="/" className="wordmark" aria-label="Silver Oaks, guest website">
            Silver Oaks
          </Link>
          <h1>The estate, at a glance.</h1>
          <p>
            The general manager’s view. Three goals: more direct stays, thoughtful replies, and no
            overbooked nights.
          </p>
        </div>
        <nav className="actions" aria-label="GM tools">
          <Link className="button secondary" href="/staff">
            Open staff tools
          </Link>
          <Link className="button secondary" href="/">
            Guest website
          </Link>
          <form action={logout}>
            <button className="button secondary" type="submit">
              Sign out
            </button>
          </form>
        </nav>
      </header>
      <section className="stat-row" aria-label="Success metrics">
        <article className="stat">
          <h2>Direct share</h2>
          <p className="metric">{metrics.directNights} nights</p>
          <p className="stat-label">Booked direct in this demo. Target 12% to 20%.</p>
          <p>
            Illustrative agency commission avoided:{" "}
            <strong>₹{metrics.commissionAvoided.toLocaleString("en-IN")}</strong>, at the brief’s
            assumed 20% of tariff excluding GST.
          </p>
          <small>
            Demo direct nights ÷ 17,199 assumed annual occupied nights ={" "}
            {((100 * metrics.directNights) / 17199).toFixed(2)}%. This is a demo comparison, not
            measured annual direct share. Agency bookings are outside this system.
          </small>
        </article>
        <article className="stat">
          <h2>First reply</h2>
          <p className="metric">
            {metrics.medianReplyMinutes === null
              ? "None yet"
              : `${Math.round(metrics.medianReplyMinutes)} min`}
          </p>
          <p className="stat-label">Median first reply. Target under 30 min.</p>
          <p>
            {metrics.medianReplyMinutes === null
              ? "No replies have been marked sent yet."
              : "Measured from receipt to the first staff-marked reply."}
          </p>
          <small>
            Elapsed minutes, including out-of-hours time. A working-hours calendar is not
            configured.
          </small>
        </article>
        <article className="stat">
          <h2>Website overbookings</h2>
          <p className="metric">{metrics.overbookings}</p>
          <p className="stat-label">Nights over allotment. Target zero.</p>
          <p>A live database audit checks sold keys plus active holds against website allotment.</p>
          <small>Confirmed stays and live holds share the same database capacity rule.</small>
        </article>
      </section>
      <section className="stack">
        <div className="screen-head">
          <h2>Complaint & fallback alerts</h2>
          <p>
            Needs your attention. Complaints and failed AI processing are surfaced for a person to
            review.
          </p>
        </div>
        {alerts.length ? (
          <ul className="alert-list">
            {alerts.map((enquiry) => (
              <li key={enquiry.id}>
                <Link href={`/staff/inbox?lane=${enquiry.lane}&id=${enquiry.id}`}>
                  <strong>
                    {enquiry.id}, {enquiry.sender_name ?? "Guest"}
                  </strong>
                </Link>
                <span>{enquiry.raw_text.slice(0, 150)}</span>
                <small className="muted">{enquiry.ai_reason ?? "Review requested"}</small>
              </li>
            ))}
          </ul>
        ) : (
          <p className="well">No alerts in the current inbox.</p>
        )}
      </section>
      <Controls enabled={enabled} />
    </main>
  );
}
