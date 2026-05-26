# Constitution and README Translation Design

## Purpose
Establish the project constitution (core principles, coding standards, and best practices) to ensure 100% perfection and highest business standards. Additionally, translate the existing project `README.md` into English to align with the new English-only language policy.

## Approach
- **Constitution Location:** The constitution will be written to a single file named `temp.md` (as requested by the user). If the file grows too large in the future, it will be split.
- **Language:** All artifacts (code, documentation, logs) must be in English.
- **README:** The current German `README.md` will be translated entirely into English, preserving its structure and technical context (USki Flashcard App, FSRS, React/FastAPI/PostgreSQL stack).

## Constitution Requirements (`temp.md`)
The constitution will outline the following domains:

### 1. Core Philosophy
- **Language:** English-only for all code, documentation, commits, and logs.
- **Standard:** 100% perfection, highest business and professional standards. Clean, modular, and maintainable code.

### 2. Backend Standards (Python/FastAPI)
- **Type Hints:** Mandatory for all function arguments and return types.
- **Validation:** Strict `pydantic` validation for all I/O and data models.
- **Documentation:** Meaningful docstrings for all modules, classes, and functions.
- **Logging:** Structured and meaningful logging using `loguru`.

### 3. Frontend Standards (React/TypeScript)
- **Typing:** Strict TypeScript types and interfaces. No `any` types.
- **Best Practices:** Clean component architecture, modern React patterns (hooks).

### 4. General Practices
- Container-first development (Docker).
- Clear and meaningful comments explaining the "why", not just the "what".

## Implementation Plan Overview
1. Write the `temp.md` file containing the project constitution based on the rules defined above.
2. Translate the `README.md` file from German to English, ensuring accurate translation of technical terms (e.g., FSRS, NotebookLM-style AI, Containerization).
