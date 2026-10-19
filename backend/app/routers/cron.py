from dataclasses import asdict

from fastapi import APIRouter, Depends, Header, HTTPException

from ..config import Settings, get_settings
from ..pipeline.run import run

router = APIRouter(prefix="/cron", tags=["cron"])


@router.post("/fetch")
def fetch_now(x_cron_secret: str | None = Header(default=None), s: Settings = Depends(get_settings)):
    """Called every 15–30 min by cron-job.org or Supabase pg_cron."""
    if s.cron_secret and x_cron_secret != s.cron_secret:
        raise HTTPException(401, "Bad cron secret")
    if not s.cron_secret and not s.dev_auth:
        raise HTTPException(403, "Set CRON_SECRET to enable this endpoint")
    return asdict(run(s))
