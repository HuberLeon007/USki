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
| `WEBAUTHN_RP_ID` | `uski.huberleon.com` (the live web origin's domain) |
| `WEBAUTHN_ORIGINS` | `https://uski.huberleon.com` (+ the Android `android:apk-key-hash:…` once you build the APK — see Passkeys) |
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

## Social login (Google / GitHub / Discord) — web + mobile

Real OAuth is configured in the provider consoles + Supabase, not in code. Steps:
1. Create an OAuth app in each provider you want:
   - **Google**: Google Cloud Console → Credentials → OAuth client (Web). 
   - **GitHub**: Settings → Developer settings → OAuth Apps.
   - **Discord**: Developer Portal → New Application → OAuth2.
   For each, set the **Authorization callback** to `https://YOUR-REF.supabase.co/auth/v1/callback`.
2. Supabase → Auth → Providers: enable each, paste client id + secret.
3. Supabase → Auth → URL Configuration → **Redirect allow-list**: add both
   - `https://huberleon.com/auth/callback` (web)
   - `uski://auth-callback` (mobile app)
4. **Mobile build**: set `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   in `mobile/.env` to the same cloud project. The login screen then shows the
   social buttons (hidden when unset). The app scheme is `uski` (app.json).

It's all free (Google/GitHub/Discord OAuth + Supabase free tier).

## Passkeys

- **Web**: works in prod. Set `WEBAUTHN_RP_ID=uski.huberleon.com` and
  `WEBAUTHN_ORIGINS=https://uski.huberleon.com` in the server `.env`, then
  `docker compose -f docker-compose.prod.yml up -d` to apply.
- **Mobile (Android APK)**: native passkeys are built in (react-native-passkey),
  but they only work in a real build (APK / dev-client), NOT in Expo Go, and need
  a one-time domain binding after the first build. Runbook:

  1. Build the APK once: `cd mobile && eas login && eas build -p android --profile preview`.
  2. Get the app's signing-cert fingerprint:
     `eas credentials` → Android → your profile → copy the **SHA-256** (form `AB:CD:…`).
  3. **assetlinks.json** — edit `frontend/public/.well-known/assetlinks.json`,
     replacing `REPLACE_WITH_APK_SIGNING_SHA256_FROM_eas_credentials` with that
     SHA-256 (keep the colons), commit, and redeploy the web container so it's
     live at `https://uski.huberleon.com/.well-known/assetlinks.json` (Caddy
     already serves it). The package is `com.uski.app`.
  4. **Backend origin allow-list** — the Android passkey ceremony's origin is
     `android:apk-key-hash:<base64url-sha256-of-the-same-cert>`. Either read it
     from the backend logs on the first failed attempt (it logs the untrusted
     origin) or convert the SHA-256: it's the base64url (no padding) of the raw
     32 cert bytes. Add it to `WEBAUTHN_ORIGINS`, e.g.
     `WEBAUTHN_ORIGINS=https://uski.huberleon.com,android:apk-key-hash:XXXX`,
     then restart the backend.
  5. Re-test on the phone: Settings → Security → **Add a passkey**, then sign out
     and use **Sign in with a passkey** on the login screen.

  Notes: the backend derives the ceremony origin from the credential's
  clientDataJSON (so the app sends no browser Origin header), and the OS only
  permits a passkey for `uski.huberleon.com` once assetlinks.json lists the
  app — so step 3 gates step 4. iOS would also need an Apple dev account + the
  `apple-app-site-association` file (not set up; Android-only for now).

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
