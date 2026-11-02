"use client";

import { useActionState } from "react";
import { testPayment } from "./actions";

export function PaymentForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(testPayment, undefined);
  return (
    <form action={action} className="stack">
      <input type="hidden" name="id" value={id} />
      <button className="button" type="submit" name="mode" value="pay" disabled={pending}>
        {pending ? "Processing test payment…" : "Pay successfully"}
      </button>
      <div className="button-row">
        <button
          className="button secondary"
          type="submit"
          name="mode"
          value="fail"
          disabled={pending}
        >
          Simulate failed payment
        </button>
        <button
          className="button secondary"
          type="submit"
          name="mode"
          value="late"
          disabled={pending}
        >
          Pay after hold expires
        </button>
      </div>
      <p className="muted small">
        The late-payment option expires this hold first. If a room is still free the payment is
        honoured; otherwise the booking is marked refund due.
      </p>
      {state?.error && (
        <p className="notice" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
