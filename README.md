# CDC Placement Mail Tracker

Never miss a drive again: every VIT CDC opportunity, filtered for you, with a reminder before it closes.

The site reads CDC placement mails from a central inbox, extracts the details with AI, checks each student's eligibility (with the exact reason when they don't qualify), and shows a personal dashboard with deadlines, reminders and application tracking. Students never give the site access to their own Gmail.

## Status

| Phase | Scope | Status |
|---|---|---|
| 0 — UI foundation | Next.js app, 3D landing page, dashboard, opportunity pages, tracker, calendar, profile, eligibility engine — on sample data | Done |
| 1 — Working core | FastAPI backend, Supabase (Postgres + VIT Google sign-in), Gmail API on the central inbox, Gemini extraction (Groq fallback), dedupe, validation | Next |
| 2 — Never miss a deadline | Saved statuses, 24h/2h/custom reminders, Telegram bot, daily digest, PWA | |
| 3 — Community & AI | Company pages, interview experiences, team finder, "Ask the CDC assistant", resume–JD match | |
| 4 — College-facing | Reach and missed-opportunity reports, trends, corrections queue, evaluation on labelled mails | |

## Run the frontend

```bash
cd frontend
npm install
npm run dev      # http://localhost:3000
```

`npm run build` and `npm run lint` should both pass.

Phase 0 uses sample drives from `frontend/lib/mockData.ts` (fictional companies, deadlines relative to now). The profile and application statuses are saved in the browser until the backend exists.

## Layout

```
frontend/
  app/page.tsx              3D landing page
  app/(app)/                dashboard, opportunity/[id], applications, calendar, profile
  components/three/         WebGL hero (react-three-fiber), loaded client-side with a fallback
  components/landing/       landing sections
  components/opportunity/   opportunity card and badges
  lib/eligibility.ts        deterministic eligibility check with reasons
  lib/types.ts              data shapes matching the planned database tables
```
