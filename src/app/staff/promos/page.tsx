import { pool } from "@/db/pool";
import { todayIST } from "@/domain/dates";
import { PromoEditor, type Promo } from "./editor";

export default async function PromosPage() {
  const { rows } = await pool.query<Promo>("SELECT * FROM promo ORDER BY active DESC,code");
  const today = todayIST();
  return (
    <div className="screen">
      <div className="screen-head">
        <h2>Promo codes</h2>
        <p>
          Direct booking benefits. Discounts apply to each night before GST. Existing booking quotes
          stay fixed.
        </p>
      </div>
      {!rows.length && <p className="notice">No promos yet. Add the first one below.</p>}
      <div className="promo-list">
        {rows.map((promo) => (
          <PromoEditor key={promo.code} promo={promo} today={today} />
        ))}
        <PromoEditor today={today} />
      </div>
    </div>
  );
}
