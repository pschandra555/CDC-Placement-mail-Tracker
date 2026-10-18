"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import {
  ArrowRight,
  Bell,
  Bot,
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  Filter,
  Inbox,
  KanbanSquare,
  LayoutDashboard,
  Lock,
  Mail,
  MailCheck,
  Radar,
  ScanSearch,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";
import { TiltCard } from "@/components/ui/TiltCard";
import { CATEGORY_META } from "@/lib/mockData";
import type { Category } from "@/lib/types";

function SectionHead({ eyebrow, title, sub }: { eyebrow: string; title: React.ReactNode; sub?: string }) {
  return (
    <Reveal className="mx-auto mb-14 max-w-2xl text-center">
      <div className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300/80">{eyebrow}</div>
      <h2 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">{title}</h2>
      {sub && <p className="mt-4 text-white/55">{sub}</p>}
    </Reveal>
  );
}

/* ───────────── Problem → solution ───────────── */

const NOISE = [
  { from: "VTOP", s: "Fee payment reminder — Fall Semester", t: "9:02" },
  { from: "CDC VIT", s: "Nimbus Labs — Campus Recruitment 2026 | Register by…", t: "8:47", hot: true },
  { from: "Coding Club", s: "Weekly meetup this Saturday!! 🎉", t: "8:30" },
  { from: "Prof. Rao", s: "Re: Lab record submission", t: "8:12" },
  { from: "CDC VIT", s: "Quantix Analytics — 6M Internship (Jan 2026)", t: "7:55", hot: true },
  { from: "Promotions", s: "Flat 60% off on hoodies — today only", t: "7:40" },
  { from: "CDC VIT", s: "Ledgerly — Deadline extended", t: "7:21", hot: true },
  { from: "Hostel Office", s: "Water supply interruption — Block Q", t: "7:02" },
];

export function ProblemSolution() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const tilt = useTransform(scrollYProgress, [0, 1], [24, 0]);
  const fade = useTransform(scrollYProgress, [0.3, 1], [1, 0.35]);

  return (
    <section className="relative px-4 py-28 sm:px-6">
      <SectionHead
        eyebrow="The problem"
        title={
          <>
            Placement mails drown in <span className="text-gradient">inbox noise</span>
          </>
        }
        sub="Every drive, eligibility rule and deadline arrives as one more email between VTOP alerts, club spam and promotions. Eligible students miss windows they never even saw."
      />
      <div ref={ref} className="mx-auto grid max-w-6xl items-center gap-8 lg:grid-cols-[1fr_auto_1fr]" style={{ perspective: 1400 }}>
        <motion.div style={{ rotateY: tilt, opacity: fade }} className="glass p-4">
          <div className="mb-3 flex items-center gap-2 px-2 text-sm text-white/50">
            <Inbox className="h-4 w-4" /> Inbox <span className="ml-auto rounded-full bg-rose-500/20 px-2 text-rose-300">248 unread</span>
          </div>
          <div className="space-y-1">
            {NOISE.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${m.hot ? "bg-violet-500/10" : ""}`}
              >
                <span className={`w-24 shrink-0 truncate font-medium ${m.hot ? "text-violet-200" : "text-white/60"}`}>{m.from}</span>
                <span className="truncate text-white/45">{m.s}</span>
                <span className="ml-auto shrink-0 text-xs text-white/30">{m.t}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <div className="flex justify-center">
          <div className="relative grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 to-cyan-500 shadow-glow lg:rotate-0">
            <span className="absolute inset-0 animate-pulseRing rounded-2xl border border-violet-400/60" />
            <BrainCircuit className="h-8 w-8 text-white" />
          </div>
        </div>

        <div className="space-y-3">
          {[
            { o: "Nimbus Labs", r: "SDE · ₹24 LPA", s: "Not eligible", why: "CGPA 7.6 is below the required 8.0", c: "rose" },
            { o: "Quantix Analytics", r: "DS Intern · ₹60k/mo", s: "Eligible", why: "Closes in 1d 16h · reminder set", c: "emerald" },
            { o: "Ledgerly Fintech", r: "Backend · ₹16 LPA", s: "Eligible", why: "Deadline extended by 12 hours", c: "emerald" },
          ].map((c, i) => (
            <Reveal key={c.o} delay={0.15 * i}>
              <div className="glass glow-border flex items-center gap-4 p-4">
                <div className={`grid h-10 w-10 place-items-center rounded-xl ${c.c === "rose" ? "bg-rose-500/15 text-rose-300" : "bg-emerald-500/15 text-emerald-300"}`}>
                  {c.c === "rose" ? <Filter className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                </div>
                <div className="min-w-0">
                  <div className="font-medium">
                    {c.o} <span className="text-white/40">· {c.r}</span>
                  </div>
                  <div className={`text-sm ${c.c === "rose" ? "text-rose-300/80" : "text-emerald-300/80"}`}>
                    {c.s} — {c.why}
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────── Pipeline ───────────── */

const STEPS = [
  { Icon: Mail, t: "Collect", d: "Volunteer inboxes auto-forward CDC mail to one project inbox." },
  { Icon: Radar, t: "Fetch", d: "Every 15–30 min, new mails are pulled; duplicates skipped by hash." },
  { Icon: ShieldCheck, t: "Clean", d: "Names and reg. numbers are stripped before any AI sees the text." },
  { Icon: BrainCircuit, t: "Extract", d: "AI classifies the mail and returns structured JSON, PDFs included." },
  { Icon: ScanSearch, t: "Validate", d: "Dates, CGPA ranges and links checked; low confidence → Check manually." },
  { Icon: UserCheck, t: "Match", d: "Plain code compares rules with every profile and stores the reasons." },
  { Icon: Send, t: "Notify", d: "Telegram, email or push — instantly, then 24h and 2h before close." },
  { Icon: LayoutDashboard, t: "Show", d: "Dashboard, calendar and company pages update live." },
];

export function Pipeline() {
  return (
    <section id="how" className="relative px-4 py-28 sm:px-6">
      <SectionHead
        eyebrow="How it works"
        title={
          <>
            One inbox in. <span className="text-gradient">Thousands of personal feeds</span> out.
          </>
        }
        sub="Each mail is read once by AI and matched against every student's profile — so no one ever grants access to their own Gmail."
      />
      <div className="relative mx-auto max-w-6xl">
        <div aria-hidden className="absolute left-6 top-0 h-full w-px bg-gradient-to-b from-violet-500/0 via-violet-500/60 to-cyan-400/0 md:left-1/2" />
        <div className="space-y-6 md:space-y-0">
          {STEPS.map((s, i) => {
            const left = i % 2 === 0;
            return (
              <Reveal key={s.t} delay={0.04 * i}>
                <div className={`relative flex pl-16 md:w-1/2 ${left ? "md:pl-0 md:pr-14" : "md:ml-auto md:pl-14"}`}>
                  <div
                    className={`absolute top-5 grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-ink-900 shadow-glow left-0 ${left ? "md:left-auto md:-right-6" : "md:-left-6"}`}
                  >
                    <s.Icon className="h-5 w-5 text-cyan-300" />
                  </div>
                  <TiltCard className="w-full p-5" intensity={6}>
                    <div className="mb-1 flex items-center gap-3">
                      <span className="font-display text-sm font-semibold text-violet-300/80">0{i + 1}</span>
                      <h3 className="font-display text-lg font-semibold">{s.t}</h3>
                    </div>
                    <p className="text-sm leading-relaxed text-white/55">{s.d}</p>
                  </TiltCard>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ───────────── Features ───────────── */

const FEATURES = [
  { Icon: Sparkles, t: "Auto mail parsing", d: "No more reading every CDC mail. AI pulls company, role, CTC, cutoffs, link and deadline.", span: "md:col-span-2" },
  { Icon: UserCheck, t: "Eligibility with reasons", d: "“CGPA 7.6 is below the required 8.0” — plus the exact line from the mail." },
  { Icon: Bell, t: "Deadline reminders", d: "24h and 2h before close. Auto-cancelled once you mark Applied." },
  { Icon: LayoutDashboard, t: "One dashboard", d: "Every open drive sorted by deadline, with smart views like “Closing in 48h”." },
  { Icon: CalendarDays, t: "Calendar + export", d: "Deadlines, tests and events on one calendar; one click to Google Calendar." },
  { Icon: KanbanSquare, t: "Application tracker", d: "Applied → Shortlisted → Interview → Selected. Shortlists auto-update your status.", span: "md:col-span-2" },
  { Icon: Send, t: "Telegram alerts", d: "Instant pings for new eligible drives, plus a daily digest at the time you pick." },
  { Icon: Bot, t: "Ask the CDC assistant", d: "“Which internships this month allow CGPA 7.5?” — answers cite the source mail." },
  { Icon: Users, t: "Seniors' experiences", d: "Interview rounds, questions and tips per company, anonymous if you like.", span: "md:col-span-2" },
];

export function Features() {
  return (
    <section id="features" className="relative px-4 py-28 sm:px-6">
      <SectionHead
        eyebrow="Features"
        title={
          <>
            Your placement season, <span className="text-gradient">on autopilot</span>
          </>
        }
      />
      <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-3">
        {FEATURES.map((f, i) => (
          <Reveal key={f.t} delay={0.05 * i} className={f.span}>
            <TiltCard className="p-6">
              <div className="mb-5 grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-violet-500/30 to-cyan-400/20 ring-1 ring-white/10">
                <f.Icon className="h-6 w-6 text-violet-200" />
              </div>
              <h3 className="font-display text-xl font-semibold">{f.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/55">{f.d}</p>
            </TiltCard>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ───────────── Categories 3D carousel ───────────── */

const CAT_FIELDS: Record<Exclude<Category, "other">, string[]> = {
  "full-time": ["Role", "CTC", "Location", "Bond", "Joining date"],
  internship: ["Role", "Stipend", "Duration", "Summer / semester", "PPO chance"],
  "intern-ft": ["Stipend", "Duration", "CTC on conversion", "Bond"],
  hackathon: ["Organizer", "Theme", "Team size", "Prizes", "Event dates"],
  workshop: ["Topic", "Date & time", "Venue / link", "Mandatory?"],
  update: ["Linked drive", "Round", "Next step", "Date"],
};

export function Categories() {
  const cats = Object.keys(CAT_FIELDS) as (keyof typeof CAT_FIELDS)[];
  const step = 360 / cats.length;
  return (
    <section id="categories" className="relative overflow-hidden px-4 py-28 sm:px-6">
      <SectionHead
        eyebrow="Every opportunity type"
        title={
          <>
            Each category gets <span className="text-gradient">its own fields</span>
          </>
        }
        sub="Hover to pause the ring. Opportunities with no CGPA rule are marked “Open to all” — never hidden."
      />
      <div className="mx-auto flex h-[420px] items-center justify-center" style={{ perspective: 1600 }}>
        <div className="carousel relative h-[300px] w-[230px]" style={{ transformStyle: "preserve-3d" }}>
          {cats.map((c, i) => {
            const m = CATEGORY_META[c];
            return (
              <div
                key={c}
                className="glass absolute inset-0 p-5"
                style={{
                  transform: `rotateY(${i * step}deg) translateZ(clamp(220px, 32vw, 340px))`,
                  backfaceVisibility: "hidden",
                  boxShadow: `0 0 60px -18px ${m.color}`,
                  borderColor: `${m.color}55`,
                }}
              >
                <div className="mb-4 h-1.5 w-14 rounded-full" style={{ background: m.color, boxShadow: `0 0 18px ${m.color}` }} />
                <h3 className="font-display text-xl font-semibold">{m.label}</h3>
                <ul className="mt-4 space-y-2 text-sm text-white/60">
                  {CAT_FIELDS[c].map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <span className="h-1 w-1 rounded-full" style={{ background: m.color }} />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
      <style>{`
        .carousel { animation: spin 28s linear infinite; }
        .carousel:hover { animation-play-state: paused; }
        @keyframes spin { from { transform: rotateX(-8deg) rotateY(0); } to { transform: rotateX(-8deg) rotateY(-360deg); } }
      `}</style>
    </section>
  );
}

/* ───────────── Evaluation targets ───────────── */

const TARGETS = [
  { v: 98, l: "Opportunity recall", d: "Missing a drive is worse than a false alarm" },
  { v: 95, l: "Category accuracy", d: "On 150–200 hand-labelled CDC mails" },
  { v: 90, l: "Field accuracy", d: "Deadline, CGPA cutoff and link" },
  { v: 95, l: "Eligibility correctness", d: "Matches a manual check" },
];

export function Targets() {
  return (
    <section className="px-4 py-24 sm:px-6">
      <SectionHead eyebrow="Measured, not promised" title={<>Judged on <span className="text-gradient">real numbers</span></>} />
      <div className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TARGETS.map((t, i) => (
          <Reveal key={t.l} delay={0.08 * i}>
            <div className="glass glow-border p-6 text-center">
              <Ring value={t.v} />
              <div className="mt-4 font-display font-semibold">{t.l}</div>
              <div className="mt-1 text-xs text-white/45">{t.d}</div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function Ring({ value }: { value: number }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative mx-auto h-28 w-28">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <defs>
          <linearGradient id="rg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#a78bfa" />
            <stop offset="1" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="7" />
        <motion.circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="url(#rg)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          whileInView={{ strokeDashoffset: c * (1 - value / 100) }}
          viewport={{ once: true }}
          transition={{ duration: 1.6, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center font-display text-2xl font-bold">≥{value}%</div>
    </div>
  );
}

/* ───────────── Privacy + CTA ───────────── */

const PRIVACY = [
  { Icon: MailCheck, t: "Your inbox stays yours", d: "Only a central project inbox is read. You never grant Gmail access." },
  { Icon: Lock, t: "VIT-only sign-in", d: "Google sign-in restricted to the college domain, with row-level security." },
  { Icon: ShieldCheck, t: "No personal data to AI", d: "Names and registration numbers are removed before mail text reaches a model." },
  { Icon: Trash2, t: "Delete anytime", d: "One button removes your profile, statuses and reminders." },
];

export function Privacy() {
  return (
    <section id="privacy" className="px-4 py-24 sm:px-6">
      <SectionHead eyebrow="Privacy by design" title={<>Built so you can <span className="text-gradient">trust it</span></>} />
      <div className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PRIVACY.map((p, i) => (
          <Reveal key={p.t} delay={0.06 * i}>
            <TiltCard className="p-6" intensity={8}>
              <p.Icon className="mb-4 h-7 w-7 text-emerald-300" />
              <h3 className="font-display font-semibold">{p.t}</h3>
              <p className="mt-2 text-sm text-white/55">{p.d}</p>
            </TiltCard>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export function CTA() {
  return (
    <section className="px-4 pb-24 pt-8 sm:px-6">
      <Reveal>
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-white/10 p-10 text-center sm:p-16">
          <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-violet-700/50 via-indigo-700/30 to-cyan-600/40" />
          <div aria-hidden className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-fuchsia-500/40 blur-3xl" />
          <div aria-hidden className="absolute -bottom-24 -right-10 h-72 w-72 rounded-full bg-cyan-400/40 blur-3xl" />
          <div className="relative">
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">Stop reading every CDC mail.</h2>
            <p className="mx-auto mt-4 max-w-xl text-white/70">Save your profile once. We&apos;ll tell you what you qualify for — and remind you before it closes.</p>
            <Link href="/dashboard" className="btn-primary group mt-8">
              Open your dashboard <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-white/5 px-4 py-10 text-center text-sm text-white/35 sm:px-6">
      CDC Placement Mail Tracker · Built for VIT Vellore students · Not an official CDC product
    </footer>
  );
}
