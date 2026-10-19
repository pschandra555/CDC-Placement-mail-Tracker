"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { AlarmClock, Bell, BellRing, CalendarClock, Megaphone, PartyPopper, Send, Sparkles, Sun } from "lucide-react";
import { api, type AppNotification } from "@/lib/api";
import { countdown } from "@/lib/format";
import { isApplied, useStore } from "@/lib/store";

const ICONS: Record<string, typeof Bell> = {
  new: Sparkles,
  "deadline-24h": AlarmClock,
  "deadline-2h": AlarmClock,
  custom: BellRing,
  digest: Sun,
  shortlist: PartyPopper,
  update: Megaphone,
};
const SEEN_KEY = "cdc-bell-seen";

function ago(iso: string, now: number) {
  const m = Math.max(0, Math.round((now - +new Date(iso)) / 60_000));
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

export function NotificationBell({ align = "left" }: { align?: "left" | "right" }) {
  const { mode, ready, now, opportunities, auth } = useStore();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [seen, setSeen] = useState<number>(0);
  const ref = useRef<HTMLDivElement>(null);

  // API mode: server notifications, refreshed every minute.
  const load = useCallback(() => {
    if (mode === "api" && auth === "ok") api.notifications().then(setItems).catch(() => {});
  }, [mode, auth]);
  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  // Demo mode: derive "closing soon" alerts from the sample drives.
  useEffect(() => {
    try {
      setSeen(Number(localStorage.getItem(SEEN_KEY) || 0));
    } catch {
      /* ignore */
    }
  }, []);
  const demo = useMemo<AppNotification[]>(() => {
    if (mode !== "demo" || !ready) return [];
    return opportunities
      .filter((o) => ["eligible", "open"].includes(o.eligibility.state) && !isApplied(o) && o.deadline && o.category !== "update")
      .filter((o) => +new Date(o.deadline) - now < 48 * 3600_000 && +new Date(o.deadline) > now)
      .map((o) => ({
        id: `demo-${o.id}`,
        opportunityId: o.id,
        kind: +new Date(o.deadline) - now < 24 * 3600_000 ? "deadline-24h" : "new",
        title: `${o.organization} — ${o.title}`,
        body: `Closes soon · ${countdown(o.deadline, now).text}`,
        channels: [],
        createdAt: new Date(now - 3600_000).toISOString(),
        read: seen > now - 3600_000,
      }));
  }, [mode, ready, opportunities, now, seen]);

  const list = mode === "api" ? items : demo;
  const unread = list.filter((n) => !n.read).length;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && unread) {
      if (mode === "api") api.markRead().then(() => setTimeout(load, 1500)).catch(() => {});
      else {
        setSeen(now);
        try {
          localStorage.setItem(SEEN_KEY, String(now));
        } catch {
          /* ignore */
        }
      }
    }
  };

  return (
    <div ref={ref} className="relative">
      <button onClick={toggle} className="relative grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 text-white/70 transition hover:text-white" aria-label="Notifications">
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-600 px-1 text-[10px] font-bold text-white shadow-glow">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className={clsx(
              "glass fixed inset-x-3 top-16 z-50 max-h-[70vh] overflow-y-auto border-white/15 bg-ink-900/95 p-2 sm:absolute sm:inset-x-auto sm:top-11 sm:w-96",
              align === "left" ? "sm:left-0" : "sm:right-0",
            )}
          >
            <div className="flex items-center justify-between px-3 py-2">
              <span className="font-display font-semibold">Notifications</span>
              <Link href="/alerts" onClick={() => setOpen(false)} className="text-xs text-violet-300 hover:text-violet-200">
                Alert settings
              </Link>
            </div>
            {list.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-white/45">
                <CalendarClock className="mx-auto mb-2 h-6 w-6 text-white/25" />
                No alerts yet. New drives and deadline reminders show up here.
              </div>
            ) : (
              list.map((n) => {
                const Icon = ICONS[n.kind] ?? Bell;
                const body = (
                  <div className={clsx("flex gap-3 rounded-xl px-3 py-2.5 transition hover:bg-white/5", !n.read && "bg-violet-500/10")}>
                    <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/5 text-violet-200">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium leading-snug">{n.title}</div>
                      <div className="mt-0.5 line-clamp-2 whitespace-pre-line text-xs text-white/50">{n.body.split("\n").slice(1, 3).join(" · ") || n.body}</div>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-white/35">
                        {ago(n.createdAt, now)}
                        {n.channels.includes("telegram") && (
                          <span className="flex items-center gap-1">
                            <Send className="h-3 w-3" /> Telegram
                          </span>
                        )}
                        {n.channels.includes("email") && <span>· Email</span>}
                      </div>
                    </div>
                  </div>
                );
                return n.opportunityId ? (
                  <Link key={n.id} href={`/opportunity/${n.opportunityId}`} onClick={() => setOpen(false)} className="block">
                    {body}
                  </Link>
                ) : (
                  <Link key={n.id} href="/dashboard" onClick={() => setOpen(false)} className="block">
                    {body}
                  </Link>
                );
              })
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
