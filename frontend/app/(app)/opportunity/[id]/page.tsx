"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import clsx from "clsx";
import { motion } from "framer-motion";
import { ArrowLeft, CalendarPlus, Check, ExternalLink, Flag, Gauge, Mail, Quote } from "lucide-react";
import { CategoryChip, EligibilityBadge } from "@/components/opportunity/Badges";
import { RemindersPanel } from "@/components/opportunity/RemindersPanel";
import { OrgTile } from "@/components/ui/Logo";
import { EVENT_FLOW, JOB_FLOW, countdown, fmtDate, gcalLink, isEventCategory } from "@/lib/format";
import { useStore } from "@/lib/store";

export default function OpportunityPage() {
  const { id } = useParams<{ id: string }>();
  const { ready, opportunities, now, setStatus, setNote, report, reported } = useStore();
  const o = opportunities.find((x) => x.id === id);

  if (!ready) return <div className="glass h-96 animate-pulse" />;
  if (!o)
    return (
      <div className="glass p-10 text-center">
        <p>That opportunity was not found.</p>
        <Link href="/dashboard" className="btn-ghost mt-4">
          Back to dashboard
        </Link>
      </div>
    );

  const cd = countdown(o.deadline, now);
  const flow = isEventCategory(o.category) ? EVENT_FLOW : JOB_FLOW;
  const current = o.application?.status ?? flow[0].id;
  return (
    <div>
      <Link href="/dashboard" className="mb-6 inline-flex items-center gap-2 text-sm text-white/50 transition hover:text-white">
        <ArrowLeft className="h-4 w-4" /> All opportunities
      </Link>

      <motion.div initial={{ opacity: 0, y: 20, rotateX: -10 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} className="glass glow-border mb-6 overflow-hidden p-6 sm:p-8">
        <div aria-hidden className="absolute -right-20 -top-24 h-64 w-64 rounded-full blur-3xl" style={{ background: `hsl(${o.logoHue} 80% 55% / .35)` }} />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start">
          <OrgTile name={o.organization} hue={o.logoHue} size={64} />
          <div className="flex-1">
            <div className="flex flex-wrap gap-2">
              <CategoryChip category={o.category} />
              <EligibilityBadge state={o.eligibility.state} />
            </div>
            <h1 className="mt-3 font-display text-3xl font-bold tracking-tight">{o.title}</h1>
            <div className="text-white/55">{o.organization}</div>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <div className={clsx("rounded-xl border px-4 py-2 font-display text-lg font-semibold", cd.urgent ? "border-rose-400/40 bg-rose-500/10 text-rose-300" : "border-white/10 bg-white/5")}>{cd.text}</div>
            <div className="text-xs text-white/40">Deadline {fmtDate(o.deadline)}</div>
          </div>
        </div>
        <div className="relative mt-6 flex flex-wrap gap-3">
          <a href={o.registrationLink} target="_blank" rel="noreferrer" className="btn-primary">
            Register now <ExternalLink className="h-4 w-4" />
          </a>
          {(o.deadline || o.eventDate) && (
            <a
              href={gcalLink(`${o.organization} — ${o.title} (${o.deadline ? "deadline" : "event"})`, o.deadline || o.eventDate!, o.summary.join(" "), o.registrationLink)}
              target="_blank"
              rel="noreferrer"
              className="btn-ghost"
            >
              <CalendarPlus className="h-4 w-4" /> Add to Google Calendar
            </a>
          )}
        </div>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="glass p-6">
            <h2 className="mb-4 font-display text-lg font-semibold">Details</h2>
            <dl className="grid gap-3 sm:grid-cols-2">
              {Object.entries(o.details).map(([k, v]) => (
                <div key={k} className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
                  <dt className="text-xs uppercase tracking-wider text-white/40">{k}</dt>
                  <dd className="mt-1 font-medium">{v}</dd>
                </div>
              ))}
              {o.eventDate && (
                <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
                  <dt className="text-xs uppercase tracking-wider text-white/40">Event date</dt>
                  <dd className="mt-1 font-medium">{fmtDate(o.eventDate)}</dd>
                </div>
              )}
            </dl>
          </section>

          <section className="glass p-6">
            <h2 className="mb-4 font-display text-lg font-semibold">Eligibility</h2>
            {o.eligibility.state === "eligible" && <p className="text-emerald-300">You meet every stated criterion.</p>}
            {o.eligibility.state === "open" && <p className="text-cyan-300">No criteria in the mail — open to all.</p>}
            {o.eligibility.reasons.length > 0 && (
              <ul className="space-y-2">
                {o.eligibility.reasons.map((r) => (
                  <li key={r} className={clsx("rounded-xl border p-3 text-sm", o.eligibility.state === "check" ? "border-amber-400/25 bg-amber-400/5 text-amber-200" : "border-rose-400/25 bg-rose-400/5 text-rose-200")}>
                    {r}
                  </li>
                ))}
              </ul>
            )}
            {o.rule?.sourceLine && (
              <blockquote className="mt-4 flex gap-3 rounded-xl border border-white/5 bg-black/25 p-4 text-sm italic text-white/60">
                <Quote className="h-4 w-4 shrink-0 text-violet-300" />
                {o.rule.sourceLine}
              </blockquote>
            )}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-white/45">
              <span className="flex items-center gap-1.5">
                <Gauge className="h-3.5 w-3.5" /> AI extraction confidence {(o.confidence * 100).toFixed(0)}%
              </span>
              <button onClick={() => report(o.id)} disabled={reported.includes(o.id)} className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 transition hover:border-amber-400/40 hover:text-amber-200 disabled:text-amber-300/70">
                <Flag className="h-3.5 w-3.5" /> {reported.includes(o.id) ? "Reported — thanks" : "Report wrong criteria"}
              </button>
            </div>
          </section>

          <section className="glass p-6">
            <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-semibold">
              <Mail className="h-4 w-4 text-violet-300" /> Original mail
            </h2>
            <div className="mb-4 text-xs text-white/40">
              {o.mail.sender} · {fmtDate(o.mail.receivedAt)}
            </div>
            <div className="mb-3 font-medium">{o.mail.subject}</div>
            <pre className="whitespace-pre-wrap rounded-xl border border-white/5 bg-black/30 p-4 font-sans text-sm leading-relaxed text-white/65">{o.mail.body}</pre>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="glass p-6">
            <h2 className="mb-4 font-display text-lg font-semibold">Your status</h2>
            <ol className="relative space-y-1">
              {flow.map((s) => {
                const idx = flow.findIndex((f) => f.id === current);
                const mine = flow.findIndex((f) => f.id === s.id);
                const done = mine <= idx && !["skipped", "rejected"].includes(s.id) && !["skipped", "rejected"].includes(current);
                const on = s.id === current;
                return (
                  <li key={s.id}>
                    <button
                      onClick={() => setStatus(o.id, s.id)}
                      className={clsx("flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition", on ? "bg-violet-500/20 text-white ring-1 ring-violet-400/40" : "text-white/55 hover:bg-white/5 hover:text-white")}
                    >
                      <span className={clsx("grid h-6 w-6 place-items-center rounded-full border text-[10px]", done || on ? "border-violet-400 bg-violet-500 text-white shadow-glow" : "border-white/20")}>
                        {(done || on) && <Check className="h-3.5 w-3.5" />}
                      </span>
                      {s.label}
                    </button>
                  </li>
                );
              })}
            </ol>
            <label className="label mt-5">Private note</label>
            <textarea
              defaultValue={o.application?.note}
              onBlur={(e) => setNote(o.id, e.target.value)}
              rows={3}
              placeholder="e.g. OA on Friday, revise graphs"
              className="input resize-none"
            />
          </section>

          <RemindersPanel o={o} />
        </aside>
      </div>
    </div>
  );
}
