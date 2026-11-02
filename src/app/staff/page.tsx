import Link from "next/link";

const tools = [
  {
    href: "/staff/inbox",
    title: "Conversations",
    text: "Review enquiries, check drafts and make sure every guest reaches the right team.",
    action: "Open inbox",
  },
  {
    href: "/staff/inventory",
    title: "The next stay",
    text: "Set nightly tariffs, website allotments and dates off sale. Existing guests stay protected.",
    action: "Manage inventory",
  },
  {
    href: "/staff/bookings",
    title: "Arrivals",
    text: "See reservations and download the daily arrival list for your reservation system.",
    action: "View bookings",
  },
];

export default function StaffPage() {
  return (
    <section aria-label="Operations">
      <ul className="tool-list">
        {tools.map((tool) => (
          <li key={tool.href}>
            <Link href={tool.href}>
              <h2>{tool.title}</h2>
              <p>{tool.text}</p>
              <span className="text-link">{tool.action}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
