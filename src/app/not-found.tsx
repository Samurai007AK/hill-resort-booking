import Link from "next/link";
import { GuestHeader } from "@/server/guest/ui";

export default function NotFound() {
  return (
    <>
      <GuestHeader />
      <main className="container quiet-page">
        <h1>This page has wandered off.</h1>
        <p className="lead">Find a stay, explore our rooms, or send our team an enquiry.</p>
        <div className="actions">
          <Link className="button" href="/">
            Find a stay
          </Link>
          <Link className="text-link" href="/enquire">
            Contact the team
          </Link>
        </div>
      </main>
    </>
  );
}
