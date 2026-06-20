-- Invite links are single-use: track who redeemed and when.
ALTER TABLE public.deck_invite
    ADD COLUMN IF NOT EXISTS redeemed_by UUID REFERENCES public.user(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS redeemed_at TIMESTAMPTZ;
