# USki — Dev-Start-Anleitung

Alles **lokal/dev**. Kein Internet nötig außer für den ersten Modell-Download.

---

## Voraussetzungen (einmalig installieren)

- **Docker Desktop** (mit WSL2 Backend auf Windows)
- **Supabase CLI** (`scoop install supabase` oder `npm i -g supabase`)
- **Git** (um das Repo zu klonen)

---

## 1. Repo + .env einrichten (einmalig)

```bash
# Repo klonen
git clone <repo-url> USki
cd USki

# .env aus Vorlage erstellen
cp .env.example .env
```

---

## 2. Supabase starten + Keys eintragen (einmalig + nach jedem PC-Neustart)

```bash
# Supabase lokal starten
supabase start
```

Die Ausgabe zeigt `anon key` und `service_role key`. Diese in `.env` eintragen:

```dotenv
SUPABASE_ANON_KEY=<anon key aus supabase start>
SUPABASE_SERVICE_ROLE_KEY=<service_role key aus supabase start>
```

Keys immer gleich — du musst das nur beim **ersten Mal** (oder nach `supabase db reset`) machen.

### Migrations anwenden (einmalig / nach git pull mit neuen Migrations)

```bash
supabase migration up
```

---

## 3. Docker + Ollama starten

**Immer mit `--profile dev`** — sonst starten Ollama und Redis NICHT.

### Erststart (baut Images + zieht Ollama-Modelle)

```bash
docker compose --profile dev up --build
```

Das dauert beim ersten Mal länger:
- Docker baut Backend- und Frontend-Image
- `ollama-init` zieht `llama3.2:latest` (~2 GB) und `nomic-embed-text` (~270 MB) ins persistente Volume

Modelle bleiben gespeichert → danach kein Download mehr.

### Normaler täglicher Start (nach dem ersten Mal)

```bash
docker compose --profile dev up
```

Oder wenn alles schon läuft, nur restart:

```bash
docker compose --profile dev restart
```

---

## 4. Überprüfen ob alles läuft

| Service | URL | Was du siehst |
|---|---|---|
| Frontend | http://localhost:5173 | USki Landing Page |
| Backend API | http://localhost:8000/api/health | `{"status":"ok"}` |
| Backend Docs | http://localhost:8000/scalar | API-Doku |
| Supabase Studio | http://localhost:54323 | DB-Verwaltung |
| Inbucket (E-Mails) | http://localhost:54324 | OTP-Codes im Dev |
| Ollama | http://localhost:11434/api/tags | Verfügbare Modelle |

---

## 5. Was `docker compose restart` vs `up --build` bedeutet

| Befehl | Wann nötig | Was passiert |
|---|---|---|
| `docker compose --profile dev restart` | täglich (alles läuft schon) | startet Container neu, Config bleibt |
| `docker compose --profile dev up -d` | nach `.env`-Änderung | liest neue Config ein |
| `docker compose --profile dev up --build` | nach `git pull` mit Dep-Änderungen | baut Images neu |
| `supabase migration up` | nach neuen SQL-Migrations | Datenbankschema updaten |

**Merksatz:** Wenn Ollama/Redis **nicht starten** → `--profile dev` fehlt.

---

## 6. Alles stoppen

```bash
docker compose --profile dev down

# Supabase
supabase stop
```

---

## Troubleshooting

**Es starten nur `backend-1` und `frontend-1` — Ollama/Redis fehlen**
- Das ist GENAU das Profil-Problem. `ollama`, `ollama-init` und `redis` haben in der `docker-compose.yml` `profiles: [dev]`. Ohne `--profile dev` ignoriert Docker sie komplett — `docker compose up` startet dann nur Backend + Frontend.
- Fix: **immer** `docker compose --profile dev up` (bzw. `restart`, `up -d`). Nie `docker compose up` ohne das Flag.
- `docker compose build` baut übrigens auch nur Backend/Frontend (Ollama/Redis sind fertige Images, kein Build) — das ist normal und kein Fehler.

**OTP-Mail zeigt noch einen Link / "Confirm your email" statt nur dem 6-stelligen Code**
- Die Mail-Templates stehen in `supabase/config.toml` → `[auth.email.template.*]` und zeigen auf `supabase/templates/otp.html` (nur `{{ .Token }}`).
- Änderungen an `config.toml` werden erst nach Neustart geladen: `supabase stop && supabase start`.

**Ollama lädt kein Modell / "assistant unavailable"**
- Prüfe: `docker logs uski-ollama-init` → läuft `ollama pull` durch?
- Prüfe: `curl http://localhost:11434/api/tags` → sind Modelle da?

**401 beim Username setzen**
- Supabase neu starten: `supabase stop && supabase start`, Keys in `.env` prüfen.

**Frontend zeigt alten Stand**
- Vite benutzt Polling (Docker Windows): kurz warten (5–10s) oder `docker compose restart frontend`.

**Datenbank leer nach Neustart**
- Migrations neu anwenden: `supabase migration up`
