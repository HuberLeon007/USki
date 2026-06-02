# Feature Specification: USki Next-Gen Flashcard App MVP

**Feature Branch**: `001-uski-flashcard-app`

**Created**: 2026-05-27

**Status**: Draft

**Input**: User description: "Please create a detailed technical and functional specification for my project "USki". USki is an intelligent, modern Next-Gen Flashcard App, initially designed as a local web app..."

## Clarifications

### Session 2026-05-27
- Q: Does USki need to support multiple isolated profiles/users on the same local installation, or is it strictly a single-user application? → A: Full Multi-User (Natively Authenticated): Full FastAPI login and registration with hashed password authentication in the DB to isolate individual users strictly.
- Q: What is the exact context boundary for the AI Chat when a user opens the chat panel during card review? → A: Deck-Wide Context with Document support. Users can attach reference documents directly to a deck to provide AI context. The system also supports standard chat threads (sessions) where users can create new chats and view older ones in history, rather than just a single hard-linked card chat.
- Q: How should the FSRS parameters be managed and optimized in the local MVP? → A: Static Default Parameters: Use the official FSRS default weights. No local machine learning or optimizer training is executed in the MVP to keep the local CPU/memory footprint lightweight.
- Q: What formats should the local document upload support, and how should large documents be handled in the MVP? → A: Advanced Chunking / Local RAG (Option B): Support `.txt` and text-based `.pdf` up to 50MB. Implement document chunking and local semantic search using `pgvector` in PostgreSQL to query relevant document passages before sending them as context to the AI API.
- Q: Should flashcards and the AI model support visual/image-based content? → A: Yes. Flashcards MUST support image attachments on front/back sides, and the AI model chosen MUST support vision/multimodal capabilities to comprehend and answer questions about images inside cards or chat sessions.
- Q: Where should the text embedding vectors be generated? → A: Cloud Embeddings (via API) (Option B): Generate text embeddings via cloud APIs (e.g. Google Gemini Embeddings API) to keep local resource overhead lightweight. Local embeddings (via offline models) are deferred as an optional post-MVP enhancement.

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
- **FR-001b**: System MUST authenticate users via secure login and registration interfaces using FastAPI's native OAuth2/JWT and hashed password storage in the local database. User registration requires an email address.
- **FR-001c**: System MUST strictly isolate user data. Files and images are never directly accessible or downloadable; they are served exclusively through authenticated API endpoints.
- **FR-001d**: System MUST provide a Rich-Text-Editor (similar to Word) for flashcards. It MUST support formatting (bold, italic, font sizes, heading templates) and Anki-style HTML/CSS templates.
- **FR-001e**: System MUST support inline images within flashcard text, allowing multiple images to be placed at exact positions within the text, replacing the simple front/back image attachment approach.
- **FR-001f**: System MUST enforce Two-Factor Authentication (2FA) deployed via QR Code (TOTP). A local `mailpit` Docker container MUST be used to handle system emails (e.g., 2FA setup/recovery).
- **FR-001g**: System MUST allow users to share decks via code or link with a hierarchical permission system: `read` (view/study), `edit` (includes read), and `share` (includes edit and read).
- **FR-002**: System MUST schedule flashcard reviews using the Free Spaced Repetition Scheduler (FSRS) algorithm based on user recall ratings, utilizing its official static default parameters (weights) to keep local CPU and memory usage lightweight. Custom parameter training/optimization is out of scope for the MVP.
- **FR-003**: System MUST store all flashcards, learning history, application logs, and chat histories securely in a local PostgreSQL database.
- **FR-004**: System MUST run completely locally via Docker Containers, requiring no internet connection for core spaced repetition functionality.
- **FR-005**: System MUST integrate with external AI APIs (Google Gemini, Groq, Cohere) or local endpoints (Ollama) to power the contextual chat.
- **FR-005b**: The integrated AI model MUST support multimodal vision capabilities (e.g., Gemini 1.5 Flash) to parse and understand images embedded in flashcards or uploaded into chat sessions.
- **FR-006**: System MUST provide a chat interface alongside the flashcard review view, automatically passing the current card's content, the parent deck's content, and any attached documents as context to the AI model.
- **FR-006b**: System MUST allow users to upload reference documents (PDF, TXT, up to 50MB) to a deck to act as learning context, extracting text and storing it locally.
- **FR-006c**: System MUST support independent Chat Sessions (threads) within a deck, allowing users to create new chat threads, list old threads in a sidebar, delete threads, and view messages.
- **FR-006d**: System MUST partition uploaded documents into chunks, generate embeddings for these chunks using external cloud APIs (e.g., Google Gemini Embeddings API), and implement local semantic search using a vector database extension (`pgvector` in PostgreSQL). Offline local embeddings are deferred as a post-MVP enhancement.
- **FR-006e**: During chat reviews, the system MUST retrieve the most contextually relevant document chunks via semantic search (RAG) and pass them, along with deck and card metadata, to the AI model.
- **FR-007**: System MUST persist the AI chat history within distinct Chat Sessions linked to the deck and (optionally) the current flashcard.
- \*\*FR-008\*\*: System MUST support configuring AI API keys and endpoint URLs. The system MUST load default keys from environment configuration for initial setup/development, and MUST provide a UI settings page where users can override the default with their own keys.

### Key Entities

- **User**: Represents a registered learner. (Attributes: id, username, email, hashed_password, two_factor_secret, is_2fa_enabled, created_at)
- **Deck**: Represents a collection of flashcards. (Attributes: id, user_id, name, description, created_at)
- **Deck_Share**: Represents sharing permissions for a deck. (Attributes: id, deck_id, link_code, permission_level (read/edit/share), created_at)
- **Flashcard**: Represents a single learning item. Uses HTML for rich text. (Attributes: id, deck_id, front_html_content, back_html_content, created_at, updated_at)
- **File_Attachment**: Securely stored files (images, PDFs). (Attributes: id, uploader_id, file_name, file_path, mime_type, created_at)
- **FSRS_State**: Tracks the spaced repetition scheduling state for a flashcard. (Attributes: card_id, due_date, stability, difficulty, elapsed_days, scheduled_days, reps, lapses, state)
- **Review_Log**: Records a single review event for analytics and FSRS optimization. (Attributes: id, card_id, rating, review_time, duration)
- **Chat_Message**: Represents a message in a chat thread. (Attributes: id, session_id, role, content, timestamp)
- **Chat_Session**: Represents an independent chat thread. (Attributes: id, user_id, deck_id, card_id (optional), title, created_at)
- **Document**: Represents an uploaded document attached to a deck for AI context. (Attributes: id, deck_id, title, file_path, file_type, created_at)
- **Document_Chunk**: Represents a chunked section of an uploaded document. (Attributes: id, document_id, content_chunk, embedding_vector, chunk_index, created_at)

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
