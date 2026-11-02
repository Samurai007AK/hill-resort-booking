"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="page card stack" role="alert">
      <h2>The dashboard is temporarily unavailable.</h2>
      <p>We couldn’t load the live figures. Try again before making changes.</p>
      <button className="button" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
