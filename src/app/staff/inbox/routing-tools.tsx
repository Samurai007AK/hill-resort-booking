"use client";
import { useActionState } from "react";
import { moveTo, rerun } from "./actions";

const initial = { message: "", reload: false };
const lanes = [
  { id: "unsorted", label: "Unsorted" },
  { id: "rooms", label: "Rooms" },
  { id: "events", label: "Events" },
  { id: "complaints", label: "Complaints" },
];
function ReloadButton() {
  return (
    <button className="button secondary" type="button" onClick={() => window.location.reload()}>
      Reload & review latest enquiry
    </button>
  );
}
export function RoutingTools({
  id,
  revision,
  lane,
}: {
  id: string;
  revision: number;
  lane: string;
}) {
  const [state, action, pending] = useActionState(moveTo, initial);
  return (
    <form action={action} className="stack">
      <input name="id" type="hidden" value={id} />
      <input name="revision" type="hidden" value={revision} />
      <div className="filter-row">
        <label>
          Move to
          <select name="lane" defaultValue={lane}>
            {lanes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <button className="button" disabled={pending || state.reload}>
          {pending ? "Moving…" : "Move enquiry"}
        </button>
      </div>
      {state.message && <p role={state.reload ? "alert" : "status"}>{state.message}</p>}
      {state.reload && <ReloadButton />}
    </form>
  );
}
export function RerunButton({
  id,
  revision,
  sent,
}: {
  id: string;
  revision: number;
  sent: boolean;
}) {
  const [state, action, pending] = useActionState(rerun, initial);
  return (
    <form action={action} className="stack">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="revision" value={revision} />
      {sent ? (
        <p>This reply is already marked sent. Its reviewed draft is preserved.</p>
      ) : (
        <button className="button" disabled={pending || state.reload}>
          {pending ? "Checking again…" : "Re-run classification"}
        </button>
      )}
      {state.message && <p role={state.reload ? "alert" : "status"}>{state.message}</p>}
      {state.reload && <ReloadButton />}
    </form>
  );
}
