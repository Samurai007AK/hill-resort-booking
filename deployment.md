# Run and deploy Silver Oaks

Repository: https://github.com/Samurai007AK/hill-resort-booking

Live deployment: pending. This checkout does not contain a verified public deployment URL.

## Run locally

Use Node.js 22 or later and npm. No Docker is needed on Windows.

1. Run `npm ci` in the project directory.
2. In one terminal, run `npm run db:start`. Wait for the Postgres ready message.
3. In another terminal, run `npm run db:migrate`, then `npm run db:seed`.
4. Run `npm run dev`. Open http://localhost:3000.

Local database binaries come from the `embedded-postgres` npm dependency. The development database lives in `.pgdata/` on port 54329. Tests use a separate throwaway database on port 54330. Stop the development server and database with Ctrl+C when finished.

`npm run db:seed` resets demo business data and adds missing demo users. Existing users and password hashes remain intact. `npm run db:reset` drops the development schema, migrates it, and seeds it. Do not run that command against a database you need to preserve. The GM screen resets demo business data without dropping the schema or changing users.

## Environment variables

Set these through your shell or hosting provider. Values and credentials are intentionally omitted.

| Name | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection URL. Local development falls back to embedded Postgres on port 54329. |
| `SESSION_SECRET` | Random signing secret for login sessions and private booking access. Required in production. |
| `PAYMENT_WEBHOOK_SECRET` | Independent random secret for signed TestPay callbacks. Required in production. |
| `APINEX_API_KEY` | Optional primary classification provider credential. |
| `AI_PRIMARY_MODEL` | Optional primary model identifier. |
| `OLLAMA_API_KEY` | Optional fallback provider credential. |

Use independent random signing secrets in production. Missing provider credentials activate the visible keyword fallback. TestPay never charges a card. Provider calls send redacted message text, not contact fields.

Next.js supports local dotenv configuration for a developer-managed setup. The continuation work did not inspect or load existing dotenv files. The clean review build was prepared by `node scripts/prepare-review.mjs`, which copies an explicit source allowlist and excludes dotenv files, Git metadata, database files, and dependency folders.

## Demo accounts

All four accounts use the demonstration password `demo1234`.

| Email | Role | Opens |
|---|---|---|
| `guest@demo.in` | Guest | Guest website |
| `reservations@demo.in` | Staff, reservations | Inventory, bookings, promos, enquiry inbox |
| `sales@demo.in` | Staff, sales | Staff tools and event enquiries |
| `gm@demo.in` | GM | Staff tools plus metrics, complaint alerts, AI switch and reset |

## Check the main flows

1. Search tomorrow for two nights. Open an Estate Room, compare the rate plans, and apply `MONSOON15` to see the per-night discount and GST.
2. Enter fictional guest details, accept the privacy consent, and continue to TestPay. Try a failed payment, then pay successfully. No card details are requested.
3. Sign in as reservations staff. Edit a night with confirmed bookings below its sold count. The calendar refuses the edit and offers the minimum capacity.
4. Open the enquiry inbox. Inspect the three brief samples, an uncertain enquiry, a complaint alert, and a keyword fallback. Move an enquiry and copy its draft before marking it sent.
5. Sign in as GM. Turn AI off, simulate a message, inspect the fallback reason, and reset the demo. Existing users remain intact.

## Run checks

Run these commands in order, with no other test run using port 54330:

```text
npm test
npm run eval
npx tsc --noEmit
npm run lint
npm run build
```

Tests refuse a supplied `DATABASE_URL` unless its database name contains `test`, because they drop and recreate that database's public schema. Leave `DATABASE_URL` unset to use the embedded test database. The CI workflow uses a Postgres service and runs types, lint, and tests. Provider tests use injected fakes and never call the network.

## Deploy on Vercel with Neon

1. Create a Neon Postgres database and use its pooled connection URL for `DATABASE_URL` on Vercel.
2. Import the GitHub repository as a Next.js project. Set the environment names above in the project's environment settings.
3. From an authorized shell configured for that database, run `npm run db:migrate` and `npm run db:seed` once.
4. Deploy the reviewed feature branch through the hosting dashboard. Verify guest booking, staff login, inbox fallback, and the capacity audit on that deployment.
5. Add the verified live URL to the top of the design document and this guide. Make the repository public for the review period, as the brief requires.

The continuation did not push, publish a deployment, change repository visibility, or access hosting secrets. Production readiness still requires those account actions and a smoke test on the actual host. Shared demo reset is intentionally destructive to demo bookings and enquiries; use a separate production configuration before accepting real guests.
