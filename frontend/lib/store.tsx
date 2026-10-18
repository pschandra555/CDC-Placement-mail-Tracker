"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { checkEligibility } from "./eligibility";
import { DEFAULT_STUDENT, getOpportunities } from "./mockData";
import type { Application, AppStatus, EligibilityResult, Opportunity, Student } from "./types";

// Browser-only store until the Phase 1 API exists. Everything renders after
// mount so server HTML never disagrees with relative deadlines.

export interface Enriched extends Opportunity {
  eligibility: EligibilityResult;
  application?: Application;
}

interface Store {
  ready: boolean;
  now: number;
  student: Student;
  setStudent: (s: Student) => void;
  opportunities: Enriched[];
  setStatus: (id: string, status: AppStatus) => void;
  setNote: (id: string, note: string) => void;
  reported: string[];
  report: (id: string) => void;
  resetAll: () => void;
}

const Ctx = createContext<Store | null>(null);
const KEY = "cdc-tracker-v1";

function load<T>(fallback: T): T {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(0);
  const [base, setBase] = useState<Opportunity[]>([]);
  const [student, setStudent] = useState<Student>(DEFAULT_STUDENT);
  const [apps, setApps] = useState<Record<string, Application>>({});
  const [reported, setReported] = useState<string[]>([]);

  useEffect(() => {
    const saved = load({ student: DEFAULT_STUDENT, apps: {} as Record<string, Application>, reported: [] as string[] });
    setStudent(saved.student);
    setApps(saved.apps);
    setReported(saved.reported);
    setBase(getOpportunities());
    setNow(Date.now());
    setReady(true);
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ student, apps, reported }));
    } catch {
      /* storage blocked: keep working in memory */
    }
  }, [ready, student, apps, reported]);

  const setStatus = useCallback((id: string, status: AppStatus) => {
    setApps((a) => ({ ...a, [id]: { ...a[id], opportunityId: id, status, updatedAt: new Date().toISOString() } }));
  }, []);
  const setNote = useCallback((id: string, note: string) => {
    setApps((a) => ({
      ...a,
      [id]: { opportunityId: id, updatedAt: new Date().toISOString(), status: a[id]?.status ?? "not-applied", note },
    }));
  }, []);
  const report = useCallback((id: string) => setReported((r) => (r.includes(id) ? r : [...r, id])), []);
  const resetAll = useCallback(() => {
    setStudent(DEFAULT_STUDENT);
    setApps({});
    setReported([]);
  }, []);

  const opportunities = useMemo(
    () =>
      base
        .map((o) => ({ ...o, eligibility: checkEligibility(o, student), application: apps[o.id] }))
        .sort((a, b) => +new Date(a.deadline) - +new Date(b.deadline)),
    [base, student, apps],
  );

  const value: Store = { ready, now, student, setStudent, opportunities, setStatus, setNote, reported, report, resetAll };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore must be used inside StoreProvider");
  return v;
}

export const isApplied = (o: Enriched) => !!o.application && !["not-applied", "not-registered", "skipped"].includes(o.application.status);
