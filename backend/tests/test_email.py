"""Tests for the pure email template builders (no sending, no DB)."""

from datetime import datetime, timezone

from uski.services.email import login_alert_email, welcome_email


def test_welcome_email_uses_name_and_kind():
    msg = welcome_email("leon@example.com", "leon")
    assert msg.to == "leon@example.com"
    assert msg.kind == "welcome"
    assert "leon" in msg.html
    assert "Welcome" in msg.subject


def test_welcome_email_falls_back_when_no_name():
    msg = welcome_email("x@example.com", None)
    assert "there" in msg.html


def test_login_alert_includes_device_location_and_time():
    when = datetime(2026, 6, 21, 14, 30, tzinfo=timezone.utc)
    msg = login_alert_email("a@example.com", "Chrome on Windows", "Vienna, Austria", when)
    assert msg.kind == "login_alert"
    assert "Chrome on Windows" in msg.html
    assert "Vienna, Austria" in msg.html
    assert "2026-06-21 14:30 UTC" in msg.html
    assert "sign-in" in msg.subject.lower()


# ── branded shell markers (prod-auth-email-polish, Requirement 2) ──────────
_ACCENT = "#7c5cff"
_DARK_BG = "#0b0b0f"


def test_welcome_email_is_branded():
    html = welcome_email("leon@example.com", "leon").html
    assert _ACCENT in html  # purple "US" wordmark accent
    assert _DARK_BG in html  # dark page background
    assert ">US<" in html and ">ki<" in html  # split wordmark


def test_login_alert_is_branded_and_keeps_details():
    when = datetime(2026, 6, 21, 14, 30, tzinfo=timezone.utc)
    html = login_alert_email("a@example.com", "iPhone", "Vienna, Austria", when).html
    assert _ACCENT in html
    assert _DARK_BG in html
    # details still present inside the branded shell
    assert "iPhone" in html
    assert "Vienna, Austria" in html
    assert "2026-06-21 14:30 UTC" in html
