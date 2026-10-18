"use client";

import { Reveal } from "@/components/ui/Reveal";
import { OpportunityCard } from "@/components/opportunity/OpportunityCard";
import { useStore } from "@/lib/store";

export function LivePreview() {
  const { ready, opportunities, student } = useStore();
  const pick = ["quantix-intern", "nimbus-sde", "hackverse"]
    .map((id) => opportunities.find((o) => o.id === id))
    .filter(Boolean) as typeof opportunities;

  return (
    <section className="px-4 py-28 sm:px-6">
      <Reveal className="mx-auto mb-12 max-w-2xl text-center">
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300/80">Live preview</div>
        <h2 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">
          Cards that <span className="text-gradient">explain themselves</span>
        </h2>
        <p className="mt-4 text-white/55">
          Shown for a sample profile — {student.branch}, batch {student.batch}, CGPA {student.cgpa}. Move your cursor over a card.
        </p>
      </Reveal>
      <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-3">
        {ready ? pick.map((o, i) => <OpportunityCard key={o.id} o={o} index={i} />) : [0, 1, 2].map((i) => <div key={i} className="glass h-80 animate-pulse" />)}
      </div>
    </section>
  );
}
