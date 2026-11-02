import Link from "next/link";
import { requireRole } from "@/server/auth";
import { logout } from "@/app/login/actions";
import { NavLink } from "./nav-link";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole("staff", "gm");
  return (
    <main className="container app">
      <header className="app-head">
        <div className="stack">
          <Link href="/" className="wordmark" aria-label="Silver Oaks, guest website">
            Silver Oaks
          </Link>
          <h1>Estate operations</h1>
        </div>
        <p>Welcome, {session.name}. Your rates, guests and conversations in one place.</p>
      </header>
      <nav className="tabs" aria-label="Staff tools">
        <NavLink href="/staff">Overview</NavLink>
        <NavLink href="/staff/inventory">Rates & allotment</NavLink>
        <NavLink href="/staff/bookings">Bookings</NavLink>
        <NavLink href="/staff/promos">Promo codes</NavLink>
        <NavLink href="/staff/inbox">Enquiry inbox</NavLink>
        {session.role === "gm" && <NavLink href="/gm">GM dashboard</NavLink>}
        <form action={logout}>
          <button className="button secondary" type="submit">
            Sign out
          </button>
        </form>
      </nav>
      {children}
    </main>
  );
}
