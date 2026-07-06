-- ════════════════════════════════════════════════════════════════════════════
-- AdabiyotX — avatar storage + "Tokcham" shelf tables
-- ════════════════════════════════════════════════════════════════════════════
-- Idempotent. Apply in the Supabase SQL editor (or `supabase db push`).
-- Creates:
--   1. public `avatars` storage bucket + RLS so a user can only write inside
--      their own `{user_id}/…` folder, but anyone can read (public avatars).
--   2. `reading_progress`  — "O'qilayotganlar" (started, not finished).
--   3. `planned_reads`     — "Rejalashtirilganlar" ("Tez orada o'qiyman").
-- Both shelf tables carry a small content snapshot (title/cover/author) so the
-- app can render cards without re-fetching every item.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. Avatars storage bucket ──────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- Public read of avatar objects.
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- A signed-in user may insert/update/delete only inside their own folder:
--   avatars/{auth.uid()}/profile-….jpg
drop policy if exists "avatars_owner_insert" on storage.objects;
create policy "avatars_owner_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_owner_update" on storage.objects;
create policy "avatars_owner_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_owner_delete" on storage.objects;
create policy "avatars_owner_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ─── 2. reading_progress ────────────────────────────────────────────────────
create table if not exists public.reading_progress (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  content_type  text not null check (content_type in ('book','poem','article','scenario')),
  content_id    text not null,
  title         text,
  cover_url     text,
  author        text,
  position      double precision not null default 0,   -- 0..1 progress ratio (or page idx)
  progress      double precision not null default 0,   -- 0..1 percent read
  finished      boolean not null default false,
  updated_at    timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  unique (user_id, content_type, content_id)
);

alter table public.reading_progress enable row level security;

drop policy if exists "reading_progress_owner_all" on public.reading_progress;
create policy "reading_progress_owner_all"
  on public.reading_progress for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists reading_progress_user_idx
  on public.reading_progress (user_id, updated_at desc);

-- ─── 3. planned_reads ("Tez orada o'qiyman") ────────────────────────────────
create table if not exists public.planned_reads (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  content_type  text not null check (content_type in ('book','poem','article','scenario')),
  content_id    text not null,
  title         text,
  cover_url     text,
  author        text,
  created_at    timestamptz not null default now(),
  unique (user_id, content_type, content_id)
);

alter table public.planned_reads enable row level security;

drop policy if exists "planned_reads_owner_all" on public.planned_reads;
create policy "planned_reads_owner_all"
  on public.planned_reads for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists planned_reads_user_idx
  on public.planned_reads (user_id, created_at desc);
