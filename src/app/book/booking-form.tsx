"use client";

import { useActionState } from "react";
import Link from "next/link";
import { bookStay } from "./actions";

type Props = {
  roomTypeId: string;
  ratePlanId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  childCount: number;
  qty: number;
  idempotencyKey: string;
  promoCode?: string;
};

export function BookingForm(props: Props) {
  const [state, action, pending] = useActionState(bookStay, undefined);
  return (
    <form action={action} className="card stack">
      <h2>A few details, then you’re on your way.</h2>
      {Object.entries(props)
        .filter(([key]) => key !== "promoCode")
        .map(([key, value]) => (
          <input
            key={key}
            type="hidden"
            name={key === "childCount" ? "children" : key}
            value={String(value)}
          />
        ))}
      <label>
        Full name
        <input name="guestName" autoComplete="name" minLength={2} maxLength={100} required />
      </label>
      <label>
        Email address
        <input type="email" name="guestEmail" autoComplete="email" maxLength={200} required />
      </label>
      <label>
        Mobile number
        <input
          type="tel"
          name="guestPhone"
          autoComplete="tel"
          placeholder="+91 98450 12345"
          maxLength={30}
          required
        />
        <small className="hint">International guests: include your + country code.</small>
      </label>
      <label>
        Promo code <span className="muted">(optional)</span>
        <input
          name="promoCode"
          defaultValue={props.promoCode}
          maxLength={32}
          autoCapitalize="characters"
          placeholder="e.g. MONSOON15"
        />
      </label>
      <label className="checkbox-label">
        <input type="checkbox" name="consent" required />
        <span>
          I agree to the use of my contact and stay details to manage this booking, as described in
          the{" "}
          <Link href="/privacy" target="_blank">
            privacy notice
          </Link>
          .
        </span>
      </label>
      <p className="muted small">
        No passport details or card numbers are collected. Foreign guests provide Form C information
        at check-in.
      </p>
      {state?.error && (
        <p className="notice" role="alert">
          {state.error}
        </p>
      )}
      <button type="submit" className="button" disabled={pending}>
        {pending ? "Holding your room…" : "Hold room & continue to TestPay"}
      </button>
      <p className="muted small">
        Nothing is charged. This is a demonstration booking with simulated payment.
      </p>
    </form>
  );
}
