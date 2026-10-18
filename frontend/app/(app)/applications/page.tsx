"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { KanbanSquare } from "lucide-react";
import { OrgTile } from "@/components/ui/Logo";
import { statusLabel } from "@/lib/format";
import { useStore, type Enriched } from "@/lib/store";
import type { AppStatus } from "@/lib/types";

const COLUMNS: { title: string; statuses: AppStatus[]; color: string }[] = [
  { title: "Applied", statuses: ["applied", "registered"], color: "#8b5cf6" },
  { title: "In progress", statuses: ["shortlisted", "interview", "team-formed", "submitted"], color: "#22d3ee" },
  { title: "Outcome", statuses: ["selected", "result", "rejected"], color: "#a3e635" },
  { title: "Skipped", statuses: ["skipped"], color: "#94a3b8" },
];

export default function Applications() {
  const { ready, opportunities } = useStore();
  const tracked = opportunities.filter((o) => o.application && !["not-applied", "not-registered"].includes(o.application.status));

  return (
    <div>
      <h1 className="mb-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
        Application <span className="text-gradient">tracker</span>
      </h1>
      <p className="mb-8 text-white/50">Update a status from any opportunity page. Shortlist mails will move cards here automatically once the backend is live.</p>

      {ready && tracked.length === 0 && (
        <div className="glass mb-8 flex items-center gap-4 p-5 text-sm text-white/60">
          <KanbanSquare className="h-8 w-8 shrink-0 text-violet-300" />
          Nothing tracked yet. Open an opportunity and mark it Applied or Registered.
          <Link href="/dashboard" className="btn-ghost ml-auto !py-2 text-xs">
            Browse
          </Link>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col, ci) => {
          const items = tracked.filter((o) => col.statuses.includes(o.application!.status));
          return (
            <motion.section key={col.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: ci * 0.06 }} className="glass min-h-[220px] p-4">
              <div className="mb-4 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: col.color, boxShadow: `0 0 10px ${col.color}` }} />
                <h2 className="font-display font-semibold">{col.title}</h2>
                <span className="ml-auto rounded-full bg-white/5 px-2 text-xs text-white/50">{items.length}</span>
              </div>
              <div className="space-y-3">
                {items.map((o) => (
                  <MiniCard key={o.id} o={o} />
                ))}
              </div>
            </motion.section>
          );
        })}
      </div>
    </div>
  );
}

function MiniCard({ o }: { o: Enriched }) {
  return (
    <Link href={`/opportunity/${o.id}`} className="block rounded-xl border border-white/10 bg-white/[0.04] p-3 transition hover:-translate-y-0.5 hover:border-violet-400/40 hover:shadow-glow">
      <div className="flex items-center gap-3">
        <OrgTile name={o.organization} hue={o.logoHue} size={32} />
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{o.title}</div>
          <div className="truncate text-xs text-white/45">{o.organization}</div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-violet-200">{statusLabel(o.application!.status)}</span>
        {o.application?.note && <span className="truncate pl-2 text-white/40">“{o.application.note}”</span>}
      </div>
    </Link>
  );
}
