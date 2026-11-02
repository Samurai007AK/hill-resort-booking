"use client";
import { useActionState } from "react";
import { updatePromo } from "./actions";

export type Promo = {
  code: string;
  kind: "percent" | "flat";
  value: number;
  valid_from: string;
  valid_to: string;
  min_nights: number;
  max_uses: number | null;
  uses: number;
  active: boolean;
};
export function PromoEditor({ promo, today }: { promo?: Promo; today: string }) {
  const [message, action, pending] = useActionState(updatePromo, "");
  return (
    <form action={action} className="card stack">
      <h3>{promo ? promo.code : "Create a promo"}</h3>
      {promo && (
        <p className="meta">
          <span>{promo.uses} recorded uses</span>
          <span className={promo.active ? "chip positive" : "chip"}>
            {promo.active ? "Active" : "Paused"}
          </span>
        </p>
      )}
      <div className="form-grid">
        <label>
          Code
          <input
            name="code"
            pattern="[A-Za-z0-9_-]{2,32}"
            maxLength={32}
            defaultValue={promo?.code}
            readOnly={Boolean(promo)}
            required
          />
        </label>
        <label>
          Discount
          <select name="kind" defaultValue={promo?.kind ?? "percent"}>
            <option value="percent">Percent</option>
            <option value="flat">INR per stay</option>
          </select>
        </label>
        <label>
          Amount
          <input
            name="value"
            type="number"
            min="1"
            max="500000"
            step="1"
            defaultValue={promo?.value ?? 10}
            required
          />
        </label>
        <label>
          Valid from
          <input name="validFrom" type="date" defaultValue={promo?.valid_from ?? today} required />
        </label>
        <label>
          Valid through
          <input name="validTo" type="date" defaultValue={promo?.valid_to ?? today} required />
        </label>
        <label>
          Minimum nights
          <input
            name="minNights"
            type="number"
            min="1"
            max="30"
            defaultValue={promo?.min_nights ?? 1}
            required
          />
        </label>
        <label>
          Maximum uses (blank for unlimited)
          <input
            name="maxUses"
            type="number"
            min="1"
            step="1"
            defaultValue={promo?.max_uses ?? ""}
          />
        </label>
      </div>
      <label className="checkbox">
        <input name="active" type="checkbox" defaultChecked={promo?.active ?? true} /> Active
      </label>
      {message && <p role="status">{message}</p>}
      <button className="button" disabled={pending}>
        {pending ? "Saving…" : "Save promo"}
      </button>
    </form>
  );
}
