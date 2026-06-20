-- Deck pictogram: stores a lucide icon key (e.g. 'flask', 'globe').
-- NULL = no icon (list view / default Layers glyph in grid view).
ALTER TABLE public.deck ADD COLUMN IF NOT EXISTS icon TEXT;
