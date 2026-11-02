# Silver Oaks: direct booking and enquiry inbox

Direct booking and staff enquiry tools for a fictional 76-key coffee-estate resort in Chikkamagaluru. Next.js App Router, strict TypeScript, and real Postgres through `pg`. A database trigger protects website allotment across bookings, payment callbacks, and admin edits.

Start with [deployment.md](deployment.md) for setup, environment names, demo logins, and deployment steps. Read [TDD.md](TDD.md) for the design and limitations, [CONTEXT.md](CONTEXT.md) for domain terms, and [ASSUMPTIONS.md](ASSUMPTIONS.md) for decisions the brief leaves open.

```bash
npm ci
npm run db:start     # local Postgres in .pgdata/ on port 54329 (leave running)
npm run db:migrate
npm run db:seed      # reset demo business data; preserve existing users
npm run dev          # http://localhost:3000
npm test             # Vitest; starts its own throwaway Postgres
npm run eval         # reproduce the labelled keyword baseline
npm run lint && npx tsc --noEmit
```

Guest flow: `/` → `/rooms/[id]` → `/book` → TestPay → confirmation. Staff tools start at `/staff`; the GM dashboard is `/gm`. The structured contact and event form is `/enquire`.

Enquiry classification uses live provider adapters when credentials are configured. Missing credentials, provider failures, low confidence, disagreement, and injection attempts remain visible to staff. Seeded fixtures demonstrate the routing states without spending quota. Drafts are never sent automatically; prices and availability come from the database.

`eval/RESULTS.md` distinguishes the reproducible keyword baseline from unmeasured live-model performance. Payments, property identity, and sample data are demonstrations. Public hosting and repository visibility still require the account owner's final setup.
