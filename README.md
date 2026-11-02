# Hill resort booking + enquiry inbox

Direct-booking site and staff enquiry inbox for a 76-key coffee-estate resort in Chikkamagaluru (Isocode take-home, brief #1). Next.js App Router + TypeScript, Postgres via `pg` with plain SQL migrations; the database itself refuses any overbooking. Domain terms are in `CONTEXT.md`, assumptions in `ASSUMPTIONS.md`. Key names are listed in `.env.example`; put values in `.env.local`.

```bash
npm install
npm run db:start     # local Postgres in .pgdata/ on port 54329 (leave running)
npm run db:reset     # drop + migrate + seed demo data
npm run dev          # http://localhost:3000
npm test             # Vitest; starts its own throwaway Postgres
npm run lint && npx tsc --noEmit
```

Other scripts: `npm run db:migrate`, `npm run db:seed`.
