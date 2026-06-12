# USki Landing Page + Login + Dashboard Design Spec

## Overview

Three interconnected frontend pages for USki: a marketing landing page, a 2-step OTP login flow, and a dashboard with sidebar navigation. The dashboard does not need functional features beyond login — only the visual shell, onboarding wizard, and empty states.

**Scope:** Frontend only. Backend auth endpoints already exist and work. No new backend code.

---

## Tech Stack

- React 19 + TypeScript 6
- Vite 8
- Tailwind CSS v4
- shadcn/ui (Radix primitives)
- Lucide React icons
- React Router v7
- Sonner (toasts)
- Geist font (Vercel)
- framer-motion (animations)

---

## Design System

### Colors

**Accent:** Blue-to-purple gradient (`from-blue-500 to-purple-500` / `from-blue-400 to-purple-400` for dark mode).

**Light Mode:**
- Background: `hsl(0 0% 100%)`
- Foreground: `hsl(222.2 84% 4.9%)`
- Card: `hsl(0 0% 100%)`
- Muted: `hsl(210 40% 96.1%)`
- Border: `hsl(214.3 31.8% 91.4%)`

**Dark Mode:**
- Background: `hsl(222.2 84% 4.9%)`
- Foreground: `hsl(210 40% 98%)`
- Card: `hsl(222.2 84% 7%)`
- Muted: `hsl(217.2 32.6% 17.5%)`
- Border: `hsl(217.2 32.6% 17.5%)`

### Typography

**Font:** Geist (Vercel) — loaded via `@fontsource/geist-sans` and `@fontsource/geist-mono`.

- Headlines: `font-semibold` or `font-bold`, tracking tight
- Body: `font-normal`, leading relaxed
- Code/mono: `font-mono` (Geist Mono)

### Animations

Subtle and elegant using framer-motion:
- Fade-in on scroll (viewport entry): `opacity 0 → 1`, `y: 20 → 0`, duration 0.5s
- Hover transitions on cards/buttons: scale 1.02, shadow increase, 200ms
- Page transitions: Skeleton loading placeholders during route changes
- No parallax, no particle effects, no bouncing

### Responsive Breakpoints

- Mobile: < 768px (sidebar becomes hamburger menu)
- Tablet: 768px – 1024px (sidebar collapses to icons)
- Desktop: > 1024px (sidebar fully open, collapsible manually)

---

## Page 1: Landing Page (`/`)

### Navbar

Sticky at top with `backdrop-blur-md` background. Contains:
- Left: USki logo (text or icon)
- Center: Nav links — Features, How It Works (smooth scroll anchors)
- Right: Theme toggle (sun/moon icon) + "Anmelden" CTA button (gradient fill)

On mobile: Logo left, hamburger menu right that opens a dropdown with nav links + CTA.

### Hero Section

Two-column layout (stacks on mobile):

**Left column:**
- Headline: "Lerne smarter, nicht härter"
- Subtext: "USki kombiniert wissenschaftlich bewährte Lernmethoden mit Künstlicher Intelligenz. Erstelle Karteikarten, lerne mit dem FSRS-Algorithmus und lass dich von der KI unterstützen."
- CTA button: Gradient fill (blue → purple), white text, "Jetzt kostenlos starten"
- Secondary link: "Mehr erfahren ↓" (scrolls to Features)

**Right column:**
- App mockup screenshot of USki dashboard on a laptop frame
- Subtle shadow and slight rotation (2-3deg) for depth

### Features Section (4 Cards)

Section title: "Alles was du zum Lernen brauchst"

Four cards in a 2x2 grid (1-column on mobile). Each card:
- Lucide icon (size 24) in a gradient circle
- Title (font-semibold)
- Description (2-3 lines, text-muted-foreground)
- Subtle fade-in animation on scroll (staggered, 100ms between cards)

| Card | Icon | Title | Description |
|---|---|---|---|
| 1 | BookOpen | Karteikarten-Decks | Erstelle und verwalte Decks für jedes Fach. Importiere bestehende Karteikarten aus anderen Quellen. |
| 2 | Brain | FSRS-Lernalgorithmus | Die Magie hinter dem Lernerfolg. FSRS passt deinen Lernplan automatisch an — du lernst genau das, was du brauchst. |
| 3 | Sparkles | KI-Assistent | Stuck? Frag den KI-Assistenten. Er erklärt, gibt Beispiele und hilft wenn du nicht weiter weißt. |
| 4 | Share2 | Teilen & Zusammenarbeiten | Teile Decks mit Freunden und Mitschülern. Gemeinsam lernen macht mehr Spaß. |

### How It Works Section (3 Steps)

Section title: "So funktioniert USki"

Three steps displayed vertically with connecting line/progress indicator. Each step:
- Large number (01, 02, 03) in gradient text
- Title + description
- Lucide icon on the side

| Step | Title | Description |
|---|---|---|
| 01 | Einfach verwalten, effektiv lernen | Erstelle Decks, organisiere deine Karteikarten und behalte deinen Fortschritt im Blick. Alles an einem Ort. |
| 02 | Importiere & lerne smarter | Importiere Karteikarten aus anderen Quellen. FSRS passt deinen Lernplan automatisch an — die Magie hinter dem Lernerfolg. |
| 03 | KI beantwortet deine Fragen | Wenn du nicht weiter weißt, frag den KI-Assistenten. Er erklärt Zusammenhänge, gibt Beispiele und hilft dir beim Verstehen. |

### CTA Section

Before footer:
- Background: subtle gradient (muted)
- Headline: "Bereit smarter zu lernen?"
- CTA button: Same gradient as Hero
- Subtext: "Kostenlos. Keine Kreditkarte erforderlich."

### Footer

Medium complexity:
- Left: USki logo + "© 2026 USki"
- Center: Links — Datenschutz, Impressum, Login
- Right: Social icons (GitHub, maybe Twitter/X)

---

## Page 2: Login (`/login`)

### Layout

Centered card on the page with subtle background (gradient or pattern). Card contains the 2-step flow.

### Step 1: Email Input

- Headline: "Willkommen bei USki"
- Subtext: "Gib deine E-Mail ein, um einen Anmeldecode zu erhalten."
- Email input field (shadcn Input, type email)
- "Code senden" button (gradient fill)
- Link: "Zurück zur Startseite"

**Loading state:** Button shows spinner, field disabled.

**Error state:** Inline red text below input for validation errors. Toast (Sonner) for network/server errors.

### Transition: Step 1 → Step 2

**Animation:** Fade + Scale
- Step 1 content fades out (opacity 1 → 0) and scales down slightly (1 → 0.95)
- Step 2 content fades in (opacity 0 → 1) and scales up (0.95 → 1)
- Duration: 300ms, easing: ease-in-out

### Step 2: OTP Code Input

- Headline: "Code eingeben"
- Subtext: "Wir haben einen 6-stelligen Code an {email} gesendet."
- 6 individual OTP input boxes (shadcn InputOTP component)
- "Verifizieren" button (gradient fill)
- Link: "Code erneut senden"
- Link: "Andere E-Mail verwenden" (goes back to Step 1)

**Loading state:** Entire page shows centered spinner with "Verifiziere..." text. All inputs disabled.

**Error state:** Inline red text below OTP boxes ("Falscher Code, bitte erneut versuchen"). Toast for network errors.

**Success:** Redirect to `/` (Dashboard).

### Theme Toggle

Top-right corner of the login card: sun/moon icon for manual theme switching. Default follows system preference.

---

## Page 3: Dashboard (`/`)

### Layout

Two-column layout:
- **Left: Sidebar** (fixed width 240px on desktop, hamburger on mobile)
- **Right: Main content area** (flex-1)

### Sidebar

**Top section — Navigation:**
- USki logo (small, top-left)
- Nav items with Lucide icons + text labels:
  - Decks (BookOpen icon)
  - KI-Assistent (Sparkles icon)
  - Settings (Settings icon)

**Bottom section — User profile:**
- Avatar: Initials in a gradient circle (blue → purple)
- Username text
- Settings gear icon (clicks open settings)

**Behavior:**
- Desktop: Open by default (240px). Toggle button on edge to collapse to icon-only (64px).
- Mobile: Hidden. Hamburger icon in top-bar opens sidebar as overlay with backdrop.
- Hover: Nav items get subtle background highlight (`bg-muted`)

**Active state:** Current page nav item has gradient left border accent.

### Main Content Area

**Top bar:** Thin bar with hamburger (mobile only) and breadcrumb/title.

**Content:** On first login, shows Onboarding Wizard. On subsequent logins, shows empty state.

### Onboarding Wizard (First Login)

Multi-step wizard centered in the main area:

**Step 1: Willkommen**
- Headline: "Willkommen bei USki, {username}!"
- Subtext: "Lass uns dein erstes Deck erstellen."
- "Los geht's" button (gradient)

**Step 2: Deck erstellen**
- Headline: "Dein erstes Deck"
- Input: Deck-Name (z.B. "Biologie Klasse 8")
- Textarea: Optional Beschreibung
- "Deck erstellen" button (gradient)
- "Überspringen" link

**Step 3: Fertig**
- Headline: "Alles bereit!"
- Subtext: "Dein Deck ist erstellt. Füge jetzt Karteikarten hinzu oder starte mit dem Lernen."
- "Zum Dashboard" button (gradient)

**Note:** Steps 2-3 are UI-only. No backend call. The wizard is skipped if user has existing decks (future feature).

### Empty State (No Decks)

Shown when user has no decks (and has completed/skipped onboarding):
- Large Lucide icon (BookOpen, muted, size 64)
- Headline: "Noch keine Decks"
- Subtext: "Erstelle dein erstes Deck um loszulegen."
- "Erstes Deck erstellen" button (gradient)

### KI-Chat Panel (Collapsible)

Right side panel that slides in/out:
- Toggle: Sparkles icon button in sidebar or floating button
- Width: 360px on desktop, full-screen overlay on mobile
- Header: "USki KI-Assistent" + close button
- Messages area: scrollable, same as current ChatPanel
- Input: text field + send button
- Empty state: Sparkles icon + "Stelle eine Frage zu deinen Lernkarten"

**Animation:** Slide in from right (translateX: 100% → 0), 300ms ease-out.

### Skeleton Loading

During page transitions, show skeleton placeholders:
- Sidebar: 3 rectangular skeleton items
- Main content: Card-shaped skeletons matching expected layout
- Shimmer animation (gradient sweep from left to right)

---

## Theme Implementation

### Dark Mode

- Uses `next-themes` ThemeProvider (already in dependencies)
- CSS variables switch between light and dark values
- Default: system preference
- Manual toggle persists to localStorage

### Toggle Locations

| Page | Location | Behavior |
|---|---|---|
| Landing Page | Navbar, top-right | Manual sun/moon icon |
| Login | Card, top-right | Manual sun/moon icon |
| Dashboard | Sidebar bottom, Settings gear | Opens settings panel with theme selector |

---

## File Structure

```
frontend/src/
├── pages/
│   ├── LandingPage.tsx          # NEW: Marketing landing page
│   ├── LoginPage.tsx            # REWRITE: 2-step OTP flow
│   └── DashboardPage.tsx        # REWRITE: Sidebar + main content
├── components/
│   ├── landing/
│   │   ├── Hero.tsx             # NEW
│   │   ├── Features.tsx         # NEW
│   │   ├── HowItWorks.tsx       # NEW
│   │   ├── CTASection.tsx       # NEW
│   │   └── LandingFooter.tsx    # NEW
│   ├── auth/
│   │   ├── EmailStep.tsx        # NEW: Step 1 of login
│   │   └── OtpStep.tsx          # NEW: Step 2 of login
│   ├── dashboard/
│   │   ├── Sidebar.tsx          # NEW
│   │   ├── TopBar.tsx           # NEW
│   │   ├── OnboardingWizard.tsx # NEW
│   │   ├── EmptyState.tsx       # NEW
│   │   └── ChatPanel.tsx        # MODIFY: collapsible version
│   ├── layout/
│   │   ├── LandingNavbar.tsx    # NEW: sticky navbar with blur
│   │   └── DashboardLayout.tsx  # NEW: sidebar + content wrapper
│   └── ui/                      # EXISTING: shadcn components
├── app/
│   ├── router.tsx               # MODIFY: add /landing route
│   └── providers.tsx            # MODIFY: add ThemeProvider
└── lib/
    └── api.ts                   # EXISTING: no changes needed
```

---

## Routing

| Path | Page | Auth |
|---|---|---|
| `/` | Landing Page | Public (no auth required) |
| `/login` | Login (2-step OTP) | Public (redirect to /dashboard if logged in) |
| `/dashboard` | Dashboard | Protected (redirect to /login if not logged in) |

**Change from current:** `/` becomes Landing Page (public), Dashboard moves to `/dashboard` (protected).

---

## Dependencies to Add

- `framer-motion` — animations
- `@fontsource/geist-sans` — Geist font
- `@fontsource/geist-mono` — Geist Mono font

---

## Out of Scope

- Deck CRUD (only UI shell, no backend)
- Flashcard creation/editing
- FSRS scheduling logic
- RAG pipeline
- Chat history persistence
- File uploads
- User settings page (only theme toggle)
