"use client";
import Link from "next/link";
import { GuestHeader } from "@/server/guest/ui";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <>
      <GuestHeader />
      <main className="container quiet-page">
        <h1>We couldn’t load this page.</h1>
        <p className="lead" role="alert">
          The connection may have paused. Your booking is confirmed only after a successful test
          payment.
        </p>
        <div className="actions">
          <button type="button" className="button" onClick={reset}>
            Try again
          </button>
          <Link href="/" className="text-link">
            Back to stays
          </Link>
        </div>
      </main>
    </>
  );
}
