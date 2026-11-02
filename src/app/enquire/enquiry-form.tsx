"use client";

import { useRef, useState } from "react";
import Link from "next/link";

export default function EnquiryForm({ today }: { today: string }) {
  const [kind, setKind] = useState("contact");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const key = useRef<string | null>(null);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    const form = new FormData(event.currentTarget);
    key.current ??= crypto.randomUUID();
    try {
      const response = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderName: form.get("senderName"),
          contact: form.get("contact"),
          text: form.get("text"),
          enquiryType: kind,
          eventDate: form.get("eventDate") ?? "",
          guests: form.get("guests") ?? "",
          budget: form.get("budget") ?? "",
          consent: form.get("consent") === "on",
          idempotencyKey: key.current,
        }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        setError(
          result &&
            typeof result === "object" &&
            "error" in result &&
            typeof result.error === "string"
            ? result.error
            : "We couldn't save your enquiry. Please try again.",
        );
        return;
      }
      if (result && typeof result === "object" && "id" in result && typeof result.id === "string")
        setSuccess(result.id);
      else setError("The response was incomplete. Please try again.");
    } catch {
      setError(
        "Connection interrupted. Please try again; repeating the form won't create another enquiry.",
      );
    } finally {
      setPending(false);
    }
  }
  if (success)
    return (
      <div className="card stack" role="status">
        <h2>Enquiry received</h2>
        <p className="lead">Thank you. We’ll take it from here.</p>
        <p>
          Your reference is <strong>{success}</strong>. Our team will review your enquiry and reply
          using the contact details you shared.
        </p>
        <Link className="button" href="/">
          Explore the estate
        </Link>
      </div>
    );
  return (
    <form className="card stack" onSubmit={submit}>
      <label>
        What are you planning?
        <select value={kind} onChange={(event) => setKind(event.target.value)}>
          <option value="contact">A stay or a general question</option>
          <option value="wedding">A wedding or celebration</option>
          <option value="offsite">An offsite or team gathering</option>
        </select>
      </label>
      <div className="form-grid">
        <label>
          Your name
          <input name="senderName" autoComplete="name" required minLength={2} maxLength={100} />
        </label>
        <label>
          Email or phone
          <input name="contact" autoComplete="email" required minLength={8} maxLength={200} />
        </label>
      </div>
      {kind !== "contact" && (
        <div className="form-grid three">
          <label>
            Preferred event date
            <input name="eventDate" type="date" min={today} />
          </label>
          <label>
            Expected guests
            <input name="guests" type="number" min={1} max={10000} />
          </label>
          <label>
            Indicative total budget (₹)
            <input name="budget" type="number" min={1} max={1000000000} />
          </label>
        </div>
      )}
      <label>
        Tell us a little more
        <textarea
          name="text"
          required
          minLength={5}
          maxLength={10000}
          rows={6}
          placeholder={
            kind === "contact"
              ? "Your dates, adults and children, preferred room, or question…"
              : "Tell us about your event, accommodation and meeting or celebration needs…"
          }
        />
      </label>
      <label className="consent">
        <input name="consent" type="checkbox" required />
        <span>
          I consent to the resort using these details to respond to my enquiry.{" "}
          <Link href="/privacy">Privacy notice</Link>
        </span>
      </label>
      <p className="muted">
        Please leave passport and government ID details out of this form. Replies are reviewed by
        our team before sending.
      </p>
      {error && (
        <p role="alert" className="alert">
          {error}
        </p>
      )}
      <button className="button" type="submit" disabled={pending}>
        {pending ? "Sending your enquiry…" : "Send enquiry"}
      </button>
    </form>
  );
}
