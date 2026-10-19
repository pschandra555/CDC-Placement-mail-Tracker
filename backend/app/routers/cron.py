from dataclasses import asdict

from fastapi import APIRouter, Depends, Header, HTTPException

from ..config import Settings, get_settings
from ..db import SessionLocal
from ..notify.dispatch import send_digests, send_due
from ..pipeline.run import run

router = APIRouter(prefix="/cron", tags=["cron"])


def _guard(secret: str | None, s: Settings) -> None:
    if s.cron_secret and secret != s.cron_secret:
        raise HTTPException(401, "Bad cron secret")
    if not s.cron_secret and not s.dev_auth:
        raise HTTPException(403, "Set CRON_SECRET to enable this endpoint")


def notify(s: Settings) -> dict:
    with SessionLocal() as db:
        rep = send_due(db, s)
        digests = send_digests(db, s)
    return {"sent": rep.sent, "skipped": rep.skipped, "digests": digests, "byChannel": dict(rep.by_channel)}


@router.post("/fetch")
def fetch_now(x_cron_secret: str | None = Header(default=None), s: Settings = Depends(get_settings)):
    """Read new mails, then send anything that became due. Call every 15–30 min."""
    _guard(x_cron_secret, s)
    return {"pipeline": asdict(run(s)), "notify": notify(s)}


@router.post("/notify")
def notify_now(x_cron_secret: str | None = Header(default=None), s: Settings = Depends(get_settings)):
    """Send due reminders and digests only. Call every 5 minutes so 2h reminders are on time."""
    _guard(x_cron_secret, s)
    return notify(s)
