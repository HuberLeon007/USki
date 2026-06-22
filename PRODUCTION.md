# USki — Production Deployment (school server + Cloudflare Tunnel)

Goal: **huberleon.com reachable by anyone, from anywhere**, served from a
school server that is itself only reachable internally / via Tailscale, for **0 €**.

## How it works

```
  anyone@internet ──https──> Cloudflare (TLS, DNS for huberleon.com)
                                  │  (outbound-only tunnel, no port-forwarding)
                              cloudflared  (runs on the school server)
                                  │  http
                              web  (Caddy :80)
                                  ├── /        → built SPA (static)
                                  └── /api/*   → backend (FastAPI :8000)
                                                   ├── Ollama  (embeddings, 768d)
                                                   ├── Redis   (rate limiting)
                                                   └── Supabase Cloud (DB + Auth, EU)
```

The school server makes only an **outbound** connection to Cloudflare, so no
public IP, no inbound firewall rule, and no port-forwarding is needed — it works
behind the school NAT/firewall. Cloudflare terminates HTTPS; the app data lives
in **Supabase Cloud (EU region)** so it survives server reboots and is backed up.

> Requires school IT permission (public service over the school's connection).
> Uptime depends on the school server staying on and the school's internet.

## What's in the repo for this

- `docker-compose.prod.yml` — the whole prod stack (backend, web, ollama, redis, cloudflared).
- `backend/Dockerfile.prod` — FastAPI image (uvicorn, no reload, no source mount).
- `frontend/Dockerfile.prod` + `frontend/Caddyfile` — build SPA, serve it + `/api` proxy via Caddy.
- `.env.example` — every env var you must fill (copy to `.env` on the server; one template for dev + prod).
- `ai_providers.example.json` — copy to `ai_providers.json`, fill chat keys.

## Decisions (locked in)

- **DB/Auth:** Supabase **Cloud**, EU region (not `supabase start` — that's dev-only, no backups).
- **Embeddings:** local **Ollama** `nomic-embed-text` (768d) on the server → matches the `vector(768)` DB column, no migration, no paid embedding API.
- **Chat:** external **provider pool** (`ai_providers.json`, e.g. groq/gemini free) — round-robin, already built.
- **Public edge:** **Cloudflare Tunnel** (custom domain huberleon.com, free, auto-HTTPS).

---

## Step-by-step

### 0. School server — dedicated user
```bash
sudo adduser --system --group --shell /bin/bash --home /opt/uski uski
sudo usermod -aG docker uski          # note: docker group ≈ root-equivalent
sudo -iu uski
git clone <your-repo> /opt/uski/USki && cd /opt/uski/USki
```

### 1. Supabase Cloud
1. Create a project in an **EU region** (e.g. Frankfurt). Enable the **pgvector** extension (Database → Extensions).
2. Link + push the migrations:
   ```bash
   npx supabase link --project-ref YOUR-REF
   npx supabase db push
   ```
   Confirm `document_chunk (vector(768))`, `match_document_chunks`, and all tables exist.
3. Auth → URL Configuration: **Site URL** `https://huberleon.com`, add it to the redirect allow-list.
4. Auth → Providers: enable Google/GitHub/Discord with real client id/secret + callback `https://YOUR-REF.supabase.co/auth/v1/callback`.
5. Auth → SMTP: set custom SMTP (Resend) so OTP login mails aren't rate-limited.
6. Copy the `anon` key + `service_role` key for the `.env`.

### 2. Domain on Cloudflare
1. Add `huberleon.com` to Cloudflare (free plan); switch the registrar's nameservers to Cloudflare's.
2. Wait for the zone to go active.

### 3. Cloudflare Tunnel
1. Cloudflare **Zero Trust → Networks → Tunnels → Create a tunnel** (type: *Cloudflared*). Name it e.g. `uski`.
2. Copy the **tunnel token** → put it in `.env` as `CLOUDFLARE_TUNNEL_TOKEN`.
3. Add a **Public Hostname**: `huberleon.com` → service `http://web:80`
   (cloudflared runs in the compose network, so it reaches the `web` container by name).
   Optionally add `www.huberleon.com` the same way.

### 4. Env + secrets (on the server, as `uski`)
```bash
cp .env.example .env       # fill in all values (use the PROD-ONLY section)
chmod 600 .env
cp ai_providers.example.json ai_providers.json   # fill real chat keys
chmod 600 ai_providers.json
```

### 5. Launch
```bash
docker compose -f docker-compose.prod.yml up -d --build
```
- `ollama-init` pulls `nomic-embed-text` once (RAG embeddings).
- `cloudflared` connects out to Cloudflare; huberleon.com goes live within seconds.
- Everything has `restart: unless-stopped` → survives crashes and server reboots
  (ensure the Docker daemon starts on boot: `sudo systemctl enable docker`).

### 6. Verify (test end-to-end)
- Open `https://huberleon.com` from a phone on mobile data (off the school network).
- Sign up via email OTP (mail arrives?), social login, add a passkey, create a deck + cards.
- Ask Sero with a deck open → answer uses card content (embeddings + chat both work).
- `https://huberleon.com/api/health` → 200.

---

## Env vars (summary)

See `.env.example` for the full list with comments (PROD-ONLY section). The essentials:

| Variable | Value |
|----------|-------|
| `APP_MODE` | `prod` |
| `SUPABASE_URL` / `SUPABASE_PUBLIC_URL` | `https://YOUR-REF.supabase.co` |
| `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | from Supabase dashboard |
| `AI_EMBED_MODEL` | `nomic-embed-text` (768d — don't change) |
| `AI_PROVIDERS_FILE` | `ai_providers.json` (chat pool, REQUIRED) |
| `RESEND_API_KEY` / `EMAIL_FROM` | Resend + verified `huberleon.com` sender |
| `WEBAUTHN_RP_ID` | `huberleon.com` |
| `WEBAUTHN_ORIGINS` | `https://huberleon.com` |
| `CLOUDFLARE_TUNNEL_TOKEN` | from the Zero Trust tunnel |

Secrets (`SUPABASE_SERVICE_ROLE_KEY`, `ai_providers.json`, `RESEND_API_KEY`,
`CLOUDFLARE_TUNNEL_TOKEN`) live only on the server / in the gitignored files.

---

## Updating after a code change
```bash
sudo -iu uski && cd /opt/uski/USki
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

## Caveats / honest notes
- **Uptime = school server uptime.** If it's powered off (night/holidays) or the
  school network blocks outbound, the site is down. For true 24/7 you'd need an
  always-on host.
- **Chat needs `ai_providers.json`.** Only the embedding model is pulled locally;
  chat is served by the external free provider pool. No pool → no chat replies.
- **Resend free** = 100 mails/day. Fine for a class; verify `huberleon.com` first.
- **Security:** it's a public app on a school machine — keep `.env` at `chmod 600`,
  don't expose Caddy's :80 to the public directly (only cloudflared talks to it),
  and run the stack as the non-root `uski` user.
- **Cloud alternative (plan B, no school server):** Render (backend, cold-starts)
  + Cloudflare Pages (frontend) + Supabase Cloud + swap embeddings to Gemini
  `text-embedding-004` (768d). Use only if the school server path falls through.
