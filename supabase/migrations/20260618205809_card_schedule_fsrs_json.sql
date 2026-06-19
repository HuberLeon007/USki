-- Store the full FSRS card state as JSON (robust against lib field changes).
-- `due` (existing column) stays mirrored for indexed due-queries.
ALTER TABLE public.card_schedule ADD COLUMN IF NOT EXISTS fsrs JSONB NOT NULL DEFAULT '{}'::jsonb;
