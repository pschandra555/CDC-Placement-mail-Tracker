"""Step 1–2: collect mails from the central inbox (Gmail API) or, with no
credentials, from the bundled sample mails."""

import base64
import hashlib
import io
import json
import logging
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from email.utils import parseaddr
from pathlib import Path

import httpx

from ..config import Settings

log = logging.getLogger(__name__)

DATE_FMT = "%d %b %Y, %I:%M %p"  # e.g. "21 Oct 2026, 11:59 PM" — how CDC mails write dates


@dataclass
class RawMail:
    message_id: str
    sender: str
    subject: str
    body: str
    received_at: datetime  # naive UTC

    @property
    def body_hash(self) -> str:
        return hashlib.sha256(f"{self.subject.strip()}\n{self.body.strip()}".encode()).hexdigest()


# ── Sample mails ──────────────────────────────────────────────────────────────

SAMPLE_FILE = Path(__file__).resolve().parent.parent / "sample_mails" / "mails.json"
# Sample mails are written in IST, like real CDC mails.
IST = timezone(timedelta(hours=5, minutes=30))


def _fill_dates(text: str, anchor: datetime) -> str:
    """{{h+20}} → 20 hours from now; {{day+9@9}} → 9 days from today at 9 AM IST."""

    def repl(m: re.Match) -> str:
        if m.group(1):
            when = anchor + timedelta(hours=int(m.group(1)))
        else:
            when = (anchor + timedelta(days=int(m.group(2)))).replace(hour=int(m.group(3)), minute=0)
        return when.strftime(DATE_FMT)

    return re.sub(r"\{\{(?:h\+(\d+)|day\+(\d+)@(\d+))\}\}", repl, text)


def load_sample_mails(now: datetime | None = None) -> list[RawMail]:
    now_ist = (now or datetime.now(timezone.utc)).astimezone(IST).replace(minute=0, second=0, microsecond=0)
    out = []
    for m in json.loads(SAMPLE_FILE.read_text()):
        received = (now_ist - timedelta(hours=m["hours_ago"])).astimezone(timezone.utc).replace(tzinfo=None)
        out.append(
            RawMail(
                message_id=m["id"],
                sender="helpdesk.cdc@vit.ac.in",
                subject=m["subject"],
                body=_fill_dates(m["body"], now_ist),
                received_at=received,
            )
        )
    return out


# ── Gmail API (REST, no Google SDK needed) ────────────────────────────────────

GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me"


def _access_token(s: Settings, client: httpx.Client) -> str:
    r = client.post(
        "https://oauth2.googleapis.com/token",
        data={
            "client_id": s.gmail_client_id,
            "client_secret": s.gmail_client_secret,
            "refresh_token": s.gmail_refresh_token,
            "grant_type": "refresh_token",
        },
    )
    r.raise_for_status()
    return r.json()["access_token"]


def _b64(data: str) -> bytes:
    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4))


def _html_to_text(html: str) -> str:
    html = re.sub(r"(?is)<(script|style).*?</\1>", "", html)
    html = re.sub(r"(?i)<br\s*/?>|</p>|</div>|</tr>", "\n", html)
    text = re.sub(r"<[^>]+>", " ", html)
    return re.sub(r"[ \t]+", " ", text).strip()


def _pdf_text(data: bytes) -> str:
    try:
        import pdfplumber

        with pdfplumber.open(io.BytesIO(data)) as pdf:
            return "\n".join((p.extract_text() or "") for p in pdf.pages[:10])
    except Exception as e:  # a broken attachment must not stop the mail
        log.warning("PDF read failed: %s", e)
        return ""


def _walk_parts(part: dict, client: httpx.Client, msg_id: str, headers: dict) -> tuple[str, str, list[str]]:
    plain, html, pdfs = "", "", []
    mime = part.get("mimeType", "")
    body = part.get("body", {})
    if mime == "text/plain" and body.get("data"):
        plain += _b64(body["data"]).decode("utf-8", "replace")
    elif mime == "text/html" and body.get("data"):
        html += _b64(body["data"]).decode("utf-8", "replace")
    elif mime == "application/pdf" or part.get("filename", "").lower().endswith(".pdf"):
        att = body.get("attachmentId")
        if att:
            r = client.get(f"{GMAIL}/messages/{msg_id}/attachments/{att}", headers=headers)
            if r.is_success:
                pdfs.append(_pdf_text(_b64(r.json()["data"])))
    for sub in part.get("parts", []) or []:
        p, h, f = _walk_parts(sub, client, msg_id, headers)
        plain, html, pdfs = plain + p, html + h, pdfs + f
    return plain, html, pdfs


def fetch_gmail(s: Settings, max_messages: int = 50) -> list[RawMail]:
    senders = " OR ".join(s.trusted_sender_list)
    query = f"from:({senders}) newer_than:{s.fetch_lookback_days}d"
    out: list[RawMail] = []
    with httpx.Client(timeout=30) as client:
        headers = {"Authorization": f"Bearer {_access_token(s, client)}"}
        r = client.get(f"{GMAIL}/messages", params={"q": query, "maxResults": max_messages}, headers=headers)
        r.raise_for_status()
        for ref in r.json().get("messages", []):
            m = client.get(f"{GMAIL}/messages/{ref['id']}", params={"format": "full"}, headers=headers).json()
            hdr = {h["name"].lower(): h["value"] for h in m["payload"].get("headers", [])}
            sender = parseaddr(hdr.get("from", ""))[1].lower()
            # Forwarded mails keep the original sender in the body; the query already limits senders.
            plain, html, pdfs = _walk_parts(m["payload"], client, m["id"], headers)
            body = plain.strip() or _html_to_text(html)
            if pdfs:
                body += "\n\n--- Attachment ---\n" + "\n".join(pdfs)
            received = datetime.fromtimestamp(int(m["internalDate"]) / 1000, tz=timezone.utc).replace(tzinfo=None)
            out.append(RawMail(m["id"], sender, hdr.get("subject", "(no subject)"), body, received))
    return out


def fetch(s: Settings) -> list[RawMail]:
    return fetch_gmail(s) if s.gmail_enabled else load_sample_mails()
