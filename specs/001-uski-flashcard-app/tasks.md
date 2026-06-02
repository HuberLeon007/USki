# Implementation Tasks: USki MVP

## Phase 0: Infrastructure & Setup
- [ ] Initialize `docker-compose.yml` with `postgres`, `mailpit`, `backend`, and `frontend`.
- [ ] Setup `backend` environment (FastAPI, SQLModel, Loguru).
- [ ] Setup `frontend` environment (Vite, React, Tailwind, TipTap).

## Phase 1: Authentication & Security
- [ ] Implement User registration/login with JWT.
- [ ] Implement 2FA (Secret generation, QR Code display).
- [ ] Integrate 2FA verification in the login flow.
- [ ] Setup `mailpit` integration for system emails.

## Phase 2: Deck & Flashcard Management
- [ ] Implement CRUD for Decks.
- [ ] Implement Rich-Text Editor (TipTap) for Flashcards.
- [ ] Implement Secure File Upload & Inline Image rendering.
- [ ] Implement Hierarchical Sharing (Read/Edit/Share links).

## Phase 3: Learning Engine (FSRS)
- [ ] Implement FSRS state management and calculation logic.
- [ ] Create Study interface with card flip and rating buttons.
- [ ] Integrate FSRS rating log with DB.

## Phase 4: AI Context & RAG
- [ ] Implement Document upload and chunking logic.
- [ ] Integrate Gemini Embeddings API and `pgvector` storage.
- [ ] Implement Semantic Search for RAG context.
- [ ] Create Chat interface with history and Vision support.

## Phase 5: Polishing & Validation
- [ ] Implement 3-level logging architecture.
- [ ] Add integration tests for RAG and FSRS.
- [ ] Final UI/UX polish and responsiveness check.
