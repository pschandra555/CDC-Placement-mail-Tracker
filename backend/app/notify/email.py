"""Plain SMTP (works with a Gmail app password, Brevo, Mailgun, etc.)."""

import smtplib
from email.message import EmailMessage

from ..config import Settings


def send(s: Settings, to: str, subject: str, text: str, html_body: str | None = None) -> None:
    msg = EmailMessage()
    msg["From"] = s.email_from
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(text)
    if html_body:
        msg.add_alternative(html_body, subtype="html")
    with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=20) as smtp:
        smtp.starttls()
        if s.smtp_user:
            smtp.login(s.smtp_user, s.smtp_password)
        smtp.send_message(msg)
