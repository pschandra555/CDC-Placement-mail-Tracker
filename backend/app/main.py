from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .db import init_db
from .routers import alerts, applications, cron, me, opportunities


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


s = get_settings()
app = FastAPI(title="CDC Placement Mail Tracker API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in s.cors_origins.split(",") if o.strip()],
    allow_origin_regex=s.cors_origin_regex or None,
    allow_methods=["*"],
    allow_headers=["*"],
)
for r in (opportunities.router, me.router, applications.router, alerts.router, cron.router):
    app.include_router(r)


@app.get("/health")
def health():
    return {
        "ok": True,
        "mode": {
            "auth": "dev" if s.dev_auth else "supabase",
            "inbox": "gmail" if s.gmail_enabled else "sample-mails",
            "extractor": "gemini" if s.gemini_api_key else ("groq" if s.groq_api_key else "rules"),
            "database": s.database_url.split(":", 1)[0],
            "telegram": "on" if s.telegram_enabled else "off",
            "email": "on" if s.email_enabled else "off",
        },
    }
