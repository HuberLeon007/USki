"""Username service — email-to-username derivation."""

import random
import re

MIN_USERNAME_LENGTH = 3
MAX_USERNAME_LENGTH = 20
FALLBACK_PREFIX = "user"


def derive_username_from_email(email: str) -> str:
    """Derive a default username from an email address.

    Rules:
    1. Take local part (before @)
    2. Remove dots
    3. Remove everything except ASCII alphanumeric
    4. Lowercase
    5. Truncate to MAX_USERNAME_LENGTH
    6. If result < MIN_USERNAME_LENGTH, fall back to 'user' + 4 random digits
    """
    local_part = email.split("@")[0] if "@" in email else ""
    # Strip +alias (e.g. test+tag@example.com -> test)
    local_part = local_part.split("+")[0]

    cleaned = local_part.replace(".", "")
    cleaned = re.sub(r"[^a-zA-Z0-9]", "", cleaned)
    cleaned = cleaned.lower()
    cleaned = cleaned[:MAX_USERNAME_LENGTH]

    if len(cleaned) < MIN_USERNAME_LENGTH:
        fallback_digits = "".join(str(random.randint(0, 9)) for _ in range(4))
        return f"{FALLBACK_PREFIX}{fallback_digits}"

    return cleaned
