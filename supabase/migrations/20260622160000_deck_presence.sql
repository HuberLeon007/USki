-- ============================================================
-- Live presence + per-card edit locks for collaborative decks
-- ============================================================
-- One row per (deck, user, device) that is currently in a deck. `card_id` is
-- the card that device is editing right now (an advisory edit lock); null means
-- "present but not editing a card". Freshness is driven by `heartbeat_at`: a row
-- is considered active only while its heartbeat is recent (TTL enforced in the
-- service), so a crashed editor's lock frees itself instead of sticking.
--
-- This lets us (a) stop two devices editing the same card at once, and (b) block
-- an owner from deleting a deck while collaborators are still inside it.
create table if not exists public.deck_presence (
  id           uuid primary key default gen_random_uuid(),
  deck_id      uuid not null references public.deck(id) on delete cascade,
  user_id      uuid not null references public."user"(id) on delete cascade,
  device_id    text not null,
  card_id      uuid,
  heartbeat_at timestamptz not null default now(),
  unique (deck_id, user_id, device_id)
);

create index if not exists idx_deck_presence_deck on public.deck_presence (deck_id);
