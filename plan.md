# USki Preparation Plan

## 1. Current Direction

USki stays Python/FastAPI for the backend. No second backend language is needed now.

The app uses Supabase Cloud as the backend platform:

- Supabase Auth for passwordless email-code login.
- Supabase PostgreSQL with `pgvector` for app data and embeddings.
- Supabase Storage for private files and images.
- Supabase Realtime for chat updates later.
- Resend SMTP inside Supabase Auth for login-code emails from `huberleon.com`.

The app runtime stays Docker-based:

- `backend` container.
- `frontend` container later.
- No local Postgres container.
- No local Mailpit container.
- No password database.

## 2. Auth Decision

USki will not use password registration.

The login flow is:

1. User enters email address.
2. Supabase Auth sends a 6-digit one-time code by email.
3. User enters the code.
4. Supabase verifies the code.
5. Supabase creates or restores the user session.
6. Frontend sends the Supabase access token to FastAPI for protected API calls.
7. FastAPI validates the Supabase JWT on every protected request.

There is no password field, no password reset flow, and no separate registration form.

Supabase calls this passwordless email OTP. OTP means one-time password, but for USki we call it a 6-digit verification code in the UI.

## 3. Current Folder State

Current scaffold exists:

```text
backend/
├── Dockerfile
├── pyproject.toml
├── src/uski/
│   ├── main.py
│   ├── api/
│   ├── core/
│   ├── schemas/
│   ├── services/
│   └── utils/
└── tests/

supabase/
├── config.toml
├── migrations/
└── seed.sql

docker-compose.yml
.env.example
README.md
```

Frontend files currently exist only as scaffold placeholders. Do not implement the frontend yet.

## 4. What To Prepare Next

The next step is preparation, not feature implementation.

Do not build real UI yet.
Do not implement the full backend yet.
Do not write business logic yet.

Prepare only the structure, contracts, configuration placeholders, and database plan so implementation is clean later.

## 5. Backend Preparation

Keep the backend structure:

```text
backend/src/uski/
├── main.py
├── api/
│   ├── __init__.py
│   ├── router.py
│   └── health.py
├── core/
│   ├── __init__.py
│   ├── config.py
│   ├── logging.py
│   ├── security.py
│   └── supabase.py
├── schemas/
├── services/
└── utils/
```

Planned backend responsibilities:

- Validate Supabase JWTs.
- Protect all user data routes.
- Handle permission checks for decks and files.
- Generate short-lived signed URLs for Supabase Storage files.
- Run FSRS scheduling.
- Prepare document chunks and embeddings.
- Build AI chat context.

Do not add full endpoint logic yet. The current placeholder files are enough until the database model and contracts are locked.

## 6. Auth Preparation

Supabase Auth setup requirements:

- Enable email provider.
- Use passwordless email OTP flow.
- Configure OTP email template so users receive a clear 6-digit code.
- Configure Resend SMTP in Supabase Auth.
- Use `huberleon.com` sender domain after DNS verification.
- Keep OTP expiration short enough for security.
- Rate limit OTP requests to prevent abuse.

Frontend later needs two screens or one combined screen:

- Email input step.
- Code verification step.

Backend does not send the OTP itself. Supabase Auth sends and verifies the code.

## 7. Environment Variables

Use `.env.example` as preparation only.

Required later:

```env
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=
SUPABASE_STORAGE_BUCKET=uski-files

GEMINI_API_KEY=
GEMINI_MODEL=gemini-1.5-flash
GEMINI_EMBEDDING_MODEL=text-embedding-004

BACKEND_CORS_ORIGINS=http://localhost:5173,http://localhost:3000
BACKEND_LOG_LEVEL=INFO

FRONTEND_PUBLIC_SUPABASE_URL=
FRONTEND_PUBLIC_SUPABASE_ANON_KEY=
FRONTEND_API_BASE_URL=http://localhost:8000
```

Security rule:

- `SUPABASE_SERVICE_ROLE_KEY` is backend-only.
- Frontend gets only public Supabase URL and anon key.
- Never commit real secrets.

## 8. Database Preparation

Prepare Supabase migrations later for:

- `profiles`
- `decks`
- `deck_shares`
- `deck_memberships`
- `flashcards`
- `file_attachments`
- `fsrs_states`
- `review_logs`
- `documents`
- `document_chunks`
- `chat_sessions`
- `chat_messages`
- `audit_logs`

Important auth model:

- Users live in `auth.users`.
- App profile data lives in `public.profiles`.
- `profiles.id` references `auth.users.id`.
- No app table stores passwords.
- No app table stores password hashes.
- No app table stores TOTP secrets.

## 9. RLS Preparation

RLS means Row-Level Security. It decides which database rows each logged-in user can access.

Enable RLS on every user-owned table.

Initial rule:

- Users can access their own rows.
- Users cannot access other users' rows.
- Shared deck access is handled through `deck_memberships` after the base owner model works.

Do not rely only on frontend checks. Backend and database rules must enforce ownership.

## 10. Storage Preparation

Supabase Storage bucket:

```text
uski-files
```

Bucket must be private.

Path convention:

```text
users/{user_id}/decks/{deck_id}/images/{file_id}
users/{user_id}/decks/{deck_id}/documents/{file_id}
```

File access rule:

- Frontend never stores permanent public URLs.
- Backend checks permission first.
- Backend returns short-lived signed URLs.
- Card HTML should reference file IDs, not permanent URLs.

## 11. Docker Preparation

Current `docker-compose.yml` is only a placeholder.

Later it should start:

- backend on port `8000`
- frontend on port `5173`

It should not start:

- Postgres
- Mailpit
- local Supabase stack

Supabase and Resend are external cloud services for this project.

## 12. What Not To Build Yet

Do not build these yet:

- Full frontend UI.
- Real login screen.
- Real backend auth implementation.
- Full CRUD endpoints.
- FSRS algorithm.
- RAG pipeline.
- AI chat.
- Realtime chat.
- File upload logic.

Reason: the auth model and database contracts should be written first so implementation does not drift.

## 13. Next Concrete Steps

Next actions in order:

1. Update docs to remove password registration and TOTP language.
2. Write `docs/auth-flow.md` describing email-code login.
3. Write `docs/supabase-setup.md` describing Supabase Auth, Resend SMTP, Storage, RLS, and `pgvector` setup.
4. Write `docs/database-model.md` with the planned Supabase tables.
5. Write `docs/api-contracts.md` with planned backend endpoints.
6. Keep backend and Supabase folder placeholders.
7. Do not implement real feature code until the above docs are clear.

## 14. MVP Auth Definition Of Done

Auth is ready when:

- User enters email.
- User receives 6-digit code.
- User enters code.
- Supabase returns a session.
- Frontend stores the session through Supabase client.
- Frontend sends access token to backend.
- Backend validates token.
- Backend can identify `current_user.id`.
- App creates a `profiles` row for new users.
- No password exists anywhere in the app.

## 15. Recommended First Implementation Commit Later

When actual implementation starts, first commit should be:

```text
chore: prepare USki scaffold for Supabase email code auth
```
