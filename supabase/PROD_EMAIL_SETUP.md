# Production email setup — code-only sign-in (no magic link)

## Why this is needed

In local development the sign-in email is controlled by `supabase/config.toml`
(`[auth.email.template.*]` → `supabase/templates/otp.html`, which renders only the 6-digit
`{{ .Token }}`). **That file applies only to the local Supabase CLI stack.**

The hosted **Supabase Cloud** project does *not* read `config.toml`. It uses the email templates
configured in the dashboard, which default to **magic-link** bodies (`{{ .ConfirmationURL }}`).
That is why production users receive a clickable link instead of the 6-digit code.

The fix is to set the Cloud email templates to the same code-only body as `otp.html`. No backend
code changes — `POST /api/auth/send-otp` and `/verify-otp` stay exactly as they are.

## Which templates to change

`supabase.auth.sign_in_with_otp()` triggers the **Magic Link** template for an existing user and
the **Confirm signup** template for a brand-new email. To guarantee no path ever sends a link,
set all of these to the code-only body:

- **Magic Link**
- **Confirm signup**
- **Reset Password** (recovery)
- **Change Email Address**

## The template body (source of truth)

Use the contents of [`supabase/templates/otp.html`](./templates/otp.html). The only required
dynamic part is the 6-digit token:

```html
{{ .Token }}
```

Keep `otp.html` as the canonical copy; paste its full HTML into each dashboard template so the
branding stays consistent with the rest of USki.

## Option A — Dashboard (manual, recommended)

1. Open the Supabase Dashboard → your project → **Authentication** → **Emails** → **Templates**.
2. Select the **Magic Link** template.
3. Replace the **Message body (HTML)** with the full contents of `supabase/templates/otp.html`.
4. Set the **Subject** to `{{ .Token }} is your USki sign-in code` (shows the code in the inbox
   preview). A plain alternative is `Your USki sign-in code`.
5. Save.
6. Repeat steps 2–5 for **Confirm signup**, **Reset Password**, and **Change Email Address**
   (subject `Your USki verification code` for the email-change one).
7. Send yourself a test sign-in and confirm the email shows a 6-digit code and **no** link.

> Custom SMTP (Resend): make sure **Authentication → Emails → SMTP Settings** points at your
> Resend SMTP credentials and a verified sender, otherwise Cloud falls back to its rate-limited
> built-in mailer. Delivery is unrelated to the template change above.

## Option B — Management API (scriptable)

You can PATCH the auth config instead of clicking. This requires a personal access token and your
project ref. **Never commit these values** — read them from the environment.

```bash
# Prereqs (set in your shell, do NOT commit):
#   SUPABASE_ACCESS_TOKEN  -> https://supabase.com/dashboard/account/tokens
#   PROJECT_REF            -> dashboard URL: https://supabase.com/dashboard/project/<PROJECT_REF>

BODY="$(cat supabase/templates/otp.html)"

curl -sS -X PATCH \
  "https://api.supabase.com/v1/projects/$PROJECT_REF/config/auth" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  --data-binary @- <<JSON
{
  "mailer_subjects_magic_link": "Your USki sign-in code",
  "mailer_templates_magic_link_content": $(jq -Rs . <<< "$BODY"),
  "mailer_subjects_confirmation": "Your USki sign-in code",
  "mailer_templates_confirmation_content": $(jq -Rs . <<< "$BODY"),
  "mailer_subjects_recovery": "Your USki sign-in code",
  "mailer_templates_recovery_content": $(jq -Rs . <<< "$BODY"),
  "mailer_subjects_email_change": "Your USki verification code",
  "mailer_templates_email_change_content": $(jq -Rs . <<< "$BODY")
}
JSON
```

`jq -Rs .` JSON-escapes the HTML file into a string. After running, send a test sign-in to verify
the 6-digit code arrives.

## Verification checklist

- [ ] All four Cloud templates show `{{ .Token }}` and contain no `{{ .ConfirmationURL }}` link.
- [ ] A real production sign-in delivers a 6-digit code, no clickable link.
- [ ] The code authenticates successfully through `POST /api/auth/verify-otp`.
- [ ] SMTP (Resend) is configured so the mail actually reaches the inbox.
