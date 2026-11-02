# Run and deploy Silver Oaks

- Repository: https://github.com/Samurai007AK/hill-resort-booking
- Live app: https://hill-resort-booking-mu.vercel.app

## Demo logins

All four accounts use the password `demo1234`. They are fake demo accounts.

| Role               | Email                  | Opens                                                                                            |
| ------------------ | ---------------------- | ------------------------------------------------------------------------------------------------ |
| Guest              | `guest@demo.in`        | Guest website                                                                                    |
| Reservations staff | `reservations@demo.in` | `/staff`: rates and allotment, bookings, promo codes, enquiry inbox                              |
| Sales staff        | `sales@demo.in`        | `/staff`: the same tools; owns wedding and offsite enquiries                                     |
| General Manager    | `gm@demo.in`           | `/gm`: the three success measures, complaint alerts, AI on/off, Reset demo; plus all staff tools |

No login is needed to search, book and pay as a guest.

## Run locally (Windows or macOS)

You need Node.js 22 and npm. Docker is not needed: the `embedded-postgres` package downloads real Postgres binaries through npm.

1. Install dependencies:

   ```
   npm ci
   ```

2. Start the local database in its own terminal and leave it running:

   ```
   npm run db:start
   ```

   Wait for `Postgres ready: postgres://postgres:postgres@localhost:54329/resort`. Data lives in `.pgdata/`. The database is created as UTF-8 (so ₹ and Hindi text store correctly). Ctrl+C stops it.

3. In a second terminal, create the tables and load the demo data:

   ```
   npm run db:migrate
   npm run db:seed
   ```

4. Start the app:

   ```
   npm run dev
   ```

   Open http://localhost:3000.

With no `DATABASE_URL` set, the app uses the local database above. With no AI keys set, every enquiry is handled by the keyword fallback and marked "AI unavailable"; everything else works.

`npm run db:reset` drops the local schema, migrates and seeds again. It refuses to run when `NODE_ENV` is `production`.

## Tests

```
npm test
```

This runs all 210 Vitest tests. They start their own throwaway Postgres on port 54330, so the dev database is not touched and does not need to be running. If you set `DATABASE_URL` for tests, its database name must contain `test`, because the tests drop and recreate the schema. Tests never call an AI provider.

Other checks, as CI runs them:

```
npx tsc --noEmit
npm run lint
```

## AI evaluation

| Command                          | What it does                                                                                                                                             | Needs a key                              |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `npm run eval`                   | Scores the keyword classifier against the 32 labelled enquiries and writes `eval/RESULTS.md`                                                             | No                                       |
| `npm run eval:live -- --offline` | Rescores the recorded live-model answers in `eval/live-responses.json` and writes `eval/RESULTS-live.md`                                                 | No                                       |
| `npm run eval:live`              | Calls the real models for all 32 enquiries, saves the answers and scores them. Paced for the free tier's 15 requests a minute, so it takes a few minutes | `APINEX_API_KEY` and/or `OLLAMA_API_KEY` |

## Environment variables

Names only. Set them in your shell, in a local `.env.local` (git-ignored), or in the Vercel project settings.

| Name                     | Required      | Purpose                                                                                 |
| ------------------------ | ------------- | --------------------------------------------------------------------------------------- |
| `DATABASE_URL`           | In production | Postgres connection string. Locally it defaults to the embedded database on port 54329. |
| `SESSION_SECRET`         | In production | Long random string. Signs session cookies and guest booking-access cookies (HS256).     |
| `PAYMENT_WEBHOOK_SECRET` | In production | A different long random string. Signs TestPay payment callbacks (HMAC-SHA256).          |
| `APINEX_API_KEY`         | No            | Primary AI provider (apinex, OpenAI-compatible).                                        |
| `OLLAMA_API_KEY`         | No            | Fallback AI provider (Ollama Cloud).                                                    |
| `AI_PRIMARY_MODEL`       | No            | Overrides the primary model. Default `free/qwen-3.8-max`.                               |

In production the app will not sign or verify anything if either signing secret is missing. `.env.example` lists the same names with empty values.

## How it is deployed

- **App:** Vercel, Next.js preset, linked to the GitHub repository.
- **Database:** Neon Postgres, connected through the Vercel Storage integration, which sets `DATABASE_URL` on the project. Neon was chosen over Supabase because a free Supabase project pauses after 7 idle days and needs a manual restore.
- **Build:** Vercel runs `npm run vercel-build`, which is `tsx scripts/deploy-db.ts && next build`. The first step applies any new migrations, then seeds demo data only if the database is empty. A redeploy therefore never wipes bookings or enquiries made during review.
- **Secrets:** `SESSION_SECRET`, `PAYMENT_WEBHOOK_SECRET`, `APINEX_API_KEY` and `OLLAMA_API_KEY` are set in the Vercel project's environment variables. `.vercelignore` keeps local data and dotenv files out of uploads.

To deploy your own copy:

1. Import the GitHub repository into Vercel.
2. In the project, open Storage and connect a Neon Postgres database.
3. Add the two signing secrets, and the AI keys if you want live AI.
4. Deploy. The build migrates and seeds the empty database.
5. Sign in with each demo login to check.

## Reset the demo data

Sign in as `gm@demo.in`, open `/gm`, tick the confirmation box and press **Reset demo**. It restores rates, allotments, blackouts, promo codes, bookings and the 32 enquiries to the seeded state, with dates moved relative to today. User accounts and passwords are never deleted or changed.

From a terminal, `npm run db:seed` does the same against whatever `DATABASE_URL` points to.

## Things to try

1. Search for any dates and open a room. The price table shows each night's tariff, GST rate and total. Weekend Estate Room nights cost ₹8,200 and are taxed at 18%; weekday nights are ₹7,200 at 5%.
2. Enter fictional details with promo `MONSOON15`, then pay in TestPay. Try "Simulate failed payment" and "Pay after hold expires" too.
3. The Pool Villa has one website key a night. Book it, then try the same night again: it is sold out. The Coffee Villa is already sold out on the first Saturday at least three days ahead.
4. As `reservations@demo.in`, cut a booked night's allotment below what is sold. The calendar refuses and offers "Set to minimum".
5. Open the enquiry inbox. Check the Unsorted lane and "How the routing was decided". Use "Simulate an incoming email or WhatsApp" with the injection example.
6. As `gm@demo.in`, turn AI off, simulate a message, and see it land in Unsorted with a GM alert. Then press Reset demo.
