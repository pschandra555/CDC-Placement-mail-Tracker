# Roadmap

What's built, what's left, and the details from the original project spec ("CDC Placement Mail Tracker: Project Proposal and Specification", VIT Vellore, Oct 2026) that aren't written down anywhere else.

---

## 1. Done

| Phase | What exists |
|---|---|
| 0: UI foundation | Next.js 14 frontend: 3D landing page (react-three-fiber), dashboard with smart views and filters, drive pages, application tracker, calendar, profile. Demo mode on sample data. |
| 1: Working core | FastAPI backend: inbox pipeline (Gmail API, or bundled sample mails) → personal data stripped → extraction (Gemini → Groq → rule-based) → validation → storage → eligibility matching with exact reasons. Update mails ("deadline extended") change the existing card. Shortlist mails move listed students to Shortlisted. Supabase sign-in limited to `@vitstudent.ac.in`. |
| 2: Never miss a deadline | Alerts for new eligible drives, 24h/2h deadline reminders, shortlists, drive updates and custom reminders. Telegram first, email as backup, always the in-app bell. Daily digest, .ics export and private calendar feed, installable PWA with offline page. |

**Where the build differs from the spec:**
- There's a **rule-based extractor** fallback, so everything runs without AI keys.
- There's an **in-app notification bell**, so alerts are visible without Telegram or email.
- A student's **first profile save** sends one alert listing drives that were already open.
- The sample inbox includes drives for 2nd/3rd years (2027/2028 batches), so juniors see eligible drives.
- Branch codes parsed from reg numbers: BCE, BAI, BDS, BCT, BCI, BKT, BRS, BIT, BEC, BEE, BEI, BME, BCL, BCH, BBT, MIS. Add more in **both** `frontend/lib/eligibility.ts` and `backend/app/pipeline/extract.py`.

---

## 2. Phase 2 leftovers

1. **Connect the Telegram bot.** The code is done and tested with mocks only.
   - In Telegram, message @BotFather and send `/newbot`. Copy the token and the bot username.
   - Put both in `backend/.env` as `TELEGRAM_BOT_TOKEN` and `TELEGRAM_BOT_USERNAME`.
   - Restart the backend, then run `.venv/bin/python -m app.notify.poll` in a 4th Terminal window.
   - On the site, open **Alerts** → **Connect Telegram** → press Start in Telegram.
   - Test that a real alert arrives and that `/today` and `/stop` work.
2. **Email backup.** Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` (Gmail: `smtp.gmail.com`, port 587, an app password), then send one real test alert.
3. **Browser push notifications (optional in the spec, not built).**
   - Web Push with VAPID keys
   - A subscribe button on the Alerts page
   - A `push` handler in `frontend/public/sw.js`
   - A `push_subscriptions` table and a backend sender (e.g. `pywebpush`)
   - A `push` channel in `backend/app/notify/dispatch.py`
4. **Calendar subscribe link** works only once the backend is online over https. "Download .ics" works now.

---

## 3. Next up, in suggested order

1. **Phase 2 leftovers** above, Telegram first.
2. **Next.js 15 upgrade.** It clears the `npm audit` warnings, but needs React 19, @react-three/fiber v9 and drei v10. Re-check the 3D hero afterwards.
3. **Put it online:**
   - **Frontend → Vercel:** import the repo with root directory `frontend`. Env: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_ALLOWED_DOMAIN`.
   - **Backend → Render** (or Railway): `uvicorn app.main:app --host 0.0.0.0 --port $PORT` with root directory `backend`.
   - **Database and sign-in → Supabase:** use the Postgres connection string as `DATABASE_URL`. Enable the Google auth provider. Set `SUPABASE_URL` (or `SUPABASE_JWT_SECRET`) on the backend.
   - **Jobs:** either keep `python -m app.scheduler` running, or set `CRON_SECRET` and have cron-job.org call `POST /cron/fetch` every 15–30 min and `POST /cron/notify` every 5 min (header `X-Cron-Secret`).
   - **Backend env for production:** `PUBLIC_SITE_URL` and `PUBLIC_API_URL` (https), `CORS_ORIGINS` (the Vercel URL), and `CORS_ORIGIN_REGEX=` (empty).
   - **Telegram in production:** set the webhook to `<api>/telegram/webhook` with `TELEGRAM_WEBHOOK_SECRET`, instead of polling.
4. **Go real:**
   - Create the central project inbox. Volunteer students from several branches and batches auto-forward CDC mails to it.
   - Run `python scripts/gmail_auth.py` to get `GMAIL_REFRESH_TOKEN`.
   - Set `TRUSTED_SENDERS` and `GEMINI_API_KEY`, optionally `GROQ_API_KEY`.
   - Free-tier limits change often; check them before launch.

---

## 4. Phase 3: Community and AI

| Feature | What it does | Notes |
|---|---|---|
| Company pages | Every company that has visited, with past roles, packages, CGPA cutoffs and dates, built from old mails | Group `opportunities` by organization |
| Interview experience board | Seniors post rounds, questions and tips per company; anonymous option; upvotes | Spec table `experiences`: id, company, author_id, anonymous, year, rounds, content, upvotes. New user type: seniors / placed students |
| Hackathon team finder | Post "looking for a teammate" with skills for a specific hackathon; others respond | New table `team_posts` |
| Ask the CDC assistant | Chat over all past and current mails ("Which internships this month allow CGPA 7.5?", "When is the Example Corp test?"). Answers cite the source mail | pgvector embeddings in Supabase Postgres (`embeddings` table). Use the cleaned mail text only |
| Resume–JD match | Student uploads a resume; the site scores it against a role's description and lists missing skills | JD text comes from mail bodies and PDF attachments |
| Prep checklist per role | Short list of topics to revise, from the JD plus seniors' experiences | |
| Mail summaries | 3-line summary on every card, full mail one tap away | Already built |

## 5. Phase 4: College-facing

| Feature | What it does |
|---|---|
| Reach report | Anonymized counts per drive: how many eligible students saw it, set a reminder, marked Applied |
| Missed-opportunity alerts | Drives where many eligible students hadn't applied close to the deadline, so the CDC can send a reminder |
| Placement trends | Charts of companies visited, roles and package ranges by year, from the mail history |
| Corrections queue | A coordinator fixes wrongly extracted details once, for everyone. Uses the existing `reports` table ("Report wrong criteria"); the spec adds a `corrections` table |

New user type: CDC or faculty coordinators (optional). They see anonymized reports and the corrections queue only. These reports matter most for impressing faculty, since they show the site improves participation in CDC drives.

**Evaluation** (for the final review): a test set of 150–200 past CDC mails, labelled by hand with the correct category and fields.

| Measure | How | Target |
|---|---|---|
| Category accuracy | Share of mails sorted into the right category | ≥ 95% |
| Opportunity recall | Share of real opportunities not missed (the most important number) | ≥ 98% |
| Field accuracy | Correct deadline, CGPA cutoff and link per mail | ≥ 90% |
| Eligibility correctness | Eligible / Not eligible matches a manual check | ≥ 95% |
| Alert delay | Mail arrival → student alert | < 30 min |
| Student impact | Survey: drives missed per semester, before vs after | A clear drop |

---

## 6. Privacy rules (keep these in every phase)

- Never read students' own inboxes; only the central project inbox.
- Sign-in with VIT Google accounts only.
- Row-level security: each student sees and edits only their own profile, applications and reminders.
- Strip names and registration numbers before any text goes to an AI model (free-tier prompts may be used for training). Registration numbers are used only on the server, to update shortlisted students.
- College-facing statistics are aggregate counts only, never individual CGPAs or names.
- One button deletes a student's profile, statuses, reminders and notifications (built).
- Keys and inbox credentials live in env files, never in the repo.

## 7. Open questions from the spec

1. Can the CDC or a faculty coordinator officially support the project (or share a forwarding address)?
2. Which students from different branches will forward mails to the central inbox?
3. Does the CDC send shortlists in a consistent format that can be matched automatically?
4. Later: extend to other colleges whose placement cells also communicate by email.
