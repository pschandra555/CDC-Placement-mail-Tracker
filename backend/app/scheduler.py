"""Local / single-server scheduler: `python -m app.scheduler`.

Reads the inbox every FETCH_MINUTES and sends due notifications every minute.
In production you can use this, or call POST /cron/fetch and /cron/notify from cron-job.org."""

import logging
import time

from .config import get_settings
from .db import init_db
from .routers.cron import notify
from .pipeline.run import run

FETCH_MINUTES = 15
log = logging.getLogger("scheduler")


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    init_db()
    s = get_settings()
    last_fetch = 0.0
    log.info("Scheduler started: inbox every %s min, notifications every minute. Ctrl+C to stop.", FETCH_MINUTES)
    while True:
        try:
            if time.time() - last_fetch >= FETCH_MINUTES * 60:
                rep = run(s)
                last_fetch = time.time()
                log.info("inbox: %s new, %s updated, %s duplicates", len(rep.created), len(rep.updated), rep.skipped_duplicates)
            res = notify(s)
            if res["sent"] or res["digests"]:
                log.info("sent %s notifications (%s), %s digests", res["sent"], res["byChannel"], res["digests"])
        except Exception:  # keep running; the next minute retries
            log.exception("tick failed")
        time.sleep(60)


if __name__ == "__main__":
    main()
