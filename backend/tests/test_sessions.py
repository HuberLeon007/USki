"""Tests for the pure session/device helpers (no DB, no network)."""

from hypothesis import given, strategies as st

from uski.services.sessions import (
    device_from_user_agent,
    is_private_ip,
    session_key_for,
)


def test_session_key_is_deterministic_and_hex():
    a = session_key_for("refresh-token-abc")
    b = session_key_for("refresh-token-abc")
    assert a == b
    assert len(a) == 64 and all(c in "0123456789abcdef" for c in a)


def test_session_key_differs_per_token():
    assert session_key_for("one") != session_key_for("two")


def test_device_parsing_known_agents():
    chrome_win = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36"
    assert device_from_user_agent(chrome_win) == "Chrome on Windows"
    iphone_safari = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Version/17.0 Mobile Safari/604.1"
    assert device_from_user_agent(iphone_safari) == "Safari on iOS"
    firefox_linux = "Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0"
    assert device_from_user_agent(firefox_linux) == "Firefox on Linux"


def test_device_parsing_empty():
    assert device_from_user_agent(None) == "Unknown device"
    assert device_from_user_agent("") == "Unknown device"


@given(st.sampled_from(["127.0.0.1", "::1", "10.0.0.5", "192.168.1.10", "172.16.0.1", "", None]))
def test_private_or_local_ips_have_no_geo(ip):
    # Loopback / private / empty addresses must be treated as non-geolocatable.
    assert is_private_ip(ip) is True


@given(st.sampled_from(["8.8.8.8", "1.1.1.1", "203.0.113.5"]))
def test_public_ips_are_not_private(ip):
    assert is_private_ip(ip) is False


@given(st.text())
def test_device_parsing_never_raises(ua):
    # Must always return a non-empty label, never raise, for arbitrary input.
    assert device_from_user_agent(ua)
