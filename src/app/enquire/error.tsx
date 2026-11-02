"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="page stack">
      <h1>We couldn’t open the enquiry form.</h1>
      <p>Please try again in a moment.</p>
      <button className="button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
