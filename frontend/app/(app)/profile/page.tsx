"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Save, Trash2, Wand2 } from "lucide-react";
import { TiltCard } from "@/components/ui/TiltCard";
import { BrandMark } from "@/components/ui/Logo";
import { ALL_BRANCHES, checkEligibility, parseRegNo } from "@/lib/eligibility";
import { CATEGORY_META, getOpportunities } from "@/lib/mockData";
import { useStore } from "@/lib/store";
import type { Category, Student } from "@/lib/types";

export default function Profile() {
  const { ready, student, setStudent, resetAll } = useStore();
  const [draft, setDraft] = useState<Student>(student);
  const [saved, setSaved] = useState(false);

  useEffect(() => setDraft(student), [student]);

  // Live preview of how many drives the draft profile qualifies for.
  const preview = useMemo(() => {
    if (!ready) return { eligible: 0, total: 0 };
    const opps = getOpportunities().filter((o) => o.rule && !o.rule.unclear);
    return { eligible: opps.filter((o) => checkEligibility(o, draft).state === "eligible").length, total: opps.length };
  }, [draft, ready]);

  if (!ready) return <div className="glass h-[600px] animate-pulse" />;

  const set = <K extends keyof Student>(k: K, v: Student[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const num = (k: keyof Student) => (e: React.ChangeEvent<HTMLInputElement>) => set(k, (e.target.value === "" ? 0 : Number(e.target.value)) as never);
  const reg = parseRegNo(draft.regNo);
  const cgpaBad = draft.cgpa < 0 || draft.cgpa > 10;

  const save = () => {
    if (cgpaBad) return;
    setStudent(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const toggleCat = (c: Category) =>
    set("alertCategories", draft.alertCategories.includes(c) ? draft.alertCategories.filter((x) => x !== c) : [...draft.alertCategories, c]);

  return (
    <div>
      <h1 className="mb-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
        Your <span className="text-gradient">profile</span>
      </h1>
      <p className="mb-8 text-white/50">Saved once, used to check every drive. Only you can see it.</p>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section className="glass p-6">
            <h2 className="mb-5 font-display text-lg font-semibold">Identity</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name">
                <input className="input" value={draft.name} onChange={(e) => set("name", e.target.value)} />
              </Field>
              <Field label="VIT email">
                <input className="input opacity-60" value={draft.vitEmail} readOnly title="Comes from Google sign-in" />
              </Field>
              <Field label="Registration number">
                <div className="flex gap-2">
                  <input className="input uppercase" value={draft.regNo} onChange={(e) => set("regNo", e.target.value.toUpperCase())} />
                  <button
                    type="button"
                    disabled={!reg.batch}
                    onClick={() => setDraft((d) => ({ ...d, batch: reg.batch ?? d.batch, branch: reg.branch ?? d.branch }))}
                    className="btn-ghost shrink-0 !px-3 disabled:opacity-40"
                    title="Fill batch and branch from reg. no."
                  >
                    <Wand2 className="h-4 w-4" />
                  </button>
                </div>
                {reg.batch && (
                  <p className="mt-1 text-xs text-cyan-300/70">
                    Detected {reg.branch ?? "unknown branch"}, batch {reg.batch}
                  </p>
                )}
              </Field>
              <Field label="Program">
                <select className="input [&>option]:bg-ink-900" value={draft.program} onChange={(e) => set("program", e.target.value)}>
                  {["B.Tech", "M.Tech", "Integrated M.Tech", "MCA", "M.Sc"].map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </Field>
              <Field label="Branch">
                <select className="input [&>option]:bg-ink-900" value={draft.branch} onChange={(e) => set("branch", e.target.value)}>
                  {ALL_BRANCHES.map((b) => (
                    <option key={b}>{b}</option>
                  ))}
                </select>
              </Field>
              <Field label="Graduating batch">
                <input type="number" className="input" value={draft.batch} onChange={num("batch")} />
              </Field>
            </div>
          </section>

          <section className="glass p-6">
            <h2 className="mb-5 font-display text-lg font-semibold">Academics</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="CGPA">
                <input type="number" step="0.01" min={0} max={10} className={clsx("input", cgpaBad && "!border-rose-400")} value={draft.cgpa} onChange={num("cgpa")} />
                {cgpaBad && <p className="mt-1 text-xs text-rose-300">CGPA must be between 0 and 10</p>}
              </Field>
              <Field label="10th %">
                <input type="number" className="input" value={draft.marks10th} onChange={num("marks10th")} />
              </Field>
              <Field label="12th %">
                <input type="number" className="input" value={draft.marks12th} onChange={num("marks12th")} />
              </Field>
              <Field label="Current backlogs">
                <input type="number" min={0} className="input" value={draft.currentBacklogs} onChange={num("currentBacklogs")} />
              </Field>
              <Field label="Past backlogs">
                <input type="number" min={0} className="input" value={draft.pastBacklogs} onChange={num("pastBacklogs")} />
              </Field>
            </div>
          </section>

          <section className="glass p-6">
            <h2 className="mb-1 font-display text-lg font-semibold">Alert me for</h2>
            <p className="mb-4 text-sm text-white/45">New-drive alerts only fire for these categories. The dashboard still shows everything.</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(CATEGORY_META) as Category[]).map((c) => {
                const on = draft.alertCategories.includes(c);
                const m = CATEGORY_META[c];
                return (
                  <button
                    key={c}
                    onClick={() => toggleCat(c)}
                    className={clsx("chip !px-3 !py-1.5 transition", !on && "border-white/10 text-white/50")}
                    style={on ? { borderColor: m.color, background: `${m.color}22`, color: "#fff" } : undefined}
                  >
                    {on && <Check className="h-3 w-3" />} {m.label}
                  </button>
                );
              })}
            </div>
          </section>

          <div className="flex flex-wrap items-center gap-3">
            <button onClick={save} disabled={cgpaBad} className="btn-primary disabled:opacity-50">
              <Save className="h-4 w-4" /> Save profile
            </button>
            <AnimatePresence>
              {saved && (
                <motion.span initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="text-sm text-emerald-300">
                  Saved — eligibility updated everywhere
                </motion.span>
              )}
            </AnimatePresence>
            <button
              onClick={() => {
                if (confirm("Delete your profile, statuses and reminders from this device?")) resetAll();
              }}
              className="ml-auto flex items-center gap-2 rounded-xl px-4 py-2 text-sm text-rose-300/80 transition hover:bg-rose-500/10"
            >
              <Trash2 className="h-4 w-4" /> Delete my data
            </button>
          </div>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-10 lg:self-start">
          {/* 3D student ID card */}
          <TiltCard intensity={14} className="aspect-[1.58] overflow-hidden p-5">
            <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-violet-600/40 via-indigo-600/20 to-cyan-500/30" />
            <div aria-hidden className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-fuchsia-500/30 blur-2xl" />
            <div className="relative flex h-full flex-col">
              <div className="flex items-center justify-between">
                <BrandMark size={28} />
                <span className="text-[10px] uppercase tracking-[0.3em] text-white/60">VIT · Vellore</span>
              </div>
              <div className="mt-auto">
                <div className="font-display text-xl font-semibold">{draft.name || "Your name"}</div>
                <div className="text-sm text-white/60">
                  {draft.program} {draft.branch} · {draft.batch}
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <span className="font-mono text-sm tracking-widest text-white/80">{draft.regNo}</span>
                  <span className="font-display text-3xl font-bold text-gradient">{draft.cgpa.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </TiltCard>

          <div className="glass p-6 text-center">
            <div className="text-sm text-white/50">With this profile you qualify for</div>
            <motion.div key={preview.eligible} initial={{ scale: 1.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="my-2 font-display text-5xl font-bold text-gradient">
              {preview.eligible}
              <span className="text-2xl text-white/30">/{preview.total}</span>
            </motion.div>
            <div className="text-sm text-white/50">drives with clear criteria</div>
            {JSON.stringify(draft) !== JSON.stringify(student) && <div className="mt-3 text-xs text-amber-300/80">Unsaved changes</div>}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
