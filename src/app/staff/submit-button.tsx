"use client";
import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pending = "Saving…",
}: {
  children: React.ReactNode;
  pending?: string;
}) {
  const status = useFormStatus();
  return (
    <button className="button" type="submit" disabled={status.pending}>
      {status.pending ? pending : children}
    </button>
  );
}
