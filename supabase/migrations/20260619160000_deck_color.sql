-- Deck accent color: stores a palette key (e.g. 'blue', 'emerald') chosen at
-- deck creation. NULL = default brand violet.
ALTER TABLE public.deck ADD COLUMN IF NOT EXISTS color TEXT;
