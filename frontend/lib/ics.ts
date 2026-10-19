import type { Enriched } from "./store";

// Builds a .ics file in the browser (works in demo mode too). The backend's
// /calendar/<token>.ics feed is the subscribable version of the same thing.

const esc = (t: string) => t.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
const ts = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

function fold(line: string) {
  const out: string[] = [];
  let rest = line;
  while (new TextEncoder().encode(rest).length > 75) {
    let cut = 75;
    while (new TextEncoder().encode(rest.slice(0, cut)).length > 75) cut--;
    out.push(rest.slice(0, cut));
    rest = " " + rest.slice(cut);
  }
  out.push(rest);
  return out.join("\r\n");
}

const isMine = (o: Enriched) => !!o.application && !["not-applied", "not-registered", "skipped", "rejected"].includes(o.application.status);

export function buildIcs(opps: Enriched[], siteUrl: string) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//CDC Tracker//EN", "CALSCALE:GREGORIAN", "X-WR-CALNAME:CDC drives"];
  for (const o of opps) {
    const canApply = ["eligible", "open", "check"].includes(o.eligibility.state) && o.application?.status !== "skipped";
    if (!isMine(o) && !canApply) continue;
    const link = `${siteUrl}/opportunity/${o.id}`;
    const items: [string, string, Date, number][] = [];
    if (o.deadline && o.category !== "update" && !isMine(o)) items.push(["deadline", `⏰ ${o.organization} closes`, new Date(o.deadline), 30]);
    if (o.eventDate) items.push(["event", `📍 ${o.title}`, new Date(o.eventDate), 60]);
    for (const [kind, title, start, mins] of items) {
      lines.push(
        "BEGIN:VEVENT",
        `UID:${o.id}-${kind}@cdc-tracker`,
        `DTSTAMP:${ts(new Date())}`,
        `DTSTART:${ts(start)}`,
        `DTEND:${ts(new Date(start.getTime() + mins * 60_000))}`,
        `SUMMARY:${esc(title)}`,
        `DESCRIPTION:${esc([o.summary.join(" · "), o.registrationLink, link].filter(Boolean).join("\n"))}`,
        `URL:${link}`,
      );
      if (kind === "deadline") lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(title)}`, "TRIGGER:-PT2H", "END:VALARM");
      lines.push("END:VEVENT");
    }
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function downloadIcs(opps: Enriched[]) {
  const blob = new Blob([buildIcs(opps, window.location.origin)], { type: "text/calendar;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "cdc-drives.ics";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
