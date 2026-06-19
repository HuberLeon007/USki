"""Live end-to-end smoke against the running stack (backend :8000, Supabase, Mailpit).

Proves the real path incl. the issuer fix: OTP login -> /me -> set-username ->
deck -> card -> review -> share invite. Run: python e2e_local.py
"""

import re
import sys
import time
import uuid

import httpx

API = "http://localhost:8000/api"
MAILPIT = "http://localhost:54324"


def fetch_otp(email: str) -> str:
    for _ in range(30):
        time.sleep(0.5)
        msgs = httpx.get(f"{MAILPIT}/api/v1/messages", params={"limit": 30}, timeout=10).json()
        for m in msgs.get("messages", []):
            tos = [t.get("Address", "").lower() for t in m.get("To", [])]
            if email.lower() in tos:
                full = httpx.get(f"{MAILPIT}/api/v1/message/{m['ID']}", timeout=10).json()
                body = f"{full.get('Text','')} {full.get('Snippet','')} {full.get('HTML','')}"
                mm = re.search(r"\b(\d{6})\b", body)
                if mm:
                    return mm.group(1)
    raise RuntimeError("OTP not found in Mailpit")


def main() -> None:
    email = f"e2e_{uuid.uuid4().hex[:8]}@example.com"
    print("email:", email)

    r = httpx.post(f"{API}/auth/send-otp", json={"email": email}, timeout=20)
    assert r.status_code == 200, r.text
    code = fetch_otp(email)
    print("otp:", code)

    r = httpx.post(f"{API}/auth/verify-otp", json={"email": email, "token": code}, timeout=20)
    assert r.status_code == 200, f"verify-otp: {r.status_code} {r.text}"
    auth = r.json()
    h = {"Authorization": f"Bearer {auth['access_token']}"}

    # The critical fix: authenticated call must NOT 401 (issuer allow-list).
    r = httpx.get(f"{API}/auth/me", headers=h, timeout=20)
    assert r.status_code == 200, f"/me 401-bug regressed: {r.status_code} {r.text}"
    print("me ok, needs_username:", auth["needs_username"])

    if auth["needs_username"]:
        uname = "e2e" + uuid.uuid4().hex[:6]
        r = httpx.post(f"{API}/auth/set-username", json={"username": uname}, headers=h, timeout=20)
        assert r.status_code == 200, f"set-username: {r.status_code} {r.text}"
        print("username set:", r.json()["username"], "#", r.json()["discriminator"])

    # deck
    r = httpx.post(f"{API}/decks", json={"title": "E2E Deck"}, headers=h, timeout=20)
    assert r.status_code == 201, r.text
    deck_id = r.json()["id"]

    # card (sanitize: script must be stripped)
    r = httpx.post(
        f"{API}/decks/{deck_id}/cards",
        json={"front_html": "<p>Q?</p><script>alert(1)</script>", "back_html": "<p>A!</p>"},
        headers=h, timeout=30,
    )
    assert r.status_code == 201, r.text
    card = r.json()
    assert "<script>" not in card["front_html"], "sanitize failed"
    card_id = card["id"]

    # review: new card due -> rate good -> not due
    due = httpx.get(f"{API}/decks/{deck_id}/review/due", headers=h, timeout=20).json()
    assert any(c["id"] == card_id for c in due), "new card not due"
    r = httpx.post(f"{API}/decks/{deck_id}/review/{card_id}", json={"rating": "good"}, headers=h, timeout=20)
    assert r.status_code == 200, r.text
    due2 = httpx.get(f"{API}/decks/{deck_id}/review/due", headers=h, timeout=20).json()
    assert all(c["id"] != card_id for c in due2), "card still due after good"

    # sharing: create invite
    r = httpx.post(f"{API}/decks/{deck_id}/invites", json={"permission": "read"}, headers=h, timeout=20)
    assert r.status_code == 201, r.text
    assert r.json()["code"]

    # cleanup
    httpx.delete(f"{API}/decks/{deck_id}", headers=h, timeout=20)
    print("\nE2E PASS: auth-fix + decks + cards(sanitize) + review(FSRS) + sharing all live.")


if __name__ == "__main__":
    try:
        main()
    except AssertionError as e:
        print("E2E FAIL:", e)
        sys.exit(1)
