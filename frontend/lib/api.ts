"use client";

import { accessToken } from "./supabase";
import type { Application, AppStatus, EligibilityResult, Opportunity, Student } from "./types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await accessToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const detail = (await res.json()).detail;
      // FastAPI validation errors are a list of {loc, msg}; show them as plain text.
      msg = Array.isArray(detail) ? detail.map((d) => `${d.loc?.at(-1) ?? "field"}: ${d.msg}`).join("; ") : detail ?? msg;
    } catch {
      /* not JSON */
    }
    throw new ApiError(res.status, String(msg));
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export interface ApiOpportunity extends Omit<Opportunity, "deadline"> {
  deadline: string | null;
  eligibility: EligibilityResult;
  application: Application | null;
  reported: boolean;
}

export interface ApiStudent extends Student {
  profileComplete: boolean;
}

export const api = {
  me: () => call<ApiStudent>("/me"),
  saveMe: (s: Student) => call<ApiStudent>("/me", { method: "PUT", body: JSON.stringify(s) }),
  deleteMe: () => call<void>("/me", { method: "DELETE" }),
  opportunities: () => call<ApiOpportunity[]>("/opportunities"),
  setApplication: (id: string, body: { status?: AppStatus; note?: string }) =>
    call<Application>(`/applications/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(body) }),
  report: (id: string) => call<void>(`/opportunities/${encodeURIComponent(id)}/report`, { method: "POST" }),
};
