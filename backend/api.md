# Backend API Dokumentation

> Aktueller Stand: OTP-Authentifizierung (6-stelliger Code)
> JWT-Validierung: RS256 via JWKS (Supabase Signing Keys)

## Endpunkte

### Health

| Methode | Pfad | Beschreibung | Auth |
|---------|------|-------------|------|
| GET | `/api/health` | Health check | Nein |

### Authentifizierung

| Methode | Pfad | Beschreibung | Auth |
|---------|------|-------------|------|
| POST | `/api/auth/send-otp` | Sendet 6-stelligen OTP-Code per E-Mail | Nein |
| POST | `/api/auth/verify-otp` | Verifiziert OTP-Code, gibt JWT zurück | Nein |
| GET | `/api/auth/me` | Gibt aktuellen User zurück | Ja (Bearer JWT) |
| POST | `/api/auth/logout` | Logout (Client muss Token verwerfen) | Nein |


## Auth-Flow Diagramm

```
1. User gibt E-Mail ein
2. Frontend -> POST /api/auth/send-otp {email}
3. Supabase generiert 6-stelligen Code, sendet E-Mail via Resend SMTP
4. User gibt Code ein
5. Frontend -> POST /api/auth/verify-otp {email, token}
6. Supabase verifiziert Code, gibt JWT zurück
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
