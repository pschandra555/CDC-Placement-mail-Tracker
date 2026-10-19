"""Telegram Bot API over plain HTTPS. Students link their chat once with a one-time code."""

import html
import logging
import secrets
from datetime import timedelta

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import Settings
from ..models import Student, utcnow

log = logging.getLogger(__name__)
LINK_TTL = timedelta(minutes=30)


def api(s: Settings, method: str, **payload) -> dict:
    r = httpx.post(f"https://api.telegram.org/bot{s.telegram_bot_token}/{method}", json=payload, timeout=20)
    r.raise_for_status()
    return r.json()


def send(s: Settings, chat_id: str, text: str, button: tuple[str, str] | None = None) -> None:
    payload: dict = {"chat_id": chat_id, "text": text, "parse_mode": "HTML", "disable_web_page_preview": True}
    if button and button[1].startswith("https://"):  # Telegram rejects http:// buttons (e.g. localhost)
        payload["reply_markup"] = {"inline_keyboard": [[{"text": button[0], "url": button[1]}]]}
    api(s, "sendMessage", **payload)


def new_link(db: Session, student: Student, s: Settings) -> str:
    """One-time deep link: t.me/<bot>?start=<code>. Opening it and pressing Start links the chat."""
    student.telegram_link_code = secrets.token_urlsafe(12)
    student.telegram_link_expires = utcnow() + LINK_TTL
    db.commit()
    return f"https://t.me/{s.telegram_bot_username}?start={student.telegram_link_code}"


def handle_update(db: Session, s: Settings, update: dict) -> str | None:
    """Handle one incoming bot update. Returns the reply text (also sent when the bot is configured)."""
    msg = update.get("message") or {}
    text = (msg.get("text") or "").strip()
    chat_id = str((msg.get("chat") or {}).get("id", ""))
    if not chat_id or not text.startswith("/"):
        return None

    cmd, _, arg = text.partition(" ")
    cmd = cmd.split("@")[0].lower()
    student = db.scalar(select(Student).where(Student.telegram_chat_id == chat_id))

    if cmd == "/start" and arg:
        target = db.scalar(select(Student).where(Student.telegram_link_code == arg.strip()))
        if not target or not target.telegram_link_expires or target.telegram_link_expires < utcnow():
            reply = "That link has expired. Open the CDC Tracker Alerts page and press <b>Connect Telegram</b> again."
        else:
            if student and student.id != target.id:  # this chat was linked to someone else
                student.telegram_chat_id = None
            target.telegram_chat_id = chat_id
            target.telegram_link_code = None
            target.telegram_link_expires = None
            target.notify_telegram = True
            db.commit()
            reply = (f"✅ Connected, {html.escape(target.name.split(' ')[0] or 'there')}!\n"
                     "You'll get new eligible drives and deadline reminders here.\n\n/today — what's due\n/stop — disconnect")
    elif cmd == "/start":
        reply = "Hi! To get CDC alerts, open the CDC Tracker <b>Alerts</b> page and press <b>Connect Telegram</b>."
    elif cmd == "/stop" and student:
        student.telegram_chat_id = None
        db.commit()
        reply = "Disconnected. You won't get Telegram alerts any more. Reconnect anytime from the Alerts page."
    elif cmd == "/today" and student:
        from .messages import today_text

        reply = today_text(db, student, s)
    else:
        reply = "Commands: /today — what's due · /stop — disconnect"

    if s.telegram_enabled:
        try:
            send(s, chat_id, reply)
        except httpx.HTTPError as e:
            log.warning("telegram reply failed: %s", e)
    return reply


def poll_forever(s: Settings) -> None:
    """Local development without a public URL: long-poll getUpdates instead of a webhook."""
    from ..db import SessionLocal

    api(s, "deleteWebhook")
    offset = 0
    log.info("Polling Telegram as @%s — press Ctrl+C to stop", s.telegram_bot_username)
    while True:
        try:
            res = httpx.get(f"https://api.telegram.org/bot{s.telegram_bot_token}/getUpdates",
                            params={"offset": offset, "timeout": 25}, timeout=35).json()
        except httpx.HTTPError as e:
            log.warning("poll failed: %s", e)
            continue
        for upd in res.get("result", []):
            offset = upd["update_id"] + 1
            with SessionLocal() as db:
                handle_update(db, s, upd)
