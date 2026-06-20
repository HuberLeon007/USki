-- Per-review history, powering the analytics dashboard (heatmap, rating mix).
CREATE TABLE IF NOT EXISTS public.review_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
    card_id     UUID NOT NULL REFERENCES public.card(id)  ON DELETE CASCADE,
    deck_id     UUID NOT NULL REFERENCES public.deck(id)  ON DELETE CASCADE,
    rating      TEXT NOT NULL CHECK (rating IN ('again', 'hard', 'good', 'easy')),
    stability   DOUBLE PRECISION,
    difficulty  DOUBLE PRECISION,
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_review_log_user_time ON public.review_log (user_id, reviewed_at);
