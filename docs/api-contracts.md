# API Contracts Plan

This is a route plan, not an implementation.

All protected endpoints require a Supabase access token:

```http
Authorization: Bearer <access_token>
```

## Health

```http
GET /health
```

Purpose: container and API health check.

## Auth

Auth code sending and verification are handled by Supabase Auth from the frontend.

FastAPI only needs:

```http
GET /api/auth/me
```

Purpose: return current authenticated app user after JWT validation.

## Decks

```http
GET /api/decks
POST /api/decks
GET /api/decks/{deck_id}
PATCH /api/decks/{deck_id}
DELETE /api/decks/{deck_id}
```

Permission: owner or membership.

## Flashcards

```http
GET /api/decks/{deck_id}/flashcards
POST /api/decks/{deck_id}/flashcards
GET /api/flashcards/{card_id}
PATCH /api/flashcards/{card_id}
DELETE /api/flashcards/{card_id}
```

Permission:

- `read` can list/view.
- `edit` can create/update/delete.
- owner can do everything.

## Files

```http
POST /api/decks/{deck_id}/files
GET /api/files/{file_id}/signed-url
DELETE /api/files/{file_id}
```

Permission:

- `read` can request signed URLs.
- `edit` can upload/delete when allowed.

## Study And FSRS

```http
GET /api/decks/{deck_id}/study/due
POST /api/flashcards/{card_id}/review
```

Purpose:

- Load due cards.
- Submit `Again`, `Hard`, `Good`, or `Easy` rating.

## Documents

```http
POST /api/decks/{deck_id}/documents
GET /api/decks/{deck_id}/documents
DELETE /api/documents/{document_id}
```

Purpose:

- Upload `.txt` or text-based `.pdf`.
- Prepare chunks and embeddings later.

## Chat

```http
GET /api/decks/{deck_id}/chat-sessions
POST /api/decks/{deck_id}/chat-sessions
GET /api/chat-sessions/{session_id}/messages
POST /api/chat-sessions/{session_id}/messages
DELETE /api/chat-sessions/{session_id}
```

Purpose:

- Create chat threads.
- Persist user and assistant messages.
- Use Supabase Realtime later for message updates.

## Sharing

```http
POST /api/decks/{deck_id}/shares
GET /api/decks/{deck_id}/shares
DELETE /api/shares/{share_id}
POST /api/shares/claim
```

Permission:

- `share` or owner can create share codes.
- Claiming creates a `deck_memberships` row.
