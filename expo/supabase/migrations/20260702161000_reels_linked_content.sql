-- ============================================================================
-- Reels linked literature support
-- Adds optional linked content fields so a reel upload can reference a poem,
-- book, article or screenplay from the upload screen.
-- Safe to re-run.
-- ============================================================================

alter table public.reels
  add column if not exists linked_content_type text;

alter table public.reels
  add column if not exists linked_content_id uuid;

alter table public.reels
  add column if not exists linked_content_title text;

create index if not exists reels_linked_content_idx
  on public.reels(linked_content_id);
