-- Reels comment system: likes, mentions, attachments + reel_comments columns.
-- Instagram-style comments for AdabiyotX reels. Idempotent — safe to re-run.
-- Does NOT touch the existing reel_comments insert/select behaviour (comments
-- already work); only ADDS columns + new side tables + their RLS.

-- ── 1) Extend reel_comments ────────────────────────────────────────────────
alter table if exists public.reel_comments
  add column if not exists parent_id uuid references public.reel_comments(id) on delete cascade,
  add column if not exists like_count int not null default 0,
  add column if not exists reply_count int not null default 0,
  add column if not exists is_deleted boolean not null default false,
  add column if not exists linked_content_type text,
  add column if not exists linked_content_id text,
  add column if not exists linked_content_title text,
  add column if not exists linked_content_cover_url text,
  add column if not exists linked_content_author text,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists reel_comments_reel_idx on public.reel_comments(reel_id);
create index if not exists reel_comments_parent_idx on public.reel_comments(parent_id);

-- ── 2) reel_comment_likes ──────────────────────────────────────────────────
create table if not exists public.reel_comment_likes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.reel_comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (comment_id, user_id)
);
create index if not exists reel_comment_likes_comment_idx on public.reel_comment_likes(comment_id);

-- ── 3) reel_comment_mentions ───────────────────────────────────────────────
create table if not exists public.reel_comment_mentions (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.reel_comments(id) on delete cascade,
  mentioned_user_id uuid not null references public.profiles(id) on delete cascade,
  username text,
  created_at timestamptz not null default now()
);

-- ── 4) reel_comment_attachments (optional; the app also stores the attachment
--       inline on reel_comments.linked_content_* for a single-row read) ──────
create table if not exists public.reel_comment_attachments (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.reel_comments(id) on delete cascade,
  content_type text not null,
  content_id text not null,
  title text,
  cover_url text,
  author text,
  created_at timestamptz not null default now()
);

-- ── RLS ────────────────────────────────────────────────────────────────────
alter table public.reel_comment_likes enable row level security;
alter table public.reel_comment_mentions enable row level security;
alter table public.reel_comment_attachments enable row level security;

-- Likes: readable by everyone; a user may add/remove ONLY their own like.
drop policy if exists reel_comment_likes_select on public.reel_comment_likes;
create policy reel_comment_likes_select on public.reel_comment_likes for select using (true);
drop policy if exists reel_comment_likes_insert on public.reel_comment_likes;
create policy reel_comment_likes_insert on public.reel_comment_likes for insert with check (auth.uid() = user_id);
drop policy if exists reel_comment_likes_delete on public.reel_comment_likes;
create policy reel_comment_likes_delete on public.reel_comment_likes for delete using (auth.uid() = user_id);

-- Mentions + attachments: readable by everyone; insert by authenticated users.
drop policy if exists reel_comment_mentions_select on public.reel_comment_mentions;
create policy reel_comment_mentions_select on public.reel_comment_mentions for select using (true);
drop policy if exists reel_comment_mentions_insert on public.reel_comment_mentions;
create policy reel_comment_mentions_insert on public.reel_comment_mentions for insert with check (auth.role() = 'authenticated');

drop policy if exists reel_comment_attachments_select on public.reel_comment_attachments;
create policy reel_comment_attachments_select on public.reel_comment_attachments for select using (true);
drop policy if exists reel_comment_attachments_insert on public.reel_comment_attachments;
create policy reel_comment_attachments_insert on public.reel_comment_attachments for insert with check (auth.role() = 'authenticated');

-- ── like_count / reply_count maintenance ───────────────────────────────────
create or replace function public.reel_comment_like_count() returns trigger
  language plpgsql security definer as $$
begin
  if (tg_op = 'INSERT') then
    update public.reel_comments set like_count = like_count + 1 where id = new.comment_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.reel_comments set like_count = greatest(0, like_count - 1) where id = old.comment_id;
    return old;
  end if;
  return null;
end; $$;
drop trigger if exists reel_comment_like_count_trg on public.reel_comment_likes;
create trigger reel_comment_like_count_trg
  after insert or delete on public.reel_comment_likes
  for each row execute function public.reel_comment_like_count();

create or replace function public.reel_comment_reply_count() returns trigger
  language plpgsql security definer as $$
begin
  if (tg_op = 'INSERT' and new.parent_id is not null) then
    update public.reel_comments set reply_count = reply_count + 1 where id = new.parent_id;
  elsif (tg_op = 'DELETE' and old.parent_id is not null) then
    update public.reel_comments set reply_count = greatest(0, reply_count - 1) where id = old.parent_id;
  end if;
  return null;
end; $$;
drop trigger if exists reel_comment_reply_count_trg on public.reel_comments;
create trigger reel_comment_reply_count_trg
  after insert or delete on public.reel_comments
  for each row execute function public.reel_comment_reply_count();
