import os
import tempfile

# Point the app at a throwaway database before anything imports app.db.
_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
for key in ("GEMINI_API_KEY", "GROQ_API_KEY", "GMAIL_REFRESH_TOKEN", "SUPABASE_URL", "SUPABASE_JWT_SECRET", "CRON_SECRET"):
    os.environ[key] = ""

import pytest  # noqa: E402

from app.db import Base, engine  # noqa: E402


@pytest.fixture(autouse=True)
def fresh_db():
    from app import models  # noqa: F401

    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield
