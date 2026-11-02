"use client";
import { useActionState } from "react";
import { resetDemo, toggleAi } from "./actions";

export function Controls({ enabled }: { enabled: boolean }) {
  const [aiMessage, aiAction, aiPending] = useActionState(toggleAi, "");
  const [resetMessage, resetAction, resetPending] = useActionState(resetDemo, "");
  return (
    <div className="grid">
      <form className="card stack" action={aiAction}>
        <div className="eyebrow">A HUMAN ALWAYS HAS THE LAST WORD</div>
        <h2>AI routing is {enabled ? "on" : "off"}.</h2>
        <p>
          Switch it off to try the same inbox with keyword fallback. Drafts still wait for staff
          approval.
        </p>
        <input type="hidden" name="enabled" value={enabled ? "no" : "yes"} />
        <button className="button" disabled={aiPending}>
          {aiPending ? "Saving…" : enabled ? "Turn AI off" : "Turn AI on"}
        </button>
        {aiMessage && <p role="status">{aiMessage}</p>}
      </form>
      <form className="card stack" action={resetAction}>
        <div className="eyebrow">A FRESH START FOR THE DEMO</div>
        <h2>Restore the estate.</h2>
        <p>
          Restores sample bookings, rates, promo codes and enquiries with fresh dates. It preserves
          every user account.
        </p>
        <label className="checkbox">
          <input name="confirm" type="checkbox" required /> Replace the shared demo data
        </label>
        <button className="button secondary" disabled={resetPending}>
          {resetPending ? "Restoring…" : "Reset demo"}
        </button>
        {resetMessage && <p role="status">{resetMessage}</p>}
      </form>
    </div>
  );
}
