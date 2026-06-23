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
# Dark, table-based, email-client-safe shell mirroring supabase/templates/otp.html:
# dark page (#0b0b0f), centered card (#15151c / #26262f), USki logo + text wordmark with
# the purple "US" accent (#7c5cff). The logo is a publicly-hosted PNG; the text wordmark
# stays as a graceful fallback if the image is blocked by the mail client.
_FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
_LOGO_URL = "https://uski.huberleon.com/logo.png"


def _shell(subtitle: str, body_html: str) -> str:
    return (
        f'<!doctype html><html lang="en"><body style="margin:0;background:#0b0b0f;font-family:{_FONT};">'
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        'style="background:#0b0b0f;padding:40px 0;"><tr><td align="center">'
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        'style="max-width:480px;background:#15151c;border:1px solid #26262f;border-radius:16px;'
        'padding:36px 32px;">'
        # Logo + wordmark side by side (logo left, "USki" right). The wordmark
        # text stays as a graceful fallback if the image is blocked.
        '<tr><td align="center" style="padding-bottom:18px;">'
        f'<img src="{_LOGO_URL}" alt="" width="40" '
        'style="display:inline-block;vertical-align:middle;width:40px;height:auto;border:0;'
        'outline:none;text-decoration:none;border-radius:10px;margin-right:10px;" />'
        '<span style="display:inline-block;vertical-align:middle;font-size:24px;font-weight:700;'
        'letter-spacing:-0.02em;">'
        '<span style="color:#7c5cff;">US</span><span style="color:#ffffff;">ki</span></span>'
        "</td></tr>"
        # Subtitle
        '<tr><td align="center" style="padding-bottom:24px;font-size:14px;color:#9b9ba7;">'
        f"{subtitle}</td></tr>"
        # Body
        f'<tr><td style="font-size:14px;line-height:1.6;color:#c7c7d1;">{body_html}</td></tr>'
        # Footer
        '<tr><td align="center" style="padding-top:28px;font-size:12px;line-height:1.6;color:#6b6b78;">'
        "You're receiving this because you have a USki account."
        "</td></tr>"
        "</table></td></tr></table></body></html>"
    )


def welcome_email(to: str, name: str | None) -> EmailMessage:
    who = name or "there"
    body = (
        f'<p style="margin:0 0 12px;color:#ffffff;font-size:16px;font-weight:600;">Hi {who}, welcome to USki!</p>'
        '<p style="margin:0;">Create your first deck, study with FSRS, and ask the AI assistant '
        "whenever you're stuck. We're glad you're here.</p>"
    )
    return EmailMessage(
        to=to, subject="Welcome to USki 🎉", html=_shell("Welcome aboard", body), kind="welcome"
    )


def _detail_row(label: str, value: str) -> str:
    return (
        '<tr>'
        f'<td style="padding:8px 16px 8px 0;color:#6b6b78;font-size:13px;white-space:nowrap;">{label}</td>'
        f'<td style="padding:8px 0;color:#ffffff;font-size:13px;font-weight:600;">{value}</td>'
        "</tr>"
    )


def login_alert_email(to: str, device: str, location: str, when: datetime) -> EmailMessage:
    ts = when.strftime("%Y-%m-%d %H:%M UTC")
    body = (
        '<p style="margin:0 0 16px;">A new sign-in to your USki account was just recorded:</p>'
        '<table role="presentation" cellpadding="0" cellspacing="0" '
        'style="width:100%;background:#0b0b0f;border:1px solid #2e2e3a;border-radius:12px;'
        'padding:8px 16px;border-collapse:separate;">'
        f"{_detail_row('Device', device)}"
        f"{_detail_row('Location', location)}"
        f"{_detail_row('Time', ts)}"
        "</table>"
        '<p style="margin:16px 0 0;color:#9b9ba7;">If this was you, no action is needed. '
        "If not, open Settings &rarr; Security and sign out that device.</p>"
    )
    return EmailMessage(
        to=to,
        subject=f"New USki sign-in from {device}",
        html=_shell("New sign-in", body),
        kind="login_alert",
    )


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
