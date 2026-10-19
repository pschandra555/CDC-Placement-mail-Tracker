import type { AppStatus, Category } from "./types";

export function countdown(iso: string, now: number) {
  if (!iso) return { text: "No deadline", urgent: false, closed: false };
  const ms = +new Date(iso) - now;
  if (ms <= 0) return { text: "Closed", urgent: false, closed: true };
  const h = Math.floor(ms / 3600_000);
  const d = Math.floor(h / 24);
  const m = Math.floor((ms % 3600_000) / 60_000);
  const text = d >= 1 ? `${d}d ${h % 24}h left` : h >= 1 ? `${h}h ${m}m left` : `${m}m left`;
  return { text, urgent: h < 24, closed: false };
}

export const fmtDate = (iso: string) =>
  !iso ? "not stated" : new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

const EVENT_CATS: Category[] = ["hackathon", "workshop"];
export const isEventCategory = (c: Category) => EVENT_CATS.includes(c);

export const JOB_FLOW: { id: AppStatus; label: string }[] = [
  { id: "not-applied", label: "Not applied" },
  { id: "applied", label: "Applied" },
  { id: "shortlisted", label: "Shortlisted" },
  { id: "interview", label: "Interview" },
  { id: "selected", label: "Selected" },
  { id: "rejected", label: "Rejected" },
  { id: "skipped", label: "Skipped" },
];

export const EVENT_FLOW: { id: AppStatus; label: string }[] = [
  { id: "not-registered", label: "Not registered" },
  { id: "registered", label: "Registered" },
  { id: "team-formed", label: "Team formed" },
  { id: "submitted", label: "Submitted" },
  { id: "result", label: "Result" },
  { id: "skipped", label: "Skipped" },
];

export const statusLabel = (s: AppStatus) => [...JOB_FLOW, ...EVENT_FLOW].find((x) => x.id === s)?.label ?? s;

/** Google Calendar "add event" link — one click, no OAuth needed. */
export function gcalLink(title: string, iso: string, details: string, link: string) {
  const start = new Date(iso);
  const end = new Date(start.getTime() + 3600_000);
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const p = new URLSearchParams({ action: "TEMPLATE", text: title, dates: `${f(start)}/${f(end)}`, details: `${details}\n${link}` });
  return `https://calendar.google.com/calendar/render?${p}`;
}
