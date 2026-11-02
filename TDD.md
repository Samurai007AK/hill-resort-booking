# Silver Oaks: direct booking and enquiry routing

GitHub: https://github.com/Samurai007AK/hill-resort-booking

Live link: not yet deployed. The local implementation and submission package are prepared for hosting review. A public URL must be added after deployment.

Technical design document | Isocode brief 1 | 2 November 2026

## 1. The product and the trade-off

Silver Oaks is a fictional coffee-estate resort with 76 keys in Chikkamagaluru. Guests search real nightly stock, compare rate plans, see tax before entering details, and complete a simulated payment. Reservations and sales staff manage website inventory and enquiries. The GM sees operational metrics, complaint alerts, and uncertainty that needs a person.

The design centres on two promises a reviewer can check: bookings cannot exceed the website allotment, and a draft cannot invent its own price. Stock is enforced by Postgres rather than a page-level availability check. Model prose is restricted to approved slots, whose values come from the rate table and the same availability view used by the website.

The brief gives an eight percentage-point direct-share target, from 12% to 20%. Applied to its assumed 17,199 annual occupied nights, that moves about 1,376 nights to direct. At INR 9,500 and 20% commission, gross avoided commission is about INR 26.1 lakh. The brief's INR 33.3 lakh uses a different assumption: moving 15% of agency nights. Payment fees and operating costs would reduce net savings. Neither number is reported as realised demo revenue.

## 2. Architecture and why

The application uses Next.js App Router and strict TypeScript. Server components fetch data; server actions validate forms and recheck roles. Client components handle form feedback and draft copying. Zod parses entry-point data. Pure domain functions implement prices, date arithmetic, routing decisions, extraction, and response checks.

Postgres is accessed directly through one small `pg` pool. Plain SQL migrations keep the capacity rule visible and reviewable. Local development and tests use embedded Postgres binaries from npm, so the race test runs against real database locks without Docker. The proposed hosted database is Neon with a pooled URL; Vercel hosts the Next.js application. This deployment has not yet been performed.

Passwords use bcrypt. A signed, expiring HS256 session cookie carries a validated role and team. The proxy guards staff and GM pages, while server actions independently require the correct role. A separate signed, HTTP-only reservation capability protects guest payment and confirmation pages. Knowing a reservation UUID alone does not grant access.

The dependency chain is browser → page or action → validated domain input → booking, admin, or enquiry service → Postgres. The enquiry service alone calls external model providers, and only after redaction. The TestPay gateway is internal and never requests card details.

## 3. Data model

`room_types` defines the physical key counts and occupancy limits. Each `rate_plan` belongs to one room type. `inventory_night` holds one room type's tariff, website allotment, and blackout flag for one calendar night. Its composite key makes a room-night the unit of availability.

`reservation` records a stay, quantity, guest contact, consent, quoted price lines, expiry, and idempotency key. Its status is held, confirmed, cancelled, or refund_due. `payment` uses the gateway payment identifier as its primary key. `promo` records discount rules, booking-date validity, and usage.

`users` constrains roles to guest, staff, or GM. Staff must belong to reservations or sales; other roles cannot have a team. `enquiry` stores the original message, redacted text, extraction, lane, owner, alert, provider status, draft, and first-reply time. `enquiry_event` is an append-only audit trail. `ai_cache` binds responses to model, prompt version, and redacted text. `settings` stores the GM's AI switch. A database-backed request counter limits public enquiry submissions.

SQL CHECK constraints restrict statuses, dates, quantities, and amounts. Types model payment and booking outcomes as explicit variants, so callers must handle refusal as well as success. The complete terminology is in `CONTEXT.md`; assumptions are numbered in `ASSUMPTIONS.md`.

## 4. Availability, holds, and payments

The `night_usage` view counts confirmed rooms plus unexpired holds. A ten-minute hold stops consuming stock as soon as it expires. A background cleanup job is unnecessary for availability.

After a reservation write, `assert_capacity` locks the affected inventory rows in night order. A separate SQL statement checks the latest committed usage after the lock wait. If a night is absent or its active quantity exceeds effective allotment, the entire write fails. Inventory edits call the same rule. Closing a night with guests or reducing allotment below commitments is refused. Additional guards prevent allotment exceeding physical keys, deletion of occupied nights, and implausible tariffs.

The guest flow has three steps: choose the stay and plan, enter details and consent, then TestPay. The server recalculates the quote from stored rates. It checks party size against the selected rooms before creating the hold. An idempotency key prevents duplicate holds from repeated submissions.

TestPay signs its callback with a separate HMAC secret. Replaying a payment identifier returns the stored result. Failed or incorrectly valued payments do not confirm the booking. A late successful payment confirms only if capacity remains; otherwise it becomes refund_due. A second successful payment for an already paid reservation is also refund_due. Limited promo usage is claimed atomically at confirmation; a competing payment that loses the final promo use becomes refund_due rather than exceeding the cap or changing the guest's price. The confirmation states that passport details for Form C are collected at check-in.

Pricing uses whole-rupee amounts and sums the displayed per-night lines. Rate-plan and promo discounts apply before GST. The demo assumes 5% at or below INR 7,500 per room-night and 18% above. Tests cover 7,499, 7,500, 7,501, and a promo crossing the threshold. The 5% threshold is supported by the Ministry of Finance FAQ: https://www.pib.gov.in/Pressreleaseshare.aspx?PRID=2167151&lang=2&reg=48. Tax treatment remains an explicit product assumption rather than an accounting integration.

## 5. Enquiry routing and drafts

Every source enters the same validated path: web contact form, structured event form, simulated email, or simulated WhatsApp. The service stores contact information separately from the text sent to a provider. Sender names, email addresses, phone numbers, and common government-identifier shapes are redacted before classification.

A keyword classifier always runs. A primary OpenAI-compatible endpoint and an Ollama fallback can return a strict JSON classification and extraction. Requests have bounded timeouts. The server rejects malformed responses, unsupported extracted numbers, reversed stays, unknown slots, and model prose containing numbers, currency, percentages, or unsupported promises. Reply prose is server-owned; model text is never pasted into the guest's draft. No provider can call tools or send a message.

Routing considers category, confidence, missing fields, keyword disagreement, injection patterns, and provider availability. A doubtful item stays in Unsorted. Room enquiries belong to reservations, events to sales, and complaints to the GM. A complaint detected by either classifier raises the alert; provider failure also alerts the GM. Staff can move an item explicitly, inspect the reason, rerun classification, and read its audit trail.

Draft prices, taxes, dates, guest counts, and availability are server-filled values. Missing years resolve to the next occurrence and the draft asks for confirmation. Large weddings prompt an estate buyout and nearby accommodation discussion rather than a promise that all guests fit. Copying and marking a reply sent records a staff action; there is no external delivery integration. Inbox mutations carry the revision the staff member reviewed. A slow rerun cannot overwrite a newer correction or sent marker, and a stale tab cannot mark a newer unseen draft sent.

## 6. Evaluation and honest limits

The recovered labelled dataset contains 32 enquiries, including the three brief samples, complaints, vague messages, and prompt-injection attempts. The same dataset seeds the visible inbox. Seeded responses are explicitly labelled demo fixtures, not live model responses. Fixtures demonstrate low confidence, unavailable AI, and AI-off states without spending provider quota.

`npm run eval` reproduces the keyword and extraction baseline in `eval/RESULTS.md`. It reports category results, extraction accuracy, complaint recall, injection handling, and a confidence-threshold table. This is a deterministic baseline, not a live-model benchmark. A conservative model cutoff is configured, but it has not been calibrated against recorded live-provider responses. The report states that limitation rather than claiming measured model accuracy.

Provider integration tests use fakes to check success and failure handling without network calls. Production provider availability, quota, and model quality require a separate live evaluation with configured credentials. The GM's AI-off switch and the fallback path keep the product usable when those dependencies fail.

## 7. UI decisions and demonstration data

The guest site uses forest green, warm off-white, coffee tones, large landscape imagery, and system serif and sans-serif fonts. Local font stacks remove a remote font request. Dates, occupancy, total price, and remaining stock sit close to the booking action. Responsive grids collapse to one column on phones. Search labels, form labels, status messages, and focus outlines remain visible.

The staff tools favour legible tables and explicit actions. Bulk inventory changes apply together or not at all. Capacity refusals show a minimum instead of an unexplained error. Inbox lanes display counts, ownership, uncertainty, and complaint alerts. Draft copying requires a staff click, and marking sent requires an explicit action.

Seed data contains five room types, two rate plans per type, 180 nights of rates, two promos, sixteen reservations, blackouts, and a sold-out Coffee Villa night. Dates are relative to the current date in India. The GM reset restores business data without altering existing users or password hashes. The property identity, photos, sample accounts, and operating assumptions are fictional and labelled as demonstrations.

## 8. Evidence a reviewer can reproduce

| Requirement or failure | Test or command | Screen or artifact |
|---|---|---|
| Parallel last-room bookings | `test/capacity.race.test.ts` | GM capacity-audit tile |
| Admin cuts, expiry, multi-night atomicity | `test/capacity.test.ts`, `test/guards.test.ts` | Rates and allotment |
| Payment replay, failures, late payment | `test/booking.test.ts` | TestPay and confirmation |
| Tax threshold and promo maths | `src/domain/pricing.test.ts` | Room price lines |
| Login and role boundaries | `test/auth.test.ts`, `src/domain/access.test.ts` | Staff and GM areas |
| Guest input and private booking access | `src/server/guest/*.test.ts`, `test/guest.test.ts` | Search and checkout |
| Atomic admin edits and safe CSV | `test/admin.test.ts` | Calendar, promos, booking export |
| Redaction, uncertain routing, safe drafts | `src/domain/enquiry/pipeline.test.ts`, `test/enquiry.test.ts` | Inbox and public form |
| Demo reset preserves accounts | `test/seed.test.ts` | GM reset |
| Baseline evaluation | `npm run eval` | `eval/RESULTS.md` |

Existing history includes a failing twenty-client race test in `3799894` and the database capacity fix in `0ac6c20`. The current continuation remains uncommitted on `codex/complete-resort`; no new red-green commit history is claimed. The accompanying verification report records observed failing tests, subsequent results, types, lint, build, and browser checks.

## 9. Security, scope, and next work

Inputs are parsed at entry points and SQL values use parameters. Cookies are HTTP-only, same-site, and secure in production. Guest consent is recorded. The privacy page explains contact data, model redaction, and a retention assumption. Server-rendered pages do not expose credentials. Public enquiry rate limiting uses shared database state rather than a process-local counter.

This build does not replace the reservation system or channel manager. It sells only the admin-set website allotment. Payments, inbound messages, and outbound delivery are simulated. External email and WhatsApp integrations, real payment settlement and refunds, automated retention deletion, working-hours reply metrics, and a hold-hoarding cap remain future work. The GM median measures recorded elapsed reply minutes, not a working-hours business calendar.

The local package still needs an authorized Git push, public repository visibility for review, hosting secrets, a deployed database, and a final production smoke test. No public URL is invented. Before real operations, remove shared demo reset, use real account onboarding, establish retention and monitoring, and complete provider calibration and payment-provider integration.
