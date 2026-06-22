# USki — Production Deployment Plan

Ziel: alles was wir jetzt haben (Web + Backend + Auth/DB + AI/RAG) in den
**production mode** bringen, sodass es **von alleine läuft** und **jeder über
eine öffentliche HTTPS-URL** darauf zugreifen kann.

Kurzantwort auf "ist das möglich, läuft alles von alleine?": **Ja.** Mit
managed Supabase Cloud + einem kleinen Server (docker compose mit
`restart: unless-stopped`) + Caddy für automatisches HTTPS läuft der Stack
dauerhaft selbstständig. Es ist überschaubar, aber ein paar Dinge sind aktuell
nur für dev gebaut und müssen für prod ergänzt werden (siehe "Was fehlt noch").

> Mobile (Expo/APK) ist hier NICHT teil von "jeder kann zugreifen im Browser".
> Die App zeigt nur per Server-URL auf dasselbe prod-Backend. Separat behandelt.

---

## 1. Architektur in prod

```
                 https://uski.<deine-domain>
                          │
                    ┌─────▼─────┐   (Caddy: auto Let's Encrypt HTTPS,
                    │   Caddy   │    single origin, reverse proxy)
                    └──┬─────┬──┘
        statische  ◄───┘     └───►  /api/*  →  Backend (uvicorn :8000)
        Frontend-Build                         │
        (vite build)                           ├─► Supabase Cloud (Auth + Postgres + pgvector + JWKS + OAuth)
                                               ├─► Ollama (nur Embeddings, nomic-embed-text, 768d)
                                               ├─► AI-Provider-Pool (Chat, round-robin: groq/gemini/openrouter)
                                               ├─► Redis (Rate-Limiting)
                                               └─► Resend (Transaktions-Mails)
```

Wichtig: Frontend ruft `/api` **relativ** auf (`API_BASE = "/api"`). Darum in prod
**ein Origin**: Caddy liefert das statische Frontend aus und proxied `/api` ans
Backend. Kein CORS-Theater, kein absolutes API-URL nötig.

---

## 2. Hosting-Entscheidung (Empfehlung)

Für "läuft von alleine + jeder kann zugreifen + nicht zu kompliziert":

| Teil | Lösung | Warum |
|------|--------|-------|
| Auth + DB (+pgvector) | **Supabase Cloud** (Free-Tier reicht zum Start) | managed, JWKS/OAuth/SMTP fertig, kein DB-Betrieb nötig |
| Backend + Ollama(Embeddings) + Redis + Caddy | **1 kleiner VPS** (z.B. Hetzner CX22, ~4 GB RAM) mit `docker compose` | ein `up -d`, restart-policy = selbstlaufend, billig |
| Frontend | statischer Build, von **Caddy** auf demselben Server ausgeliefert | gleicher Origin → `/api` proxy ohne CORS |
| Chat-LLM | **Provider-Pool** (groq/gemini/openrouter free keys) | kein eigenes GPU-Hosting nötig |

Alternative (noch weniger Server-Pflege, aber zwei Origins + CORS + getrenntes
Ollama-Hosting): Frontend auf Cloudflare Pages/Vercel, Backend auf Railway/Render,
Embeddings über gehosteten Ollama. Mehr bewegliche Teile → nicht empfohlen für
den ersten Schritt.

---

## 3. KRITISCHE Knackpunkte (zuerst lesen)

1. **Embeddings laufen in prod weiter über Ollama.** Der Provider-Pool
   (`ai_providers.json`) ist NUR für Chat (`next_chat_provider`). `OllamaEmbedder`
   nutzt immer `AI_BASE_URL`. → In prod muss ein **Ollama mit `nomic-embed-text`
   erreichbar sein** (im selben compose als Service, CPU reicht für das Embed-
   Modell). Ohne das funktioniert RAG-Indexierung und -Suche nicht.

2. **Embedding-Dimension ist fix 768.** Die DB-Spalte ist `vector(768)` mit
   HNSW-Index (`match_document_chunks`). Wenn du je das Embed-Modell wechselst,
   muss es 768d liefern ODER Migration + Neu-Embedding aller Karten. → Am
   einfachsten: bei `nomic-embed-text` (768d) bleiben, dann keine Code/DB-Änderung.

3. **Die aktuellen Dockerfiles sind dev-only.**
   - `backend/Dockerfile`: startet uvicorn mit `--reload` und compose mountet
     `./backend/src` als Volume. → prod: kein `--reload`, kein Source-Mount,
     fixe Worker.
   - `frontend/Dockerfile`: startet den **Vite Dev-Server** (`npm run dev`). →
     prod: `vite build` (multi-stage) und statisch ausliefern.
   → Es braucht prod-Varianten (siehe Abschnitt 6).

4. **Auth-E-Mails (OTP) kommen von Supabase, nicht von Resend.** OTP-Login ist der
   Haupt-Login. Supabase Cloud Default-SMTP hat **strenge Limits** (paar Mails/h)
   → für echten Betrieb **Custom SMTP in Supabase** konfigurieren (z.B. Resend
   SMTP). Resend im Backend ist nur für Welcome/Login-Alerts.

5. **WebAuthn/Passkeys brauchen die echte Domain.** `WEBAUTHN_RP_ID` =
   registrierbare Domain (ohne Schema/Port), `WEBAUTHN_ORIGINS` = volle prod-URL.
   Sonst schlagen Passkeys fehl.

6. **`/api/dev/wipe` (DB-Wipe) und der mock-social Pfad** sind dev-Features.
   Sicherstellen: in prod (`APP_MODE=prod`) ist der Dev-Wipe deaktiviert/404 und
   der Social-Mock aus dem Build entfernt. → vor Go-Live verifizieren.

---

## 4. Was `APP_MODE=prod` automatisch umschaltet (schon gebaut)

- **Social-Login**: echtes Google/GitHub/Discord OAuth über Supabase statt
  Offline-Mock. Der Mock-Adapter wird aus dem prod-Build entfernt.
- **Chat-AI**: round-robin über den Provider-Pool (`AI_PROVIDERS_FILE`), Fallback
  auf `AI_BASE_URL`/`AI_MODEL` wenn kein Pool gesetzt.
- Backend `is_dev` Flag steuert weitere Pfade (z.B. dev-Wipe, single-Ollama Chat).

Das meiste prod-Verhalten hängt also nur an korrekten **env-Werten** + dem
Provider-Pool-File. Der Code ist dafür schon vorbereitet.

---

## 5. Schritt-für-Schritt

### Phase A — Supabase Cloud
1. Projekt in Supabase Cloud anlegen. Region nah wählen.
2. `pgvector` Extension aktivieren (Dashboard → Database → Extensions).
3. Migrations anwenden: lokales Projekt linken und pushen
   (`supabase link --project-ref <ref>` → `supabase db push`). Prüfen, dass
   `document_chunk (vector(768))` + `match_document_chunks` + alle Tabellen da sind.
4. **Auth → URL Configuration**: Site URL = `https://uski.<domain>`, Redirect-
   Allowlist ergänzen.
5. **Auth → Providers**: Google/GitHub/Discord mit echten Client-ID/Secret +
   Callback-URLs (`https://<ref>.supabase.co/auth/v1/callback`) aktivieren.
6. **Auth → SMTP**: Custom SMTP (z.B. Resend) eintragen (wegen OTP-Limits).
7. Keys notieren: `SUPABASE_URL` (https://<ref>.supabase.co), `ANON_KEY`,
   `SERVICE_ROLE_KEY`.

### Phase B — AI
8. `ai_providers.json` aus `ai_providers.example.json` erstellen, echte Keys
   (groq/gemini/openrouter free) eintragen. **Nicht committen** (gitignore prüfen).
9. Embeddings: Ollama-Service in prod-compose aufnehmen, beim Start
   `nomic-embed-text` pullen. `AI_BASE_URL` des Backends → dieser Ollama.

### Phase C — Server + Deploy
10. VPS mit Docker + docker compose. Domain-A-Record → Server-IP.
11. `docker-compose.prod.yml` + `Caddyfile` + prod-Dockerfiles anlegen (Abschnitt 6).
12. `.env` (prod) mit allen Werten aus Abschnitt 7 befüllen (auf dem Server, nicht im Repo).
13. `docker compose -f docker-compose.prod.yml up -d --build`.
14. Caddy holt automatisch HTTPS-Zertifikat. Healthcheck: `GET /api/health` = 200.

### Phase D — Verifikation (ich teste, du nicht)
15. Registrierung per E-Mail-OTP (echte Mail kommt an?), Social-Login, Passkey
    anlegen/login, Deck+Karten anlegen, Sero/Chat (Chat-Provider antwortet),
    RAG (Antwort nutzt Karteninhalt → Embeddings laufen), Rate-Limit greift.
16. Bestätigen: Dev-Wipe ist in prod nicht erreichbar; Mock-Social nicht im Build.

---

## 6. Was fehlt noch (neue Dateien, die ich anlegen würde)

Diese existieren noch NICHT und sind für prod nötig:

- `backend/Dockerfile.prod` — uvicorn ohne `--reload`, mehrere Worker, kein
  Source-Mount. (Oder ein `--target prod` Stage im bestehenden Dockerfile.)
- `frontend/Dockerfile.prod` — multi-stage: `npm ci && vite build` → Build in ein
  schlankes nginx/Caddy-Image, statisch ausliefern.
- `docker-compose.prod.yml` — services: `caddy`, `backend` (prod image, kein
  Volume-Mount, `restart: unless-stopped`, env_file `.env`), `ollama` (für
  Embeddings, persistentes Volume, restart), `ollama-init` (pullt
  `nomic-embed-text`), `redis` (persistent, restart). KEIN frontend-dev-server.
- `Caddyfile` — `uski.<domain> { root static-build; try_files; reverse_proxy /api/* backend:8000 }`,
  auto-HTTPS.
- (optional) `.github/workflows/deploy.yml` — bei push auf `main`: build + per SSH
  `docker compose pull && up -d` auf dem VPS → echtes Continuous Deployment.

---

## 7. Env-Variablen prod (Übersicht)

| Variable | prod-Wert / Quelle |
|----------|--------------------|
| `APP_MODE` | `prod` |
| `SUPABASE_URL` | `https://<ref>.supabase.co` |
| `SUPABASE_PUBLIC_URL` | leer (gleich wie SUPABASE_URL, ein Origin) |
| `SUPABASE_ANON_KEY` | Supabase Cloud Dashboard |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Cloud Dashboard (geheim!) |
| `BACKEND_CORS_ORIGINS` | `https://uski.<domain>` |
| `AI_BASE_URL` | `http://ollama:11434/v1` (für Embeddings) |
| `AI_EMBED_MODEL` | `nomic-embed-text` (768d, nicht ändern) |
| `AI_PROVIDERS_FILE` | `ai_providers.json` (Chat-Pool) |
| `RATE_LIMIT_REDIS_URL` | `redis://redis:6379` |
| `RESEND_API_KEY` | Resend (Transaktionsmails) |
| `EMAIL_FROM` | verifizierter Resend-Sender |
| `WEBAUTHN_RP_ID` | `uski.<domain>` (ohne Schema/Port) |
| `WEBAUTHN_RP_NAME` | `USki` |
| `WEBAUTHN_ORIGINS` | `https://uski.<domain>` |
| Frontend build | `VITE_APP_MODE=prod`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |

Secrets (`SERVICE_ROLE_KEY`, `ai_providers.json`, `RESEND_API_KEY`) leben NUR auf
dem Server / in CI-Secrets, niemals im Repo.

---

## 8. "Läuft von alleine" — wie sichergestellt

- `restart: unless-stopped` auf allen prod-Services → Auto-Neustart nach Crash/Reboot.
- Caddy = automatisches HTTPS + Auto-Renewal der Zertifikate.
- Supabase Cloud = managed (kein DB-Babysitting).
- Ollama-Modell + Redis auf persistenten Volumes → übersteht Neustart.
- `GET /api/health` für Uptime-Monitoring (z.B. UptimeRobot) anschließbar.
- Optional CI/CD: push auf `main` → automatisches Redeploy.

---

## 9. Entscheidungen, die DU treffen musst (bevor ich Dateien baue)

1. **Domain** für prod (z.B. `uski.huberleon.com`)?
2. **Hosting**: VPS + compose (empfohlen) oder Plattform (Railway/Render + Pages)?
3. **Supabase**: Cloud (empfohlen) oder Self-host?
4. **Chat-Provider**: welche free-tier keys hast du (groq/gemini/openrouter)?
5. **Mail**: Resend-Domain verifizierbar (für OTP-SMTP + Transaktionsmails)?

Sobald das steht, lege ich die prod-Dateien aus Abschnitt 6 an und wir testen
Phase D durch.
