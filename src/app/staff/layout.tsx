import Link from "next/link";
import { requireRole } from "@/server/auth";
import { logout } from "@/app/login/actions";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole("staff", "gm");
  return (
    <main className="page stack">
      <header className="stack">
        <div className="eyebrow">ESTATE OPERATIONS</div>
        <h1>A little more room to care.</h1>
        <p>Welcome, {session.name}. Your rates, guests and conversations in one place.</p>
      </header>
      <nav className="tabs" aria-label="Staff tools">
        <Link href="/staff">Overview</Link>
        <Link href="/staff/inventory">Rates & allotment</Link>
        <Link href="/staff/bookings">Bookings</Link>
        <Link href="/staff/promos">Promo codes</Link>
        <Link href="/staff/inbox">Enquiry inbox</Link>
        {session.role === "gm" && <Link href="/gm">GM dashboard</Link>}
        <form action={logout}>
          <button className="button secondary">Sign out</button>
        </form>
      </nav>
      {children}
    </main>
  );
}
