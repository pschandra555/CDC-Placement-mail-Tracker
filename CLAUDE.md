# CDC Placement Mail Tracker

Website for VIT Vellore students: reads CDC placement mails from one central inbox, extracts each drive with AI, checks every student's eligibility (with the exact failing reason), and shows a personal dashboard with deadlines, reminders and application tracking. Students never give access to their own Gmail.

The owner is a student (Mac, Python 3.14, Node). Explain steps simply, give copy-paste Terminal commands, and say which Terminal window each goes in.

## Status
- **Phase 0 (done):** Next.js frontend: 3D landing page (react-three-fiber), dashboard, drive pages, tracker, calendar, profile. Dark neon/glass style.
- **Phase 1 (done):** FastAPI backend: inbox pipeline (Gmail API or bundled sample mails) → clean personal data → extract (Gemini → Groq → rule-based) → validate → store → eligibility matching. Supabase sign-in limited to `@vitstudent.ac.in`.
- **Phase 2 (done, PR #1):** alerts (new drives, 24h/2h deadline reminders, shortlists, drive updates, custom reminders) sent by Telegram first, email as backup, always the in-app bell. Daily digest, .ics calendar export and feed, installable PWA. Verified working on the owner's Mac.
- **Next options:** connect a Telegram bot; deploy (frontend on Vercel, backend on Render, Supabase Postgres); Phase 3 (company pages, interview experiences, team finder, "Ask the CDC assistant" chat, resume–JD match); Phase 4 (college reports, corrections queue, evaluation on 150–200 labelled mails).
- **Known:** `npm audit` warnings come from Next.js 14. Upgrading to Next 15 also means React 19, R3F v9 and drei v10; do it before deploying.

## Run locally (no keys needed)
Three Terminal windows:
```bash
# 1. backend
cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt   # first time only
.venv/bin/uvicorn app.main:app --port 8000

# 2. website
cd frontend && npm install    # first time only
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev

# 3. scheduler: reads the inbox every 15 min, sends alerts every minute
cd backend && .venv/bin/python -m app.scheduler
```
Without keys the backend uses SQLite (`backend/dev.db`), the sample mails in `backend/app/sample_mails/mails.json`, the rule-based extractor and dev sign-in (X-Dev-Email header, defaulting to a demo student). Deleting `dev.db` resets everything, including the saved profile. Without `NEXT_PUBLIC_API_URL` the frontend runs a demo on `frontend/lib/mockData.ts`.

Keys go in `backend/.env` (template `backend/.env.example`) and `frontend/.env.local` (template `frontend/.env.example`). Never commit them.

## Checks before committing
```bash
cd backend && .venv/bin/python -m pytest -q          # 30 tests
cd frontend && npx tsc --noEmit && npm run lint && npm run build
```

## Layout and conventions
- `backend/app/pipeline/`: fetch, clean, extract, validate, run. `app/matching.py` holds eligibility results and reminder scheduling. `app/notify/` covers Telegram, email, messages, digest, calendar and dispatch. `app/routers/` holds the API.
- `backend/app/eligibility.py` and `frontend/lib/eligibility.ts` must produce identical reason strings (e.g. "CGPA 7.6 is below the required 8.0").
- Datetimes are stored as naive UTC. Mail dates without a timezone are IST. Messages show IST.
- `app/db.py` adds missing columns on startup. New columns need `server_default` or must be nullable.
- Python deps use version ranges (not exact pins), so Python 3.14 wheels resolve.
- Sample data uses fictional companies only.
- Work on a branch and open a PR into `main`. The owner merges.
