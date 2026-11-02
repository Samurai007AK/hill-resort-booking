"use client";
import { useState, useTransition } from "react";
import { markSent } from "./actions";

export function Draft({
  id,
  text,
  sent,
  revision,
}: {
  id: string;
  text: string;
  sent: boolean;
  revision: number;
}) {
  const [status, setStatus] = useState("");
  const [stale, setStale] = useState(false);
  const [pending, start] = useTransition();
  function copyAndMark() {
    start(async () => {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        setStatus(
          "Clipboard access failed. Select and copy the draft, then use “Mark copied & sent” below.",
        );
        return;
      }
      const result = await markSent(id, revision);
      setStale(!result.ok);
      setStatus(result.ok ? result.message : `Do not send the copied text yet. ${result.message}`);
    });
  }
  return (
    <section className="stack">
      <h3>A reply, ready for your review.</h3>
      <p>Check the dates and details before copying. Nothing is sent automatically.</p>
      <textarea aria-label="Reply draft" value={text} readOnly rows={9} />
      <div className="actions">
        <button type="button" className="button" disabled={pending || stale} onClick={copyAndMark}>
          {pending ? "Recording…" : sent ? "Copy reply again" : "Copy & mark sent"}
        </button>
        <button
          type="button"
          className="button secondary"
          disabled={pending || stale}
          onClick={() =>
            start(async () => {
              const result = await markSent(id, revision);
              setStale(!result.ok);
              setStatus(result.message);
            })
          }
        >
          Mark copied & sent
        </button>
      </div>
      {status && <p role={stale ? "alert" : "status"}>{status}</p>}
      {stale && (
        <button className="button secondary" type="button" onClick={() => window.location.reload()}>
          Reload & review latest draft
        </button>
      )}
    </section>
  );
}
