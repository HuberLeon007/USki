# Backend API Dokumentation

> Aktueller Stand: OTP-Authentifizierung (6-stelliger Code)

## Endpunkte

### Health

| Methode | Pfad | Beschreibung | Auth |
|---------|------|-------------|------|
| GET | `/api/health` | Health check | Nein |

### Authentifizierung

| Methode | Pfad | Beschreibung | Auth |
|---------|------|-------------|------|
| POST | `/api/auth/send-otp` | Sendet 6-stelligen OTP-Code per E-Mail | Nein |
| POST | `/api/auth/verify-otp` | Verifiziert OTP-Code, gibt JWT zurueck | Nein |
| GET | `/api/auth/me` | Gibt aktuellen User zurueck | Ja (Bearer JWT) |
| POST | `/api/auth/logout` | Logout (Client muss Token verwerfen) | Nein |


## Auth-Flow Diagramm

```
1. User gibt E-Mail ein
2. Frontend -> POST /api/auth/send-otp {email}
3. Supabase generiert 6-stelligen Code, sendet E-Mail via Resend SMTP
4. User gibt Code ein
5. Frontend -> POST /api/auth/verify-otp {email, token}
6. Supabase verifiziert Code, gibt JWT zurueck
7. Frontend speichert Session, nutzt access_token fuer alle API-Calls
8. Backend validiert JWT bei jedem geschuetzten Request
```

## JWT-Validierung

- Algorithmus: HS256
- Secret: `SUPABASE_JWT_SECRET` aus Env-Var
- Payload: `sub` (User-ID), `email`, `exp` (Ablaufzeit)
- Bearer Token im Authorization Header
