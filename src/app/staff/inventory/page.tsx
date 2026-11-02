import { z } from "zod";
import { todayIST } from "@/domain/dates";
import { getInventory } from "@/server/admin/service";
import { InventoryEditor } from "./editor";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const params = await searchParams;
  const date = z.iso.date().safeParse(params.from);
  const from = date.success ? date.data : todayIST();
  const nights = await getInventory(from);
  const rooms = [
    ...new Map(
      nights.map((night) => [
        night.room_type_id,
        { id: night.room_type_id, name: night.room_name },
      ]),
    ).values(),
  ];
  return (
    <div className="stack">
      <div>
        <span className="eyebrow">INVENTORY</span>
        <h2>Rates & website allotment</h2>
        <p>The website sells only these keys. Held keys release automatically after ten minutes.</p>
      </div>
      <form className="actions">
        <label>
          Calendar from
          <input type="date" name="from" defaultValue={from} required />
        </label>
        <button className="button secondary">View thirty nights</button>
      </form>
      {nights.length ? (
        <>
          <InventoryEditor rooms={rooms} date={from} />
          <div className="table-scroll">
            <table>
              <caption>Thirty-night calendar · all rates before GST</caption>
              <thead>
                <tr>
                  <th>Room</th>
                  <th>Night</th>
                  <th>Tariff</th>
                  <th>Allotment</th>
                  <th>Sold</th>
                  <th>Held</th>
                  <th>Left</th>
                  <th>State</th>
                </tr>
              </thead>
              <tbody>
                {nights.map((night) => (
                  <tr key={`${night.room_type_id}-${night.night}`}>
                    <th scope="row">{night.room_name}</th>
                    <td>{night.night}</td>
                    <td>₹{night.rate_inr.toLocaleString("en-IN")}</td>
                    <td>
                      {night.allotment} / {night.keys_total}
                    </td>
                    <td>{night.sold}</td>
                    <td>{night.held}</td>
                    <td>{night.remaining}</td>
                    <td>
                      <span className="badge">
                        {night.closed ? "Off sale" : night.remaining ? "Open" : "Full"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="card">
          <h3>No published nights here.</h3>
          <p>Choose a date in the current demo calendar, or ask the GM to reset the demo.</p>
        </div>
      )}
    </div>
  );
}
