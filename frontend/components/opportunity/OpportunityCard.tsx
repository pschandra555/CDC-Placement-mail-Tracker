"use client";

import Link from "next/link";
import clsx from "clsx";
import { motion } from "framer-motion";
import { CalendarClock, Clock, ExternalLink, Flag, Quote, RefreshCw } from "lucide-react";
import { TiltCard } from "@/components/ui/TiltCard";
import { OrgTile } from "@/components/ui/Logo";
import { CategoryChip, EligibilityBadge } from "./Badges";
import { countdown, fmtDate, statusLabel } from "@/lib/format";
import { useStore, type Enriched } from "@/lib/store";

const HEADLINE_FIELDS = ["CTC", "Stipend", "Prizes", "Location", "Mode", "Venue", "Next step"];

export function OpportunityCard({ o, index = 0 }: { o: Enriched; index?: number }) {
  const { now, report, reported } = useStore();
  const cd = countdown(o.deadline, now);
  const dim = o.eligibility.state === "not-eligible";
  const facts = HEADLINE_FIELDS.filter((k) => o.details[k]).slice(0, 2);
  const wasReported = reported.includes(o.id);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.45, delay: Math.min(index, 8) * 0.04, ease: [0.22, 1, 0.36, 1] }}
    >
      <TiltCard intensity={5} className={clsx("p-5 transition", dim && "opacity-60 saturate-[.4] hover:opacity-90 hover:saturate-100")}>
        <div className="flex items-start gap-4">
          <OrgTile name={o.organization} hue={o.logoHue} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <CategoryChip category={o.category} />
              <EligibilityBadge state={o.eligibility.state} />
              {o.status === "updated" && (
                <span className="chip border-sky-400/30 bg-sky-400/10 text-sky-300">
                  <RefreshCw className="h-3 w-3" /> {o.updateNote ?? "Updated"}
                </span>
              )}
              {o.application && !["not-applied", "not-registered"].includes(o.application.status) && (
                <span className="chip border-violet-400/30 bg-violet-400/10 text-violet-200">{statusLabel(o.application.status)}</span>
              )}
            </div>
            <Link href={`/opportunity/${o.id}`} className="mt-2 block">
              <h3 className="font-display text-lg font-semibold leading-snug transition hover:text-violet-200">{o.title}</h3>
              <div className="text-sm text-white/50">{o.organization}</div>
            </Link>
          </div>
          <div
            className={clsx(
              "hidden shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold sm:flex",
              cd.closed ? "border-white/10 text-white/40" : cd.urgent ? "border-rose-400/40 bg-rose-500/10 text-rose-300 shadow-[0_0_24px_-6px_rgba(244,63,94,.7)]" : "border-white/10 bg-white/5 text-white/70",
            )}
          >
            <Clock className="h-3.5 w-3.5" />
            {cd.text}
          </div>
        </div>

        <ul className="mt-4 space-y-1 text-sm text-white/60">
          {o.summary.map((s) => (
            <li key={s} className="flex gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-violet-400" />
              {s}
            </li>
          ))}
        </ul>

        {o.eligibility.reasons.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {o.eligibility.reasons.map((r) => (
              <span key={r} className={clsx("chip", o.eligibility.state === "check" ? "border-amber-400/25 bg-amber-400/5 text-amber-200/90" : "border-rose-400/25 bg-rose-400/5 text-rose-200/90")}>
                {r}
              </span>
            ))}
          </div>
        )}

        {o.rule?.sourceLine && (
          <div className="mt-3 flex gap-2 rounded-xl border border-white/5 bg-black/20 p-3 text-xs italic text-white/45">
            <Quote className="h-3.5 w-3.5 shrink-0 text-violet-300/60" />
            {o.rule.sourceLine}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-white/50">
          {facts.map((k) => (
            <span key={k}>
              <span className="text-white/30">{k}:</span> <span className="text-white/80">{o.details[k]}</span>
            </span>
          ))}
          <span className={clsx("flex items-center gap-1 sm:hidden", cd.urgent && "text-rose-300")}>
            <Clock className="h-3 w-3" /> {cd.text}
          </span>
          {o.eventDate && (
            <span className="flex items-center gap-1">
              <CalendarClock className="h-3 w-3" /> Event {fmtDate(o.eventDate)}
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => report(o.id)}
              disabled={wasReported}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-white/40 transition hover:bg-white/5 hover:text-amber-200 disabled:text-amber-300/70"
              title="Report wrong criteria"
            >
              <Flag className="h-3.5 w-3.5" /> {wasReported ? "Reported" : "Report"}
            </button>
            <a href={o.registrationLink} target="_blank" rel="noreferrer" className="btn-primary !gap-1.5 !rounded-lg !px-3 !py-1.5 text-xs">
              Register <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </TiltCard>
    </motion.div>
  );
}
