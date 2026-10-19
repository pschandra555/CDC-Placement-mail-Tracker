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

export interface AlertSettings {
  notifyTelegram: boolean;
  notifyEmail: boolean;
  digestEnabled: boolean;
  digestTime: string;
  telegramLinked: boolean;
  telegramAvailable: boolean;
  emailAvailable: boolean;
  calendarUrl: string;
}

export interface AppNotification {
  id: string;
  opportunityId: string | null;
  kind: string;
  title: string;
  body: string;
  channels: string[];
  createdAt: string;
  read: boolean;
}

export interface ReminderRow {
  id: string;
  opportunityId: string;
  kind: "deadline-24h" | "deadline-2h" | "custom";
  remindAt: string;
  sent: boolean;
  cancelled: boolean;
}

export const api = {
  me: () => call<ApiStudent>("/me"),
  saveMe: (s: Student) => call<ApiStudent>("/me", { method: "PUT", body: JSON.stringify(s) }),
  deleteMe: () => call<void>("/me", { method: "DELETE" }),
  opportunities: () => call<ApiOpportunity[]>("/opportunities"),
  setApplication: (id: string, body: { status?: AppStatus; note?: string }) =>
    call<Application>(`/applications/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(body) }),
  report: (id: string) => call<void>(`/opportunities/${encodeURIComponent(id)}/report`, { method: "POST" }),
  alerts: () => call<AlertSettings>("/me/alerts"),
  saveAlerts: (body: Partial<Pick<AlertSettings, "notifyTelegram" | "notifyEmail" | "digestEnabled" | "digestTime">>) =>
    call<AlertSettings>("/me/alerts", { method: "PUT", body: JSON.stringify(body) }),
  rotateCalendar: () => call<AlertSettings>("/me/calendar/rotate", { method: "POST" }),
  telegramLink: () => call<{ url: string }>("/telegram/link", { method: "POST" }),
  telegramUnlink: () => call<void>("/telegram/link", { method: "DELETE" }),
  notifications: () => call<AppNotification[]>("/notifications"),
  markRead: () => call<void>("/notifications/read", { method: "POST" }),
  reminders: (opportunityId: string) => call<ReminderRow[]>(`/reminders?opportunityId=${encodeURIComponent(opportunityId)}`),
  addReminder: (opportunityId: string, remindAt: string) =>
    call<ReminderRow>("/reminders", { method: "POST", body: JSON.stringify({ opportunityId, remindAt }) }),
  deleteReminder: (id: string) => call<void>(`/reminders/${encodeURIComponent(id)}`, { method: "DELETE" }),
};
