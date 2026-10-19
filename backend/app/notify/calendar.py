"""iCalendar (.ics) feed: deadlines and event dates a student cares about.
Calendar apps can subscribe to it with a private, unguessable URL."""

from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import Settings
from ..models import Application, EligibilityResult, Opportunity, Student, utcnow


def _esc(text: str) -> str:
    return text.replace("\\", "\\\\").replace(";", "\;").replace(",", "\\,").replace("\n", "\\n")


def _fold(line: str) -> str:
    """RFC 5545: lines longer than 75 octets continue on the next line with a leading space."""
    out, raw = [], line.encode()
    while len(raw) > 75:
        cut = 75
        while (raw[cut] & 0xC0) == 0x80:  # don't split a UTF-8 character
            cut -= 1
        out.append(raw[:cut].decode())
        raw = b" " + raw[cut:]
    out.append(raw.decode())
    return "\r\n".join(out)


def _ts(dt: datetime) -> str:
    return dt.strftime("%Y%m%dT%H%M%SZ")


def build(db: Session, student: Student, s: Settings) -> str:
    states = {r.opportunity_id: r.state for r in db.scalars(select(EligibilityResult).where(EligibilityResult.student_id == student.id))}
    apps = {a.opportunity_id: a.status for a in db.scalars(select(Application).where(Application.student_id == student.id))}
    since = utcnow() - timedelta(days=30)
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//CDC Tracker//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
             "X-WR-CALNAME:CDC drives", "X-WR-TIMEZONE:Asia/Kolkata", "REFRESH-INTERVAL;VALUE=DURATION:PT1H"]
    for o in db.scalars(select(Opportunity)):
        state, status = states.get(o.id), apps.get(o.id)
        mine = status not in (None, "not-applied", "not-registered", "skipped", "rejected")
        if not (mine or (state in ("eligible", "open", "check") and status != "skipped")):
            continue
        link = f"{s.public_site_url.rstrip('/')}/opportunity/{o.id}"
        items = []
        if o.deadline and o.deadline > since and o.category != "update" and not mine:
            items.append(("deadline", f"⏰ {o.organization} closes", o.deadline, o.deadline + timedelta(minutes=30)))
        if o.event_date and o.event_date > since:
            items.append(("event", f"📍 {o.title}", o.event_date, o.event_date + timedelta(hours=1)))
        for kind, title, start, end in items:
            desc = "\n".join(filter(None, [" · ".join(o.summary), o.registration_link, link]))
            lines += ["BEGIN:VEVENT", f"UID:{o.id}-{kind}@cdc-tracker", f"DTSTAMP:{_ts(o.updated_at or utcnow())}",
                      f"DTSTART:{_ts(start)}", f"DTEND:{_ts(end)}", f"SUMMARY:{_esc(title)}", f"DESCRIPTION:{_esc(desc)}",
                      f"URL:{link}"]
            if kind == "deadline":
                lines += ["BEGIN:VALARM", "ACTION:DISPLAY", f"DESCRIPTION:{_esc(title)}", "TRIGGER:-PT2H", "END:VALARM"]
            lines.append("END:VEVENT")
    lines.append("END:VCALENDAR")
    return "\r\n".join(_fold(l) for l in lines) + "\r\n"
