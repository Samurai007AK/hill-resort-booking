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
    <div className="screen">
      <div className="screen-head">
        <h2>Rates & website allotment</h2>
        <p>The website sells only these keys. Held keys release automatically after ten minutes.</p>
      </div>
      <form className="filter-row">
        <label>
          Calendar from
          <input type="date" name="from" defaultValue={from} required />
        </label>
        <button className="button secondary" type="submit">
          View thirty nights
        </button>
      </form>
      {nights.length ? (
        <>
          <InventoryEditor rooms={rooms} date={from} />
          <div className="table-scroll">
            <table className="sticky-first">
              <caption>Thirty-night calendar, all rates before GST</caption>
              <thead>
                <tr>
                  <th scope="col">Room</th>
                  <th scope="col">Night</th>
                  <th scope="col" className="amount">
                    Tariff
                  </th>
                  <th scope="col" className="amount">
                    Allotment
                  </th>
                  <th scope="col" className="amount">
                    Sold
                  </th>
                  <th scope="col" className="amount">
                    Held
                  </th>
                  <th scope="col" className="amount">
                    Left
                  </th>
                  <th scope="col">State</th>
                </tr>
              </thead>
              <tbody>
                {nights.map((night) => (
                  <tr key={`${night.room_type_id}-${night.night}`}>
                    <th scope="row">{night.room_name}</th>
                    <td>{night.night}</td>
                    <td className="amount">₹{night.rate_inr.toLocaleString("en-IN")}</td>
                    <td className="amount">
                      {night.allotment} / {night.keys_total}
                    </td>
                    <td className="amount">{night.sold}</td>
                    <td className="amount">{night.held}</td>
                    <td className="amount">{night.remaining}</td>
                    <td>
                      <span
                        className={
                          night.closed ? "chip alert" : night.remaining ? "chip positive" : "chip"
                        }
                      >
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
        <div className="well stack">
          <h3>No published nights here.</h3>
          <p>Choose a date in the current demo calendar, or ask the GM to reset the demo.</p>
        </div>
      )}
    </div>
  );
}
