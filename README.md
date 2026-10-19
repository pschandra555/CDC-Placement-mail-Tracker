# CDC Placement Mail Tracker

Never miss a drive again: every VIT CDC opportunity, filtered for you, with a reminder before it closes.

The site reads CDC placement mails from a central inbox, extracts the details with AI, checks each student's eligibility (with the exact reason when they don't qualify), and shows a personal dashboard with deadlines, reminders and application tracking. Students never give the site access to their own Gmail.

## Status

| Phase | Scope | Status |
|---|---|---|
| 0 — UI foundation | Next.js app, 3D landing page, dashboard, opportunity pages, tracker, calendar, profile, eligibility engine — on sample data | Done |
| 1 — Working core | FastAPI backend, Supabase (Postgres + VIT Google sign-in), Gmail API on the central inbox, Gemini extraction (Groq fallback), dedupe, validation, eligibility matching, shortlist auto-update | Done (needs your keys to go live) |
| 2 — Never miss a deadline | Alerts sent by Telegram bot (email as backup) plus an in-app bell: new eligible drives, 24h/2h deadline reminders, shortlists, deadline changes, custom reminders, daily digest; calendar export and subscribe feed; installable app (PWA) | Done (Telegram/email need keys) |
| 3 — Community & AI | Company pages, interview experiences, team finder, "Ask the CDC assistant", resume–JD match | Next |
| 4 — College-facing | Reach and missed-opportunity reports, trends, corrections queue, evaluation on labelled mails | |

## Run it locally

Both parts run with **no API keys**: the backend falls back to SQLite, the bundled sample CDC mails, a rule-based extractor and a dev sign-in.

```bash
# backend
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python -m app.pipeline.run          # read the inbox (sample mails) into the database
.venv/bin/uvicorn app.main:app --reload       # http://localhost:8000  (docs at /docs)
.venv/bin/python -m app.scheduler             # optional: reads the inbox every 15 min, sends alerts every minute
.venv/bin/python -m pytest                     # tests

# frontend (in another terminal)
cd frontend
npm install
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev   # http://localhost:3000
```

Without `NEXT_PUBLIC_API_URL` the frontend runs in demo mode on `frontend/lib/mockData.ts`, with the profile and statuses kept in the browser.

## Going live

Fill in `backend/.env` (template: `backend/.env.example`) and `frontend/.env.local` (template: `frontend/.env.example`). Each key switches one piece on:

| What | Keys | Without it |
|---|---|---|
| Database | `DATABASE_URL` (Supabase Postgres connection string) | SQLite file |
| Sign-in | `SUPABASE_URL` or `SUPABASE_JWT_SECRET` (backend); `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (frontend). Enable the Google provider in Supabase. | Dev sign-in as a demo student |
| Central inbox | `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, then run `python scripts/gmail_auth.py` signed in as the inbox to get `GMAIL_REFRESH_TOKEN` | Sample mails |
| AI extraction | `GEMINI_API_KEY` (and optionally `GROQ_API_KEY` as backup) | Rule-based extractor |
| Scheduled jobs | Run `python -m app.scheduler` on the server, **or** set `CRON_SECRET` and call `POST /cron/fetch` every 15–30 min and `POST /cron/notify` every 5 min (header `X-Cron-Secret`) from cron-job.org | Run the pipeline by hand |
| Telegram alerts | Create a bot with @BotFather → `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`. Locally run `python -m app.notify.poll`; in production set the bot webhook to `<api>/telegram/webhook` with `TELEGRAM_WEBHOOK_SECRET` | Alerts only in the in-app bell |
| Email alerts | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` (e.g. Gmail with an app password) | Alerts only in the in-app bell |
| Links in alerts & calendar feed | `PUBLIC_SITE_URL`, `PUBLIC_API_URL` (must be https for Google Calendar subscriptions) | localhost links |

Only `@vitstudent.ac.in` accounts are accepted (`ALLOWED_EMAIL_DOMAIN`).

## How a mail becomes a card

`backend/app/pipeline/`: **fetch** (Gmail API, trusted senders, PDF attachments read) → **dedupe** (hash of subject + body) → **clean** (registration numbers, student emails and phone numbers removed before any AI call) → **extract** (Gemini → Groq → rules) → **validate** (dates, CGPA 0–10, links; low confidence becomes "Check manually") → **store** (update mails such as "deadline extended" change the existing card) → **match** (`app/eligibility.py`, same reasons as the frontend; 24h and 2h reminders scheduled, cancelled on Applied). Shortlist mails move listed students to Shortlisted, using registration numbers that never leave the server.

## Alerts (Phase 2)

`backend/app/notify/`: `dispatch.py` sends whatever is due (Telegram first, email if Telegram isn't linked or fails, and always the in-app bell). Many new drives at once arrive as one combined message. A 24h reminder that is very late is skipped in favour of the 2h one; reminders stop once a student marks Applied. `messages.py` holds the wording (IST times), `telegram.py` links a chat with a one-time `t.me/<bot>?start=<code>` link and answers `/today` and `/stop`, `calendar.py` builds the private `.ics` feed.

## Layout

```
backend/
  app/main.py               FastAPI app (/opportunities, /me, /applications, /cron/fetch, /health)
  app/pipeline/             fetch, clean, extract, validate, run
  app/matching.py           eligibility results and reminder scheduling
  app/notify/               Telegram, email, digest, calendar feed, dispatcher
  app/scheduler.py          simple always-on scheduler (inbox + alerts)
  app/sample_mails/         sample CDC mails (fictional companies) used when no inbox is connected
  tests/                    pytest suite
frontend/
  app/page.tsx              3D landing page
  app/(app)/                dashboard, opportunity/[id], applications, calendar, profile
  components/three/         WebGL hero (react-three-fiber), loaded client-side with a fallback
  components/landing/       landing sections
  components/opportunity/   opportunity card and badges
  lib/eligibility.ts        deterministic eligibility check with reasons
  lib/types.ts              data shapes matching the planned database tables
```
