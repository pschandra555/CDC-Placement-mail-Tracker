"""Step 4: classify the mail and extract structured fields.

Order: Gemini (JSON output) → Groq (Llama, JSON mode) → rule-based parser.
The rule-based parser keeps the system working with no API keys and handles
the templated way CDC mails are usually written."""

import json
import logging
import re
from datetime import datetime, timedelta, timezone

import httpx
from dateutil import parser as dateparser
from pydantic import BaseModel, Field, ValidationError

from ..config import Settings

log = logging.getLogger(__name__)
IST = timezone(timedelta(hours=5, minutes=30))
CATEGORIES = ["full-time", "internship", "intern-ft", "hackathon", "workshop", "update", "other"]


class Eligibility(BaseModel):
    min_cgpa: float | None = None
    branches: list[str] = Field(default_factory=list)
    batches: list[int] = Field(default_factory=list)
    max_backlogs: int | None = None
    no_past_backlogs: bool = False
    min_10th: float | None = None
    min_12th: float | None = None
    source_line: str = ""
    unclear: bool = False


class Extraction(BaseModel):
    category: str = "other"
    is_update: bool = False  # changes an earlier drive (deadline extended, venue changed)
    update_note: str | None = None
    title: str = ""
    organization: str = ""
    registration_link: str = ""
    deadline: str | None = None  # ISO 8601
    event_date: str | None = None
    summary: list[str] = Field(default_factory=list)
    details: dict[str, str] = Field(default_factory=dict)
    eligibility: Eligibility | None = None  # None = no criteria stated (open to all)
    confidence: float = 0.5
    extractor: str = "rules"


def parse_dt(value: str | None) -> datetime | None:
    """Parse a date from a mail or the AI; times without a zone are IST. Returns naive UTC."""
    if not value:
        return None
    try:
        dt = dateparser.parse(value, dayfirst=True, fuzzy=True)
    except (ValueError, OverflowError):
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=IST)
    return dt.astimezone(timezone.utc).replace(tzinfo=None)


# ── AI extractors ─────────────────────────────────────────────────────────────

PROMPT = """You extract placement opportunities from VIT CDC (Career Development Centre) emails.
Return ONLY a JSON object with these keys:
- category: one of {cats}
  (intern-ft = internship that converts to full-time; update = shortlist / result / round info;
   hackathon also covers ideathons and coding contests; workshop also covers pre-placement talks)
- is_update: true only if this mail changes an EARLIER announcement (deadline extended, venue/time changed)
- update_note: short note like "Deadline extended" when is_update, else null
- title: role name or event name
- organization: company or organizing body
- registration_link: the registration URL, or ""
- deadline: registration deadline in ISO 8601 with +05:30 offset, or null
- event_date: event / test / talk date in ISO 8601 with +05:30 offset, or null
- summary: exactly 3 short lines a student can skim
- details: object of category-specific fields as short strings, using these keys when present:
  full-time: Role, CTC, Location, Bond, Joining date
  internship: Role, Stipend, Duration, Type, PPO
  intern-ft: Role, Stipend, Duration, CTC, Location, Bond
  hackathon: Organizer, Theme, Team size, Prizes, Mode
  workshop: Topic, Venue, Attendance
  update: Linked drive, Round, Next step
- eligibility: null if the mail states no criteria at all; otherwise an object with
  min_cgpa (number|null), branches (list using CSE, CSE-AI, CSE-DS, CSE-IoT, CSE-IS, CSE-BC, CSE-BS, IT, ECE, EEE, EIE, MECH, CIVIL, CHEM, BIOTECH;
  "CSE & allied" means CSE, CSE-AI, CSE-DS, CSE-IoT, CSE-IS, CSE-BC, CSE-BS, IT; empty list = all branches),
  batches (graduation years, e.g. [2026]), max_backlogs (current backlogs allowed, number|null),
  no_past_backlogs (bool), min_10th, min_12th (percent|null),
  source_line (the eligibility sentence copied exactly from the mail),
  unclear (true if criteria are vague, e.g. "good academic record")
- confidence: 0..1, how sure you are about the fields above

Today is {today}. Email received {received}.
Subject: {subject}

{body}"""


def _prompt(subject: str, body: str, received: datetime) -> str:
    return PROMPT.format(
        cats=", ".join(CATEGORIES),
        today=datetime.now(IST).strftime("%d %b %Y"),
        received=received.replace(tzinfo=timezone.utc).astimezone(IST).strftime("%d %b %Y %H:%M IST"),
        subject=subject,
        body=body[:12000],
    )


def _parse_ai(text: str, name: str) -> Extraction:
    data = json.loads(text)
    ex = Extraction.model_validate(data)
    ex.extractor = name
    if ex.category not in CATEGORIES:
        ex.category = "other"
    return ex


def extract_gemini(s: Settings, prompt: str) -> Extraction:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{s.gemini_model}:generateContent"
    r = httpx.post(
        url,
        params={"key": s.gemini_api_key},
        json={
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"responseMimeType": "application/json", "temperature": 0.1},
        },
        timeout=60,
    )
    r.raise_for_status()
    text = r.json()["candidates"][0]["content"]["parts"][0]["text"]
    return _parse_ai(text, "gemini")


def extract_groq(s: Settings, prompt: str) -> Extraction:
    r = httpx.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={"Authorization": f"Bearer {s.groq_api_key}"},
        json={
            "model": s.groq_model,
            "messages": [{"role": "user", "content": prompt}],
            "response_format": {"type": "json_object"},
            "temperature": 0.1,
        },
        timeout=60,
    )
    r.raise_for_status()
    return _parse_ai(r.json()["choices"][0]["message"]["content"], "groq")


# ── Rule-based extractor ──────────────────────────────────────────────────────

CSE_FAMILY = ["CSE", "CSE-AI", "CSE-DS", "CSE-IoT", "CSE-IS", "CSE-BC", "CSE-BS", "IT"]
BRANCH_WORDS = [
    (r"\bCSE\b(?!\s*(?:&|and)\s*allied)", "CSE"),
    (r"\bIT\b", "IT"),
    (r"\bECE\b", "ECE"),
    (r"\bEEE\b", "EEE"),
    (r"\b(?:Mechanical|MECH)\b", "MECH"),
    (r"\bCivil\b", "CIVIL"),
    (r"\bChemical\b", "CHEM"),
    (r"\bBiotech(?:nology)?\b", "BIOTECH"),
]
DATE_RE = re.compile(r"\d{1,2}\s+[A-Z][a-z]{2,8}\s+\d{4}(?:,?\s+\d{1,2}:\d{2}\s*[AP]M)?", re.I)
URL_RE = re.compile(r"https?://[^\s)>\]]+")
KV_RE = re.compile(r"^\s*([A-Z][A-Za-z /()+&-]{1,28}):\s*(.+?)\s*$")
SKIP_KEYS = re.compile(r"eligib|link|register|deadline|last date|event date|regards|dear|note|details", re.I)
DEADLINE_HINT = re.compile(r"new deadline|register by|registration deadline|deadline|last date|register before|before|confirm attendance by|report by", re.I)
ELIG_HINT = re.compile(r"eligib|cgpa|open to|batch|branches|arrears|backlog|academic record|passouts|students of", re.I)


def _classify(subject: str, body: str, details: dict) -> tuple[str, bool]:
    s, text = subject.lower(), f"{subject}\n{body}".lower()
    is_update = bool(re.search(r"extended|postponed|rescheduled|venue chang|time chang|revised", s))
    if re.search(r"shortlist|result|selected students|final selects", s):
        return "update", is_update
    if re.search(r"hackathon|ideathon|coding contest|contest|codeathon", text):
        return "hackathon", is_update
    if re.search(r"pre-placement talk|\bppt\b|workshop|webinar|seminar|clinic", text):
        return "workshop", is_update
    if re.search(r"intern", s) and re.search(r"full[- ]time|\+\s*ft|ppo\)? drive", s) or "on conversion" in text:
        return "intern-ft", is_update
    if re.search(r"intern", text) or "Stipend" in details:
        return "internship", is_update
    if re.search(r"\bctc\b|lpa|campus recruitment|hiring|campus drive", text):
        return "full-time", is_update
    return "other", is_update


def _eligibility(lines: list[str]) -> Eligibility | None:
    line = next((l for l in lines if ELIG_HINT.search(l) and not URL_RE.search(l)), None)
    if line is None:
        return None
    src = re.sub(r"^\s*Eligibility\s*:\s*", "", line).strip()
    low = src.lower()
    e = Eligibility(source_line=src)

    m = re.search(r"CGPA\s*(?:of|:|≥|>=|above|\s)*\s*(\d{1,2}(?:\.\d{1,2})?)", src, re.I) or re.search(
        r"(\d{1,2}(?:\.\d{1,2})?)\s*CGPA", src, re.I
    )
    if m and 0 <= float(m.group(1)) <= 10:
        e.min_cgpa = float(m.group(1))

    if re.search(r"(?:CSE|computer science)\s*(?:&|and)\s*allied", src, re.I):
        e.branches = list(CSE_FAMILY)
    if not re.search(r"all (?:b\.tech )?branches|any branch|all students", low):
        for pat, name in BRANCH_WORDS:
            if re.search(pat, src) and name not in e.branches:
                e.branches.append(name)

    e.batches = sorted({int(y) for y in re.findall(r"\b(20[2-3]\d)\b", src)})

    if re.search(r"no (?:history of|past) (?:arrears|backlogs)", low):
        e.no_past_backlogs, e.max_backlogs = True, 0
    elif re.search(r"no (?:standing|current|active)? ?(?:arrears|backlogs)", low):
        e.max_backlogs = 0

    if m := re.search(r"(\d{2,3})\s*%\s*in\s*10th\s*(?:&|and)\s*12th", src, re.I):
        e.min_10th = e.min_12th = float(m.group(1))
    else:
        if m := re.search(r"(\d{2,3})\s*%\s*in\s*(?:Class\s*)?(?:X|10th)\b", src, re.I):
            e.min_10th = float(m.group(1))
        if m := re.search(r"(\d{2,3})\s*%\s*in\s*(?:Class\s*)?(?:XII|12th)\b", src, re.I):
            e.min_12th = float(m.group(1))

    has_criteria = any([e.min_cgpa is not None, e.branches, e.batches, e.max_backlogs is not None, e.min_10th, e.min_12th])
    if not has_criteria:
        if re.search(r"open to all|all students|any branch", low):
            return None  # explicitly open
        e.unclear = True
    return e


def _summary(ex: Extraction) -> list[str]:
    d = ex.details
    money = d.get("CTC") or d.get("Stipend") or d.get("Prizes")
    first = f"{ex.title} — {ex.organization}" + (f", {money}" if money else "")
    def show(k: str, v: str) -> str:
        if k == "Bond":
            return "No bond" if v.strip().lower() in ("none", "no", "nil") else f"Bond: {v}"
        return f"Team of {v}" if k == "Team size" and v[:1].isdigit() else v

    rest = [show(k, v) for k, v in d.items() if k in ("Location", "Duration", "Mode", "Venue", "Team size", "Next step", "Bond", "Type", "Attendance") and v]
    second = " · ".join(rest[:3]) or "See the original mail for details."
    if ex.eligibility is None:
        third = "Open to all."
    elif ex.eligibility.unclear:
        third = "Criteria unclear — check the mail."
    else:
        third = ex.eligibility.source_line[:110]
    return [first, second, third]


def _iso(dt: datetime | None) -> str | None:
    return dt.replace(tzinfo=timezone.utc).isoformat() if dt else None


def extract_rules(subject: str, body: str) -> Extraction:
    lines = [l for l in body.splitlines() if l.strip()]
    details: dict[str, str] = {}
    for l in lines:
        if (m := KV_RE.match(l)) and not SKIP_KEYS.search(m.group(1)) and not URL_RE.search(m.group(2)):
            details[m.group(1).strip()] = m.group(2).strip()

    category, is_update = _classify(subject, body, details)
    head = re.split(r"\s+[—–|-]\s+", re.sub(r"^(?:re|fwd?):\s*", "", subject, flags=re.I))[0].strip()

    org = details.pop("Organizer", None) if category == "hackathon" else None
    if category == "hackathon":
        title, org = head, org or head
        if org:
            details = {"Organizer": org, **details}
    else:
        org = head
        title = details.get("Role") or details.get("Topic") or ""
        if category == "workshop" and re.search(r"pre-placement talk|\bppt\b", subject, re.I):
            title = "Pre-Placement Talk"
        if category == "update":
            title = subject
            details.setdefault("Linked drive", head)
        title = title or (subject.split("—")[-1].strip() if "—" in subject else subject)

    deadline = None
    for pick_new in (True, False):
        for l in lines:
            if (("new deadline" in l.lower()) if pick_new else DEADLINE_HINT.search(l)) and (m := DATE_RE.search(l)):
                if "event date" not in l.lower():
                    deadline = m.group(0)
                    break
        if deadline:
            break
    event = next((m.group(0) for l in lines if re.search(r"event date|date of event|test date", l, re.I) and (m := DATE_RE.search(l))), None)
    link_m = URL_RE.search(body)

    ex = Extraction(
        category=category,
        is_update=is_update,
        update_note="Deadline extended" if is_update and "extend" in subject.lower() else ("Updated" if is_update else None),
        title=title,
        organization=org or "",
        registration_link=link_m.group(0).rstrip(".,") if link_m else "",
        deadline=_iso(parse_dt(deadline)),
        event_date=_iso(parse_dt(event)),
        details=details,
        eligibility=None if category == "update" else _eligibility(lines),
        extractor="rules",
    )
    ex.summary = _summary(ex)
    solid = ex.category != "other" and ex.deadline and ex.registration_link and ex.organization
    ex.confidence = 0.8 if solid else 0.55
    return ex


def extract(s: Settings, subject: str, body: str, received: datetime) -> Extraction:
    prompt = _prompt(subject, body, received)
    for name, enabled, fn in (("gemini", s.gemini_api_key, extract_gemini), ("groq", s.groq_api_key, extract_groq)):
        if not enabled:
            continue
        try:
            return fn(s, prompt)
        except (httpx.HTTPError, KeyError, IndexError, json.JSONDecodeError, ValidationError) as e:
            log.warning("%s extraction failed, trying next: %s", name, e)
    return extract_rules(subject, body)
