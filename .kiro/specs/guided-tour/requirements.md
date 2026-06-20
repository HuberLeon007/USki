# Requirements Document

## Introduction

The Guided Tour is an interactive, self-built onboarding experience for the USki app dashboard. After a user finishes (or skips) the existing username onboarding wizard, the tour visually walks the user through the key parts of the dashboard. It points to each area with an animated cursor that glides into place and performs a click-pulse, dims the rest of the screen with a spotlight overlay, and shows a short tooltip explanation with Next and Back controls. The tour can be skipped at any time and can be re-launched later from a manual control.

The tour is deliberately a self-built module rather than an off-the-shelf tour library (such as react-joyride, driver.js, or NextStep.js). Prior research confirmed that no off-the-shelf library provides the animated-pointing-cursor behavior that "takes the user by the hand," so the cursor and overlay are built in-house on top of the existing `motion` animation library. The module is designed as a deep module: it exposes a small interface (a list of steps in; completion and skip notifications out) and hides all spotlight, overlay, animated-cursor, and tooltip-placement complexity behind that interface. The step-selection logic is kept pure so it can be tested in isolation.

This document defines what the Guided Tour must do. It does not prescribe implementation or design details.

## Glossary

- **Guided_Tour**: The self-built interactive tour subsystem that highlights dashboard areas and guides the user through them step by step. Referred to as "the tour."
- **Dashboard**: The main authenticated USki view containing the Sidebar, deck information, and the AI assistant bubble.
- **Onboarding_Wizard**: The existing post-login username onboarding flow that runs before the Guided_Tour. It is separate from the Guided_Tour.
- **Tour_Step**: A single unit of the Guided_Tour that targets one element, with an explanation and navigation controls.
- **Target_Element**: The live DOM element on the Dashboard that a Tour_Step points to and highlights.
- **Spotlight**: The visual treatment that highlights the current Target_Element while dimming the rest of the Dashboard via an overlay.
- **Tooltip**: The panel attached to a Tour_Step that shows a short explanation and the Next and Back controls.
- **Animated_Cursor**: The custom pointer graphic that glides from its current position to the next Target_Element and performs a click-pulse.
- **Skip_Control**: The control, visible during every Tour_Step, that ends the Guided_Tour immediately.
- **Launch_Control**: The control (for example "Show me around") that lets the user start the Guided_Tour manually.
- **Tour_Seen_Flag**: The per-user persisted boolean indicating whether the user has already completed or skipped the Guided_Tour.
- **Reduced_Motion**: The user/OS preference, surfaced via `useReducedMotion`, that requests minimized non-essential animation.
- **Tour_Steps_Input**: The ordered list of Tour_Step definitions provided to the Guided_Tour as its sole content input.

## Requirements

### Requirement 1: Automatic start after onboarding

**User Story:** As a first-time user, I want the tour to start on its own after I finish setting up my username, so that I learn the dashboard without having to look for help.

#### Acceptance Criteria

1. WHEN the Onboarding_Wizard completes or is skipped AND the Tour_Seen_Flag is false, THE Guided_Tour SHALL auto-start on the Dashboard.
2. WHILE the Tour_Seen_Flag is true, THE Guided_Tour SHALL remain inactive on Dashboard load until the user activates the Launch_Control.

### Requirement 2: Manual re-launch

**User Story:** As a returning user, I want to start the tour again whenever I want, so that I can refresh my understanding of the dashboard.

#### Acceptance Criteria

1. THE Guided_Tour SHALL provide a Launch_Control on the Dashboard.
2. WHEN the user activates the Launch_Control, THE Guided_Tour SHALL start from the first Tour_Step regardless of the Tour_Seen_Flag value.

### Requirement 3: Step presentation

**User Story:** As a user taking the tour, I want each step to clearly highlight one area and explain it, so that I understand what each part of the dashboard does.

#### Acceptance Criteria

1. WHILE a Tour_Step is active, THE Guided_Tour SHALL apply a Spotlight to exactly one Target_Element and dim the remainder of the Dashboard with an overlay.
2. WHILE a Tour_Step is active, THE Guided_Tour SHALL display a Tooltip containing a short explanation, a Next control, and a Back control.
3. WHEN the user activates the Next control on a non-final Tour_Step, THE Guided_Tour SHALL advance to the following Tour_Step.
4. WHEN the user activates the Back control on a non-first Tour_Step, THE Guided_Tour SHALL return to the preceding Tour_Step.
5. WHEN the user activates the Next control on the final Tour_Step, THE Guided_Tour SHALL end by completion.

### Requirement 4: Animated cursor guidance

**User Story:** As a user taking the tour, I want an animated cursor to point at each area before it is explained, so that the tour feels like it is taking me by the hand.

#### Acceptance Criteria

1. WHEN a Tour_Step begins, THE Animated_Cursor SHALL glide from its current position to the Target_Element over a duration between 400 and 800 milliseconds.
2. WHEN the Animated_Cursor reaches the Target_Element, THE Animated_Cursor SHALL perform a click-pulse lasting between 150 and 300 milliseconds before the Tooltip appears.

### Requirement 5: Skip at any time

**User Story:** As a user, I want to skip the tour whenever I want, so that I am never forced to sit through guidance I do not need.

#### Acceptance Criteria

1. WHILE any Tour_Step is active, THE Guided_Tour SHALL display a Skip_Control.
2. WHEN the user activates the Skip_Control, THE Guided_Tour SHALL end by skip.

### Requirement 6: Persisted "tour seen" state

**User Story:** As a returning user, I want the tour to remember that I have already seen it, so that it does not interrupt me every time I open the dashboard.

#### Acceptance Criteria

1. WHEN the Guided_Tour ends by completion or by skip, THE Guided_Tour SHALL set the Tour_Seen_Flag to true for the current user.
2. THE Guided_Tour SHALL persist the Tour_Seen_Flag per user across sessions.

### Requirement 7: Responsive positioning

**User Story:** As a user on any screen size, I want the highlights and tooltips to stay correctly placed, so that the tour remains readable when I resize the window or use a small viewport.

#### Acceptance Criteria

1. WHILE a Tour_Step is active, THE Guided_Tour SHALL read the Target_Element position from the live DOM.
2. WHEN the window is resized, THE Guided_Tour SHALL reposition the Spotlight and Tooltip within 200 milliseconds.
3. WHERE the viewport is too small to place the Tooltip beside the Target_Element, THE Guided_Tour SHALL keep the Tooltip fully within the viewport bounds.

### Requirement 8: Reduced motion support

**User Story:** As a user who prefers reduced motion, I want the tour to limit animation, so that I can still take the tour comfortably.

#### Acceptance Criteria

1. WHERE Reduced_Motion is enabled, THE Guided_Tour SHALL disable the Animated_Cursor flight and other non-essential animation.
2. WHERE Reduced_Motion is enabled, THE Guided_Tour SHALL continue to present the Spotlight and Tooltip for every Tour_Step.

### Requirement 9: Coverage of key dashboard areas

**User Story:** As a new user, I want the tour to cover the most important parts of the dashboard, so that I know where to find the core features.

#### Acceptance Criteria

1. THE Tour_Steps_Input SHALL include Tour_Steps targeting the Decks list, the New Deck control, the Overview/due decks area, the Settings entry, and the AI assistant bubble.

### Requirement 10: Missing target handling

**User Story:** As a user, I want the tour to handle areas that are not on screen yet, so that the tour does not break or point at nothing.

#### Acceptance Criteria

1. IF a Tour_Step's Target_Element is absent from the live DOM when the Tour_Step begins, THEN THE Guided_Tour SHALL poll for the Target_Element every 100 milliseconds for up to 2000 milliseconds.
2. IF the Target_Element remains absent after 2000 milliseconds of polling, THEN THE Guided_Tour SHALL skip that Tour_Step and proceed to the next available Tour_Step.

### Requirement 11: Clean interruption on navigation

**User Story:** As a user, I want the tour to clean up after itself if I navigate away, so that I am never left with a stuck overlay.

#### Acceptance Criteria

1. IF navigation away from the Dashboard occurs while the Guided_Tour is active, THEN THE Guided_Tour SHALL end and remove the Spotlight, overlay, Tooltip, and Animated_Cursor.

### Requirement 12: Consistent state under rapid input

**User Story:** As a user, I want the tour to stay consistent even if I click Next or Back quickly, so that I never end up in a broken intermediate state.

#### Acceptance Criteria

1. WHILE a step transition is animating, THE Guided_Tour SHALL coalesce additional Next and Back activations so that the Guided_Tour settles on a single, fully rendered Tour_Step.

### Requirement 13: Deep-module interface

**User Story:** As a developer integrating the tour, I want a small, well-defined interface that hides the tour's internal complexity, so that the tour is easy to reuse and its core logic is easy to test.

#### Acceptance Criteria

1. THE Guided_Tour SHALL accept the Tour_Steps_Input as its sole content input.
2. WHEN the Guided_Tour ends by completion, THE Guided_Tour SHALL emit a completion notification to its caller.
3. WHEN the Guided_Tour ends by skip, THE Guided_Tour SHALL emit a skip notification to its caller.
4. THE Guided_Tour SHALL encapsulate the Spotlight, overlay, Animated_Cursor, and Tooltip-placement behavior behind its interface so that callers do not interact with those internals directly.
5. WHEN given a current step index and a navigation action, THE Guided_Tour SHALL compute the resulting step selection through logic that is evaluable in isolation from the DOM and animation rendering.
