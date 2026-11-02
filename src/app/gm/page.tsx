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
    <main className="page stack">
      <header>
        <div className="eyebrow">THE GENERAL MANAGER’S VIEW</div>
        <h1>The estate, at a glance.</h1>
        <p>Three goals: more direct stays, thoughtful replies, and no overbooked nights.</p>
        <nav className="actions">
          <Link className="button secondary" href="/staff">
            Open staff tools
          </Link>
          <Link className="button secondary" href="/">
            Guest website
          </Link>
          <form action={logout}>
            <button className="button secondary">Sign out</button>
          </form>
        </nav>
      </header>
      <section className="grid three" aria-label="Success metrics">
        <article className="card stack">
          <div className="eyebrow">DIRECT SHARE · TARGET 12% → 20%</div>
          <div className="metric">{metrics.directNights} nights</div>
          <h3>Booked direct in this demo</h3>
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
        <article className="card stack">
          <div className="eyebrow">FIRST REPLY · TARGET UNDER 30 MIN</div>
          <div className="metric">
            {metrics.medianReplyMinutes === null
              ? "—"
              : `${Math.round(metrics.medianReplyMinutes)} min`}
          </div>
          <h3>Median first reply</h3>
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
        <article className="card stack">
          <div className="eyebrow">WEBSITE OVERBOOKINGS · TARGET ZERO</div>
          <div className="metric">{metrics.overbookings}</div>
          <h3>Nights over allotment</h3>
          <p>A live database audit checks sold keys plus active holds against website allotment.</p>
          <small>Confirmed stays and live holds share the same database capacity rule.</small>
        </article>
      </section>
      <section className="card stack">
        <div>
          <div className="eyebrow">NEEDS YOUR ATTENTION</div>
          <h2>Complaint & fallback alerts</h2>
          <p>Complaints and failed AI processing are surfaced for a person to review.</p>
        </div>
        {alerts.length ? (
          <ul className="stack">
            {alerts.map((enquiry) => (
              <li key={enquiry.id}>
                <Link href={`/staff/inbox?lane=${enquiry.lane}&id=${enquiry.id}`}>
                  <strong>
                    {enquiry.id} · {enquiry.sender_name ?? "Guest"}
                  </strong>{" "}
                  — {enquiry.raw_text.slice(0, 150)}
                </Link>
                <br />
                <small>{enquiry.ai_reason ?? "Review requested"}</small>
              </li>
            ))}
          </ul>
        ) : (
          <p>No alerts in the current inbox.</p>
        )}
      </section>
      <Controls enabled={enabled} />
    </main>
  );
}
