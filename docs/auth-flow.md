# Auth Flow

USki uses passwordless email-code login through Resend-Email OTPs. 

## User Flow

1. User enters their email address.
2. Resend sends a 6-digit verification code to that email address.
3. User enters the code in USki.
4. Resend verifies the code.
5. Resend creates or restores the user session.
6. The frontend uses the Resend session for client-side auth state.
7. The frontend sends the Resend access token to the FastAPI backend.
8. The backend validates the JWT before allowing protected API access.

## What USki Does Not Use

- No password registration.
- No password login.
- No password reset.
- No local password hash table.
- No app-managed TOTP secrets.

## Frontend Responsibility Later

The frontend later needs:

- Email input step.
- Code input step.
- Session restore.
- Logout.
- Protected route handling.
