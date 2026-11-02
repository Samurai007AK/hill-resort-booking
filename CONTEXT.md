# Domain glossary

Words used in code, UI and docs. One meaning each.

**Key** — one lettable unit (a room or a villa). The resort has 76 keys: 64 rooms + 12 villas.

**Room type** — a group of identical keys sold as one product (Estate Room, Plantation View Room, Family Suite, Coffee Villa, Pool Villa). Table `room_types`.

**Night** — the unit of sale: one key for the night starting on a date. A stay from 14 Nov to 16 Nov is two nights (14th and 15th). The check-out date is never a night of the stay.

**Allotment** — how many keys of a room type the website may sell on a night. Set by staff per room type per night (`inventory_night.allotment`).

**Website allotment vs agency stock** — the website sells only its allotment. The remaining keys are agency stock, sold through travel agencies and the reservation system, and this site never touches them. "Never overbooks" means: website reservations on a night never exceed the website allotment.

**Closed night (blackout)** — a night staff have taken off sale for a room type (`inventory_night.closed`). A closed night has an effective allotment of 0. A night with no inventory row is also not for sale.

**Hold** — a reservation in status `held`: the guest is at the payment step. It counts against the allotment until `expires_at` (10 minutes). After that it stops counting by itself; no job cleans it up.

**Reservation** — one booking of `qty` keys of one room type for consecutive nights. Status `held` → `confirmed` (paid), or `cancelled`, or `refund_due` (money arrived but no room could be given). Identified to guests by `ref` (e.g. `CS-7K3P`).

**Active** — the keys counted against a night: confirmed reservations plus holds that have not expired. The database refuses any change that makes active exceed the effective allotment (SQLSTATE 23514).

**Rate** — the base price of one key for one night, set per room type per night (`inventory_night.rate_inr`).

**Rate plan** — the terms a guest picks for a room type, as a factor on the rate: Flexible with breakfast ×1.00, Non-refundable ×0.90.

**Tariff** — the price of one key for one night after the rate plan factor and before tax. The GST slab is chosen on the tariff after any promo discount.

**GST slab** — the tax rate for a night: 5% when that night's discounted tariff is ₹7,500 or less, 18% above. Worked out per night.

**Promo** — a code that lowers the price before tax: a percent off every night, or a flat amount off the whole stay spread across its nights. Has a validity window, minimum nights, a use limit and an on/off switch.

**Payment** — a signed callback from the mock gateway (TestPay). Keyed by the gateway's `payment_id`, so a repeated callback gets the stored answer and changes nothing.

**Late payment** — a payment that arrives after its hold expired. Honoured (reservation confirmed, marked `late`) if the room is still free, otherwise the reservation becomes `refund_due`.

**Enquiry** — one incoming message from a guest or planner, e.g. `ENQ-4410`.

**Source** — where an enquiry came in: `web` (contact form), `email` (forwarded), `whatsapp` (simulated), `event_form` (structured wedding/event form).

**Category** — what an enquiry is about: room, wedding, offsite, complaint, other.

**Lane** — the inbox tab an enquiry sits in: Unsorted, Rooms, Events, Complaints. Unsorted holds anything the AI was unsure about, where the AI and the keyword rules disagree, or when the AI was unavailable. The GM sees Unsorted.

**Owner team** — who must reply: reservations (rooms), sales (weddings and offsites), GM (complaints).

**Draft** — a reply prepared for staff to edit and send themselves. Never sent automatically. Prices, dates and availability in a draft come from the rate table, never from the AI.

**GM alert** — a flag that puts an enquiry in front of the GM: raised for every complaint (AI or keyword rule says so) and whenever the AI call failed.
