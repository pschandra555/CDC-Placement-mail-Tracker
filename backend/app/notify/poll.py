"""Run the Telegram bot locally without a public URL: `python -m app.notify.poll`."""

import logging
import sys

from ..config import get_settings
from ..db import init_db
from .telegram import poll_forever

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    s = get_settings()
    if not s.telegram_enabled:
        sys.exit("Set TELEGRAM_BOT_TOKEN and TELEGRAM_BOT_USERNAME in backend/.env first (create a bot with @BotFather).")
    init_db()
    poll_forever(s)
