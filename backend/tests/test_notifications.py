from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.config import Settings, get_settings
from app.db import SessionLocal
from app.main import app
from app.models import Notification, Opportunity, Reminder, Student, utcnow
from app.notify import dispatch, telegram
from app.notify.dispatch import send_digests, send_due
from app.pipeline.run import run

PROFILE = {"name": "Aarav Sharma", "regNo": "22BCE1234", "branch": "CSE", "program": "B.Tech", "batch": 2026, "cgpa": 7.6,
           "marks10th": 92, "marks12th": 88, "currentBacklogs": 0, "pastBacklogs": 0,
           "alertCategories": ["full-time", "internship", "intern-ft", "hackathon"]}
BOT = Settings(telegram_bot_token="123:abc", telegram_bot_username="cdc_test_bot", telegram_webhook_secret="hook-secret")


@pytest.fixture
def sent(monkeypatch):
    """Capture Telegram messages instead of calling the real API."""
    out = []
    monkeypatch.setattr(telegram, "send", lambda s, chat, text, button=None: out.append((chat, text)))
    monkeypatch.setattr(telegram, "api", lambda s, method, **kw: {"ok": True})
    return out


@pytest.fixture
def client():
    app.dependency_overrides[get_settings] = lambda: BOT
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def student(db) -> Student:
    return db.scalar(select(Student))


def opp(db, prefix) -> Opportunity:
    return next(o for o in db.scalars(select(Opportunity)) if o.id.startswith(prefix))


def link_telegram(db, chat="555"):
    s = student(db)
    s.telegram_chat_id = chat
    db.commit()


def test_new_drives_are_combined_and_shortlist_alerted(client, sent):
    client.put("/me", json=PROFILE)
    with SessionLocal() as db:
        link_telegram(db)
    run()
    with SessionLocal() as db:
        rep = send_due(db, BOT)
        kinds = [n.kind for n in db.scalars(select(Notification))]
    assert kinds.count("new") == 1, "many new drives at once → one combined message"
    assert "shortlist" in kinds
    assert rep.by_channel["telegram"] == rep.sent
    assert any("new drives you can apply for" in t for _, t in sent)
    assert any("You're shortlisted" in t and "Nimbus Labs" in t for _, t in sent)

    bell = client.get("/notifications").json()
    assert bell and all(not n["read"] for n in bell)
    client.post("/notifications/read")
    assert all(n["read"] for n in client.get("/notifications").json())

    with SessionLocal() as db:  # nothing is sent twice
        assert send_due(db, BOT).sent == 0


def test_deadline_reminders_and_cancel_on_apply(client, sent):
    run()
    client.put("/me", json=PROFILE)
    with SessionLocal() as db:
        q = opp(db, "quantix")
        qid, deadline = q.id, q.deadline
        assert {r.kind for r in db.scalars(select(Reminder).where(Reminder.opportunity_id == qid))} == {"deadline-24h", "deadline-2h"}
        rep = send_due(db, BOT, now=deadline - timedelta(hours=23))
        assert any(n.kind == "deadline-24h" and n.opportunity_id == qid for n in db.scalars(select(Notification)))
        assert rep.sent >= 1
    client.put(f"/applications/{qid}", json={"status": "applied"})
    with SessionLocal() as db:
        send_due(db, BOT, now=deadline - timedelta(hours=1))
        assert not any(n.kind == "deadline-2h" and n.opportunity_id == qid for n in db.scalars(select(Notification)))


def test_late_24h_reminder_is_skipped(client, sent):
    run()
    client.put("/me", json=PROFILE)
    with SessionLocal() as db:
        q = opp(db, "quantix")
        send_due(db, BOT, now=q.deadline - timedelta(hours=1))  # scheduler was down for a day
        kinds = [n.kind for n in db.scalars(select(Notification).where(Notification.opportunity_id == q.id))]
    assert "deadline-24h" not in kinds and "deadline-2h" in kinds


def test_custom_reminders(client, sent):
    run()
    client.put("/me", json=PROFILE)
    with SessionLocal() as db:
        qid = opp(db, "quantix").id
    client.put(f"/applications/{qid}", json={"note": "OA on Friday"})
    when = (utcnow() + timedelta(hours=3)).isoformat() + "Z"
    r = client.post("/reminders", json={"opportunityId": qid, "remindAt": when})
    assert r.status_code == 201
    rid = r.json()["id"]
    assert any(x["kind"] == "custom" for x in client.get(f"/reminders?opportunityId={qid}").json())
    past = (utcnow() - timedelta(hours=1)).isoformat() + "Z"
    assert client.post("/reminders", json={"opportunityId": qid, "remindAt": past}).status_code == 422

    with SessionLocal() as db:
        link_telegram(db)
        send_due(db, BOT, now=utcnow() + timedelta(hours=3, minutes=1))
    assert any("Your reminder" in t and "OA on Friday" in t for _, t in sent)

    r2 = client.post("/reminders", json={"opportunityId": qid, "remindAt": when}).json()["id"]
    assert client.delete(f"/reminders/{r2}").status_code == 204
    assert rid != r2


def test_telegram_linking(client, sent):
    client.put("/me", json=PROFILE)
    url = client.post("/telegram/link").json()["url"]
    assert url.startswith("https://t.me/cdc_test_bot?start=")
    code = url.split("=", 1)[1]
    with SessionLocal() as db:
        reply = telegram.handle_update(db, BOT, {"message": {"chat": {"id": 777}, "text": f"/start {code}"}})
        assert "Connected" in reply and student(db).telegram_chat_id == "777"
        # the code is single-use
        assert "expired" in telegram.handle_update(db, BOT, {"message": {"chat": {"id": 888}, "text": f"/start {code}"}})
        assert "Nothing due" in telegram.handle_update(db, BOT, {"message": {"chat": {"id": 777}, "text": "/today"}})
    assert client.get("/me/alerts").json()["telegramLinked"] is True
    # webhook requires the secret
    upd = {"message": {"chat": {"id": 777}, "text": "/stop"}}
    assert client.post("/telegram/webhook", json=upd).status_code == 401
    assert client.post("/telegram/webhook", json=upd, headers={"X-Telegram-Bot-Api-Secret-Token": "hook-secret"}).status_code == 200
    assert client.get("/me/alerts").json()["telegramLinked"] is False


def test_daily_digest_once_per_day(client, sent):
    run()
    client.put("/me", json=PROFILE)
    client.put("/me/alerts", json={"digestEnabled": True, "digestTime": "08:00"})
    with SessionLocal() as db:
        today_ist = (utcnow() + timedelta(hours=5, minutes=30)).date()
        at_9_ist = datetime.combine(today_ist, datetime.min.time()) + timedelta(hours=9) - timedelta(hours=5, minutes=30)
        at_7_ist = at_9_ist - timedelta(hours=2)
        assert send_digests(db, BOT, now=at_7_ist) == 0  # before the chosen time
        assert send_digests(db, BOT, now=at_9_ist) == 1
        assert send_digests(db, BOT, now=at_9_ist + timedelta(hours=3)) == 0  # already sent today
        assert db.scalar(select(Notification).where(Notification.kind == "digest")).title.startswith("Daily digest")
    assert client.put("/me/alerts", json={"digestTime": "25:00"}).status_code == 422


def test_update_mail_notifies_followers(client, sent):
    client.put("/me", json=PROFILE)
    run()
    with SessionLocal() as db:
        send_due(db, BOT)
        led = opp(db, "ledgerly-fintech-backend")
        assert any(n.kind == "update" and n.opportunity_id == led.id for n in db.scalars(select(Notification)))
        assert "Deadline extended" in db.scalar(select(Notification).where(Notification.kind == "update")).body


def test_email_is_backup_when_telegram_fails(client, monkeypatch):
    mails = []

    def boom(*a, **k):
        raise RuntimeError("telegram down")

    monkeypatch.setattr(telegram, "send", boom)
    monkeypatch.setattr(dispatch.email, "send", lambda s, to, subject, text, html_body=None: mails.append((to, subject)))
    both = Settings(**{**BOT.model_dump(), "smtp_host": "smtp.test", "email_from": "alerts@test"})
    client.put("/me", json=PROFILE)
    run()
    with SessionLocal() as db:
        link_telegram(db)
        rep = send_due(db, both)
    assert rep.by_channel["email"] == rep.sent and mails[0][0] == "aarav.sharma2022@vitstudent.ac.in"


def test_calendar_feed(client):
    run()
    client.put("/me", json=PROFILE)
    url = client.get("/me/alerts").json()["calendarUrl"]
    path = url.split("8000", 1)[1]
    r = client.get(path)
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/calendar")
    body = r.text
    assert body.startswith("BEGIN:VCALENDAR") and "Quantix Analytics closes" in body
    assert "VoltGrid" not in body, "drives you can't apply for stay out of your calendar"
    assert all(len(line.encode()) <= 75 for line in body.split("\r\n"))
    assert client.get("/calendar/not-a-real-token-at-all-xx.ics").status_code == 404
    new = client.post("/me/calendar/rotate").json()["calendarUrl"]
    assert new != url and client.get(path).status_code == 404
