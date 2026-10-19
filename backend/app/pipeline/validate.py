"""Step 5: sanity-check extracted fields before they reach students."""

import re
from datetime import datetime, timedelta

from .extract import Extraction, parse_dt

URL_OK = re.compile(r"^https?://[^\s/$.?#].[^\s]*$", re.I)


def validate(ex: Extraction, received: datetime, min_confidence: float) -> tuple[Extraction, list[str]]:
    """Fix or drop bad values; lower confidence when something looks wrong.
    Low confidence turns the criteria into 'Check manually' so nothing is silently hidden."""
    problems: list[str] = []

    if ex.registration_link and not URL_OK.match(ex.registration_link):
        problems.append(f"bad link {ex.registration_link!r}")
        ex.registration_link = ""

    for field in ("deadline", "event_date"):
        dt = parse_dt(getattr(ex, field))
        if getattr(ex, field) and dt is None:
            problems.append(f"unparseable {field}")
            setattr(ex, field, None)
        elif dt and not (received - timedelta(days=2) <= dt <= received + timedelta(days=365)):
            problems.append(f"{field} {dt:%Y-%m-%d} out of range")
            setattr(ex, field, None)

    e = ex.eligibility
    if e:
        if e.min_cgpa is not None and not 0 <= e.min_cgpa <= 10:
            problems.append(f"CGPA {e.min_cgpa} out of range")
            e.min_cgpa, e.unclear = None, True
        for f in ("min_10th", "min_12th"):
            v = getattr(e, f)
            if v is not None and not 0 <= v <= 100:
                problems.append(f"{f} {v} out of range")
                setattr(e, f, None)
        e.batches = [b for b in e.batches if 2020 <= b <= 2035]

    if problems:
        ex.confidence = min(ex.confidence, 0.6)
    if ex.confidence < min_confidence and e and not e.unclear:
        e.unclear = True
    if not ex.summary:
        ex.summary = [f"{ex.title} — {ex.organization}"]
    ex.summary = ex.summary[:3]
    return ex, problems
