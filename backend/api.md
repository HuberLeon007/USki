# Backend API Dokumentation

> Aktueller Stand: OTP-Authentifizierung (6-stelliger Code) + KI-Chat
> JWT-Validierung: RS256 via JWKS (Supabase Signing Keys)
> Interaktive API-Docs: `/scalar` (Scalar UI)

## Endpunkte

### System

| Methode | Pfad | Beschreibung | Auth |
|---------|------|-------------|------|
| GET | `/api/health` | Health check | Nein |
| GET | `/scalar` | Interaktive API-Dokumentation (Scalar UI) | Nein |
| GET | `/openapi.json` | OpenAPI-Spec (maschinenlesbar) | Nein |

### Authentifizierung

| Methode | Pfad | Beschreibung | Auth |
|---------|------|-------------|------|
| POST | `/api/auth/send-otp` | Sendet 6-stelligen OTP-Code per E-Mail | Nein |
| POST | `/api/auth/verify-otp` | Verifiziert OTP-Code (genau 6 Ziffern), gibt JWT zurück | Nein |
| GET | `/api/auth/me` | Gibt aktuellen User zurück | Ja (Bearer JWT) |
| POST | `/api/auth/logout` | Logout (Client muss Token verwerfen) | Nein |

### Chat (KI)

| Methode | Pfad | Beschreibung | Auth |
|---------|------|-------------|------|
| POST | `/api/chat` | Sendet Chat-Nachricht, gibt KI-Antwort zurück. Optional `deck_id` für RAG-Kontext eines bestimmten Decks. | Ja (Bearer JWT) |

**Request Body** (`POST /api/chat`):
```json
{
  "messages": [
    {"role": "user", "content": "Was ist FSRS?"}
  ],
  "deck_id": "optional-deck-id"}
```

**Response**:
```json
{
  "message": {
    "role": "assistant",
    "content": "FSRS ist ein Spaced Repetition Algorithmus..."
  },
  "model": "qwen3:4b"
}
```

**Fehler**:
- `422` — Validierungsfehler (leere Messages, ungültige Rolle)
- `401/403` — Kein oder ungültiger JWT
- `502` — KI-Service nicht erreichbar

## Auth-Flow Diagramm

```
1. User gibt E-Mail ein
2. Frontend -> POST /api/auth/send-otp {email}
3. Supabase generiert 6-stelligen Code, sendet E-Mail
   DEV: Code landet in Inbucket (localhost:54324)
   PROD: Code wird per Resend SMTP versendet
4. User gibt Code ein
5. Frontend -> POST /api/auth/verify-otp {email, token: "123456"}
6. Supabase verifiziert Code (muss genau 6 Ziffern sein), gibt JWT zurück
7. Frontend speichert Session, nutzt access_token für alle API-Calls
8. Backend validiert JWT bei jedem geschützten Request
```

## JWT-Validierung

- Algorithmus: RS256 (JWKS)
- Signing Keys werden vom Supabase JWKS-Endpoint bezogen:
  `{SUPABASE_URL}/auth/v1/.well-known/jwks.json`
- Caching: 10 Minuten TTL (cachetools)
- Validierung: `aud` (audience), `iss` (issuer)
- Payload: `sub` (User-ID), `email`, `exp` (Ablaufzeit)
- Bearer Token im Authorization Header

## Dev vs Prod

| | Dev (lokal) | Prod (Cloud) |
|---|---|---|
| **Supabase** | `supabase start` (localhost:54321) | Supabase Cloud |
| **E-Mail** | Inbucket (localhost:54324) | Resend SMTP |
| **KI-Chat** | Ollama (localhost:11434) | Google Gemini / OpenAI |
| **API-Doku** | `/scalar` (localhost:8000/scalar) | `/scalar` (prod-url/scalar) |

Gesteuert via `APP_MODE=dev|prod` in `.env`.
