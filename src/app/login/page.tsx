import type { Metadata } from "next";
import { GuestHeader } from "@/server/guest/ui";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  return (
    <>
      <GuestHeader />
      <main className="container page">
        <div className="login-grid">
          <section className="stack">
            <h1>
              Behind every
              <br />
              unhurried stay.
            </h1>
            <p className="lead muted">
              Your guests, conversations and calendar, all in one quiet place.
            </p>
            <div className="well stack small">
              <strong>Try the demonstration</strong>
              <p>
                Use reservations@demo.in, sales@demo.in, gm@demo.in, or guest@demo.in. The password
                for each is <strong>demo1234</strong>.
              </p>
              <p>
                All payments and incoming messages are simulated. Demo reset is available to the GM.
              </p>
            </div>
          </section>
          <section className="card stack">
            <h2>Sign in</h2>
            <p className="muted">For guests, the resort team, and the GM.</p>
            <LoginForm next={typeof next === "string" ? next : undefined} />
          </section>
        </div>
      </main>
    </>
  );
}
