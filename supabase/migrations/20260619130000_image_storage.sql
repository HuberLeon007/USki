-- ============================================================
-- Image storage + per-user dedup and quota.
--  * Binary lives in the Storage bucket 'card-images' (path = owner/{hash}.webp).
--  * public.image holds metadata keyed by (owner_id, sha256). Identical bytes
--    dedup to one row per user, so re-using / duplicate images cost storage once.
--  * Quota (50 MB/user) = SUM(bytes) of the user's image rows, enforced in the
--    backend before upload.
-- ============================================================

CREATE TABLE public.image (
    sha256     TEXT NOT NULL,
    owner_id   UUID NOT NULL REFERENCES public.user(id) ON DELETE CASCADE,
    path       TEXT NOT NULL,           -- storage object path: {owner}/{sha}.webp
    bytes      INT  NOT NULL,
    width      INT  NOT NULL DEFAULT 0,
    height     INT  NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (owner_id, sha256)
);
CREATE INDEX idx_image_owner ON public.image (owner_id);

ALTER TABLE public.image ENABLE ROW LEVEL SECURITY;
CREATE POLICY "image_owner_all" ON public.image FOR ALL
    TO authenticated USING (owner_id = (select auth.uid()))
    WITH CHECK (owner_id = (select auth.uid()));

-- Storage bucket for card images. Public-read keeps dev URLs simple; uploads go
-- through the backend (service role), so write access is server-controlled.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('card-images', 'card-images', true, 5242880, ARRAY['image/webp','image/png','image/jpeg'])
ON CONFLICT (id) DO NOTHING;

-- Anyone may read objects in this bucket (public flashcards / shared decks).
CREATE POLICY "card_images_public_read" ON storage.objects FOR SELECT
    TO public USING (bucket_id = 'card-images');
