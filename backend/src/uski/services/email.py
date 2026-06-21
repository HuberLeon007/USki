"""Transactional email: welcome + login-alert mails.

A small deep module behind one method, `notify_login`, which the auth endpoints
call after a successful login. Everything else (which adapter delivers, how the
templates are built, the welcome-once rule) is hidden.

Adapter seam mirrors the social-login pattern:
- dev  -> records to the `email_log` outbox (and logs); no external delivery,
          so it works fully offline and is inspectable.
- prod -> delivers via the Resend HTTP API and also records to the outbox.

The interesting logic (template building, the once-per-email welcome decision)
is pure / DB-only and testable without sending anything.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

import requests
from loguru import logger

from uski.core.config import settings
from uski.core.supabase import get_supabase_client

_TABLE = "email_log"


@dataclass(frozen=True)
class EmailMessage:
    to: str
    subject: str
    html: str
    kind: str


# ── templates (pure) ─────────────────────────────────────────
def _shell(title: str, body_html: str) -> str:
    return (
        '<div style="font-family:system-ui,Segoe UI,Roboto,sans-serif;max-width:520px;'
        'margin:0 auto;padding:24px;color:#0f172a">'
        '<h1 style="font-size:20px;margin:0 0 4px">USki</h1>'
        f'<h2 style="font-size:16px;margin:16px 0 8px">{title}</h2>'
        f'{body_html}'
        '<p style="margin-top:24px;font-size:12px;color:#64748b">'
        "You're receiving this because you have a USki account.</p>"
        "</div>"
    )


def welcome_email(to: str, name: str | None) -> EmailMessage:
    who = name or "there"
    body = (
        f"<p>Hi {who}, welcome to USki!</p>"
        "<p>Create your first deck, study with FSRS, and ask the AI assistant whenever "
        "you're stuck. We're glad you're here.</p>"
    )
    return EmailMessage(to=to, subject="Welcome to USki", html=_shell("Welcome aboard", body), kind="welcome")


def login_alert_email(to: str, device: str, location: str, when: datetime) -> EmailMessage:
    ts = when.strftime("%Y-%m-%d %H:%M UTC")
    body = (
        "<p>A new sign-in to your USki account was just recorded:</p>"
        '<table style="font-size:14px;border-collapse:collapse">'
        f'<tr><td style="padding:2px 12px 2px 0;color:#64748b">Device</td><td>{device}</td></tr>'
        f'<tr><td style="padding:2px 12px 2px 0;color:#64748b">Location</td><td>{location}</td></tr>'
        f'<tr><td style="padding:2px 12px 2px 0;color:#64748b">Time</td><td>{ts}</td></tr>'
        "</table>"
        "<p style=\"margin-top:12px\">If this was you, no action is needed. If not, open "
        "Settings &rarr; Security and sign out that device.</p>"
    )
    return EmailMessage(to=to, subject="New sign-in to your USki account", html=_shell("New sign-in", body), kind="login_alert")


# ── adapters ─────────────────────────────────────────────────
def _record(msg: EmailMessage) -> None:
    """Persist the message to the outbox (both dev and prod)."""
    try:
        get_supabase_client().table(_TABLE).insert(
            {"to_email": msg.to, "subject": msg.subject, "html": msg.html, "kind": msg.kind}
        ).execute()
    except Exception as exc:  # noqa: BLE001 - email must never break login
        logger.warning("email outbox insert failed for {}: {}", msg.to, exc)


def _deliver_resend(msg: EmailMessage) -> None:
    if not settings.RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not set; email to {} recorded but not delivered", msg.to)
        return
    try:
        requests.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
            json={"from": settings.EMAIL_FROM, "to": [msg.to], "subject": msg.subject, "html": msg.html},
            timeout=8,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Resend delivery failed for {}: {}", msg.to, exc)


def _send(msg: EmailMessage) -> None:
    """Record always; deliver via Resend only in prod."""
    _record(msg)
    if settings.is_dev:
        logger.info("dev email [{}] to {}: {}", msg.kind, msg.to, msg.subject)
    else:
        _deliver_resend(msg)


def _already_welcomed(to: str) -> bool:
    try:
        res = (
            get_supabase_client()
            .table(_TABLE)
            .select("id")
            .eq("to_email", to)
            .eq("kind", "welcome")
            .limit(1)
            .execute()
        )
        return bool(res.data)
    except Exception:  # noqa: BLE001
        return False


# ── public interface ─────────────────────────────────────────
def notify_login(to: str | None, name: str | None, device: str, location: str) -> None:
    """Send the welcome email (first time only) and a login-alert email.

    Safe to call on every login: it never raises, and the welcome is sent at
    most once per email address (tracked via the outbox).
    """
    if not to:
        return
    try:
        if not _already_welcomed(to):
            _send(welcome_email(to, name))
        _send(login_alert_email(to, device, location, datetime.now(timezone.utc)))
    except Exception as exc:  # noqa: BLE001 - never block login on email
        logger.warning("notify_login failed for {}: {}", to, exc)
