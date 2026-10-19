"""Wording for every notification. Times are shown in IST."""

import html
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import Settings
from ..matching import DONE_STATUSES
from ..models import Application, EligibilityResult, Opportunity, Student, utcnow

IST = timezone(timedelta(hours=5, minutes=30))


def ist(dt: datetime) -> str:
    d = dt.replace(tzinfo=timezone.utc).astimezone(IST)
    return f"{d.day} {d:%b}, {d.strftime('%I').lstrip('0')}:{d:%M} {d:%p}"  # portable (no %-d on Windows)


def left(dt: datetime, now: datetime | None = None) -> str:
    secs = (dt - (now or utcnow())).total_seconds()
    if secs <= 0:
        return "closed"
    h = int(secs // 3600)
    return f"{h // 24}d {h % 24}h left" if h >= 24 else (f"{h}h {int(secs % 3600 // 60)}m left" if h else f"{int(secs // 60)}m left")


@dataclass
class Message:
    title: str  # short, for the bell and email subject
    text: str  # Telegram HTML
    plain: str  # email body
    link: str  # button target


def _facts(o: Opportunity) -> str:
    keys = ("CTC", "Stipend", "Prizes", "Location", "Mode", "Venue")
    return " · ".join(o.details[k] for k in keys if o.details.get(k))[:120]


def _link(s: Settings, o: Opportunity) -> str:
    return f"{s.public_site_url.rstrip('/')}/opportunity/{o.id}"


HEADINGS = {
    "new": ("🆕", "New drive for you"),
    "deadline-24h": ("⏰", "Closes in 24 hours"),
    "deadline-2h": ("🚨", "Closes in 2 hours"),
    "custom": ("🔔", "Your reminder"),
    "shortlist": ("🎉", "You're shortlisted"),
    "update": ("📢", "Drive updated"),
}


def for_reminder(kind: str, o: Opportunity, s: Settings, state: str | None = None, note: str | None = None) -> Message:
    icon, heading = HEADINGS.get(kind, ("🔔", "Reminder"))
    name = f"{o.organization} — {o.title}" if o.title and o.title != o.organization else o.organization
    lines = [f"{icon} <b>{heading}</b>", f"<b>{html.escape(name)}</b>"]
    if facts := _facts(o):
        lines.append(html.escape(facts))
    if o.deadline:
        lines.append(f"Register by {ist(o.deadline)} ({left(o.deadline)})")
    if o.event_date and kind in ("custom", "new") and o.category in ("hackathon", "workshop", "update"):
        lines.append(f"Event: {ist(o.event_date)}")
    if kind == "update" and o.update_note:
        lines.insert(2, f"<i>{html.escape(o.update_note)}</i>")
    if state == "check":
        lines.append("⚠️ Criteria unclear — check the original mail.")
    if note:
        lines.append(f"📝 {html.escape(note)}")
    if o.registration_link:
        lines.append(f'<a href="{html.escape(o.registration_link)}">Register here</a>')
    text = "\n".join(lines)
    return Message(title=f"{heading}: {name}", text=text, plain=_plain(text), link=_link(s, o))


def combined_new(opps: list[Opportunity], s: Settings) -> Message:
    rows = []
    for o in sorted(opps, key=lambda o: o.deadline or datetime.max):
        due = f" — by {ist(o.deadline)}" if o.deadline else ""
        rows.append(f"• <b>{html.escape(o.organization)}</b>: {html.escape(o.title)}{due}")
    text = f"🆕 <b>{len(opps)} new drives you can apply for</b>\n" + "\n".join(rows)
    return Message(title=f"{len(opps)} new drives you can apply for", text=text, plain=_plain(text),
                   link=f"{s.public_site_url.rstrip('/')}/dashboard")


def _plain(text: str) -> str:
    import re

    text = re.sub(r'<a href="([^"]+)">([^<]+)</a>', r"\2: \1", text)
    return html.unescape(re.sub(r"<[^>]+>", "", text))


def _upcoming(db: Session, student: Student, hours: int):
    """Open drives the student can act on, closing within `hours`, and events in that window."""
    now = utcnow()
    until = now + timedelta(hours=hours)
    states = {r.opportunity_id: r.state for r in db.scalars(select(EligibilityResult).where(EligibilityResult.student_id == student.id))}
    apps = {a.opportunity_id: a.status for a in db.scalars(select(Application).where(Application.student_id == student.id))}
    closing, events = [], []
    for o in db.scalars(select(Opportunity).order_by(Opportunity.deadline)):
        can = states.get(o.id) in ("eligible", "open", "check") and o.category != "update"
        if can and o.deadline and now < o.deadline <= until and apps.get(o.id) not in DONE_STATUSES:
            closing.append(o)
        if o.event_date and now < o.event_date <= until and (apps.get(o.id) in DONE_STATUSES or o.category in ("update", "workshop")
                                                              or states.get(o.id) in ("eligible", "open")):
            events.append(o)
    return closing, events


def today_text(db: Session, student: Student, s: Settings) -> str:
    closing, events = _upcoming(db, student, 48)
    if not closing and not events:
        return "Nothing due in the next 48 hours 🎉"
    out = []
    if closing:
        out.append("<b>Closing in the next 48h</b>")
        out += [f"• {html.escape(o.organization)} — {html.escape(o.title)} ({left(o.deadline)})" for o in closing]
    if events:
        out.append("\n<b>Events</b>")
        out += [f"• {html.escape(o.title)} — {ist(o.event_date)}" for o in events]
    return "\n".join(out)


def digest(db: Session, student: Student, s: Settings) -> Message | None:
    now = utcnow()
    states = {r.opportunity_id: r.state for r in db.scalars(select(EligibilityResult).where(EligibilityResult.student_id == student.id))}
    fresh = [o for o in db.scalars(select(Opportunity).where(Opportunity.created_at >= now - timedelta(hours=24)))
             if states.get(o.id) in ("eligible", "open") and o.category != "update" and (not o.deadline or o.deadline > now)]
    closing, events = _upcoming(db, student, 24)
    if not (fresh or closing or events):
        return None
    today = datetime.now(IST)
    out = [f"☀️ <b>Your CDC digest</b> — {today:%a} {today.day} {today:%b}"]
    if fresh:
        out.append(f"\n<b>New for you ({len(fresh)})</b>")
        out += [f"• {html.escape(o.organization)} — {html.escape(o.title)}" for o in fresh]
    if closing:
        out.append("\n<b>Closing today</b>")
        out += [f"• {html.escape(o.organization)} — {html.escape(o.title)} ({left(o.deadline)})" for o in closing]
    if events:
        out.append("\n<b>Coming up</b>")
        out += [f"• {html.escape(o.title)} — {ist(o.event_date)}" for o in events]
    text = "\n".join(out)
    parts = [f"{len(fresh)} new" if fresh else "", f"{len(closing)} closing" if closing else "", f"{len(events)} events" if events else ""]
    return Message(title="Daily digest: " + ", ".join(p for p in parts if p), text=text, plain=_plain(text),
                   link=f"{s.public_site_url.rstrip('/')}/dashboard")
