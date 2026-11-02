"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="card stack" role="alert">
      <h2>We couldn’t open this view.</h2>
      <p>Your changes may already be saved. Refresh to check the current state.</p>
      <button className="button" onClick={reset}>
        Try again
      </button>
    </section>
  );
}
