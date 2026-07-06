-- Public (anon + authenticated) read access for published screenplays and their
-- child rows so the mobile user app can render the Ssenariylar section.
--
-- Context: screenplays / screenplay_scenes / screenplay_characters / screenplay_music
-- all have RLS ENABLED but shipped with ONLY admin policies — so anon/user reads
-- returned nothing. This mirrors the "Public can read published books" policy.
-- Idempotent: safe to re-run.
--
-- Reading progress reuses the existing `reading_progress` table
-- (content_type = 'scenario'); no new table is required here.

-- ── screenplays: only published rows are visible to the public ────────────────
drop policy if exists "Public can read published screenplays" on public.screenplays;
create policy "Public can read published screenplays"
  on public.screenplays for select
  to anon, authenticated
  using (status = 'published');

-- ── child tables: visible only when the parent screenplay is published ────────
drop policy if exists "Public can read published screenplay scenes" on public.screenplay_scenes;
create policy "Public can read published screenplay scenes"
  on public.screenplay_scenes for select
  to anon, authenticated
  using (exists (
    select 1 from public.screenplays s
    where s.id = screenplay_scenes.screenplay_id and s.status = 'published'
  ));

drop policy if exists "Public can read published screenplay characters" on public.screenplay_characters;
create policy "Public can read published screenplay characters"
  on public.screenplay_characters for select
  to anon, authenticated
  using (exists (
    select 1 from public.screenplays s
    where s.id = screenplay_characters.screenplay_id and s.status = 'published'
  ));

drop policy if exists "Public can read published screenplay music" on public.screenplay_music;
create policy "Public can read published screenplay music"
  on public.screenplay_music for select
  to anon, authenticated
  using (exists (
    select 1 from public.screenplays s
    where s.id = screenplay_music.screenplay_id and s.status = 'published'
  ));

notify pgrst, 'reload schema';
