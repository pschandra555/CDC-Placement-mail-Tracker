"""The full pipeline: fetch → dedupe → clean → extract → validate → store → match.

Run it with `python -m app.pipeline.run` (or POST /cron/fetch)."""

import hashlib
import logging
import re
from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import Settings, get_settings
from ..db import SessionLocal, init_db
from ..matching import DONE_STATUSES, cancel_reminders, match_opportunity
from ..models import Application, EligibilityRule, Mail, Opportunity, Student, utcnow
from .clean import clean
from .extract import Extraction, extract, parse_dt
from .fetch import RawMail, fetch
from .validate import validate

log = logging.getLogger(__name__)


@dataclass
class RunReport:
    fetched: int = 0
    skipped_duplicates: int = 0
    created: list[str] = field(default_factory=list)
    updated: list[str] = field(default_factory=list)
    ignored: int = 0
    shortlisted: int = 0
    errors: list[str] = field(default_factory=list)


def _slug(org: str, title: str, mail_hash: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", f"{org} {title}".lower()).strip("-")[:60]
    return f"{base}-{mail_hash[:6]}"


def _hue(name: str) -> int:
    return int(hashlib.md5(name.lower().encode()).hexdigest()[:4], 16) % 360


def _rule(ex: Extraction) -> EligibilityRule | None:
    e = ex.eligibility
    if e is None:
        return None
    return EligibilityRule(min_cgpa=e.min_cgpa, branches=e.branches, batches=e.batches, max_backlogs=e.max_backlogs,
                           no_past_backlogs=e.no_past_backlogs, min_10th=e.min_10th, min_12th=e.min_12th,
                           source_line=e.source_line, unclear=e.unclear)


def _find_original(db: Session, ex: Extraction, body: str) -> Opportunity | None:
    """The drive an update mail refers to: same organization, best title match, newest first."""
    org = ex.organization.lower().strip()
    if not org:
        return None
    cands = [o for o in db.scalars(select(Opportunity).where(Opportunity.category != "update").order_by(Opportunity.created_at.desc()))
             if o.organization.lower() in org or org in o.organization.lower()]
    if not cands:
        return None
    text = body.lower()
    return max(cands, key=lambda o: (o.title.lower() in text, o.category != "workshop"))


def _apply_update(db: Session, target: Opportunity, ex: Extraction) -> None:
    changes = []
    if (dl := parse_dt(ex.deadline)) and dl != target.deadline:
        changes.append("Deadline extended" if target.deadline and dl > target.deadline else "Deadline changed")
        target.deadline = dl
    if (ev := parse_dt(ex.event_date)) and ev != target.event_date:
        changes.append("Event date changed")
        target.event_date = ev
    for k, v in ex.details.items():
        if k in ("Venue", "Mode", "Location") and target.details.get(k) != v:
            target.details = {**target.details, k: v}
            changes.append(f"{k} changed")
    if ex.registration_link and ex.registration_link != target.registration_link:
        target.registration_link = ex.registration_link
    target.status = "updated"
    target.update_note = ", ".join(dict.fromkeys(changes)) or ex.update_note or "Updated"


def _shortlist(db: Session, ex: Extraction, regs: list[str]) -> int:
    """Move shortlisted students' application to Shortlisted. Reg numbers never leave the server."""
    if not regs:
        return 0
    drive = _find_original(db, ex, ex.title)
    if not drive:
        return 0
    n = 0
    for s in db.scalars(select(Student).where(Student.reg_no.in_(regs))):
        app = db.get(Application, (s.id, drive.id))
        if app is None:
            db.add(Application(student_id=s.id, opportunity_id=drive.id, status="shortlisted"))
        elif app.status in ("not-applied", "applied"):
            app.status = "shortlisted"
        else:
            continue
        cancel_reminders(db, s.id, drive.id)
        n += 1
    return n


def apply_past_shortlists(db: Session, student: Student) -> int:
    """When a student saves their reg number, catch up on shortlists that already arrived."""
    if not student.reg_no:
        return 0
    n = 0
    for o in db.scalars(select(Opportunity).where(Opportunity.category == "update")):
        if student.reg_no in clean(o.mail.raw_text).reg_numbers:
            ex = Extraction(organization=o.organization, title=o.title)
            drive = _find_original(db, ex, o.title)
            if drive:
                app = db.get(Application, (student.id, drive.id))
                if app is None:
                    db.add(Application(student_id=student.id, opportunity_id=drive.id, status="shortlisted"))
                    n += 1
                elif app.status in ("not-applied", "applied"):
                    app.status = "shortlisted"
                    n += 1
                cancel_reminders(db, student.id, drive.id)
    return n


def process_mail(db: Session, raw: RawMail, s: Settings, report: RunReport) -> None:
    if raw.sender.lower() not in s.trusted_sender_list:
        report.ignored += 1
        return
    h = raw.body_hash
    if db.scalar(select(Mail.id).where((Mail.body_hash == h) | (Mail.message_id == raw.message_id))):
        report.skipped_duplicates += 1
        return

    cleaned = clean(raw.body)
    mail = Mail(message_id=raw.message_id, sender=raw.sender, subject=raw.subject, body_hash=h,
                received_at=raw.received_at, raw_text=raw.body, clean_text=cleaned.text)
    db.add(mail)
    db.flush()

    ex = extract(s, raw.subject, cleaned.text, raw.received_at)
    ex, problems = validate(ex, raw.received_at, s.min_confidence)
    if problems:
        mail.error = "; ".join(problems)

    if ex.is_update and (target := _find_original(db, ex, cleaned.text)):
        _apply_update(db, target, ex)
        db.flush()
        match_opportunity(db, target, notify_new=False)
        report.updated.append(target.id)
    elif ex.category == "other" and not (ex.deadline or ex.registration_link):
        report.ignored += 1  # not an opportunity (e.g. an admin notice)
    else:
        opp = Opportunity(
            id=_slug(ex.organization, ex.title, h), mail_id=mail.id, category=ex.category, title=ex.title[:255] or raw.subject[:255],
            organization=ex.organization[:255], registration_link=ex.registration_link, deadline=parse_dt(ex.deadline),
            event_date=parse_dt(ex.event_date), summary=ex.summary, details=ex.details, confidence=ex.confidence,
            extractor=ex.extractor, logo_hue=_hue(ex.organization or ex.title), rule=_rule(ex),
        )
        db.add(opp)
        db.flush()
        match_opportunity(db, opp)
        report.created.append(opp.id)
        if ex.category == "update":
            report.shortlisted += _shortlist(db, ex, cleaned.reg_numbers)

    mail.processed_at = utcnow()


def close_expired(db: Session) -> None:
    now = utcnow()
    for o in db.scalars(select(Opportunity).where(Opportunity.status != "closed", Opportunity.deadline < now)):
        o.status = "closed"


def run(settings: Settings | None = None) -> RunReport:
    s = settings or get_settings()
    report = RunReport()
    mails = fetch(s)
    report.fetched = len(mails)
    with SessionLocal() as db:
        for raw in sorted(mails, key=lambda m: m.received_at):  # oldest first so updates find their drive
            try:
                process_mail(db, raw, s, report)
                db.commit()
            except Exception as e:  # one bad mail must not stop the batch
                db.rollback()
                log.exception("failed on %s", raw.message_id)
                report.errors.append(f"{raw.message_id}: {e}")
        close_expired(db)
        db.commit()
    return report


__all__ = ["run", "process_mail", "apply_past_shortlists", "RunReport", "DONE_STATUSES"]

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    init_db()
    print(run())
