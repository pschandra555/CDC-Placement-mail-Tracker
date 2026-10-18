import { AlertTriangle, CheckCircle2, Globe2, XCircle } from "lucide-react";
import clsx from "clsx";
import { CATEGORY_META } from "@/lib/mockData";
import type { Category, EligibilityState } from "@/lib/types";

const EL = {
  eligible: { label: "Eligible", Icon: CheckCircle2, cls: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300 shadow-[0_0_20px_-6px_rgba(52,211,153,.6)]" },
  "not-eligible": { label: "Not eligible", Icon: XCircle, cls: "border-rose-400/25 bg-rose-400/10 text-rose-300" },
  check: { label: "Check manually", Icon: AlertTriangle, cls: "border-amber-400/30 bg-amber-400/10 text-amber-300" },
  open: { label: "Open to all", Icon: Globe2, cls: "border-cyan-400/30 bg-cyan-400/10 text-cyan-300 shadow-[0_0_20px_-6px_rgba(34,211,238,.6)]" },
} as const;

export function EligibilityBadge({ state, className }: { state: EligibilityState; className?: string }) {
  const { label, Icon, cls } = EL[state];
  return (
    <span className={clsx("chip", cls, className)}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

export function CategoryChip({ category }: { category: Category }) {
  const m = CATEGORY_META[category];
  return (
    <span className="chip border-white/10 bg-white/5 text-white/70">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color, boxShadow: `0 0 8px ${m.color}` }} />
      {m.label}
    </span>
  );
}
