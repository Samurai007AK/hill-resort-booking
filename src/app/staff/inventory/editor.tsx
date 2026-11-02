"use client";
import { useActionState } from "react";
import { updateInventory } from "./actions";

export function InventoryEditor({
  rooms,
  date,
}: {
  rooms: { id: string; name: string }[];
  date: string;
}) {
  const [state, action, pending] = useActionState(updateInventory, {
    message: "",
    needsMinimum: false,
  });
  return (
    <form className="card stack" action={action}>
      <div className="screen-head">
        <h2>Set the nights ahead.</h2>
        <p>Daily or bulk edit. Both dates are included. Changes apply together or not at all.</p>
      </div>
      <div className="form-grid five">
        <label>
          Room type
          <select name="roomTypeId" required>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          From
          <input name="from" type="date" defaultValue={date} required />
        </label>
        <label>
          Through
          <input name="to" type="date" defaultValue={date} required />
        </label>
        <label>
          Nightly tariff (INR)
          <input
            name="rate"
            type="number"
            min="1000"
            max="500000"
            step="1"
            defaultValue="7200"
            required
          />
        </label>
        <label>
          Website keys
          <input
            name="allotment"
            type="number"
            min="0"
            max="76"
            step="1"
            defaultValue="3"
            required
          />
        </label>
      </div>
      <label className="checkbox">
        <input type="checkbox" name="closed" /> Blackout: take these nights off sale
      </label>
      {state.message && (
        <p role="status" className="notice">
          {state.message}
        </p>
      )}
      <div className="actions">
        <button className="button" disabled={pending}>
          {pending ? "Saving…" : "Save selected nights"}
        </button>
        {state.needsMinimum && (
          <button className="button secondary" name="setMinimum" value="yes" disabled={pending}>
            Set to minimum
          </button>
        )}
      </div>
    </form>
  );
}
