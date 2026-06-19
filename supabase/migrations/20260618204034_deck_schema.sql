-- ============================================================
-- USki Deck Schema — groups, decks, cards, FSRS, sharing, RAG
-- Backend uses the service-role key (bypasses RLS); the authoritative
-- permission checks live in the backend `permissions` module. RLS here is
-- defense-in-depth so the Data API never leaks rows to anon/other users.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ── deck_group — nestable folder structure ──────────────────
CREATE TABLE public.deck_group (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id        UUID NOT NULL REFERENCES public.user(id) ON DELETE CASCADE,
    parent_group_id UUID REFERENCES public.deck_group(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    position        INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_deck_group_owner ON public.deck_group (owner_id);
CREATE INDEX idx_deck_group_parent ON public.deck_group (parent_group_id);

-- ── deck ─────────────────────────────────────────────────────
CREATE TABLE public.deck (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id      UUID NOT NULL REFERENCES public.user(id) ON DELETE CASCADE,
    group_id      UUID REFERENCES public.deck_group(id) ON DELETE SET NULL,
    title         TEXT NOT NULL,
    description   TEXT NOT NULL DEFAULT '',
    card_template TEXT NOT NULL DEFAULT 'default',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_deck_owner ON public.deck (owner_id);
CREATE INDEX idx_deck_group ON public.deck (group_id);

-- ── card — front/back as TipTap JSON + sanitized HTML ────────
CREATE TABLE public.card (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deck_id    UUID NOT NULL REFERENCES public.deck(id) ON DELETE CASCADE,
    front_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    front_html TEXT NOT NULL DEFAULT '',
    back_json  JSONB NOT NULL DEFAULT '{}'::jsonb,
    back_html  TEXT NOT NULL DEFAULT '',
    position   INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_card_deck ON public.card (deck_id);

-- ── card_schedule — FSRS state per (card, user) ──────────────
-- One row per learner per card. Own decks: user_id = owner. Shared decks:
-- each learner accumulates their own schedule.
CREATE TABLE public.card_schedule (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id     UUID NOT NULL REFERENCES public.card(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES public.user(id) ON DELETE CASCADE,
    due         TIMESTAMPTZ NOT NULL DEFAULT now(),
    stability   DOUBLE PRECISION NOT NULL DEFAULT 0,
    difficulty  DOUBLE PRECISION NOT NULL DEFAULT 0,
    elapsed_days INT NOT NULL DEFAULT 0,
    scheduled_days INT NOT NULL DEFAULT 0,
    reps        INT NOT NULL DEFAULT 0,
    lapses      INT NOT NULL DEFAULT 0,
    state       SMALLINT NOT NULL DEFAULT 0,  -- 0=New 1=Learning 2=Review 3=Relearning
    last_review TIMESTAMPTZ,
    CONSTRAINT card_schedule_card_user_key UNIQUE (card_id, user_id)
);
CREATE INDEX idx_card_schedule_user_due ON public.card_schedule (user_id, due);
CREATE INDEX idx_card_schedule_card ON public.card_schedule (card_id);

-- ── deck_share — RBAC (read < edit < share) ──────────────────
CREATE TABLE public.deck_share (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deck_id    UUID NOT NULL REFERENCES public.deck(id) ON DELETE CASCADE,
    grantee_id UUID NOT NULL REFERENCES public.user(id) ON DELETE CASCADE,
    permission TEXT NOT NULL CHECK (permission IN ('read', 'edit', 'share')),
    granted_by UUID NOT NULL REFERENCES public.user(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT deck_share_deck_grantee_key UNIQUE (deck_id, grantee_id)
);
CREATE INDEX idx_deck_share_grantee ON public.deck_share (grantee_id);
CREATE INDEX idx_deck_share_deck ON public.deck_share (deck_id);

-- ── deck_invite — share by code/link ─────────────────────────
CREATE TABLE public.deck_invite (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deck_id     UUID NOT NULL REFERENCES public.deck(id) ON DELETE CASCADE,
    code        TEXT NOT NULL UNIQUE,
    permission  TEXT NOT NULL CHECK (permission IN ('read', 'edit', 'share')),
    created_by  UUID NOT NULL REFERENCES public.user(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_deck_invite_deck ON public.deck_invite (deck_id);

-- ── deck_access_log — audit: access + permission changes ─────
CREATE TABLE public.deck_access_log (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deck_id    UUID NOT NULL REFERENCES public.deck(id) ON DELETE CASCADE,
    actor_id   UUID REFERENCES public.user(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,  -- 'access' | 'grant' | 'revoke' | 'redeem'
    detail     JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_deck_access_log_deck ON public.deck_access_log (deck_id, created_at DESC);

-- ── permission_notification — shown at next login ────────────
CREATE TABLE public.permission_notification (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES public.user(id) ON DELETE CASCADE,
    deck_id    UUID REFERENCES public.deck(id) ON DELETE CASCADE,
    kind       TEXT NOT NULL,  -- 'granted' | 'revoked' | 'changed'
    message    TEXT NOT NULL,
    seen       BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_perm_notif_user_unseen ON public.permission_notification (user_id) WHERE seen = false;

-- ── document_chunk — RAG index built from card content ───────
CREATE TABLE public.document_chunk (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id   UUID NOT NULL REFERENCES public.card(id) ON DELETE CASCADE,
    deck_id   UUID NOT NULL REFERENCES public.deck(id) ON DELETE CASCADE,
    owner_id  UUID NOT NULL REFERENCES public.user(id) ON DELETE CASCADE,
    content   TEXT NOT NULL,
    embedding vector(768),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_document_chunk_deck ON public.document_chunk (deck_id);
CREATE INDEX idx_document_chunk_embedding
    ON public.document_chunk USING hnsw (embedding vector_cosine_ops);

-- ── updated_at trigger ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_deck_updated  BEFORE UPDATE ON public.deck
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_card_updated  BEFORE UPDATE ON public.card
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- Row Level Security (defense-in-depth; backend uses service role)
-- ============================================================
ALTER TABLE public.deck_group ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deck ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deck_share ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deck_invite ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deck_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_notification ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunk ENABLE ROW LEVEL SECURITY;

-- Helper: does the current user have at least read access to a deck?
CREATE OR REPLACE FUNCTION public.can_read_deck(p_deck_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.deck d WHERE d.id = p_deck_id AND d.owner_id = (select auth.uid())
    ) OR EXISTS (
        SELECT 1 FROM public.deck_share s
        WHERE s.deck_id = p_deck_id AND s.grantee_id = (select auth.uid())
    );
$$;

-- deck_group: owner only
CREATE POLICY "deck_group_owner_all" ON public.deck_group FOR ALL
    TO authenticated USING (owner_id = (select auth.uid()))
    WITH CHECK (owner_id = (select auth.uid()));

-- deck: owner full; grantees read
CREATE POLICY "deck_owner_all" ON public.deck FOR ALL
    TO authenticated USING (owner_id = (select auth.uid()))
    WITH CHECK (owner_id = (select auth.uid()));
CREATE POLICY "deck_shared_read" ON public.deck FOR SELECT
    TO authenticated USING (public.can_read_deck(id));

-- card: readable when the deck is readable; writable by deck owner
CREATE POLICY "card_read" ON public.card FOR SELECT
    TO authenticated USING (public.can_read_deck(deck_id));
CREATE POLICY "card_owner_write" ON public.card FOR ALL
    TO authenticated
    USING (EXISTS (SELECT 1 FROM public.deck d WHERE d.id = deck_id AND d.owner_id = (select auth.uid())))
    WITH CHECK (EXISTS (SELECT 1 FROM public.deck d WHERE d.id = deck_id AND d.owner_id = (select auth.uid())));

-- card_schedule: each user owns their own schedule rows
CREATE POLICY "card_schedule_own" ON public.card_schedule FOR ALL
    TO authenticated USING (user_id = (select auth.uid()))
    WITH CHECK (user_id = (select auth.uid()));

-- deck_share: grantee sees own; deck owner manages
CREATE POLICY "deck_share_grantee_read" ON public.deck_share FOR SELECT
    TO authenticated USING (grantee_id = (select auth.uid()) OR
        EXISTS (SELECT 1 FROM public.deck d WHERE d.id = deck_id AND d.owner_id = (select auth.uid())));

-- deck_invite: deck owner manages
CREATE POLICY "deck_invite_owner" ON public.deck_invite FOR ALL
    TO authenticated
    USING (EXISTS (SELECT 1 FROM public.deck d WHERE d.id = deck_id AND d.owner_id = (select auth.uid())))
    WITH CHECK (EXISTS (SELECT 1 FROM public.deck d WHERE d.id = deck_id AND d.owner_id = (select auth.uid())));

-- deck_access_log: deck owner reads
CREATE POLICY "deck_access_log_owner_read" ON public.deck_access_log FOR SELECT
    TO authenticated
    USING (EXISTS (SELECT 1 FROM public.deck d WHERE d.id = deck_id AND d.owner_id = (select auth.uid())));

-- permission_notification: user reads/updates own
CREATE POLICY "perm_notif_own" ON public.permission_notification FOR ALL
    TO authenticated USING (user_id = (select auth.uid()))
    WITH CHECK (user_id = (select auth.uid()));

-- document_chunk: owner only (RAG runs server-side with service role)
CREATE POLICY "document_chunk_owner" ON public.document_chunk FOR ALL
    TO authenticated USING (owner_id = (select auth.uid()))
    WITH CHECK (owner_id = (select auth.uid()));
