"""Tables from the project spec. Datetimes are stored as naive UTC."""

import secrets
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, false, text, true
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def new_id() -> str:
    return uuid.uuid4().hex


class Student(Base):
    __tablename__ = "students"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    vit_email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    reg_no: Mapped[str] = mapped_column(String(20), default="", index=True)
    name: Mapped[str] = mapped_column(String(120), default="")
    branch: Mapped[str] = mapped_column(String(40), default="")
    program: Mapped[str] = mapped_column(String(40), default="B.Tech")
    batch: Mapped[int] = mapped_column(Integer, default=0)
    cgpa: Mapped[float] = mapped_column(Float, default=0)
    marks_10th: Mapped[float] = mapped_column(Float, default=0)
    marks_12th: Mapped[float] = mapped_column(Float, default=0)
    current_backlogs: Mapped[int] = mapped_column(Integer, default=0)
    past_backlogs: Mapped[int] = mapped_column(Integer, default=0)
    telegram_chat_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    alert_categories: Mapped[list] = mapped_column(JSON, default=lambda: ["full-time", "internship", "intern-ft", "hackathon"])
    profile_complete: Mapped[bool] = mapped_column(Boolean, default=False)
    cgpa_updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    # Phase 2: notifications. server_default lets old databases gain these columns.
    notify_telegram: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())
    notify_email: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())
    digest_enabled: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    digest_time: Mapped[str] = mapped_column(String(5), default="08:00", server_default=text("'08:00'"))  # HH:MM, IST
    last_digest_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    telegram_link_code: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    telegram_link_expires: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    calendar_token: Mapped[str | None] = mapped_column(String(48), nullable=True, index=True)


def new_calendar_token() -> str:
    return secrets.token_urlsafe(24)


class Mail(Base):
    __tablename__ = "mails"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    message_id: Mapped[str] = mapped_column(String(255), unique=True)
    sender: Mapped[str] = mapped_column(String(255))
    subject: Mapped[str] = mapped_column(Text)
    body_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    received_at: Mapped[datetime] = mapped_column(DateTime)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    raw_text: Mapped[str] = mapped_column(Text)  # original; kept server-side only
    clean_text: Mapped[str] = mapped_column(Text, default="")  # reg numbers removed; safe to show
    error: Mapped[str | None] = mapped_column(Text, nullable=True)


class Opportunity(Base):
    __tablename__ = "opportunities"

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    mail_id: Mapped[str] = mapped_column(ForeignKey("mails.id"))
    category: Mapped[str] = mapped_column(String(20), index=True)
    title: Mapped[str] = mapped_column(String(255))
    organization: Mapped[str] = mapped_column(String(255), index=True)
    registration_link: Mapped[str] = mapped_column(Text, default="")
    deadline: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    event_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    summary: Mapped[list] = mapped_column(JSON, default=list)
    details: Mapped[dict] = mapped_column(JSON, default=dict)
    confidence: Mapped[float] = mapped_column(Float, default=0)
    status: Mapped[str] = mapped_column(String(10), default="open")  # open / closed / updated
    update_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    extractor: Mapped[str] = mapped_column(String(20), default="rules")
    logo_hue: Mapped[int] = mapped_column(Integer, default=260)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    mail: Mapped[Mail] = relationship()
    rule: Mapped["EligibilityRule | None"] = relationship(back_populates="opportunity", uselist=False, cascade="all, delete-orphan")


class EligibilityRule(Base):
    """No row means the mail stated no criteria: open to all."""

    __tablename__ = "eligibility_rules"

    opportunity_id: Mapped[str] = mapped_column(ForeignKey("opportunities.id"), primary_key=True)
    min_cgpa: Mapped[float | None] = mapped_column(Float, nullable=True)
    branches: Mapped[list] = mapped_column(JSON, default=list)
    batches: Mapped[list] = mapped_column(JSON, default=list)
    max_backlogs: Mapped[int | None] = mapped_column(Integer, nullable=True)
    no_past_backlogs: Mapped[bool] = mapped_column(Boolean, default=False)
    min_10th: Mapped[float | None] = mapped_column(Float, nullable=True)
    min_12th: Mapped[float | None] = mapped_column(Float, nullable=True)
    source_line: Mapped[str] = mapped_column(Text, default="")
    unclear: Mapped[bool] = mapped_column(Boolean, default=False)

    opportunity: Mapped[Opportunity] = relationship(back_populates="rule")


class EligibilityResult(Base):
    __tablename__ = "eligibility_results"

    student_id: Mapped[str] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), primary_key=True)
    opportunity_id: Mapped[str] = mapped_column(ForeignKey("opportunities.id", ondelete="CASCADE"), primary_key=True)
    state: Mapped[str] = mapped_column(String(20))  # eligible / not-eligible / check / open
    reasons: Mapped[list] = mapped_column(JSON, default=list)


class Application(Base):
    __tablename__ = "applications"

    student_id: Mapped[str] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), primary_key=True)
    opportunity_id: Mapped[str] = mapped_column(ForeignKey("opportunities.id", ondelete="CASCADE"), primary_key=True)
    status: Mapped[str] = mapped_column(String(20), default="not-applied")
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class Reminder(Base):
    __tablename__ = "reminders"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    student_id: Mapped[str] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True)
    opportunity_id: Mapped[str] = mapped_column(ForeignKey("opportunities.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(20))  # new / deadline-24h / deadline-2h / custom
    remind_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    channel: Mapped[str] = mapped_column(String(10), default="email")  # telegram / email / push
    sent: Mapped[bool] = mapped_column(Boolean, default=False)
    cancelled: Mapped[bool] = mapped_column(Boolean, default=False)


class Report(Base):
    """'Report wrong criteria' clicks; feeds the Phase 4 corrections queue."""

    __tablename__ = "reports"

    student_id: Mapped[str] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), primary_key=True)
    opportunity_id: Mapped[str] = mapped_column(ForeignKey("opportunities.id", ondelete="CASCADE"), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Notification(Base):
    """Everything sent to a student, also shown in the in-app bell."""

    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    student_id: Mapped[str] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True)
    opportunity_id: Mapped[str | None] = mapped_column(ForeignKey("opportunities.id", ondelete="SET NULL"), nullable=True)
    kind: Mapped[str] = mapped_column(String(20))  # new / deadline-24h / deadline-2h / custom / digest / shortlist
    title: Mapped[str] = mapped_column(String(255))
    body: Mapped[str] = mapped_column(Text, default="")
    channels: Mapped[list] = mapped_column(JSON, default=list)  # where it was delivered besides the app
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    read: Mapped[bool] = mapped_column(Boolean, default=False)
