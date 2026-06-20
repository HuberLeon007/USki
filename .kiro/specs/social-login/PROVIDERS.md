# Social Login Provider Configuration

Operational note for Google, GitHub, and Discord OAuth. This is not a runbook.

## Where credentials live

Provider client id + secret are entered into Supabase Auth only, never committed:

- **Prod**: Supabase Cloud dashboard -> Authentication -> Providers.
- **Local dev**: `supabase/config.toml` `[auth.external.<provider>]`, which reads
  `client_id` / `secret` via `env(...)` indirection from your shell or `.env`.

The app never reads provider secrets from the repo. `.gitignore` already excludes
`.env`, so real values stay out of version control.

## Callback URL principle

- **Production**
  - Supabase: `https://<project>.supabase.co/auth/v1/callback`
  - App: `https://<deployed-host>/auth/callback`
- **Local dev**
  - Supabase: `http://127.0.0.1:54321/auth/v1/callback`
  - App: `http://127.0.0.1:5173/auth/callback`

Register the Supabase callback in each provider's developer portal; the app
callback is the post-login redirect, validated against the redirect allowlist.
