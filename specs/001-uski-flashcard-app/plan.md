# Implementation Plan: USki Next-Gen Flashcard App MVP

**Branch**: `001-uski-flashcard-app` | **Date**: 2026-06-02 | **Spec**: [spec.md](./spec.md)

## Summary
Implementation of "USki", a local-first, multi-user flashcard application featuring the FSRS algorithm, a rich-text editor with inline image support, and a RAG-based AI chat. The system is fully containerized and emphasizes security (2FA, RBAC, isolated file access).

## Technical Context
- **Language/Version**: Python 3.11+ (Backend), TypeScript 5.0+ (Frontend)
- **Primary Dependencies**: 
    - **Backend**: FastAPI, Pydantic, SQLAlchemy/SQLModel, `pgvector`, `pyotp`, `python-multipart`, `loguru`.
    - **Frontend**: React, React Router, Tailwind CSS, TipTap (Editor), Axios, `lucide-react`.
- **Storage**: PostgreSQL 15+ with `pgvector` extension. Local filesystem for secure attachment storage (mounted volume).
- **Testing**: `pytest` (Backend), `vitest` + `Testing Library` (Frontend).
- **Target Platform**: Docker / Docker Compose (Linux-based images).
- **Performance Goals**: <100ms card transitions, <3s AI response latency.
- **Constraints**: 100% Offline-capable core (except AI API calls), 100% Local Docker setup.

## Constitution Check
- **English-Only**: Checked. All code and docs will be in English.
- **Clean Code**: Checked. Following SOLID and modular architecture.
- **Backend Strictness**: Type hints and Pydantic validation are mandatory.
- **Frontend Strictness**: No `any` types; strict TS configuration.

## Project Structure

### Documentation (this feature)
```text
specs/001-uski-flashcard-app/
├── plan.md              # This file
├── research.md          # Technical research & feasibility
├── data-model.md        # Detailed DB Schema
├── quickstart.md        # Dev setup instructions
├── contracts/           # API & Interface definitions
└── tasks.md             # Implementation tasks
```

### Source Code (repository root)
```text
.
├── backend/
│   ├── src/
│   │   ├── api/         # Routes & Endpoints
│   │   ├── core/        # Config, Auth, Security
│   │   ├── models/      # DB Entities & Schemas
│   │   ├── services/    # Business Logic (FSRS, RAG, AI)
│   │   └── utils/       # Helpers (QR, Mail)
│   ├── tests/
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/  # Atomic & Composite UI
│   │   ├── hooks/       # Custom React Hooks
│   │   ├── pages/       # Route views
│   │   ├── services/    # API Clients
│   │   └── store/       # State Management
│   ├── tests/
│   └── Dockerfile
├── docker-compose.yml
└── .env.example
```

## Complexity Tracking
- **RAG & Vector Search**: Managing embeddings via cloud API and local `pgvector` adds moderate complexity.
- **Inline Image Editor**: Integrating a rich-text editor that handles inline images and Anki-style templates requires careful state management.
- **Hierarchical Sharing**: Implementing RBAC with link-based codes needs a robust permission check middleware.
