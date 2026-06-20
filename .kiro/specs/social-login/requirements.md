# Requirements Document

## Introduction

This feature adds OAuth 2.0 / OIDC social login (Google, GitHub, and Discord) to the USki flashcard application. Social login coexists with the existing passwordless email one-time-password (OTP) login: both paths produce the same kind of authenticated session and may be used interchangeably for the same account.

The feature must work in two production-like contexts and one offline context:

- **Production** — real OAuth against Supabase Cloud, configured through the Supabase dashboard and each provider's developer portal.
- **Development (online)** — optional real OAuth against a local or cloud test Supabase project with a localhost redirect.
- **Development (offline)** — a mock social-login mechanism that establishes a local development session for a per-provider mock identity without contacting any external provider, so the full system (frontend, backend guards, roles, sharing) can be exercised with no internet access.

Supabase Auth is the fixed authentication core of the architecture; no external authentication provider (Auth0, Clerk, WorkOS, etc.) is introduced. The mock social-login mechanism is strictly development-only and must be prevented from ever activating in production by multiple independent guard layers.

Account identity is anchored to email: a person who signs in via OTP and via a social provider with the same email address resolves to one single account and profile.

The Minimum Viable Product (MVP) supports exactly three providers — Google, GitHub, and Discord. Apple, Microsoft, and other providers are out of scope.

This document defines WHAT the system must do. Technical design (component structure, schema details, specific configuration steps) is deferred to the design phase.

## Glossary

- **USki**: The flashcard web application this feature extends.
- **Social_Login**: Authentication via a third-party OAuth 2.0 / OIDC provider (Google, GitHub, or Discord) brokered by Supabase Auth.
- **OTP_Login**: The existing passwordless authentication path where a user enters an email address and verifies a 6-digit one-time code.
- **Provider**: A supported third-party identity source. In scope: Google, GitHub, Discord.
- **Supabase_Auth**: The Supabase-native authentication service that brokers OAuth flows and issues sessions/JWTs. The fixed authentication core.
- **Auth_System**: The combined USki frontend authentication surface and backend authentication endpoints that integrate with Supabase_Auth.
- **Frontend**: The React Router + TypeScript web client, including the Login Page, auth-context, tokenStorage module, and apiFetch helper.
- **Backend**: The Python FastAPI service that validates Supabase JWTs and serves application APIs.
- **Login_Page**: The existing USki login screen containing the email step, the 6-digit OTP step, and (after this feature) the social login buttons.
- **Session**: The authenticated state represented by a Supabase-issued access token (JWT) and refresh token, persisted via the tokenStorage module and consumed by apiFetch and auth-context.
- **Account**: The single logical user identity in USki, uniquely bound to one email address, owning one Profile.
- **Profile**: The per-user record containing display identity, including a username and discriminator (username#discriminator) and related user settings.
- **Auth_Identity**: A record linking a Provider (including the OTP/email provider) to an Account, enabling one Account to have multiple sign-in methods.
- **Account_Linking**: The resolution of multiple Auth_Identities that share the same email address to one single Account.
- **APP_MODE**: The environment-mode setting whose value is `dev`, `prod`, or `test`, controlling environment-specific behavior.
- **Mock_Social_Login**: The development-only mechanism that simulates a Provider sign-in by creating a local development Session for a mock identity without any external network call.
- **Mock_Identity**: A predefined per-Provider synthetic identity (provider name, email, display name, avatar placeholder) used by Mock_Social_Login.
- **Callback_URL**: The redirect URL that a Provider returns the user to after authorization (the OAuth callback / redirect URI).
- **Needs_Username**: The state indicating that an authenticated Account does not yet have an assigned username and must complete the onboarding username step.
- **RBAC**: Role-based access control governing permissions and deck sharing.

## Requirements

### Requirement 1: Social Login Buttons on the Login Page

**User Story:** As a USki visitor, I want social login buttons alongside the existing email entry, so that I can choose to sign in with Google, GitHub, or Discord instead of email codes.

#### Acceptance Criteria

1. THE Login_Page SHALL display the existing OTP_Login email entry step.
2. THE Login_Page SHALL display three Social_Login buttons labeled "Continue with Google", "Continue with GitHub", and "Continue with Discord".
3. THE Login_Page SHALL render the three Social_Login buttons in a consistent, fixed order: Google, then GitHub, then Discord.
4. THE Login_Page SHALL present all visible authentication text in English.
5. THE Login_Page SHALL visually associate each Social_Login button with its Provider through a consistent label and Provider identifier.

### Requirement 2: Initiating Real Social Login

**User Story:** As a user, I want activating a social button to start the provider's sign-in flow, so that I can authenticate through Google, GitHub, or Discord.

#### Acceptance Criteria

1. WHERE APP_MODE is `prod` or `test`, WHEN a user activates a Social_Login button, THE Auth_System SHALL initiate the Supabase_Auth OAuth flow for the selected Provider.
2. WHERE APP_MODE is `dev`, WHEN a user activates a Social_Login button, THE Auth_System SHALL use the offline Mock_Social_Login path defined in Requirement 5 instead of initiating a real Supabase_Auth OAuth flow.
3. WHEN the Supabase_Auth OAuth flow completes successfully, THE Auth_System SHALL establish a Session of the same kind produced by OTP_Login.
4. WHEN a Session is established through Social_Login, THE Auth_System SHALL persist the access token and refresh token through the tokenStorage module.
5. WHEN a Session is established through Social_Login, THE Auth_System SHALL route the user to the same post-login destination used by OTP_Login.

### Requirement 3: Email-Based Account Linking

**User Story:** As a returning user, I want signing in with a social provider to reach my existing account when the email matches, so that I keep one profile and all my decks.

#### Acceptance Criteria

1. WHEN a Social_Login returns a user whose email matches an existing Account, THE Auth_System SHALL resolve the Session to that single existing Account.
2. WHEN a Social_Login resolves to an existing Account, THE Auth_System SHALL associate the Provider as an additional Auth_Identity of that Account without creating a duplicate Profile.
3. THE Auth_System SHALL bind each email address to exactly one Account.
4. WHEN a user who previously used OTP_Login signs in via Social_Login with the same email, THE Auth_System SHALL grant access to the same Profile, decks, and settings established under OTP_Login.

### Requirement 4: New Social User Onboarding

**User Story:** As a first-time social user, I want a profile created consistently with email onboarding, so that I get a username just like any other new user.

#### Acceptance Criteria

1. WHEN a Social_Login returns a user whose email matches no existing Account, THE Auth_System SHALL create a new Account and Profile for that email.
2. WHEN a new Account is created through Social_Login without an assigned username, THE Auth_System SHALL set the Needs_Username state for that Account.
3. WHILE the Needs_Username state is set for an Account, THE Auth_System SHALL require completion of the onboarding username step before granting access to authenticated application areas.
4. THE Auth_System SHALL apply the same username assignment rules (username#discriminator) to Social_Login-created Accounts as to OTP_Login-created Accounts.

### Requirement 5: Offline Mock Social Login in Development

**User Story:** As a developer working offline, I want the social buttons to create a local test session, so that I can develop and test social login flows without internet access.

#### Acceptance Criteria

1. WHERE APP_MODE is `dev`, WHEN a user activates a Social_Login button, THE Auth_System SHALL create a local development Session for the Mock_Identity associated with the selected Provider.
2. WHERE Mock_Social_Login is active, WHEN a Social_Login button is activated, THE Auth_System SHALL complete sign-in without making any external network call to a Provider.
3. WHEN Mock_Social_Login creates a Session, THE Auth_System SHALL produce a Session that the tokenStorage module, apiFetch helper, and auth-context process identically to an OTP_Login Session.
4. WHEN Mock_Social_Login resolves a Mock_Identity whose email matches an existing Account, THE Auth_System SHALL apply the email-based Account_Linking defined in Requirement 3.
5. WHEN Mock_Social_Login resolves a Mock_Identity whose email matches no existing Account, THE Auth_System SHALL apply the new-user onboarding defined in Requirement 4.

### Requirement 6: Realistic Mock Identity Metadata

**User Story:** As a developer, I want each mock identity to carry realistic provider data, so that role-based access, sharing, guards, and session handling behave like production.

#### Acceptance Criteria

1. THE Mock_Identity for each Provider SHALL include the Provider name.
2. THE Mock_Identity for each Provider SHALL include an email address.
3. THE Mock_Identity for each Provider SHALL include a display name.
4. THE Mock_Identity for each Provider SHALL include an avatar placeholder reference.
5. THE Auth_System SHALL expose Mock_Identity metadata through the same Session and Profile fields used by real Social_Login, so that RBAC, deck sharing, route guards, and Session handling can be exercised against it.
6. THE Auth_System SHALL provide a distinct Mock_Identity for each of the three Providers (Google, GitHub, Discord).

### Requirement 7: Production Protection Against Mock Authentication

**User Story:** As an operator, I want the mock auth mode to be impossible in production, so that no synthetic login path can ever bypass real authentication for real users.

#### Acceptance Criteria

1. THE Auth_System SHALL decide Mock_Social_Login activation solely from APP_MODE, activating it only WHERE APP_MODE is `dev` and using real Supabase_Auth OAuth in every other mode.
2. WHERE APP_MODE is `prod`, THE Frontend SHALL exclude the Mock_Social_Login path from the production build through a build-time dynamic-import gate so that it cannot execute in a production build.
3. WHERE APP_MODE is not `dev`, THE Backend SHALL NOT register the Mock_Social_Login route.
4. WHERE APP_MODE is `prod`, THE Auth_System SHALL provide no synthetic login path and SHALL reject any request that attempts to invoke Mock_Social_Login.

### Requirement 8: Coexistence With Existing Authentication Lifecycle

**User Story:** As an existing user, I want email and social login to work side by side, so that the current sign-in, token refresh, and access behavior keeps working unchanged.

#### Acceptance Criteria

1. THE Auth_System SHALL keep OTP_Login fully functional after Social_Login is introduced.
2. WHEN a Session is established through Social_Login, THE Auth_System SHALL store and retrieve tokens through the existing tokenStorage module without changing its interface contract.
3. WHEN an access token obtained through Social_Login expires, THE apiFetch helper SHALL perform its existing refresh-and-retry behavior using the refresh token.
4. THE auth-context SHALL represent a Social_Login Session using the same authenticated state shape it uses for an OTP_Login Session.
5. THE Backend SHALL validate JWTs issued for Social_Login Sessions using the existing Supabase JWT validation, preserving existing row-level access controls.

### Requirement 9: Identity and Profile Data Model

**User Story:** As a user with multiple sign-in methods, I want my providers tracked under one account, so that all my identities map to a single profile, settings, and permissions.

#### Acceptance Criteria

1. THE Auth_System SHALL represent each Account with one Profile that holds the username, discriminator, and user settings.
2. THE Auth_System SHALL associate one Account with one or more Auth_Identity records, covering the OTP/email identity and zero or more Provider identities.
3. THE Auth_System SHALL link all Auth_Identity records that share the same email address to the same Account.
4. THE Auth_System SHALL maintain permissions and deck-sharing relationships at the Account level so that they apply regardless of which Auth_Identity established the current Session.
5. WHEN an additional Provider Auth_Identity is added to an existing Account, THE Auth_System SHALL preserve the Account's existing Profile, settings, permissions, and deck-sharing relationships.

### Requirement 10: Security of Redirects, Sessions, and Secrets

**User Story:** As a security-conscious stakeholder, I want safe callbacks and protected secrets, so that social login does not introduce redirect, session, or credential-leak vulnerabilities.

#### Acceptance Criteria

1. WHEN handling a Provider Callback_URL, THE Auth_System SHALL only accept redirect destinations that match a pre-approved allowlist of USki destinations.
2. IF a Callback_URL or post-login redirect target is not on the approved allowlist, THEN THE Auth_System SHALL reject the redirect and route the user to the Login_Page.
3. THE Auth_System SHALL validate Social_Login Session JWTs using the same validation rules applied to OTP_Login Session JWTs, with no relaxation.
4. THE Auth_System SHALL exclude all Provider client secrets from the Frontend and from any client-delivered artifact.
5. THE Auth_System SHALL confine Mock_Social_Login behavior to development as defined in Requirement 7, so that it provides no authentication path in production.

### Requirement 11: Social Login User Experience States

**User Story:** As a user, I want clear placement and feedback for social login, so that I understand loading, errors, and cancellation when I use a provider button.

#### Acceptance Criteria

1. THE Login_Page SHALL position the three Social_Login buttons together as a group, visually distinguished from the OTP_Login email step, with English labels.
2. WHILE a Social_Login flow is in progress, THE Login_Page SHALL present a loading state for the activated Provider button.
3. IF a Social_Login flow fails, THEN THE Login_Page SHALL display an English error message and return the user to an interactive Login_Page state.
4. IF a user cancels or closes the Provider authorization without completing it, THEN THE Login_Page SHALL return to an interactive Login_Page state without establishing a Session.
5. WHEN a Social_Login flow returns control to the Login_Page after a failure or cancellation, THE Login_Page SHALL keep the OTP_Login email step available for use.

### Requirement 12: Provider Configuration and Operations

**User Story:** As an operator, I want documented provider configuration without committed secrets, so that production and local environments can enable social login securely.

#### Acceptance Criteria

1. THE Auth_System SHALL require each Provider to be configured in Supabase_Auth with that Provider's OAuth client identifier and client secret before that Provider's Social_Login can succeed in production.
2. THE Auth_System SHALL document the Callback_URL principle for production destinations and for localhost development destinations.
3. THE Auth_System SHALL source Provider client identifiers and client secrets from environment configuration or Supabase_Auth configuration, not from the source repository.
4. THE Auth_System SHALL keep Provider client secrets out of version control.
5. IF a Provider is activated on the Login_Page WHILE that Provider is not configured in Supabase_Auth, THEN THE Auth_System SHALL surface an English error state rather than establishing a Session.
