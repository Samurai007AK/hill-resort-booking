import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import Link from "next/link";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  return (
    <main className="page narrow">
      <div className="grid">
        <section className="stack">
          <Link href="/" className="brand">
            SILVER OAKS<span>COFFEE ESTATE · CHIKKAMAGALURU</span>
          </Link>
          <p className="eyebrow">A WARM WELCOME BACK</p>
          <h1>
            Behind every
            <br />
            <em>unhurried stay.</em>
          </h1>
          <p className="muted">Your guests, conversations and calendar, all in one quiet place.</p>
          <div className="notice small">
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
        <section className="card">
          <h2>Sign in</h2>
          <p className="muted">For guests, the resort team, and the GM.</p>
          <LoginForm next={typeof next === "string" ? next : undefined} />
        </section>
      </div>
    </main>
  );
}
