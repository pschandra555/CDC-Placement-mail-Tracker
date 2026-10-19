"""One-time setup: get a refresh token for the central project inbox.

1. In Google Cloud Console create an OAuth client of type "Desktop app" and
   enable the Gmail API. Put its id/secret in backend/.env.
2. Run:  python scripts/gmail_auth.py
3. Open the printed URL, sign in AS THE CENTRAL INBOX, approve read-only access,
   paste the code back here. Copy the printed GMAIL_REFRESH_TOKEN into .env.

Only this one inbox is ever read; students never grant Gmail access."""

import os
import sys
import urllib.parse

import httpx

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from app.config import get_settings  # noqa: E402

LOOPBACK = "http://localhost"
SCOPE = "https://www.googleapis.com/auth/gmail.readonly"


def main() -> None:
    s = get_settings()
    if not (s.gmail_client_id and s.gmail_client_secret):
        sys.exit("Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in backend/.env first.")
    params = {"client_id": s.gmail_client_id, "redirect_uri": LOOPBACK, "response_type": "code",
              "scope": SCOPE, "access_type": "offline", "prompt": "consent"}
    print("Open this URL while signed in as the central inbox:\n")
    print("https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode(params))
    print("\nAfter approving, the browser goes to http://localhost/?code=... (the page won't load — that's fine).")
    code = input("Paste the full redirected URL or just the code: ").strip()
    if "code=" in code:
        code = urllib.parse.parse_qs(urllib.parse.urlparse(code).query)["code"][0]
    r = httpx.post("https://oauth2.googleapis.com/token", data={
        "code": code, "client_id": s.gmail_client_id, "client_secret": s.gmail_client_secret,
        "redirect_uri": LOOPBACK, "grant_type": "authorization_code"})
    r.raise_for_status()
    print("\nGMAIL_REFRESH_TOKEN=" + r.json()["refresh_token"])


if __name__ == "__main__":
    main()
