# Database Model Plan

This is the planned Supabase database model. It is not a migration yet.

## Auth-Owned User

Users are managed by Supabase Auth in `auth.users`.

USki does not store passwords.

USki does not store password hashes.

## profiles

Stores app-specific user data.

Fields:

- `id` UUID primary key, references `auth.users.id`
- `display_name` text nullable
- `avatar_path` text nullable
- `created_at` timestamptz

## decks

Stores flashcard decks.

Fields:

- `id` UUID primary key
- `owner_id` UUID references `auth.users.id`
- `name` text
- `description` text nullable
- `created_at` timestamptz
- `updated_at` timestamptz

## deck_memberships

Stores durable shared access to decks.

Fields:

- `id` UUID primary key
- `deck_id` UUID references `decks.id`
- `user_id` UUID references `auth.users.id`
- `permission_level` text: `read`, `edit`, `share`
- `created_at` timestamptz

## deck_shares

Stores share codes or links.

Fields:

- `id` UUID primary key
- `deck_id` UUID references `decks.id`
- `created_by` UUID references `auth.users.id`
- `share_code` text unique
- `permission_level` text: `read`, `edit`, `share`
- `created_at` timestamptz
- `expires_at` timestamptz nullable

## flashcards

Stores cards inside decks.

Fields:

- `id` UUID primary key
- `deck_id` UUID references `decks.id`
- `front_html` text
- `back_html` text
- `created_at` timestamptz
- `updated_at` timestamptz

## file_attachments

Stores private Supabase Storage file metadata.

Fields:

- `id` UUID primary key
- `uploader_id` UUID references `auth.users.id`
- `deck_id` UUID references `decks.id`
- `storage_path` text
- `file_name` text
- `mime_type` text
- `size_bytes` bigint
- `created_at` timestamptz

## fsrs_states

Stores scheduling state per flashcard.

Fields:

- `card_id` UUID primary key references `flashcards.id`
- `due_at` timestamptz
- `stability` double precision
- `difficulty` double precision
- `elapsed_days` integer
- `scheduled_days` integer
- `reps` integer
- `lapses` integer
- `state` text

## review_logs

Stores card review history.

Fields:

- `id` UUID primary key
- `card_id` UUID references `flashcards.id`
- `user_id` UUID references `auth.users.id`
- `rating` integer from 1 to 4
- `reviewed_at` timestamptz
- `duration_ms` integer nullable

## documents

Stores uploaded document metadata.

Fields:

- `id` UUID primary key
- `deck_id` UUID references `decks.id`
- `uploaded_by` UUID references `auth.users.id`
- `title` text
- `storage_path` text
- `file_type` text
- `created_at` timestamptz

## document_chunks

Stores RAG chunks and embeddings.

Fields:

- `id` UUID primary key
- `document_id` UUID references `documents.id`
- `content` text
- `embedding` vector
- `chunk_index` integer
- `created_at` timestamptz

## chat_sessions

Stores independent chat threads.

Fields:

- `id` UUID primary key
- `user_id` UUID references `auth.users.id`
- `deck_id` UUID references `decks.id`
- `card_id` UUID nullable references `flashcards.id`
- `title` text
- `created_at` timestamptz

## chat_messages

Stores chat messages.

Fields:

- `id` UUID primary key
- `session_id` UUID references `chat_sessions.id`
- `role` text: `user`, `assistant`, `system`
- `content` text
- `created_at` timestamptz

## audit_logs

Stores security-relevant app events.

Fields:

- `id` UUID primary key
- `user_id` UUID nullable references `auth.users.id`
- `action` text
- `resource_type` text
- `resource_id` UUID nullable
- `metadata` jsonb
- `created_at` timestamptz
