"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { API_URL, ApiError, api, type ApiOpportunity } from "./api";
import { checkEligibility } from "./eligibility";
import { DEFAULT_STUDENT, getOpportunities } from "./mockData";
import { supabase } from "./supabase";
import type { Application, AppStatus, EligibilityResult, Opportunity, Student } from "./types";

// Two modes:
//  - "api":  NEXT_PUBLIC_API_URL is set; data comes from the FastAPI backend.
//  - "demo": no backend; sample drives, with profile and statuses kept in this browser.
// Everything renders after mount so server HTML never disagrees with relative deadlines.

export interface Enriched extends Opportunity {
  eligibility: EligibilityResult;
  application?: Application;
}

type AuthState = "ok" | "signed-out" | "forbidden";

interface Store {
  mode: "api" | "demo";
  ready: boolean;
  now: number;
  auth: AuthState;
  error: string | null;
  profileComplete: boolean;
  student: Student;
  setStudent: (s: Student) => Promise<void>;
  opportunities: Enriched[];
  setStatus: (id: string, status: AppStatus) => void;
  setNote: (id: string, note: string) => void;
  reported: string[];
  report: (id: string) => void;
  resetAll: () => Promise<void>;
}

const Ctx = createContext<Store | null>(null);
const KEY = "cdc-tracker-v1";
const MODE = API_URL ? "api" : "demo";

function load<T>(fallback: T): T {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

const fromApi = (o: ApiOpportunity): Enriched => ({ ...o, deadline: o.deadline ?? "", application: o.application ?? undefined });

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(0);
  const [auth, setAuth] = useState<AuthState>("ok");
  const [error, setError] = useState<string | null>(null);
  const [profileComplete, setProfileComplete] = useState(MODE === "demo");
  const [base, setBase] = useState<Opportunity[]>([]); // demo only
  const [remote, setRemote] = useState<Enriched[]>([]); // api only
  const [student, setStudentState] = useState<Student>(DEFAULT_STUDENT);
  const [apps, setApps] = useState<Record<string, Application>>({});
  const [reported, setReported] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    try {
      const [me, ops] = await Promise.all([api.me(), api.opportunities()]);
      const { profileComplete: done, ...s } = me;
      setStudentState(s);
      setProfileComplete(done);
      setRemote(ops.map(fromApi));
      setReported(ops.filter((o) => o.reported).map((o) => o.id));
      setAuth("ok");
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setAuth("signed-out");
      else if (e instanceof ApiError && e.status === 403) setAuth("forbidden");
      else setError(e instanceof Error ? e.message : "Could not reach the server");
    }
  }, []);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30_000);
    if (MODE === "demo") {
      const saved = load({ student: DEFAULT_STUDENT, apps: {} as Record<string, Application>, reported: [] as string[] });
      setStudentState(saved.student);
      setApps(saved.apps);
      setReported(saved.reported);
      setBase(getOpportunities());
      setReady(true);
    } else {
      refresh().finally(() => setReady(true));
      const sub = supabase?.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_IN" || event === "SIGNED_OUT") refresh();
      });
      return () => {
        clearInterval(t);
        sub?.data.subscription.unsubscribe();
      };
    }
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    if (!ready || MODE !== "demo") return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ student, apps, reported }));
    } catch {
      /* storage blocked: keep working in memory */
    }
  }, [ready, student, apps, reported]);

  const patchRemote = (id: string, patch: (a: Application | undefined) => Application) =>
    setRemote((rs) => rs.map((o) => (o.id === id ? { ...o, application: patch(o.application) } : o)));

  const setStatus = useCallback(
    (id: string, status: AppStatus) => {
      const patch = (a?: Application): Application => ({ ...a, opportunityId: id, status, updatedAt: new Date().toISOString() });
      if (MODE === "demo") return setApps((a) => ({ ...a, [id]: patch(a[id]) }));
      patchRemote(id, patch); // optimistic
      api.setApplication(id, { status }).catch((e) => {
        setError(`Could not save status: ${e.message}`);
        refresh();
      });
    },
    [refresh],
  );

  const setNote = useCallback(
    (id: string, note: string) => {
      const patch = (a?: Application): Application => ({ opportunityId: id, updatedAt: new Date().toISOString(), status: a?.status ?? "not-applied", note });
      if (MODE === "demo") return setApps((a) => ({ ...a, [id]: patch(a[id]) }));
      patchRemote(id, patch);
      api.setApplication(id, { note }).catch((e) => setError(`Could not save note: ${e.message}`));
    },
    [],
  );

  const report = useCallback((id: string) => {
    setReported((r) => (r.includes(id) ? r : [...r, id]));
    if (MODE === "api") api.report(id).catch((e) => setError(`Could not send report: ${e.message}`));
  }, []);

  const setStudent = useCallback(
    async (s: Student) => {
      if (MODE === "demo") return setStudentState(s);
      await api.saveMe(s); // throws to the caller so the form can show the error
      await refresh(); // eligibility is recomputed on the server
    },
    [refresh],
  );

  const resetAll = useCallback(async () => {
    if (MODE === "demo") {
      setStudentState(DEFAULT_STUDENT);
      setApps({});
      setReported([]);
      return;
    }
    await api.deleteMe();
    await refresh();
  }, [refresh]);

  const opportunities = useMemo(() => {
    const list =
      MODE === "api" ? remote : base.map((o) => ({ ...o, eligibility: checkEligibility(o, student), application: apps[o.id] }));
    // No deadline sorts last.
    const t = (d: string) => (d ? +new Date(d) : Infinity);
    return [...list].sort((a, b) => t(a.deadline) - t(b.deadline));
  }, [remote, base, student, apps]);

  const value: Store = {
    mode: MODE,
    ready,
    now,
    auth,
    error,
    profileComplete,
    student,
    setStudent,
    opportunities,
    setStatus,
    setNote,
    reported,
    report,
    resetAll,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore must be used inside StoreProvider");
  return v;
}

export const isApplied = (o: Enriched) => !!o.application && !["not-applied", "not-registered", "skipped"].includes(o.application.status);
