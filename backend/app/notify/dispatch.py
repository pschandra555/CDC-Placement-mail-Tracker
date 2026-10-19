"""Send what is due: reminders (new / 24h / 2h / custom) and daily digests.

Every notification is stored for the in-app bell. Telegram is the main channel;
email is the backup when Telegram isn't linked or fails."""

import logging
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import Settings
from ..matching import DONE_STATUSES
from ..models import Application, EligibilityResult, Notification, Opportunity, Reminder, Student, utcnow
from . import email, telegram
from .messages import IST, Message, combined_new, digest, for_reminder

log = logging.getLogger(__name__)
COMBINE_NEW_OVER = 2  # more than this many new drives at once → one combined message


@dataclass
class DispatchReport:
    sent: int = 0
    skipped: int = 0
    digests: int = 0
    by_channel: dict = field(default_factory=lambda: defaultdict(int))


def deliver(db: Session, s: Settings, student: Student, msg: Message, kind: str, opp_id: str | None, report: DispatchReport) -> None:
    channels: list[str] = []
    if s.telegram_enabled and student.telegram_chat_id and student.notify_telegram:
        try:
            telegram.send(s, student.telegram_chat_id, msg.text, ("Open in CDC Tracker", msg.link))
            channels.append("telegram")
        except Exception as e:  # noqa: BLE001 — fall back to email
            log.warning("telegram to %s failed: %s", student.id, e)
    if not channels and s.email_enabled and student.notify_email:
        try:
            email.send(s, student.vit_email, msg.title, f"{msg.plain}\n\nOpen in CDC Tracker: {msg.link}")
            channels.append("email")
        except Exception as e:  # noqa: BLE001
            log.warning("email to %s failed: %s", student.id, e)
    db.add(Notification(student_id=student.id, opportunity_id=opp_id, kind=kind, title=msg.title[:255], body=msg.plain, channels=channels))
    report.sent += 1
    for c in channels or ["app"]:
        report.by_channel[c] += 1


def _still_relevant(r: Reminder, o: Opportunity, app: Application | None, now: datetime) -> bool:
    if r.kind in ("custom", "shortlist"):
        return True
    if r.kind == "update":  # applied students still need to hear about a venue or date change
        return not (app and app.status in ("skipped", "rejected"))
    if app and app.status in DONE_STATUSES:
        return False
    if o.deadline and o.deadline <= now:
        return False
    # A 24h reminder that is very late (scheduler was down) would be confusing; the 2h one covers it.
    if r.kind == "deadline-24h" and o.deadline and o.deadline - now < timedelta(hours=2):
        return False
    return True


def send_due(db: Session, s: Settings, now: datetime | None = None) -> DispatchReport:
    now = now or utcnow()
    report = DispatchReport()
    due = db.scalars(select(Reminder).where(Reminder.remind_at <= now, Reminder.sent.is_(False), Reminder.cancelled.is_(False))
                     .order_by(Reminder.remind_at)).all()
    new_by_student: dict[str, list[tuple[Reminder, Opportunity]]] = defaultdict(list)

    for r in due:
        student, o = db.get(Student, r.student_id), db.get(Opportunity, r.opportunity_id)
        if not student or not o:
            r.cancelled = True
            continue
        if not _still_relevant(r, o, db.get(Application, (student.id, o.id)), now):
            r.cancelled = True
            report.skipped += 1
            continue
        r.sent = True
        if r.kind == "new":
            new_by_student[student.id].append((r, o))
            continue
        res = db.get(EligibilityResult, (student.id, o.id))
        app = db.get(Application, (student.id, o.id))
        msg = for_reminder(r.kind, o, s, res.state if res else None, app.note if app and r.kind == "custom" else None)
        deliver(db, s, student, msg, r.kind, o.id, report)

    for sid, items in new_by_student.items():
        student = db.get(Student, sid)
        if len(items) > COMBINE_NEW_OVER:
            deliver(db, s, student, combined_new([o for _, o in items], s), "new", None, report)
        else:
            for _, o in items:
                res = db.get(EligibilityResult, (sid, o.id))
                deliver(db, s, student, for_reminder("new", o, s, res.state if res else None), "new", o.id, report)
    db.commit()
    return report


def send_digests(db: Session, s: Settings, now: datetime | None = None) -> int:
    """Send each opted-in student's digest once a day, at or after their chosen IST time."""
    now = now or utcnow()
    local = now.replace(tzinfo=None) + timedelta(hours=5, minutes=30)  # naive UTC → IST wall clock
    sent = 0
    report = DispatchReport()
    for st in db.scalars(select(Student).where(Student.digest_enabled.is_(True), Student.profile_complete.is_(True))):
        if st.last_digest_on == local.date() or local.strftime("%H:%M") < (st.digest_time or "08:00"):
            continue
        st.last_digest_on = local.date()
        if msg := digest(db, st, s):
            deliver(db, s, st, msg, "digest", None, report)
            sent += 1
    db.commit()
    return sent


__all__ = ["send_due", "send_digests", "deliver", "DispatchReport", "IST"]
