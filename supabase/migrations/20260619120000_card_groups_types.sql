-- ============================================================
-- Card grouping + types, and per-deck custom-study policy.
--  * card.card_type   : 'basic' (front->back) | 'reverse' (back->front).
--                       A note can spawn a basic + reverse pair (linked via
--                       note_id) so editing one updates both.
--  * card.note_id     : groups linked cards generated from the same note.
--  * card.group_label : optional in-deck grouping name (NOT a sub-deck).
--  * card.group_color : optional hex/token for the group's colored frame.
--  * deck.custom_study_updates : whether custom-study sessions feed the FSRS
--                       algorithm. Default FALSE (custom study never alters
--                       scheduling unless explicitly enabled per deck).
-- ============================================================

ALTER TABLE public.card
    ADD COLUMN IF NOT EXISTS card_type   TEXT NOT NULL DEFAULT 'basic'
        CHECK (card_type IN ('basic', 'reverse')),
    ADD COLUMN IF NOT EXISTS note_id     UUID,
    ADD COLUMN IF NOT EXISTS group_label TEXT,
    ADD COLUMN IF NOT EXISTS group_color TEXT;

CREATE INDEX IF NOT EXISTS idx_card_note ON public.card (note_id);
CREATE INDEX IF NOT EXISTS idx_card_group ON public.card (deck_id, group_label);

ALTER TABLE public.deck
    ADD COLUMN IF NOT EXISTS custom_study_updates BOOLEAN NOT NULL DEFAULT false;
