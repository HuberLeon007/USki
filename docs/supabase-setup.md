# Supabase Setup Plan

This is a preparation document. It describes what needs to be configured before real implementation.

## Required Supabase Products

- Auth
- PostgreSQL
- Storage
- Realtime
- `pgvector`

## Auth Setup

Use passwordless email-code login.

Required settings:

- Enable email auth provider.
- Enable email OTP login.
- Configure the email template to show a 6-digit verification code.
- Configure Resend SMTP for Auth emails.
- Use the verified sender domain `huberleon.com`.

Do not enable password-based UX in USki.

## Database Setup

Required extension:

```sql
create extension if not exists vector;
```

Application users are Supabase Auth users in `auth.users`.

Application profile data belongs in `public.profiles`.

## Storage Setup

Create private bucket:

```text
uski-files
```

No public file access.

The backend will generate short-lived signed URLs after checking deck/file permissions.

## RLS Setup

Enable RLS on all public application tables.

Use owner policies first.

Add sharing policies only after owner-only CRUD is working.

## Realtime Setup

Realtime is planned for chat messages later.

Do not build realtime before basic chat persistence exists.
