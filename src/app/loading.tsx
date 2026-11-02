import { GuestHeader } from "@/server/guest/ui";

export default function Loading() {
  return (
    <>
      <GuestHeader />
      <main className="container quiet-page" role="status" aria-live="polite">
        <h1>A moment in the hills.</h1>
        <p className="lead">We’re checking the latest details for you.</p>
        <div className="skeleton" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </main>
    </>
  );
}
