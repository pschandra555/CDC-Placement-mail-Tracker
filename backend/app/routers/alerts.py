"""Phase 2 API: notification settings, the in-app bell, custom reminders, Telegram linking, calendar feed."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from ..auth import current_student
from ..config import Settings, get_settings
from ..db import get_db
from ..models import Notification, Opportunity, Reminder, Student, new_calendar_token, utcnow
from ..notify import calendar, telegram
from ..schemas import Out

router = APIRouter(tags=["alerts"])


# ── Settings ──────────────────────────────────────────────────────────────────

class AlertSettingsOut(Out):
    notify_telegram: bool
    notify_email: bool
    digest_enabled: bool
    digest_time: str
    telegram_linked: bool
    telegram_available: bool
    email_available: bool
    calendar_url: str


class AlertSettingsIn(BaseModel):
    model_config = {"populate_by_name": True}
    notify_telegram: bool | None = Field(default=None, alias="notifyTelegram")
    notify_email: bool | None = Field(default=None, alias="notifyEmail")
    digest_enabled: bool | None = Field(default=None, alias="digestEnabled")
    digest_time: str | None = Field(default=None, alias="digestTime", pattern=r"^([01]\d|2[0-3]):[0-5]\d$")


def _settings_out(st: Student, s: Settings, db: Session) -> AlertSettingsOut:
    if not st.calendar_token:
        st.calendar_token = new_calendar_token()
        db.commit()
    return AlertSettingsOut(
        notify_telegram=st.notify_telegram, notify_email=st.notify_email, digest_enabled=st.digest_enabled,
        digest_time=st.digest_time or "08:00", telegram_linked=bool(st.telegram_chat_id), telegram_available=s.telegram_enabled,
        email_available=s.email_enabled, calendar_url=f"{s.public_api_url.rstrip('/')}/calendar/{st.calendar_token}.ics",
    )


@router.get("/me/alerts", response_model=AlertSettingsOut, response_model_by_alias=True)
def get_alerts(st: Student = Depends(current_student), db: Session = Depends(get_db), s: Settings = Depends(get_settings)):
    return _settings_out(db.merge(st), s, db)


@router.put("/me/alerts", response_model=AlertSettingsOut, response_model_by_alias=True)
def put_alerts(body: AlertSettingsIn, st: Student = Depends(current_student), db: Session = Depends(get_db),
               s: Settings = Depends(get_settings)):
    st = db.merge(st)
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(st, k, v)
    db.commit()
    return _settings_out(st, s, db)


@router.post("/me/calendar/rotate", response_model=AlertSettingsOut, response_model_by_alias=True)
def rotate_calendar(st: Student = Depends(current_student), db: Session = Depends(get_db), s: Settings = Depends(get_settings)):
    """New private calendar URL (the old one stops working)."""
    st = db.merge(st)
    st.calendar_token = new_calendar_token()
    db.commit()
    return _settings_out(st, s, db)


# ── Bell ──────────────────────────────────────────────────────────────────────

class NotificationOut(Out):
    id: str
    opportunity_id: str | None
    kind: str
    title: str
    body: str
    channels: list[str]
    created_at: datetime
    read: bool


@router.get("/notifications", response_model=list[NotificationOut], response_model_by_alias=True)
def list_notifications(st: Student = Depends(current_student), db: Session = Depends(get_db)):
    return db.scalars(select(Notification).where(Notification.student_id == st.id).order_by(Notification.created_at.desc()).limit(50)).all()


@router.post("/notifications/read", status_code=204)
def mark_read(st: Student = Depends(current_student), db: Session = Depends(get_db)):
    db.execute(update(Notification).where(Notification.student_id == st.id, Notification.read.is_(False)).values(read=True))
    db.commit()


# ── Custom reminders ──────────────────────────────────────────────────────────

class ReminderOut(Out):
    id: str
    opportunity_id: str
    kind: str
    remind_at: datetime
    sent: bool
    cancelled: bool


class ReminderIn(BaseModel):
    model_config = {"populate_by_name": True}
    opportunity_id: str = Field(alias="opportunityId")
    remind_at: datetime = Field(alias="remindAt")


@router.get("/reminders", response_model=list[ReminderOut], response_model_by_alias=True)
def list_reminders(opportunity_id: str = Query(alias="opportunityId"), st: Student = Depends(current_student), db: Session = Depends(get_db)):
    return db.scalars(select(Reminder).where(Reminder.student_id == st.id, Reminder.opportunity_id == opportunity_id,
                                             Reminder.kind.in_(["deadline-24h", "deadline-2h", "custom"]))
                      .order_by(Reminder.remind_at)).all()


@router.post("/reminders", response_model=ReminderOut, response_model_by_alias=True, status_code=201)
def add_reminder(body: ReminderIn, st: Student = Depends(current_student), db: Session = Depends(get_db)):
    if not db.get(Opportunity, body.opportunity_id):
        raise HTTPException(404, "Opportunity not found")
    at = body.remind_at
    at = (at.astimezone(timezone.utc) if at.tzinfo else at.replace(tzinfo=timezone(timedelta(hours=5, minutes=30))).astimezone(timezone.utc)).replace(tzinfo=None)
    if at <= utcnow():
        raise HTTPException(422, "Pick a time in the future")
    count = len(db.scalars(select(Reminder.id).where(Reminder.student_id == st.id, Reminder.kind == "custom",
                                                     Reminder.sent.is_(False), Reminder.cancelled.is_(False))).all())
    if count >= 50:
        raise HTTPException(422, "Too many pending reminders")
    r = Reminder(student_id=st.id, opportunity_id=body.opportunity_id, kind="custom", remind_at=at,
                 channel="telegram" if st.telegram_chat_id else "email")
    db.add(r)
    db.commit()
    return r


@router.delete("/reminders/{reminder_id}", status_code=204)
def delete_reminder(reminder_id: str, st: Student = Depends(current_student), db: Session = Depends(get_db)):
    r = db.get(Reminder, reminder_id)
    if not r or r.student_id != st.id:
        raise HTTPException(404, "Reminder not found")
    if r.kind != "custom":
        raise HTTPException(422, "Automatic reminders stop when you mark the drive Applied")
    db.delete(r)
    db.commit()


# ── Telegram ──────────────────────────────────────────────────────────────────

@router.post("/telegram/link")
def telegram_link(st: Student = Depends(current_student), db: Session = Depends(get_db), s: Settings = Depends(get_settings)):
    if not s.telegram_enabled:
        raise HTTPException(503, "The Telegram bot isn't set up on this server yet")
    return {"url": telegram.new_link(db, db.merge(st), s)}


@router.delete("/telegram/link", status_code=204)
def telegram_unlink(st: Student = Depends(current_student), db: Session = Depends(get_db)):
    st = db.merge(st)
    st.telegram_chat_id = None
    db.commit()


@router.post("/telegram/webhook")
async def telegram_webhook(request: Request, x_telegram_bot_api_secret_token: str | None = Header(default=None),
                           db: Session = Depends(get_db), s: Settings = Depends(get_settings)):
    if not s.telegram_webhook_secret or x_telegram_bot_api_secret_token != s.telegram_webhook_secret:
        raise HTTPException(401, "Bad webhook secret")
    telegram.handle_update(db, s, await request.json())
    return {"ok": True}


# ── Calendar feed (no login: the token in the URL is the secret) ─────────────

@router.get("/calendar/{token}.ics")
def calendar_feed(token: str, db: Session = Depends(get_db), s: Settings = Depends(get_settings)):
    st = db.scalar(select(Student).where(Student.calendar_token == token)) if len(token) >= 20 else None
    if not st:
        raise HTTPException(404, "Calendar not found")
    return Response(calendar.build(db, st, s), media_type="text/calendar; charset=utf-8",
                    headers={"Content-Disposition": 'inline; filename="cdc-drives.ics"', "Cache-Control": "private, max-age=300"})
