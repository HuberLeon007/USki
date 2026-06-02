# Data Model: USki Next-Gen Flashcard App

## Entities

### 1. User
Represents a registered learner.
- `id`: UUID (PK)
- `username`: VARCHAR(50) (Unique, Indexed)
- `email`: VARCHAR(255) (Unique, Not Null)
- `hashed_password`: VARCHAR(255) (Not Null)
- `two_factor_secret`: VARCHAR(32) (Nullable)
- `is_2fa_enabled`: BOOLEAN (Default: FALSE)
- `created_at`: TIMESTAMP (UTC)

### 2. Deck
Represents a collection of flashcards.
- `id`: UUID (PK)
- `user_id`: UUID (FK -> User.id)
- `name`: VARCHAR(100) (Not Null)
- `description`: TEXT
- `created_at`: TIMESTAMP (UTC)

### 3. Deck_Share
Represents sharing permissions for a deck.
- `id`: UUID (PK)
- `deck_id`: UUID (FK -> Deck.id)
- `share_code`: VARCHAR(64) (Unique, Indexed)
- `permission_level`: ENUM ('read', 'edit', 'share')
- `created_at`: TIMESTAMP (UTC)

### 4. Flashcard
Represents a learning item.
- `id`: UUID (PK)
- `deck_id`: UUID (FK -> Deck.id, Cascade Delete)
- `front_html`: TEXT (Rich-text content)
- `back_html`: TEXT (Rich-text content)
- `created_at`: TIMESTAMP (UTC)
- `updated_at`: TIMESTAMP (UTC)

### 5. File_Attachment
Securely stored files (images, PDFs).
- `id`: UUID (PK)
- `uploader_id`: UUID (FK -> User.id)
- `deck_id`: UUID (FK -> Deck.id, Nullable)
- `file_name`: VARCHAR(255)
- `file_path`: VARCHAR(512) (Internal path)
- `mime_type`: VARCHAR(100)
- `created_at`: TIMESTAMP (UTC)

### 6. FSRS_State
Spaced repetition metadata.
- `card_id`: UUID (PK, FK -> Flashcard.id)
- `due_date`: TIMESTAMP (Indexed)
- `stability`: FLOAT
- `difficulty`: FLOAT
- `elapsed_days`: INT
- `scheduled_days`: INT
- `reps`: INT
- `lapses`: INT
- `state`: VARCHAR(20) (New, Learning, Review, Relearning)

### 7. Review_Log
History of recall ratings.
- `id`: UUID (PK)
- `card_id`: UUID (FK -> Flashcard.id)
- `rating`: INT (1-4)
- `review_time`: TIMESTAMP
- `duration`: INT (Seconds)

### 8. Document
Reference material for RAG.
- `id`: UUID (PK)
- `deck_id`: UUID (FK -> Deck.id)
- `title`: VARCHAR(255)
- `file_path`: VARCHAR(512)
- `file_type`: VARCHAR(10)
- `created_at`: TIMESTAMP (UTC)

### 9. Document_Chunk
Embedded sections of documents.
- `id`: UUID (PK)
- `document_id`: UUID (FK -> Document.id)
- `content`: TEXT
- `embedding`: VECTOR(768) (Google Gemini Embeddings)
- `chunk_index`: INT

### 10. Chat_Session
Independent AI chat threads.
- `id`: UUID (PK)
- `user_id`: UUID (FK -> User.id)
- `deck_id`: UUID (FK -> Deck.id)
- `card_id`: UUID (FK -> Flashcard.id, Nullable)
- `title`: VARCHAR(255)
- `created_at`: TIMESTAMP (UTC)

### 11. Chat_Message
- `id`: UUID (PK)
- `session_id`: UUID (FK -> Chat_Session.id)
- `role`: VARCHAR(20) (user, assistant)
- `content`: TEXT
- `timestamp`: TIMESTAMP (UTC)
