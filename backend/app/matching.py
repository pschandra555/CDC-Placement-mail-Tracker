"""Step 6: compare each opportunity's rule with student profiles, store the
result, and schedule reminders. Plain code, no AI."""

from datetime import timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from . import eligibility
from .models import Application, EligibilityResult, Opportunity, Reminder, Student, utcnow

DONE_STATUSES = {"applied", "shortlisted", "interview", "selected", "rejected", "skipped",
                 "registered", "team-formed", "submitted", "result"}
DEADLINE_OFFSETS = {"deadline-24h": timedelta(hours=24), "deadline-2h": timedelta(hours=2)}


def _store_result(db: Session, s: Student, o: Opportunity) -> eligibility.Result:
    res = eligibility.check(o.rule, s)
    row = db.get(EligibilityResult, (s.id, o.id))
    if row:
        row.state, row.reasons = res.state, res.reasons
    else:
        db.add(EligibilityResult(student_id=s.id, opportunity_id=o.id, state=res.state, reasons=res.reasons))
    return res


def schedule_reminders(db: Session, s: Student, o: Opportunity, state: str, *, notify_new: bool) -> None:
    """Keep this student's pending reminders for the drive in line with its deadline."""
    db.execute(delete(Reminder).where(Reminder.student_id == s.id, Reminder.opportunity_id == o.id,
                                      Reminder.sent.is_(False), Reminder.kind.in_(list(DEADLINE_OFFSETS))))
    app = db.get(Application, (s.id, o.id))
    wants = (o.category in (s.alert_categories or [])) and state in ("eligible", "open", "check")
    if not wants or (app and app.status in DONE_STATUSES) or o.category == "update":
        return
    now = utcnow()
    channel = "telegram" if s.telegram_chat_id else "email"
    if notify_new:
        db.add(Reminder(student_id=s.id, opportunity_id=o.id, kind="new", remind_at=now, channel=channel))
    if o.deadline:
        for kind, delta in DEADLINE_OFFSETS.items():
            if o.deadline - delta > now:
                db.add(Reminder(student_id=s.id, opportunity_id=o.id, kind=kind, remind_at=o.deadline - delta, channel=channel))


def match_opportunity(db: Session, o: Opportunity, *, notify_new: bool = True) -> None:
    for s in db.scalars(select(Student).where(Student.profile_complete.is_(True))):
        res = _store_result(db, s, o)
        schedule_reminders(db, s, o, res.state, notify_new=notify_new)


def match_student(db: Session, s: Student) -> None:
    now = utcnow()
    for o in db.scalars(select(Opportunity)):
        res = _store_result(db, s, o)
        if o.deadline is None or o.deadline > now:
            schedule_reminders(db, s, o, res.state, notify_new=False)


def cancel_reminders(db: Session, student_id: str, opportunity_id: str) -> None:
    for r in db.scalars(select(Reminder).where(Reminder.student_id == student_id, Reminder.opportunity_id == opportunity_id,
                                               Reminder.sent.is_(False), Reminder.kind != "custom")):
        r.cancelled = True


def queue_now(db: Session, student_id: str, opportunity_id: str, kind: str) -> None:
    """Queue an immediate alert (shortlist, drive update); the dispatcher sends it on its next run."""
    s = db.get(Student, student_id)
    channel = "telegram" if s and s.telegram_chat_id else "email"
    db.add(Reminder(student_id=student_id, opportunity_id=opportunity_id, kind=kind, remind_at=utcnow(), channel=channel))


def notify_followers(db: Session, o: Opportunity) -> None:
    """After an update mail: tell students who could still act on this drive or already applied."""
    for res in db.scalars(select(EligibilityResult).where(EligibilityResult.opportunity_id == o.id)):
        s = db.get(Student, res.student_id)
        app = db.get(Application, (res.student_id, o.id))
        following = app is not None and app.status not in ("skipped", "rejected")
        could_apply = res.state in ("eligible", "open", "check") and o.category in (s.alert_categories or [])
        if following or could_apply:
            queue_now(db, res.student_id, o.id, "update")
