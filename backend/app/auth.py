"""Sign-in: verify the Supabase access token and require a VIT student email.

With no Supabase settings (local dev), the X-Dev-Email header picks the user."""

from functools import lru_cache

import jwt
from fastapi import Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import Settings, get_settings
from .db import get_db
from .models import Student

DEV_DEFAULT_EMAIL = "aarav.sharma2022@vitstudent.ac.in"


@lru_cache
def _jwks(url: str) -> jwt.PyJWKClient:
    return jwt.PyJWKClient(f"{url.rstrip('/')}/auth/v1/.well-known/jwks.json")


def _claims(token: str, s: Settings) -> dict:
    try:
        if s.supabase_jwt_secret:
            return jwt.decode(token, s.supabase_jwt_secret, algorithms=["HS256"], audience="authenticated")
        key = _jwks(s.supabase_url).get_signing_key_from_jwt(token)
        return jwt.decode(token, key.key, algorithms=["RS256", "ES256"], audience="authenticated")
    except jwt.PyJWTError as e:
        raise HTTPException(401, f"Invalid sign-in token: {e}") from e


def current_student(
    authorization: str | None = Header(default=None),
    x_dev_email: str | None = Header(default=None),
    db: Session = Depends(get_db),
    s: Settings = Depends(get_settings),
) -> Student:
    if s.dev_auth:
        email, name = (x_dev_email or DEV_DEFAULT_EMAIL).lower(), ""
    else:
        if not authorization or not authorization.lower().startswith("bearer "):
            raise HTTPException(401, "Sign in required")
        claims = _claims(authorization.split(" ", 1)[1], s)
        email = (claims.get("email") or "").lower()
        name = (claims.get("user_metadata") or {}).get("full_name", "")

    if not email.endswith("@" + s.allowed_email_domain):
        raise HTTPException(403, f"Only @{s.allowed_email_domain} accounts can sign in")

    student = db.scalar(select(Student).where(Student.vit_email == email))
    if student is None:
        student = Student(vit_email=email, name=name or email.split("@")[0].replace(".", " ").title())
        db.add(student)
        db.commit()
    return student
