"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CATEGORY_META } from "@/lib/mockData";
import { useStore } from "@/lib/store";

interface Ev {
  id: string;
  label: string;
  kind: "deadline" | "event";
  color: string;
  date: Date;
}

const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export default function CalendarPage() {
  const { ready, opportunities, now } = useStore();
  const [offset, setOffset] = useState(0);

  const events = useMemo(() => {
    const map = new Map<string, Ev[]>();
    const add = (e: Ev) => map.set(key(e.date), [...(map.get(key(e.date)) ?? []), e]);
    opportunities.forEach((o) => {
      const color = CATEGORY_META[o.category].color;
      if (o.deadline) add({ id: o.id, label: `${o.organization} closes`, kind: "deadline", color, date: new Date(o.deadline) });
      if (o.eventDate) add({ id: o.id, label: o.title, kind: "event", color, date: new Date(o.eventDate) });
    });
    return map;
  }, [opportunities]);

  if (!ready) return <div className="glass h-[600px] animate-pulse" />;

  const today = new Date(now);
  const month = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const startPad = (month.getDay() + 6) % 7; // Monday first
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = [...Array(startPad).fill(null), ...Array.from({ length: days }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            <span className="text-gradient">Calendar</span>
          </h1>
          <p className="mt-1 text-white/50">Deadlines and event dates in one place. Export any one from its page.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setOffset((o) => o - 1)} className="btn-ghost !p-2" aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="w-40 text-center font-display font-semibold">{month.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</div>
          <button onClick={() => setOffset((o) => o + 1)} className="btn-ghost !p-2" aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="glass overflow-hidden p-2 sm:p-4">
        <div className="grid grid-cols-7 gap-1 pb-2 text-center text-xs uppercase tracking-wider text-white/40">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (!d) return <div key={`p${i}`} />;
            const evs = events.get(key(d)) ?? [];
            const isToday = key(d) === key(today);
            return (
              <div
                key={i}
                className={clsx(
                  "min-h-[64px] rounded-xl border p-1.5 transition sm:min-h-[104px] sm:p-2",
                  isToday ? "border-violet-400/60 bg-violet-500/10 shadow-glow" : "border-white/5 bg-white/[0.02] hover:bg-white/[0.05]",
                )}
              >
                <div className={clsx("text-xs", isToday ? "font-bold text-violet-200" : "text-white/50")}>{d.getDate()}</div>
                <div className="mt-1 space-y-1">
                  {evs.slice(0, 3).map((e, j) => (
                    <Link
                      key={j}
                      href={`/opportunity/${e.id}`}
                      title={e.label}
                      className="block truncate rounded-md px-1.5 py-0.5 text-[10px] leading-tight sm:text-[11px]"
                      style={{ background: `${e.color}22`, color: e.color, borderLeft: `2px solid ${e.color}` }}
                    >
                      <span className="hidden sm:inline">{e.kind === "deadline" ? "⏰ " : "📍 "}</span>
                      {e.label}
                    </Link>
                  ))}
                  {evs.length > 3 && <div className="text-[10px] text-white/40">+{evs.length - 3} more</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
