# Assumptions

The brief does not say these things, so they are decided here. Each one is numbered so the code, tests and TDD can point at it. Append new ones at the end; never renumber.

**A1. Room types.** The 76 keys (64 rooms + 12 villas) split as: Estate Room 40, Plantation View Room 16, Family Suite 8 (rooms, 64 total); Coffee Villa 8, Pool Villa 4 (villas, 12 total).

**A2. Rates.** Base rate per key per night: Estate Room ₹7,200 Sunday–Thursday and ₹8,200 on Friday and Saturday nights; Plantation View Room ₹9,500; Family Suite ₹12,000; Coffee Villa ₹16,000; Pool Villa ₹22,000. The Estate Room sits on both sides of the ₹7,500 GST line on purpose. Staff can change any night's rate.

**A3. Website allotment.** About a third of each room type's keys are offered on the website each night by default (Estate 13, Plantation 5, Family 3, Coffee Villa 3, Pool Villa 1). The rest is agency stock this site never sells.

**A4. GST.** 5% when a night's tariff after discount is ₹7,500 or less, 18% above ₹7,500 (hotel accommodation rates in force since 22 September 2025). The slab is decided per night on the price of one key after the rate plan and any promo (when several keys are booked, the night's discounted amount divided by the number of keys). Shown per night.

**A5. Hold.** A guest's rooms are held for 10 minutes while they pay. An expired hold stops counting at once; nothing has to clean it up.

**A6. Rate plans.** Every room type has two: Flexible with breakfast (×1.00, free cancellation) and Non-refundable (×0.90).

**A7. Money.** All amounts are whole rupees. Each computed amount (tariff after plan, discount, GST) is rounded half up once, per night line. Totals are sums of the lines, so they always match what the guest sees.

**A8. Check-in 14:00, check-out 11:00.** A stay is 1 to 30 nights. Up to 4 keys of one room type per booking.

**A9. Form C.** Foreign guests' passport details (Form C) are collected at the front desk at check-in, not online. The site only says so on the confirmation.

**A10. ENQ-4411 year.** "14-16 Nov" with no year means the next 14–16 November that has not started yet. The draft reply asks the guest to confirm the dates.

**A11. Promo codes.** A percent promo takes that percent off every night. A flat promo takes a fixed amount off the whole stay (all keys), spread over the nights in proportion to their price, with the rounding remainder on the last night. Discounts apply before GST. The validity window (`valid_from`–`valid_to`) applies to the booking date. A promo use is counted when the payment confirms the booking.

**A12. Dates.** "Today" is the date in Asia/Kolkata. Demo data is created relative to today, 180 nights ahead.

**A13. Payments.** Payments are mocked by an in-app gateway, TestPay, which sends a callback signed with HMAC-SHA256. A repeated callback (same payment id) returns the stored answer. A second, different successful payment for a booking that is already paid is marked refund due. A failed payment leaves the hold as it was so the guest can retry.

**A14. Weekend.** Friday and Saturday nights are weekend nights.

**A15. Rate bounds.** Admin-set nightly rates must stay between INR 1,000 and INR 500,000. Allotment cannot exceed the physical keys of its room type; occupied nights cannot be deleted.

**A16. Display name.** Silver Oaks is a fictional demo name. Photos illustrate the stay and do not depict a verified property. Default system fonts avoid remote font downloads.

**A17. Limited promos.** Promo usage is claimed atomically when payment confirms. If competing held bookings exhaust a promo before payment, the losing paid booking becomes refund due and releases its rooms. The demo does not silently charge a different total.

**A18. Type.** Headings use one web face, Newsreader (light and regular, Latin only), which Next.js serves from the site itself; text is shown at once in a metric-matched serif fallback while it loads. Body text, forms and staff tables keep the system face. This replaces the font line in A16.
