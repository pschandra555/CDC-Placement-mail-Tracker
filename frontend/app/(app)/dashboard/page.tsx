"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { Flame, Inbox, Search, Sparkles, Target, TimerReset, UserRound } from "lucide-react";
import { OpportunityCard } from "@/components/opportunity/OpportunityCard";
import { CATEGORY_META } from "@/lib/mockData";
import { isApplied, useStore } from "@/lib/store";
import type { Category, EligibilityState } from "@/lib/types";

type View = "all" | "closing" | "eligible-not-applied" | "mine";

const VIEWS: { id: View; label: string; Icon: typeof Flame }[] = [
  { id: "all", label: "All open", Icon: Inbox },
  { id: "closing", label: "Closing in 48h", Icon: Flame },
  { id: "eligible-not-applied", label: "Eligible, not applied", Icon: Target },
  { id: "mine", label: "My applications", Icon: TimerReset },
];

const EL_FILTERS: { id: EligibilityState | "any"; label: string }[] = [
  { id: "any", label: "Any eligibility" },
  { id: "eligible", label: "Eligible" },
  { id: "open", label: "Open to all" },
  { id: "check", label: "Check manually" },
  { id: "not-eligible", label: "Not eligible" },
];

export default function Dashboard() {
  const { ready, opportunities, now, student, mode, profileComplete } = useStore();
  const [view, setView] = useState<View>("all");
  const [cats, setCats] = useState<Category[]>([]);
  const [el, setEl] = useState<EligibilityState | "any">("any");
  const [q, setQ] = useState("");

  const open = useMemo(() => opportunities.filter((o) => !o.deadline || +new Date(o.deadline) > now), [opportunities, now]);
  const canApply = (s: EligibilityState) => s === "eligible" || s === "open";
  const closingSoon = (d: string) => !!d && +new Date(d) - now < 48 * 3600_000;

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return open.filter((o) => {
      if (view === "closing" && !closingSoon(o.deadline)) return false;
      if (view === "eligible-not-applied" && (!canApply(o.eligibility.state) || isApplied(o) || o.category === "update")) return false;
      if (view === "mine" && !isApplied(o)) return false;
      if (cats.length && !cats.includes(o.category)) return false;
      if (el !== "any" && o.eligibility.state !== el) return false;
      if (term && !`${o.title} ${o.organization} ${o.summary.join(" ")}`.toLowerCase().includes(term)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, view, cats, el, q, now]);

  const stats = [
    { label: "You're eligible", value: open.filter((o) => canApply(o.eligibility.state) && o.category !== "update").length, tone: "from-emerald-400/30 to-cyan-400/10", glow: "rgba(52,211,153,.5)" },
    { label: "Closing in 48h", value: open.filter((o) => closingSoon(o.deadline)).length, tone: "from-rose-500/30 to-fuchsia-500/10", glow: "rgba(244,63,94,.5)" },
    { label: "Applied / registered", value: open.filter(isApplied).length, tone: "from-violet-500/30 to-indigo-500/10", glow: "rgba(139,92,246,.5)" },
    { label: "Need a manual check", value: open.filter((o) => o.eligibility.state === "check").length, tone: "from-amber-400/30 to-orange-500/10", glow: "rgba(251,191,36,.45)" },
  ];

  const toggleCat = (c: Category) => setCats((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]));

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="chip mb-3 border-cyan-400/30 bg-cyan-400/10 text-cyan-200">
          <Sparkles className="h-3.5 w-3.5" /> {mode === "api" ? "Live · synced with the CDC inbox" : "Demo · sample data"}
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Hey {ready ? student.name.split(" ")[0] : "there"}, <span className="text-gradient">here&apos;s what&apos;s open</span>
        </h1>
      </motion.div>

      {ready && !profileComplete && (
        <Link href="/profile" className="glass glow-border mb-6 flex items-center gap-3 border-amber-400/30 p-4 text-sm text-amber-100">
          <UserRound className="h-5 w-5 shrink-0 text-amber-300" />
          Save your CGPA, branch and batch once to see which drives you&apos;re eligible for.
          <span className="ml-auto shrink-0 font-medium text-amber-300">Complete profile →</span>
        </Link>
      )}

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 16, rotateX: -20 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ delay: 0.05 * i }}
            className={`glass overflow-hidden p-4 sm:p-5`}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${s.tone} opacity-60`} />
            <div className="relative">
              <div className="font-display text-3xl font-bold sm:text-4xl" style={{ textShadow: `0 0 24px ${s.glow}` }}>
                {ready ? s.value : "–"}
              </div>
              <div className="mt-1 text-xs text-white/60 sm:text-sm">{s.label}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* smart views */}
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {VIEWS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={clsx("relative flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm transition", view === id ? "text-white" : "text-white/50 hover:text-white")}
          >
            {view === id && <motion.span layoutId="view-pill" className="absolute inset-0 rounded-xl border border-violet-400/30 bg-violet-500/15" />}
            <Icon className="relative h-4 w-4" />
            <span className="relative">{label}</span>
          </button>
        ))}
      </div>

      {/* filters */}
      <div className="glass mb-6 flex flex-col gap-3 p-3 md:flex-row md:items-center">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search company, role, keyword…" className="input !pl-9" />
        </label>
        <select value={el} onChange={(e) => setEl(e.target.value as EligibilityState | "any")} className="input md:w-48 [&>option]:bg-ink-900">
          {EL_FILTERS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
      </div>
      <div className="mb-6 flex flex-wrap gap-2">
        {(Object.keys(CATEGORY_META) as Category[])
          .filter((c) => c !== "other")
          .map((c) => {
            const on = cats.includes(c);
            const m = CATEGORY_META[c];
            return (
              <button
                key={c}
                onClick={() => toggleCat(c)}
                className={clsx("chip transition", on ? "text-white" : "border-white/10 bg-white/[0.03] text-white/55 hover:text-white")}
                style={on ? { borderColor: m.color, background: `${m.color}22`, boxShadow: `0 0 18px -6px ${m.color}` } : undefined}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} />
                {m.label}
              </button>
            );
          })}
        {cats.length > 0 && (
          <button onClick={() => setCats([])} className="chip border-transparent text-white/40 hover:text-white">
            Clear
          </button>
        )}
      </div>

      {!ready ? (
        <div className="grid gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass h-56 animate-pulse" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="glass grid place-items-center p-14 text-center">
          <Inbox className="mb-3 h-10 w-10 text-white/25" />
          <div className="font-display text-lg font-semibold">Nothing here</div>
          <p className="mt-1 text-sm text-white/45">
            {view === "mine" ? "Mark a drive as Applied from its page and it will show up here." : "Try clearing a filter or search."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <AnimatePresence mode="popLayout">
            {list.map((o, i) => (
              <OpportunityCard key={o.id} o={o} index={i} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
