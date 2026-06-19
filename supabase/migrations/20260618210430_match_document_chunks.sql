-- Similarity search over card-derived chunks, scoped to owner + deck.
-- Called by the backend (service role). SECURITY INVOKER keeps RLS in force.
CREATE OR REPLACE FUNCTION public.match_document_chunks(
    p_owner UUID,
    p_deck  UUID,
    p_query vector(768),
    p_k     INT DEFAULT 5
)
RETURNS TABLE (content TEXT, similarity DOUBLE PRECISION)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
    SELECT dc.content,
           1 - (dc.embedding <=> p_query) AS similarity
    FROM public.document_chunk dc
    WHERE dc.owner_id = p_owner
      AND dc.deck_id = p_deck
      AND dc.embedding IS NOT NULL
    ORDER BY dc.embedding <=> p_query
    LIMIT GREATEST(p_k, 1);
$$;
