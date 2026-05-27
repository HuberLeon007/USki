# Feature Specification: USki Next-Gen Flashcard App MVP

**Feature Branch**: `001-uski-flashcard-app`

**Created**: 2026-05-27

**Status**: Draft

**Input**: User description: "Please create a detailed technical and functional specification for my project "USki". USki is an intelligent, modern Next-Gen Flashcard App, initially designed as a local web app..."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Flashcard Creation and Management (Priority: P1)

As a learner, I want to create, edit, and organize flashcards into decks so that I can study them effectively.

**Why this priority**: Without flashcards and decks, there is no learning application. This is the foundational capability.

**Independent Test**: Can be fully tested by creating a new deck, adding several flashcards with front/back content, editing one, and verifying they are successfully saved and retrieved from the local database.

**Acceptance Scenarios**:

1. **Given** a user is on the dashboard, **When** they create a new deck and add a flashcard with text, **Then** the card is saved to the local database and appears in the deck's card list.
2. **Given** a user has an existing flashcard, **When** they edit the card's content and save, **Then** the updated content is persisted and reflected immediately in the UI.

---

### User Story 2 - Spaced Repetition Learning Session (Priority: P1)

As a learner, I want to review due flashcards using the FSRS algorithm so that my learning intervals are optimized based on my actual recall performance.

**Why this priority**: The core value proposition of USki over basic flashcard apps is the data-driven FSRS algorithm for efficient learning.

**Independent Test**: Can be tested by starting a review session, rating a card's difficulty (e.g., Easy, Good, Hard, Again), and verifying that the next due date is calculated correctly using FSRS parameters.

**Acceptance Scenarios**:

1. **Given** a user starts a learning session for a deck, **When** a card is shown and the user rates their recall, **Then** the FSRS algorithm calculates the next review date, logs the review, and updates the card's state.
2. **Given** a deck with no due cards for today, **When** the user attempts to study the deck, **Then** the system informs them that they have finished their reviews for now.

---

### User Story 3 - Contextual AI Chat During Review (Priority: P2)

As a learner, I want to chat with an AI about a specific flashcard while reviewing it so that I can ask comprehension questions without losing my learning context.

**Why this priority**: This is the unique "NotebookLM-style" feature that differentiates USki, providing active learning support rather than just passive recall.

**Independent Test**: Can be tested by opening the chat panel during a card review, sending a question, and receiving an AI response that incorporates the card's content as context.

**Acceptance Scenarios**:

1. **Given** a user is reviewing a specific card, **When** they open the AI chat and ask a question, **Then** the AI responds contextually based on the card's front/back content.
2. **Given** a user has previously chatted about a specific card, **When** they review that card again on a later date, **Then** the previous chat history for that card is preserved and visible.

---

### Edge Cases

- What happens when the external AI API rate limits the user or the service is offline?
- How does the system handle corrupted or missing FSRS tracking parameters for a specific card?
- What happens if the local Docker environment runs out of storage space or the Postgres database fails to write?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow users to create, read, update, and delete (CRUD) decks and flashcards.
- **FR-002**: System MUST schedule flashcard reviews using the Free Spaced Repetition Scheduler (FSRS) algorithm based on user recall ratings.
- **FR-003**: System MUST store all flashcards, learning history, application logs, and chat histories securely in a local PostgreSQL database.
- **FR-004**: System MUST run completely locally via Docker Containers, requiring no internet connection for core spaced repetition functionality.
- **FR-005**: System MUST integrate with external AI APIs (Google Gemini, Groq, Cohere) or local endpoints (Ollama) to power the contextual chat.
- **FR-006**: System MUST provide a chat interface alongside the flashcard review view, automatically passing the current card's content as context to the AI model.
- **FR-007**: System MUST persist the AI chat history linked to each specific flashcard.
- \*\*FR-008\*\*: System MUST support configuring AI API keys and endpoint URLs. The system MUST load default keys from environment configuration for initial setup/development, and MUST provide a UI settings page where users can override the default with their own keys.

### Key Entities

- **Deck**: Represents a collection of flashcards. (Attributes: id, name, description, created_at)
- **Flashcard**: Represents a single learning item. (Attributes: id, deck_id, front_content, back_content, created_at, updated_at)
- **FSRS_State**: Tracks the spaced repetition scheduling state for a flashcard. (Attributes: card_id, due_date, stability, difficulty, elapsed_days, scheduled_days, reps, lapses, state)
- **Review_Log**: Records a single review event for analytics and FSRS optimization. (Attributes: id, card_id, rating, review_time, duration)
- **Chat_Message**: Represents a message in the contextual AI chat. (Attributes: id, card_id, role, content, timestamp)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can create a deck and add their first flashcard in under 60 seconds.
- **SC-002**: The learning interface transitions between flashcards in under 100 milliseconds to ensure a smooth study flow.
- **SC-003**: Contextual AI chat responses are displayed to the user within 3 seconds of sending a message (assuming standard API latency).
- **SC-004**: FSRS due dates are calculated perfectly in accordance with the official FSRS mathematical specification.

## Assumptions

- **Target Audience**: Users have a machine capable of running Docker and `docker-compose`.
- **AI Access**: Users will obtain their own API keys for the external AI services or have the technical ability to point the app to a local Ollama instance.
- **Scope Boundary**: Mobile and Desktop specific builds (Tauri/React Native) are explicitly out of scope for this MVP phase.
- **Scope Boundary**: Multi-device sync and cloud database integration (Supabase) are out of scope for this MVP phase.
