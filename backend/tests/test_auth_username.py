"""Tests for username setup endpoints."""

from unittest.mock import patch, MagicMock

from uski.core.security import CurrentUser
from uski.main import app


def _mock_current_user(user_id="user-123", email="test@example.com"):
    """Helper to mock authenticated user."""
    user = CurrentUser(id=user_id, email=email)

    async def _override():
        return user

    from uski.core.security import get_current_user
    app.dependency_overrides[get_current_user] = _override
    return user


class TestSetUsername:
    """Test POST /api/auth/set-username."""

    def test_set_username_success(self, client):
        _mock_current_user()
        mock_result = MagicMock()
        mock_result.data = [{"id": "user-123", "username": "leon", "discriminator": "4821"}]

        with patch("uski.api.auth.get_supabase_client") as mock_get_client:
            mock_client = MagicMock()
            mock_get_client.return_value = mock_client
            # Guard check: table("user").select("username").eq("id",...).execute()
            # -> returns [{"username": None}] (new user, no username yet)
            mock_client.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[{"username": None}])
            # Discriminator check: table("user").select("id").eq("username",...).eq("discriminator",...).execute()
            # -> returns [] (no collision)
            mock_client.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
            # Update returns success
            mock_client.table.return_value.update.return_value.eq.return_value.execute.return_value = mock_result

            response = client.post(
                "/api/auth/set-username",
                json={"username": "leon"},
                headers={"Authorization": "Bearer fake-token"},
            )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == "user-123"

    def test_set_username_all_discriminators_taken_returns_500(self, client):
        _mock_current_user()
        with patch("uski.api.auth.get_supabase_client") as mock_get_client:
            mock_client = MagicMock()
            mock_get_client.return_value = mock_client
            # Guard check: user has no username yet
            mock_client.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[{"username": None}])
            # All 10 discriminator combos taken
            existing = MagicMock()
            existing.data = [{"id": "other-user"}]
            mock_client.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = existing

            response = client.post(
                "/api/auth/set-username",
                json={"username": "leon"},
                headers={"Authorization": "Bearer fake-token"},
            )
        assert response.status_code == 500

    def test_set_username_invalid_format_returns_422(self, client):
        _mock_current_user()
        response = client.post(
            "/api/auth/set-username",
            json={"username": "has spaces!"},
            headers={"Authorization": "Bearer fake-token"},
        )
        assert response.status_code == 422

    def test_set_username_too_short_returns_422(self, client):
        _mock_current_user()
        response = client.post(
            "/api/auth/set-username",
            json={"username": "ab"},
            headers={"Authorization": "Bearer fake-token"},
        )
        assert response.status_code == 422

    def test_set_username_requires_auth(self, client):
        response = client.post("/api/auth/set-username", json={"username": "leon"})
        assert response.status_code == 401


class TestCheckUsername:
    """Test GET /api/auth/check-username."""

    def test_check_available_username(self, client):
        _mock_current_user()
        with patch("uski.api.auth.get_supabase_client") as mock_get_client:
            mock_client = MagicMock()
            mock_get_client.return_value = mock_client
            mock_client.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[])

            response = client.get(
                "/api/auth/check-username?username=leon",
                headers={"Authorization": "Bearer fake-token"},
            )
        assert response.status_code == 200
        data = response.json()
        assert data["available"] is True
        assert data["username"] == "leon"

    def test_check_taken_username(self, client):
        _mock_current_user()
        with patch("uski.api.auth.get_supabase_client") as mock_get_client:
            mock_client = MagicMock()
            mock_get_client.return_value = mock_client
            mock_client.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[{"id": "other"}])

            response = client.get(
                "/api/auth/check-username?username=leon",
                headers={"Authorization": "Bearer fake-token"},
            )
        assert response.status_code == 200
        data = response.json()
        assert data["available"] is False

    def test_check_username_requires_auth(self, client):
        response = client.get("/api/auth/check-username?username=leon")
        assert response.status_code == 401
