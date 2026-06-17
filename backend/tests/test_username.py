"""Tests for the username service."""

from uski.services.username import derive_username_from_email


class TestDeriveUsernameFromEmail:
    """Test email-to-username derivation."""

    def test_simple_email(self):
        assert derive_username_from_email("leon@example.com") == "leon"

    def test_dots_removed(self):
        assert derive_username_from_email("leon.huber@example.com") == "leonhuber"

    def test_plus_alias_removed(self):
        assert derive_username_from_email("test+tag@example.com") == "test"

    def test_multiple_dots_and_plus(self):
        assert derive_username_from_email("test.user+tag@example.com") == "testuser"

    def test_numbers_preserved(self):
        assert derive_username_from_email("user123@example.com") == "user123"

    def test_underscores_and_hyphens_stripped(self):
        assert derive_username_from_email("my_name-test@example.com") == "mynametest"

    def test_too_short_falls_back(self):
        result = derive_username_from_email("ab@b.com")
        assert result.startswith("user")
        assert len(result) == 8
        assert result[4:].isdigit()

    def test_empty_local_part_falls_back(self):
        result = derive_username_from_email("@example.com")
        assert result.startswith("user")
        assert len(result) == 8

    def test_only_dots_falls_back(self):
        result = derive_username_from_email("...@example.com")
        assert result.startswith("user")
        assert len(result) == 8

    def test_long_email_truncated_to_20(self):
        result = derive_username_from_email(
            "verylongusernamethatexceedslimit@example.com"
        )
        assert len(result) == 20
        assert result == "verylongusernamethat"

    def test_exactly_3_chars_valid(self):
        assert derive_username_from_email("abc@example.com") == "abc"

    def test_exactly_2_chars_falls_back(self):
        result = derive_username_from_email("ab@example.com")
        assert result.startswith("user")

    def test_uppercase_lowercased(self):
        assert derive_username_from_email("Leon@Example.com") == "leon"

    def test_all_special_chars_falls_back(self):
        result = derive_username_from_email("!@#$%@example.com")
        assert result.startswith("user")
        assert len(result) == 8
