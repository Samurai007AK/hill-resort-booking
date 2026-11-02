import Link from "next/link";
import { z } from "zod";
import { getEnquiry, listEnquiries } from "@/server/enquiry/service";
import { RoutingTools, RerunButton } from "./routing-tools";
import { Draft } from "./draft";
import { Facts } from "./facts";
import { Simulator } from "./simulator";

const lanes = [
  { id: "unsorted", label: "Unsorted" },
  { id: "rooms", label: "Rooms" },
  { id: "events", label: "Events" },
  { id: "complaints", label: "Complaints" },
] as const;
export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ lane?: string; id?: string }>;
}) {
  const params = await searchParams;
  const lane = z
    .enum(["unsorted", "rooms", "events", "complaints"])
    .catch("unsorted")
    .parse(params.lane);
  const all = await listEnquiries();
  const enquiries = all.filter((enquiry) => enquiry.lane === lane);
  const id = z
    .string()
    .regex(/^ENQ-\d+$/)
    .safeParse(params.id);
  const detail = id.success ? await getEnquiry(id.data) : null;
  const selected = detail?.enquiry;
  return (
    <div className="stack">
      <div>
        <span className="eyebrow">EVERY CONVERSATION, ACCOUNTED FOR</span>
        <h2>The enquiry inbox</h2>
        <p>
          Uncertain messages wait for a person. Complaints always alert the GM. Drafts never send
          themselves.
        </p>
      </div>
      <nav className="tabs" aria-label="Enquiry lanes">
        {lanes.map((item) => (
          <Link
            key={item.id}
            aria-current={lane === item.id ? "page" : undefined}
            href={`/staff/inbox?lane=${item.id}`}
          >
            {item.label}{" "}
            <span className="badge">
              {all.filter((enquiry) => enquiry.lane === item.id).length}
            </span>
          </Link>
        ))}
      </nav>
      <div className="grid inbox-grid">
        <section className="stack" aria-label={`${lane} enquiries`}>
          {enquiries.length ? (
            enquiries.map((enquiry) => (
              <Link
                key={enquiry.id}
                className="card stack"
                href={`/staff/inbox?lane=${lane}&id=${enquiry.id}`}
                aria-current={selected?.id === enquiry.id ? "true" : undefined}
              >
                <div className="actions">
                  <strong>{enquiry.id}</strong>
                  <span className="badge">{enquiry.source.replace("_", " ")}</span>
                  {enquiry.gm_alert && <span className="badge alert">GM alert</span>}
                </div>
                <h3>{enquiry.sender_name ?? "Guest enquiry"}</h3>
                <p>
                  {enquiry.raw_text.length > 180
                    ? `${enquiry.raw_text.slice(0, 180)}…`
                    : enquiry.raw_text}
                </p>
                <Facts enquiry={enquiry} />
                <small>
                  {enquiry.category ?? "Needs review"} · {enquiry.owner_team ?? "Unassigned"} ·{" "}
                  {enquiry.ai_model?.startsWith("demo fixture")
                    ? `Demo fixture${enquiry.ai_status === "off" ? " · AI off" : enquiry.ai_status === "fallback" ? " · AI unavailable" : ""}`
                    : enquiry.ai_status === "ok"
                      ? "AI checked"
                      : enquiry.ai_status === "off"
                        ? "AI off"
                        : "AI unavailable"}
                </small>
                {enquiry.ai_reason && <small>{enquiry.ai_reason}</small>}
              </Link>
            ))
          ) : (
            <div className="card">
              <h3>A clear lane.</h3>
              <p>No enquiries here. Try another lane or simulate a message below.</p>
            </div>
          )}
        </section>
        <aside className="card stack" aria-label="Enquiry detail">
          {selected ? (
            <>
              <div className="actions">
                <span className="eyebrow">{selected.id}</span>
                <span className="badge">
                  {selected.draft_status === "sent" ? "Reply marked sent" : "Awaiting review"}
                </span>
              </div>
              <h2>{selected.sender_name ?? "Guest enquiry"}</h2>
              <p>{selected.contact}</p>
              <blockquote>{selected.raw_text}</blockquote>
              <div className="notice stack">
                <strong>Extracted details</strong>
                <Facts enquiry={selected} />
                <small>
                  Owner: {selected.owner_team ?? "Unassigned"}. Confirm dates and missing details
                  before replying.
                </small>
              </div>
              <RoutingTools
                key={`move-${selected.id}-${selected.revision}`}
                id={selected.id}
                revision={selected.revision}
                lane={selected.lane}
              />
              {selected.draft ? (
                <Draft
                  key={`draft-${selected.id}-${selected.revision}`}
                  id={selected.id}
                  revision={selected.revision}
                  text={selected.draft}
                  sent={selected.draft_status === "sent"}
                />
              ) : (
                <p>No draft is available yet. Review the message and rerun classification.</p>
              )}
              <details>
                <summary>How the routing was decided</summary>
                <div className="stack">
                  <p>{selected.ai_reason}</p>
                  <p>
                    Model: {selected.ai_model ?? "Keyword fallback"} · confidence:{" "}
                    {selected.confidence ?? "unavailable"}
                  </p>
                  <h4>Redacted text used by the router</h4>
                  <pre>{selected.redacted_text}</pre>
                  <h4>Stored response</h4>
                  <pre>{JSON.stringify(selected.ai_response ?? selected.extracted, null, 2)}</pre>
                  <RerunButton
                    key={`rerun-${selected.id}-${selected.revision}`}
                    id={selected.id}
                    revision={selected.revision}
                    sent={selected.draft_status === "sent"}
                  />
                </div>
              </details>
              <details open>
                <summary>Audit timeline</summary>
                {detail.events.length ? (
                  <ol className="timeline">
                    {detail.events.map((event, index) => (
                      <li key={index}>
                        <strong>{event.kind}</strong> · {event.actor}
                        <br />
                        <small>
                          {new Date(event.at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                        </small>
                        <pre>{JSON.stringify(event.detail)}</pre>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p>No events recorded.</p>
                )}
              </details>
            </>
          ) : (
            <>
              <h3>{id.success ? "Enquiry unavailable" : "A considered reply starts here."}</h3>
              <p>
                {id.success
                  ? "This item may have been removed by a demo reset. Select another enquiry."
                  : "Choose a conversation to inspect its details, review the draft and see the full routing trail."}
              </p>
            </>
          )}
        </aside>
      </div>
      <Simulator />
    </div>
  );
}
