"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BellPlus, BellRing, Check, Trash2 } from "lucide-react";
import { api, type ReminderRow } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { isApplied, useStore, type Enriched } from "@/lib/store";

const LOCAL_KEY = "cdc-custom-reminders"; // demo mode only
type Row = { id: string; kind: ReminderRow["kind"]; remindAt: string; sent?: boolean };

function loadLocal(oppId: string): Row[] {
  try {
    return (JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]") as (Row & { opportunityId: string })[]).filter((r) => r.opportunityId === oppId);
  } catch {
    return [];
  }
}
function saveLocal(oppId: string, rows: Row[]) {
  try {
    const all = (JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]") as (Row & { opportunityId: string })[]).filter((r) => r.opportunityId !== oppId);
    localStorage.setItem(LOCAL_KEY, JSON.stringify([...all, ...rows.map((r) => ({ ...r, opportunityId: oppId }))]));
  } catch {
    /* storage blocked */
  }
}

const at = (d: Date, h: number, m = 0) => {
  const x = new Date(d);
  x.setHours(h, m, 0, 0);
  return x;
};
const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

const LABEL: Record<string, string> = { "deadline-24h": "24h before deadline", "deadline-2h": "2h before deadline", custom: "Your reminder" };

export function RemindersPanel({ o }: { o: Enriched }) {
  const { mode, now } = useStore();
  const [rows, setRows] = useState<Row[]>([]);
  const [custom, setCustom] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const applied = isApplied(o);

  const load = useCallback(() => {
    if (mode === "api") api.reminders(o.id).then((r) => setRows(r.filter((x) => !x.cancelled))).catch(() => {});
    else setRows(loadLocal(o.id));
  }, [mode, o.id]);
  useEffect(load, [load, o.application?.status]);

  // Demo mode shows the automatic ones the server would schedule.
  const autos: Row[] = useMemo(() => {
    if (mode === "api" || applied || !o.deadline) return [];
    return ([["deadline-24h", 24], ["deadline-2h", 2]] as const)
      .map(([kind, h]) => ({ id: kind, kind, remindAt: new Date(+new Date(o.deadline) - h * 3600_000).toISOString() }))
      .filter((r) => +new Date(r.remindAt) > now);
  }, [mode, applied, o.deadline, now]);

  const list = [...autos, ...rows].filter((r) => !r.sent || r.kind === "custom").sort((a, b) => +new Date(a.remindAt) - +new Date(b.remindAt));

  const quick = useMemo(() => {
    const n = new Date(now || Date.now());
    const opts: [string, Date][] = [];
    if (n.getHours() < 19) opts.push(["Tonight 8 PM", at(n, 20)]);
    const tmr = new Date(n);
    tmr.setDate(n.getDate() + 1);
    opts.push(["Tomorrow 9 AM", at(tmr, 9)]);
    if (o.deadline && +new Date(o.deadline) - 3 * 3600_000 > +n) opts.push(["3h before deadline", new Date(+new Date(o.deadline) - 3 * 3600_000)]);
    if (o.eventDate && +new Date(o.eventDate) - 24 * 3600_000 > +n) opts.push(["Day before event", new Date(+new Date(o.eventDate) - 24 * 3600_000)]);
    return opts.filter(([, d]) => +d > +n);
  }, [now, o.deadline, o.eventDate]);

  const add = async (when: Date) => {
    setMsg(null);
    if (+when <= Date.now()) return setMsg({ ok: false, text: "Pick a time in the future." });
    if (mode === "api") {
      try {
        await api.addReminder(o.id, when.toISOString());
        load();
      } catch (e) {
        return setMsg({ ok: false, text: e instanceof Error ? e.message : "Could not add reminder" });
      }
    } else {
      const next = [...rows, { id: `local-${when.getTime()}`, kind: "custom" as const, remindAt: when.toISOString() }];
      setRows(next);
      saveLocal(o.id, next);
    }
    setMsg({ ok: true, text: `Reminder set for ${fmtDate(when.toISOString())}` });
    setCustom("");
  };

  const remove = async (id: string) => {
    if (mode === "api") await api.deleteReminder(id).catch(() => {});
    const next = rows.filter((r) => r.id !== id);
    setRows(next);
    if (mode === "demo") saveLocal(o.id, next);
  };

  return (
    <section className="glass p-6">
      <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
        <BellRing className="h-4 w-4 text-cyan-300" /> Reminders
      </h2>

      {list.length > 0 ? (
        <ul className="space-y-2 text-sm">
          {list.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2">
              <span className={r.kind === "custom" ? "text-violet-200" : ""}>{LABEL[r.kind] ?? r.kind}</span>
              <span className="ml-auto text-white/45">{fmtDate(r.remindAt)}</span>
              {r.kind === "custom" && (
                <button onClick={() => remove(r.id)} className="rounded-md p-1 text-white/35 hover:text-rose-300" title="Remove">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-white/55">
          {applied
            ? "Deadline reminders stopped — you've marked this as done."
            : o.deadline
              ? "No automatic reminders for this one (closing soon, or not in your alert categories)."
              : "The mail gives no deadline."}
        </p>
      )}
      {applied && list.length > 0 && <p className="mt-2 text-xs text-white/40">Deadline reminders stopped because you marked this as done.</p>}

      <div className="mt-5 border-t border-white/5 pt-4">
        <div className="label flex items-center gap-1.5">
          <BellPlus className="h-3.5 w-3.5" /> Remind me
        </div>
        <div className="flex flex-wrap gap-2">
          {quick.map(([label, d]) => (
            <button key={label} onClick={() => add(d)} className="chip border-white/10 bg-white/5 !py-1.5 text-white/75 transition hover:border-violet-400/50 hover:text-white">
              {label}
            </button>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            type="datetime-local"
            value={custom}
            min={toLocalInput(new Date())}
            onChange={(e) => setCustom(e.target.value)}
            className="input [color-scheme:dark]"
          />
          <button onClick={() => custom && add(new Date(custom))} disabled={!custom} className="btn-primary shrink-0 !px-4 !py-2 text-sm disabled:opacity-50">
            Add
          </button>
        </div>
        {msg && (
          <p className={`mt-2 flex items-center gap-1.5 text-xs ${msg.ok ? "text-emerald-300" : "text-rose-300"}`}>
            {msg.ok && <Check className="h-3.5 w-3.5" />} {msg.text}
          </p>
        )}
        <p className="mt-3 text-xs text-white/35">{mode === "api" ? "Sent to Telegram or email, and the bell." : "Demo: saved in this browser only."}</p>
      </div>
    </section>
  );
}
