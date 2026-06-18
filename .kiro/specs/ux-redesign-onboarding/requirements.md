# Requirements Document

## Introduction

This feature covers a comprehensive UX redesign and onboarding fix for the USki flashcard
application (React 19 + TypeScript + Vite + Tailwind v4 + shadcn/ui frontend, FastAPI + Supabase
backend). It addresses a critical authentication bug that breaks username setting during
onboarding, a redesign of the landing page and its animated hero demo, sign-in/login improvements
(landscape cards, larger logo, resend-code timer, OTP success animation), a robust skip-onboarding
flow with an email-derived username, a new Settings surface (username change, theme toggle, logout),
a restructured dashboard (Overview vs Decks sections, relocated collapse control, removed buttons,
username instead of email), and an improved collapsible/draggable/maximizable AI assistant.

All user-facing text, code, and comments are authored in English. Existing functionality that is
not explicitly changed by these requirements is preserved.

### Assumptions (documented decisions where the request was ambiguous)

- **A1 — check-username auth:** The `check-username` endpoint currently requires authentication.
  Since username availability is checked only by an already-authenticated user during onboarding or
  in settings, authentication is retained, but the call MUST send a valid access token. The root fix
  targets the token lifecycle rather than removing the auth dependency.
- **A2 — Softer dark tone:** "Not 100% black" is interpreted as a near-black neutral surface color
  (an approximate luminance floor above pure black, e.g. a dark slate/zinc tone) defined as a theme
  token, rather than `#000000`.
- **A3 — Resend countdown duration:** A 60-second countdown is used as the default resend cooldown.
- **A4 — Due decks definition:** A deck is "due"/"affected" when it contains at least one card whose
  FSRS next-review timestamp is at or before the current time.
- **A5 — Demo interactivity scope:** The landing hero dashboard demo is a self-contained,
  client-only mock. It does not call backend APIs and does not mutate real user data.
- **A6 — Theme persistence:** The selected theme is persisted in `localStorage` and applied on app
  load, defaulting to the operating-system preference when no stored value exists.
- **A7 — Mobile landscape exception:** Flashcards render in landscape on all viewports except mobile
  portrait orientation, where they render in portrait; rotating the device to landscape restores the
  landscape layout.

## Glossary

- **System:** The USki application as a whole (frontend and backend) unless a more specific
  component is named.
- **Auth_Service:** The backend authentication module (`backend/src/uski/api/auth.py`) exposing
  send-otp, verify-otp, refresh, me, set-username, and check-username endpoints.
- **Auth_Client:** The frontend authentication context and API layer
  (`auth-context.tsx`, `lib/api.ts`) responsible for storing and attaching the access token.
- **Access_Token:** The Supabase-issued JWT stored under the `uski_access_token` key in
  `localStorage` and sent as `Authorization: Bearer <token>`.
- **Refresh_Token:** The Supabase-issued refresh token stored under `uski_refresh_token`.
- **Onboarding:** The post-verification step where a first-time user sets a username.
- **Username_Service:** The combined frontend/backend logic that sets, derives, and validates a
  username (`services/username.py`, `set-username`, `check-username`, `deriveUsernameFromEmail`).
- **Landing_Page:** The public marketing page (`pages/LandingPage.tsx`, `components/landing/*`).
- **Hero_Demo:** The animated, interactive dashboard-preview graphic on the Landing_Page.
- **Login_Page:** The sign-in page (`pages/LoginPage.tsx`) containing the email and OTP steps.
- **Otp_Step:** The OTP entry component (`components/auth/OtpStep.tsx`).
- **Card_Stack:** The animated flashcard stack on the Login_Page (`components/CardStackBackdrop.tsx`).
- **Logo:** The USKI wordmark and logo mark (`components/Logo.tsx`).
- **Dashboard:** The authenticated main application screen (`pages/DashboardPage.tsx`).
- **Sidebar:** The dashboard side navigation bar.
- **Overview_Section:** The Sidebar section showing Review plus only due decks.
- **Decks_Section:** The Sidebar section showing all decks and the only place to create a deck.
- **Settings:** The settings surface where a user changes username, switches theme, and logs out.
- **AI_Assistant:** The AI chat panel (`components/dashboard/AiChatPanel.tsx`).
- **Assistant_Bubble:** The bottom-right control that opens the AI_Assistant.
- **Theme:** The active color scheme, either dark mode or light mode.
- **Due_Deck:** A deck containing at least one card whose next FSRS review time is at or before now.

## Requirements

### Requirement 1: Fix username onboarding authentication (401 bug)

**User Story:** As a first-time user, I want the username step to succeed immediately after I verify
my code, so that I can finish onboarding without authentication errors.

#### Acceptance Criteria

1. WHEN the Otp_Step verification succeeds, THE Auth_Client SHALL write the returned Access_Token to localStorage key "uski_access_token" and the Refresh_Token to localStorage key "uski_refresh_token", and SHALL complete both writes before it issues any request to the check-username or set-username endpoint.
2. WHILE the Onboarding step is active, THE Auth_Client SHALL attach the Access_Token read from localStorage key "uski_access_token" as an `Authorization: Bearer <Access_Token>` header on every request to the check-username and set-username endpoints.
3. IF the value at localStorage key "uski_access_token" is absent or an empty string when an Onboarding request to check-username or set-username is about to be issued, THEN THE Auth_Client SHALL NOT issue the request and SHALL return the user to the Login_Page email step.
4. WHEN a request to check-username or set-username is received bearing an Access_Token that is unexpired and validates against the Supabase JWKS, THE Auth_Service SHALL return a 2xx response within 5 seconds.
5. IF a request to check-username or set-username returns 401 Unauthorized, THEN THE Auth_Client SHALL request a new Access_Token from the refresh endpoint using the Refresh_Token read from localStorage key "uski_refresh_token" and SHALL retry the original request exactly once.
6. WHEN the Auth_Client obtains a new Access_Token from the refresh endpoint, THE Auth_Client SHALL write the new Access_Token to localStorage key "uski_access_token" and the new Refresh_Token to localStorage key "uski_refresh_token" before it retries the original request.
7. IF the refresh request returns 401 Unauthorized or does not return new tokens within 5 seconds, THEN THE Auth_Client SHALL remove localStorage keys "uski_access_token" and "uski_refresh_token" and SHALL return the user to the Login_Page email step.

### Requirement 2: Landing page modern redesign

**User Story:** As a visitor, I want the landing page to look professional and modern in both themes,
so that I trust the product.

#### Acceptance Criteria

1. THE Landing_Page SHALL render using a softer dark surface color in dark mode rather than pure black (`#000000`).
2. THE Landing_Page SHALL support both dark mode and light mode.
3. WHEN the active Theme is dark mode, THE Landing_Page SHALL apply the dark theme tokens to all sections.
4. WHEN the active Theme is light mode, THE Landing_Page SHALL apply the light theme tokens to all sections.
5. THE Landing_Page SHALL preserve all existing navigation and call-to-action destinations present before the redesign.

### Requirement 3: Interactive dashboard hero demo

**User Story:** As a visitor, I want an animated preview that looks like the real dashboard, so that
I understand what the product offers before signing in.

#### Acceptance Criteria

1. THE Hero_Demo SHALL visually replicate the Dashboard layout, including a side navigation area and an AI assistant area on the right.
2. WHEN the Landing_Page loads, THE Hero_Demo SHALL animate into view with a smooth transition.
3. WHERE a pointer device is available, THE Hero_Demo SHALL allow the visitor to scroll within the demo content.
4. WHEN the visitor clicks an interactive element inside the Hero_Demo, THE Hero_Demo SHALL respond within the demo without navigating away from the Landing_Page.
5. THE Hero_Demo SHALL operate as a client-only mock that issues no backend API requests and mutates no real user data.
6. THE Hero_Demo SHALL limit interactivity to the predefined demo content and SHALL expose no real account or deck data.

### Requirement 4: Landscape flashcards

**User Story:** As a user, I want flashcards in landscape orientation, so that the layout is
consistent across the app.

#### Acceptance Criteria

1. THE Card_Stack SHALL render its cards in landscape orientation.
2. THE System SHALL render flashcards in landscape orientation on all viewports except mobile portrait orientation.
3. WHILE a mobile device is in portrait orientation, THE System SHALL render flashcards in portrait orientation.
4. WHEN a mobile device is rotated from portrait to landscape orientation, THE System SHALL render flashcards in landscape orientation.

### Requirement 5: Larger logo on sign-in

**User Story:** As a user on the sign-in page, I want a more prominent logo and name, so that the
brand is clear.

#### Acceptance Criteria

1. THE Login_Page SHALL render the Logo mark and product name at a larger size than before the redesign.
2. THE Login_Page SHALL keep the Logo mark and product name legible in both dark mode and light mode.

### Requirement 6: Resend code with countdown timer

**User Story:** As a user awaiting a code, I want to resend the code after a wait, so that I can
recover if the code never arrives.

#### Acceptance Criteria

1. WHEN the Otp_Step is shown after a code is sent, THE Otp_Step SHALL start a 60-second countdown and SHALL disable the resend control while the countdown is greater than zero.
2. WHILE the countdown is greater than zero, THE Otp_Step SHALL display the remaining seconds.
3. WHEN the countdown reaches zero, THE Otp_Step SHALL enable the resend control.
4. WHEN the user activates the enabled resend control, THE Auth_Client SHALL request a new code for the same email and THE Otp_Step SHALL restart the 60-second countdown.
5. IF a resend request fails, THEN THE Otp_Step SHALL display an error message and SHALL re-enable the resend control.

### Requirement 7: OTP success animation before transition

**User Story:** As a user who entered the correct code, I want a clear success animation before
moving on, so that the transition is not overwhelming.

#### Acceptance Criteria

1. WHEN the entered code is verified as correct, THE Otp_Step SHALL apply a green/success state to all six code fields within 100 milliseconds.
2. WHEN the code fields turn green, THE Otp_Step SHALL play exactly one spinning-circle animation lasting between 600 and 1200 milliseconds.
3. WHEN the spinning-circle animation completes, THE Otp_Step SHALL play exactly one drawn-checkmark animation lasting between 300 and 800 milliseconds.
4. WHEN the checkmark animation completes, THE Login_Page SHALL transition to the next step with an animated transition lasting between 200 and 600 milliseconds.
5. THE Login_Page SHALL NOT navigate to the next step before the green-state, spinning-circle, and checkmark animation sequence has completed.
6. IF the entered code is incorrect, THEN THE Otp_Step SHALL play the existing error feedback and SHALL NOT play the green-state, spinning-circle, or checkmark success animation.
7. IF the verification request fails due to a network or service error, THEN THE Otp_Step SHALL display an error indication, SHALL retain the entered code value, and SHALL NOT play the success animation.

### Requirement 8: Skip onboarding with email-derived username

**User Story:** As a user, I want to skip onboarding and get a sensible default username, so that I
am not forced to choose one immediately.

#### Acceptance Criteria

1. WHERE the Onboarding step is shown, THE Onboarding SHALL present a skip control.
2. WHEN the user activates the skip control, THE Username_Service SHALL derive a username by taking the local part of the user's email (the substring before `@` and before any `+`), removing dot characters, removing non-ASCII-alphanumeric characters, converting to lowercase, and truncating to a maximum of 20 characters, and SHALL assign the result as the user's username.
3. WHEN a username is assigned by skipping, THE System SHALL record that Onboarding is complete so that Onboarding is not shown again on subsequent logins.
4. WHILE a user has a username assigned, THE System SHALL NOT display the Onboarding step on subsequent logins.
5. IF the derived value contains fewer than 3 ASCII-alphanumeric characters, THEN THE Username_Service SHALL assign a fallback username of the form `user` followed by exactly 4 random digits.
6. IF the email local part is empty or produces no valid characters, THEN THE Username_Service SHALL assign a fallback username of the form `user` followed by exactly 4 random digits.
7. WHEN a user later changes the username in Settings, THE Username_Service SHALL replace the previously assigned username with the new value.

### Requirement 9: Settings — username change

**User Story:** As a user, I want to change my username in settings, so that I can update my identity
after onboarding.

#### Acceptance Criteria

1. THE Settings SHALL provide a control to view and edit the current username.
2. WHEN the user submits a new username, THE Username_Service SHALL validate that the username is 3 to 20 lowercase alphanumeric characters.
3. IF the submitted username fails validation, THEN THE Settings SHALL display a validation error and SHALL NOT submit the change.
4. WHEN a valid new username is submitted, THE Auth_Service SHALL update the user's username and SHALL return the updated username and discriminator.
5. WHEN the username update succeeds, THE Settings SHALL display the updated username.
6. IF the username update request returns an error, THEN THE Settings SHALL display an error message and SHALL retain the previous username.

### Requirement 10: Settings — theme toggle

**User Story:** As a user, I want to switch themes in settings, so that I control the appearance in
one place.

#### Acceptance Criteria

1. THE Settings SHALL provide a control to switch between dark mode and light mode.
2. WHEN the user selects a Theme in Settings, THE System SHALL apply the selected Theme across the application.
3. WHEN the user selects a Theme, THE System SHALL persist the selection to localStorage.
4. WHEN the application loads and a persisted Theme exists, THE System SHALL apply the persisted Theme.
5. WHERE no persisted Theme exists, THE System SHALL apply the operating-system color-scheme preference.

### Requirement 11: Settings — logout

**User Story:** As a user, I want to log out from settings, so that there is a single clear place to
end my session.

#### Acceptance Criteria

1. THE Settings SHALL provide a logout control.
2. WHEN the user activates the logout control, THE Auth_Client SHALL clear the stored Access_Token and Refresh_Token and SHALL return the user to the Login_Page.
3. THE Sidebar SHALL NOT contain a logout control.

### Requirement 12: Dashboard shows username instead of email

**User Story:** As a user, I want my username displayed in the dashboard, so that my identity is
shown consistently with the rest of the app.

#### Acceptance Criteria

1. THE Dashboard SHALL display the user's username in the location previously used to display the email.
2. THE Dashboard SHALL NOT display the user's email address in the Sidebar.
3. WHILE the username has not yet loaded, THE Dashboard SHALL display a neutral placeholder rather than the email.

### Requirement 13: Sidebar collapse control relocation

**User Story:** As a user, I want the collapse control in the top-right of the sidebar, so that
collapsing the navigation is intuitive.

#### Acceptance Criteria

1. THE Sidebar SHALL place the collapse control in its top-right corner, horizontally opposite the Logo and wordmark.
2. THE Sidebar SHALL NOT place the collapse control at the bottom-left above the username.
3. WHEN the user activates the collapse control, THE Sidebar SHALL collapse the entire Sidebar.
4. WHILE the Sidebar is collapsed, WHEN the user activates the collapse control, THE Sidebar SHALL expand the entire Sidebar.

### Requirement 14: Remove review button from sidebar

**User Story:** As a user, I want a cleaner sidebar, so that navigation is focused.

#### Acceptance Criteria

1. THE Sidebar SHALL NOT contain a standalone "Review" button.

### Requirement 15: Overview and Decks sections

**User Story:** As a user, I want due decks surfaced separately from all decks, so that I can focus
on what needs review.

#### Acceptance Criteria

1. THE Sidebar SHALL render the Overview_Section and the Decks_Section such that the Overview_Section appears before (visually above) the Decks_Section.
2. THE Overview_Section SHALL display a Review entry as its first (topmost) item.
3. THE Overview_Section SHALL list below the Review entry exactly those decks that are Due_Decks, where a Due_Deck is a deck containing at least one card whose FSRS next-review timestamp is at or before the current time, and SHALL exclude every deck that is not a Due_Deck.
4. WHILE the user has no Due_Decks, THE Overview_Section SHALL display no deck entries below the Review entry.
5. THE Decks_Section SHALL list all of the user's decks, including both Due_Decks and decks with no cards due.
6. THE Decks_Section SHALL provide exactly one control for creating a new deck.
7. THE Overview_Section SHALL NOT provide any control for creating a new deck.
8. WHEN a deck transitions to having no cards due, THE Overview_Section SHALL remove that deck from its list within 2 seconds of the transition.
9. WHEN a deck transitions to having at least one card due, THE Overview_Section SHALL add that deck to its list within 2 seconds of the transition.
10. WHEN the Sidebar is loaded or refreshed, THE Overview_Section SHALL evaluate each deck against the current time and list only the Due_Decks.

### Requirement 16: Settings placement and removed dashboard controls

**User Story:** As a user, I want settings near my username and a decluttered dashboard, so that
controls are predictable.

#### Acceptance Criteria

1. THE Sidebar SHALL place the Settings entry at the bottom, directly above the username.
2. THE Dashboard SHALL NOT contain a dark/light mode toggle.
3. THE Dashboard SHALL provide access to Settings, and theme switching SHALL be available only within Settings.

### Requirement 17: AI assistant collapsible bubble

**User Story:** As a user, I want a chat bubble that opens the assistant, so that I can access it on
demand without it taking permanent space.

#### Acceptance Criteria

1. WHILE the AI_Assistant is closed, THE AI_Assistant SHALL display an Assistant_Bubble in the bottom-right corner with a margin between 16 and 24 pixels from the bottom and right viewport edges.
2. WHEN the user activates the Assistant_Bubble, THE AI_Assistant SHALL open as a small window measuring between 320 and 400 pixels wide and between 480 and 600 pixels tall.
3. WHILE the AI_Assistant is open as a small window, THE AI_Assistant SHALL provide a control to maximize the window.
4. WHEN the user activates the maximize control, THE AI_Assistant SHALL display as a large window occupying the full viewport height and between 33% and 50% of the viewport width, fixed to the right edge of the screen.
5. WHILE the AI_Assistant is maximized, THE AI_Assistant SHALL provide a control to return to the small window.
6. WHEN the user closes the AI_Assistant, THE AI_Assistant SHALL hide the window, display the Assistant_Bubble, and retain the current conversation for the next time it is opened.
7. IF the viewport width is less than 320 pixels, THEN THE AI_Assistant SHALL constrain the small window width to the available viewport width.

### Requirement 18: AI assistant small-window dragging

**User Story:** As a user, I want to move the small assistant window, so that it does not block my
content.

#### Acceptance Criteria

1. WHILE the AI_Assistant is open as a small window, THE AI_Assistant SHALL allow the user to drag the window to a new position by pressing and holding its title bar.
2. WHILE the AI_Assistant is maximized, THE AI_Assistant SHALL remain fixed to the right side of the screen and SHALL NOT be draggable.
3. WHEN the user drags the small window, THE AI_Assistant SHALL keep the entire window within all four edges of the visible viewport.
4. WHEN the user releases the small window after dragging, THE AI_Assistant SHALL retain the window at its released position until it is dragged again, closed, or maximized.
5. WHEN the viewport is resized such that the small window would fall outside the viewport, THE AI_Assistant SHALL reposition the window to remain fully within the viewport.

### Requirement 19: AI assistant smooth open/close animation

**User Story:** As a user, I want smooth assistant open and close animations, so that the interface
feels polished.

#### Acceptance Criteria

1. WHEN the AI_Assistant opens, THE AI_Assistant SHALL complete its open animation within 150 to 400 milliseconds.
2. WHEN the AI_Assistant closes, THE AI_Assistant SHALL complete its close animation within 150 to 400 milliseconds.
3. WHILE an open or close animation is playing, THE AI_Assistant SHALL maintain a mean frame rate of at least 55 frames per second with no single frame interval exceeding 32 milliseconds on a standard desktop browser.
4. IF the open or close state changes while an animation is still playing, THEN THE AI_Assistant SHALL interrupt the current animation and transition to the new state without leaving the window in a partially-animated resting state.
