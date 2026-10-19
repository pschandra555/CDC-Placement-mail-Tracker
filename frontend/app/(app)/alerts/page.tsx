"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { motion } from "framer-motion";
import { Bell, CalendarPlus, Check, Copy, Download, Mail, RefreshCw, Send, Smartphone, Sun } from "lucide-react";
import { api, type AlertSettings } from "@/lib/api";
import { downloadIcs } from "@/lib/ics";
import { useInstall } from "@/lib/pwa";
import { useStore } from "@/lib/store";

function Toggle({ on, onChange, disabled, label }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={clsx("relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-40", on ? "bg-gradient-to-r from-violet-500 to-cyan-400 shadow-glow" : "bg-white/15")}
    >
      <motion.span layout className={clsx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow", on ? "right-0.5" : "left-0.5")} />
    </button>
  );
}

function Card({ icon: Icon, title, children, tone = "from-violet-500/30 to-cyan-400/20" }: { icon: typeof Bell; title: string; children: React.ReactNode; tone?: string }) {
  return (
    <section className="glass glow-border p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className={clsx("grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br ring-1 ring-white/10", tone)}>
          <Icon className="h-5 w-5 text-white" />
        </span>
        <h2 className="font-display text-lg font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

const Muted = ({ children }: { children: React.ReactNode }) => <p className="mt-3 text-xs leading-relaxed text-white/40">{children}</p>;

export default function AlertsPage() {
  const { mode, ready, student, opportunities } = useStore();
  const [cfg, setCfg] = useState<AlertSettings | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval>>();
  const { canInstall, installed, ios, install } = useInstall();

  const load = useCallback(() => {
    if (mode === "api") api.alerts().then(setCfg).catch((e) => setErr(e.message));
  }, [mode]);
  useEffect(() => {
    load();
    return () => clearInterval(pollRef.current);
  }, [load]);

  const save = async (patch: Parameters<typeof api.saveAlerts>[0]) => {
    if (!cfg) return;
    setCfg({ ...cfg, ...patch }); // optimistic
    try {
      setCfg(await api.saveAlerts(patch));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save");
      load();
    }
  };

  const connectTelegram = async () => {
    setErr(null);
    try {
      const { url } = await api.telegramLink();
      window.open(url, "_blank", "noopener");
      // Wait for the student to press Start in Telegram.
      setWaiting(true);
      let tries = 0;
      clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        tries++;
        const next = await api.alerts().catch(() => null);
        if (next?.telegramLinked || tries > 60) {
          clearInterval(pollRef.current);
          setWaiting(false);
          if (next) setCfg(next);
        }
      }, 3000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not start Telegram linking");
    }
  };

  const demo = mode === "demo";
  const httpsFeed = cfg?.calendarUrl.startsWith("https://");

  return (
    <div>
      <h1 className="mb-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
        <span className="text-gradient">Alerts</span> & reminders
      </h1>
      <p className="mb-8 text-white/50">
        Choose where alerts reach you. New drives only alert you for the categories picked on your{" "}
        <Link href="/profile" className="text-violet-300 hover:underline">
          profile
        </Link>
        .
      </p>

      {demo && (
        <div className="glass mb-6 border-amber-400/30 p-4 text-sm text-amber-100">
          This is the demo. Telegram, email and the calendar feed work once the site is connected to the backend. Calendar download and app install work now.
        </div>
      )}
      {err && <div className="mb-6 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">{err}</div>}

      <div className="mb-6 flex flex-wrap gap-2 text-xs">
        {["🆕 New eligible drives", "⏰ 24h before deadlines", "🚨 2h before deadlines", "🎉 Shortlists", "📢 Deadline / venue changes", "🔔 Your own reminders"].map((t) => (
          <span key={t} className="chip border-white/10 bg-white/5 text-white/70">
            {t}
          </span>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card icon={Send} title="Telegram" tone="from-sky-500/40 to-cyan-400/20">
          {demo || !cfg ? (
            <p className="text-sm text-white/55">The main channel: instant messages from the CDC Tracker bot.</p>
          ) : !cfg.telegramAvailable ? (
            <>
              <p className="text-sm text-white/55">The Telegram bot isn&apos;t set up on this server yet.</p>
              <Muted>Admin: create a bot with @BotFather and set TELEGRAM_BOT_TOKEN and TELEGRAM_BOT_USERNAME in backend/.env.</Muted>
            </>
          ) : cfg.telegramLinked ? (
            <>
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-2 text-sm text-emerald-300">
                  <Check className="h-4 w-4" /> Connected
                </span>
                <Toggle label="Telegram alerts" on={cfg.notifyTelegram} onChange={(v) => save({ notifyTelegram: v })} />
              </div>
              <button onClick={() => api.telegramUnlink().then(load)} className="mt-4 text-xs text-white/45 hover:text-rose-300">
                Disconnect Telegram
              </button>
              <Muted>Send /today to the bot anytime to see what&apos;s due.</Muted>
            </>
          ) : (
            <>
              <button onClick={connectTelegram} disabled={waiting} className="btn-primary w-full disabled:opacity-70">
                <Send className="h-4 w-4" /> {waiting ? "Waiting for you to press Start in Telegram…" : "Connect Telegram"}
              </button>
              <Muted>Opens Telegram. Press Start in the bot chat and this page updates by itself.</Muted>
            </>
          )}
        </Card>

        <Card icon={Mail} title="Email (backup)" tone="from-fuchsia-500/40 to-violet-500/20">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 text-sm">
              <div className="truncate text-white/80">{ready ? student.vitEmail : "…"}</div>
              <div className="text-xs text-white/40">Used when Telegram isn&apos;t connected or fails</div>
            </div>
            <Toggle label="Email alerts" disabled={!cfg} on={cfg?.notifyEmail ?? true} onChange={(v) => save({ notifyEmail: v })} />
          </div>
          {cfg && !cfg.emailAvailable && <Muted>Email sending isn&apos;t set up on the server yet. Everything still appears in the bell 🔔.</Muted>}
        </Card>

        <Card icon={Sun} title="Daily digest" tone="from-amber-400/40 to-orange-500/20">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-white/55">One message a day: new drives, today&apos;s deadlines and upcoming events.</p>
            <Toggle label="Daily digest" disabled={!cfg} on={cfg?.digestEnabled ?? false} onChange={(v) => save({ digestEnabled: v })} />
          </div>
          <label className="mt-4 flex items-center gap-3 text-sm text-white/60">
            Send at
            <input
              type="time"
              disabled={!cfg?.digestEnabled}
              value={cfg?.digestTime ?? "08:00"}
              onChange={(e) => e.target.value && save({ digestTime: e.target.value })}
              className="input !w-32 disabled:opacity-40 [color-scheme:dark]"
            />
            <span className="text-xs text-white/35">IST</span>
          </label>
        </Card>

        <Card icon={CalendarPlus} title="Calendar" tone="from-emerald-400/40 to-cyan-500/20">
          <p className="text-sm text-white/55">Deadlines of drives you can apply for, plus events you signed up for.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => downloadIcs(opportunities)} disabled={!ready} className="btn-ghost !py-2 text-sm">
              <Download className="h-4 w-4" /> Download .ics
            </button>
            {cfg && httpsFeed && (
              <a
                href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(cfg.calendarUrl.replace(/^https:/, "webcal:"))}`}
                target="_blank"
                rel="noreferrer"
                className="btn-primary !py-2 text-sm"
              >
                <CalendarPlus className="h-4 w-4" /> Subscribe in Google Calendar
              </a>
            )}
          </div>
          {cfg && (
            <div className="mt-4">
              <div className="label">Private subscribe link</div>
              <div className="flex gap-2">
                <input readOnly value={cfg.calendarUrl} className="input font-mono !text-xs" onFocus={(e) => e.target.select()} />
                <button
                  onClick={() => navigator.clipboard.writeText(cfg.calendarUrl).then(() => (setCopied(true), setTimeout(() => setCopied(false), 1500)))}
                  className="btn-ghost shrink-0 !px-3"
                  title="Copy link"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />}
                </button>
                <button onClick={() => api.rotateCalendar().then(setCfg)} className="btn-ghost shrink-0 !px-3" title="Make a new link (the old one stops working)">
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
              <Muted>
                {httpsFeed
                  ? "Calendar apps refresh it every hour or so. Anyone with this link can see your drive calendar — reset it if you shared it by mistake."
                  : "This link points at your own computer, so phones and Google Calendar can't reach it yet. Use Download .ics for now; subscribing works once the backend is online."}
              </Muted>
            </div>
          )}
        </Card>

        <Card icon={Smartphone} title="Install as an app" tone="from-violet-500/40 to-fuchsia-500/20">
          {installed ? (
            <p className="flex items-center gap-2 text-sm text-emerald-300">
              <Check className="h-4 w-4" /> You&apos;re using the installed app.
            </p>
          ) : canInstall ? (
            <>
              <p className="text-sm text-white/55">Add CDC Tracker to your home screen. It opens full-screen like an app, no app store needed.</p>
              <button onClick={install} className="btn-primary mt-4">
                <Smartphone className="h-4 w-4" /> Install app
              </button>
            </>
          ) : ios ? (
            <p className="text-sm text-white/55">
              In Safari, tap <b>Share</b> → <b>Add to Home Screen</b>.
            </p>
          ) : (
            <p className="text-sm text-white/55">
              On your phone, open this site in Chrome and choose <b>Add to Home screen</b> (Android) or Safari → <b>Share</b> → <b>Add to Home Screen</b> (iPhone).
            </p>
          )}
        </Card>

        <Card icon={Bell} title="In-app bell" tone="from-indigo-500/40 to-violet-500/20">
          <p className="text-sm text-white/55">Always on. Every alert also lands in the bell at the top of the page, even when Telegram and email are off.</p>
        </Card>
      </div>
    </div>
  );
}
