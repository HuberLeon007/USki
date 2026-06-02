# Research: USki Technical Implementation

## 1. Rich-Text Editor & Inline Images
- **Tool**: TipTap (Headless, based on Prosemirror).
- **Why**: TipTap allows building a custom "Word-like" interface while remaining fully accessible and extensible. It handles JSON/HTML serialization perfectly.
- **Inline Images**: Images will be uploaded via a secure API and inserted as `<img>` tags with a custom source pointing to an authenticated proxy endpoint (e.g., `/api/files/{id}`).
- **Anki Templates**: CSS can be scoped to the card viewer component to replicate the specific styling requirements (gradients, rounded corners, headers).

## 2. 2FA & Security
- **TOTP**: Use `pyotp` for generating secrets and verifying tokens.
- **QR Codes**: Use `python-qrcode` to generate data URI images for the frontend.
- **Email**: `mailpit` will be used as the SMTP relay in development/local mode. FastAPI will use `fastapi-mail` to send codes.
- **Isolated Access**: The backend will serve files via a `FileResponse` after verifying the user's `session_token` and ownership of the deck/file.

## 3. RAG Pipeline (Gemini)
- **Embeddings**: Google Gemini Embeddings API (768 dimensions).
- **Storage**: PostgreSQL `pgvector`.
- **Retrieval**: Cosine similarity search (`<=>` operator) to find relevant document chunks based on user query + current card context.

## 4. FSRS Algorithm
- Use the official Python implementation or a port that follows the FSRS-v4 specification exactly.
- Static weights will be stored in a config file and loaded as defaults.
