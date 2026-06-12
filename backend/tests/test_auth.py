from unittest.mock import patch, MagicMock


class TestSendOtp:
    def test_send_otp_returns_success_message(self, client):
        with patch("uski.api.auth.get_supabase_anon_client") as mock_create:
            mock_client = MagicMock()
            mock_create.return_value = mock_client
            mock_client.auth.sign_in_with_otp.return_value = MagicMock()
            response = client.post("/api/auth/send-otp", json={"email": "test@example.com"})
        assert response.status_code == 200
        assert "verification code" in response.json()["message"].lower()

    def test_send_otp_invalid_email_returns_422(self, client):
        response = client.post("/api/auth/send-otp", json={"email": "not-an-email"})
        assert response.status_code == 422

    def test_send_otp_missing_email_returns_422(self, client):
        response = client.post("/api/auth/send-otp", json={})
        assert response.status_code == 422

    def test_send_otp_calls_supabase(self, client):
        with patch("uski.api.auth.get_supabase_anon_client") as mock_create:
            mock_client = MagicMock()
            mock_create.return_value = mock_client
            mock_client.auth.sign_in_with_otp.return_value = MagicMock()
            client.post("/api/auth/send-otp", json={"email": "user@test.com"})
            mock_client.auth.sign_in_with_otp.assert_called_once_with({"email": "user@test.com"})


class TestVerifyOtp:
    def test_verify_otp_success(self, client):
        with patch("uski.api.auth.get_supabase_anon_client") as mock_create:
            mock_client = MagicMock()
            mock_create.return_value = mock_client
            mock_session = MagicMock()
            mock_session.access_token = "test-access-token"
            mock_session.refresh_token = "test-refresh-token"
            mock_user = MagicMock()
            mock_user.id = "user-123"
            mock_response = MagicMock()
            mock_response.session = mock_session
            mock_response.user = mock_user
            mock_client.auth.verify_otp.return_value = mock_response
            response = client.post("/api/auth/verify-otp", json={"email": "test@example.com", "token": "123456"})
        assert response.status_code == 200
        data = response.json()
        assert data["access_token"] == "test-access-token"
        assert data["user_id"] == "user-123"

    def test_verify_otp_invalid_code_returns_401(self, client):
        with patch("uski.api.auth.get_supabase_anon_client") as mock_create:
            mock_client = MagicMock()
            mock_create.return_value = mock_client
            mock_client.auth.verify_otp.side_effect = Exception("Invalid OTP")
            response = client.post("/api/auth/verify-otp", json={"email": "test@example.com", "token": "000000"})
        assert response.status_code == 401

    def test_verify_otp_missing_fields_returns_422(self, client):
        response = client.post("/api/auth/verify-otp", json={"email": "test@example.com"})
        assert response.status_code == 422


class TestGetMe:
    def test_get_me_without_token_returns_401(self, client):
        response = client.get("/api/auth/me")
        assert response.status_code == 401

    def test_get_me_with_valid_token(self, client, make_token):
        token = make_token({"sub": "user-456", "email": "me@example.com"})
        response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == "user-456"
        assert data["email"] == "me@example.com"

    def test_get_me_with_invalid_token_returns_401(self, client):
        response = client.get("/api/auth/me", headers={"Authorization": "Bearer invalid-token"})
        assert response.status_code == 401


class TestLogout:
    def test_logout_returns_success(self, client):
        response = client.post("/api/auth/logout")
        assert response.status_code == 200
        assert "logged out" in response.json()["message"].lower()


class TestVerifyOtpValidation:
    """Test 6-digit code format validation."""

    def test_code_too_short_returns_422(self, client):
        response = client.post(
            "/api/auth/verify-otp",
            json={"email": "test@example.com", "token": "12345"},
        )
        assert response.status_code == 422

    def test_code_too_long_returns_422(self, client):
        response = client.post(
            "/api/auth/verify-otp",
            json={"email": "test@example.com", "token": "1234567"},
        )
        assert response.status_code == 422

    def test_code_non_numeric_returns_422(self, client):
        response = client.post(
            "/api/auth/verify-otp",
            json={"email": "test@example.com", "token": "abcdef"},
        )
        assert response.status_code == 422

    def test_code_mixed_alpha_numeric_returns_422(self, client):
        response = client.post(
            "/api/auth/verify-otp",
            json={"email": "test@example.com", "token": "12345a"},
        )
        assert response.status_code == 422

    def test_code_empty_returns_422(self, client):
        response = client.post(
            "/api/auth/verify-otp",
            json={"email": "test@example.com", "token": ""},
        )
        assert response.status_code == 422

    def test_exactly_6_digits_accepted(self, client):
        with patch("uski.api.auth.get_supabase_anon_client") as mock_create:
            mock_client = MagicMock()
            mock_create.return_value = mock_client
            mock_session = MagicMock()
            mock_session.access_token = "test-token"
            mock_session.refresh_token = "test-refresh"
            mock_user = MagicMock()
            mock_user.id = "user-789"
            mock_response = MagicMock()
            mock_response.session = mock_session
            mock_response.user = mock_user
            mock_client.auth.verify_otp.return_value = mock_response
            response = client.post(
                "/api/auth/verify-otp",
                json={"email": "test@example.com", "token": "654321"},
            )
        assert response.status_code == 200
        assert response.json()["access_token"] == "test-token"
