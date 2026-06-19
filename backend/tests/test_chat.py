"""Tests for the chat API endpoint."""

from unittest.mock import patch

import pytest

from uski.core.security import CurrentUser
from uski.main import app
from uski.schemas.chat import ChatMessage, ChatResponse


@pytest.fixture
def mock_current_user():
    """Mock the auth dependency to skip JWT validation."""
    from uski.core.security import get_current_user

    user = CurrentUser(id="test-user-id", email="test@example.com")

    async def _override():
        return user

    app.dependency_overrides[get_current_user] = _override
    yield user
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def mock_ai_chat():
    """Mock the AI chat service to avoid real API calls."""
    response = ChatResponse(
        message=ChatMessage(
            role="assistant",
            content="FSRS ist ein Spaced Repetition Algorithmus.",
        ),
        model="test-model",
    )
    with patch("uski.api.chat.ai_chat", return_value=response) as mock:
        yield mock


def test_chat_success(client, mock_current_user, mock_ai_chat):
    """Test successful chat request."""
    response = client.post(
        "/api/chat",
        json={"messages": [{"role": "user", "content": "Was ist FSRS?"}]},
        headers={"Authorization": "Bearer fake-token"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["message"]["role"] == "assistant"
    assert "FSRS" in data["message"]["content"]
    assert data["model"] == "test-model"


def test_chat_empty_messages(client, mock_current_user):
    """Test that empty messages list is rejected."""
    response = client.post(
        "/api/chat",
        json={"messages": []},
        headers={"Authorization": "Bearer fake-token"},
    )
    assert response.status_code == 422


def test_chat_unauthorized(client):
    """Test that unauthenticated requests are rejected."""
    response = client.post(
        "/api/chat",
        json={"messages": [{"role": "user", "content": "Hello"}]},
    )
    assert response.status_code in (401, 403)


def test_chat_calls_ai_service(client, mock_current_user, mock_ai_chat):
    """With a deck_id, RAG grounding runs: a system context message is prepended
    and the user question is preserved. AI service is called once."""
    from uski.core.deps import get_chunk_repo, get_deck_repo, get_embedder, get_share_repo
    from uski.repos.chunks import InMemoryChunkRepo
    from uski.repos.decks import InMemoryDeckRepo
    from uski.repos.sharing import InMemoryShareRepo
    from uski.schemas.deck import DeckCreate
    from uski.services.embeddings import FakeEmbedder

    decks = InMemoryDeckRepo()
    deck = decks.create("test-user-id", DeckCreate(title="Bio"))
    app.dependency_overrides[get_deck_repo] = lambda: decks
    app.dependency_overrides[get_chunk_repo] = lambda: InMemoryChunkRepo()
    app.dependency_overrides[get_embedder] = lambda: FakeEmbedder()
    app.dependency_overrides[get_share_repo] = lambda: InMemoryShareRepo()
    try:
        client.post(
            "/api/chat",
            json={
                "messages": [{"role": "user", "content": "Was ist FSRS?"}],
                "deck_id": deck.id,
            },
            headers={"Authorization": "Bearer fake-token"},
        )
        mock_ai_chat.assert_called_once()
        call_request = mock_ai_chat.call_args[0][0]
        assert call_request.messages[0].role == "system"
        assert any(m.content == "Was ist FSRS?" for m in call_request.messages)
    finally:
        for dep in (get_deck_repo, get_chunk_repo, get_embedder, get_share_repo):
            app.dependency_overrides.pop(dep, None)


def test_chat_server_error(client, mock_current_user):
    """Test that AI service errors return 502."""
    with patch("uski.api.chat.ai_chat", side_effect=Exception("AI down")):
        response = client.post(
            "/api/chat",
            json={"messages": [{"role": "user", "content": "Test"}]},
            headers={"Authorization": "Bearer fake-token"},
        )
    assert response.status_code == 502
    assert "unavailable" in response.json()["detail"].lower()
