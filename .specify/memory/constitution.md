<!-- 
Sync Impact Report
- Version change: 1.0.0 -> 1.1.0
- Modified principles:
  - [PRINCIPLE_1_NAME] -> I. English-Only Standard
  - [PRINCIPLE_2_NAME] -> II. 100% Perfection & Best Practices
  - [PRINCIPLE_3_NAME] -> III. Backend Strictness (Python/FastAPI)
  - [PRINCIPLE_4_NAME] -> IV. Frontend Strictness (React/TypeScript)
  - [PRINCIPLE_5_NAME] -> V. Container-First & Modular Architecture
- Added sections: None
- Removed sections: None
- Templates requiring updates: 
  - .specify/templates/plan-template.md (⚠ pending)
  - .specify/templates/spec-template.md (⚠ pending)
  - .specify/templates/tasks-template.md (⚠ pending)
- Follow-up TODOs: Update runtime docs with English guidelines.
-->
# USki Flashcard App Constitution

## Core Principles

### I. English-Only Standard
All code, documentation, comments, variable names, logs, and commits MUST be written in English.

### II. 100% Perfection & Best Practices
All code MUST adhere to the highest business and professional standards. Clean, modular, and maintainable code is expected. Work must always follow best practices. 100% perfection is the standard.

### III. Backend Strictness (Python/FastAPI)
- Mandatory Type Hints: All Python function arguments and return types MUST have type hints.
- Pydantic Validation: Strict validation is required for all inputs, outputs, and data models.
- Meaningful Logging: Structured and meaningful logging is required, utilizing `loguru`.
- Comprehensive Docstrings: Meaningful docstrings MUST be present for all modules, classes, and functions.

### IV. Frontend Strictness (React/TypeScript)
- Strict Typing: TypeScript MUST be used strictly. The use of `any` is strictly prohibited.
- Best Practices: Modern React patterns (e.g., hooks) and clean component architecture MUST be followed.

### V. Container-First & Modular Architecture
All services and the database MUST be containerized (Docker). The architecture MUST remain modular and adhere to separation of concerns.

## Additional Constraints

All components must prioritize local-first execution. There should be no external cloud dependencies for data storage in the MVP phase. External APIs are only permitted for AI functionalities (e.g., Gemini, Groq).

## Development Workflow

Code must pass type checking, linting, and formatting before being merged. TDD and testing protocols are strongly recommended.

## Governance

Amendments require documentation, approval, and an updated version number following semantic versioning. The constitution supersedes all other practices. All PRs/reviews must verify compliance.

**Version**: 1.1.0 | **Ratified**: 2026-05-26 | **Last Amended**: 2026-05-26
