import type { Enquiry } from "@/server/enquiry/service";

type DatePart = NonNullable<NonNullable<Enquiry["extracted"]>["check_in"]>;
function dateLabel(date: DatePart): string {
  const month = new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "UTC" }).format(
    new Date(Date.UTC(2000, date.month - 1, 1)),
  );
  return [date.day, month, date.year].filter((value) => value !== null).join(" ");
}
export function Facts({ enquiry }: { enquiry: Enquiry }) {
  const details = enquiry.extracted;
  if (!details) return <small>No details extracted yet.</small>;
  const guests =
    details.guests_total !== null
      ? `${details.guests_total} guests`
      : details.adults !== null
        ? `${details.adults} adults${details.children !== null ? ` · ${details.children} children` : ""}`
        : null;
  const stay = details.check_in
    ? `${dateLabel(details.check_in)}${details.check_out ? ` – ${dateLabel(details.check_out)}` : ""}`
    : null;
  const facts = [
    stay,
    guests,
    details.budget_inr !== null ? `Budget ₹${details.budget_inr.toLocaleString("en-IN")}` : null,
    details.room_type?.replaceAll("-", " "),
  ];
  if (!facts.some(Boolean)) return <small>Dates, guests and budget still need confirmation.</small>;
  return (
    <div className="actions" aria-label="Extracted enquiry details">
      {facts
        .filter((fact) => fact)
        .map((fact) => (
          <span className="badge" key={fact}>
            {fact}
          </span>
        ))}
    </div>
  );
}
