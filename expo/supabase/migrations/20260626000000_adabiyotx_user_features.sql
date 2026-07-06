-- ============================================================================
-- AdabiyotX user-app features migration
-- Run in Supabase SQL Editor (project ref: jrwtggbxveficgglccxq).
-- Safe to re-run (idempotent). Order matters: this file is self-contained.
--
-- Creates / normalizes:
--   notifications (+ mobile_my_notifications view + mark_notification_read RPC
--                  + unread_notifications_count RPC)
--   sozlab_comments (normalize) + mobile_sozlab_comments view
--   sozlab_mentions
--   user_follows (+ notify triggers)
--   creator_content_submissions
--   content_reviews + mobile_content_reviews view + content_review_stats view
--   sozlab_posts: attached_content_metadata / post_source / review_id columns
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 0) sozlab_posts: extra columns used by the content-review mirror
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.sozlab_posts add column if not exists attached_content_metadata jsonb;
alter table public.sozlab_posts add column if not exists post_source text;     -- e.g. 'content_review'
alter table public.sozlab_posts add column if not exists review_id uuid;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) sozlab_comments — normalize structure so every row owns its author
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.sozlab_comments add column if not exists user_id uuid references public.profiles(id) on delete set null;
alter table public.sozlab_comments add column if not exists parent_comment_id uuid references public.sozlab_comments(id) on delete cascade;
alter table public.sozlab_comments add column if not exists content text;
alter table public.sozlab_comments add column if not exists status text not null default 'published';
alter table public.sozlab_comments add column if not exists is_edited boolean not null default false;
alter table public.sozlab_comments add column if not exists is_deleted boolean not null default false;
alter table public.sozlab_comments add column if not exists created_at timestamptz not null default now();

-- Carry legacy values forward when present (columns are optional — check first).
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='sozlab_comments' and column_name='body') then
    update public.sozlab_comments set content = body where content is null and body is not null;
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='sozlab_comments' and column_name='author_id') then
    update public.sozlab_comments set user_id = author_id where user_id is null and author_id is not null;
  end if;
end $$;

create index if not exists sozlab_comments_post_idx   on public.sozlab_comments(post_id, created_at);
create index if not exists sozlab_comments_parent_idx on public.sozlab_comments(parent_comment_id);
create index if not exists sozlab_comments_user_idx   on public.sozlab_comments(user_id);

-- Author identity is joined per-row by user_id → never inherits parent/post author.
drop view if exists public.mobile_sozlab_comments;
create view public.mobile_sozlab_comments
with (security_invoker = true) as
select
  c.id,
  c.post_id,
  c.parent_comment_id,
  c.user_id,
  c.content,
  c.status,
  c.is_edited,
  c.is_deleted,
  c.created_at,
  coalesce(p.pen_name, p.display_name, p.full_name) as author_name,
  p.pen_name,
  p.display_name,
  p.full_name,
  p.avatar_url                                       as author_avatar_url,
  p.provider_avatar_url,
  p.verification_type                                as author_verification_type
from public.sozlab_comments c
left join public.profiles p on p.id = c.user_id
where coalesce(c.is_deleted, false) = false
  and coalesce(c.status, 'published') <> 'deleted';

alter table public.sozlab_comments enable row level security;
drop policy if exists sozlab_comments_select on public.sozlab_comments;
create policy sozlab_comments_select on public.sozlab_comments for select using (true);
drop policy if exists sozlab_comments_insert on public.sozlab_comments;
create policy sozlab_comments_insert on public.sozlab_comments for insert with check (auth.uid() = user_id);
drop policy if exists sozlab_comments_update on public.sozlab_comments;
create policy sozlab_comments_update on public.sozlab_comments
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select on public.mobile_sozlab_comments to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) notifications
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.notifications (
  id                uuid primary key default gen_random_uuid(),
  recipient_id      uuid not null references public.profiles(id) on delete cascade,
  actor_user_id     uuid references public.profiles(id) on delete set null,
  notification_type text not null check (notification_type in
                      ('mention','comment_reply','new_follower','new_content','rating','system')),
  title             text,
  body              text,
  target_type       text,   -- 'sozlab_post' | 'sozlab_comment' | 'content' | 'profile'
  target_post_id    uuid,
  target_comment_id uuid,
  content_type      text,   -- for new_content/rating: book|poem|article|script|...
  content_id        text,   -- text: supports both uuid + mock ids
  metadata          jsonb,
  is_read           boolean not null default false,
  created_at        timestamptz not null default now()
);
create index if not exists notifications_recipient_idx on public.notifications(recipient_id, is_read, created_at desc);

alter table public.notifications enable row level security;
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select using (auth.uid() = recipient_id);
drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications
  for update using (auth.uid() = recipient_id) with check (auth.uid() = recipient_id);
-- App creates mention/reply notifications directly (actor must be the caller).
drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert on public.notifications for insert with check (auth.uid() = actor_user_id);

-- Per-user feed (filtered to the caller) with actor identity joined.
drop view if exists public.mobile_my_notifications;
create view public.mobile_my_notifications
with (security_invoker = true) as
select
  n.id, n.recipient_id, n.actor_user_id, n.notification_type, n.title, n.body,
  n.target_type, n.target_post_id, n.target_comment_id, n.content_type, n.content_id,
  n.metadata, n.is_read, n.created_at,
  coalesce(ap.pen_name, ap.display_name, ap.full_name) as actor_name,
  ap.avatar_url        as actor_avatar_url,
  ap.verification_type as actor_verification_type
from public.notifications n
left join public.profiles ap on ap.id = n.actor_user_id
where n.recipient_id = auth.uid();

grant select on public.mobile_my_notifications to authenticated;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.notifications set is_read = true
  where id = p_notification_id and recipient_id = auth.uid();
$$;

create or replace function public.mark_all_notifications_read()
returns void language sql security definer set search_path = public as $$
  update public.notifications set is_read = true
  where recipient_id = auth.uid() and is_read = false;
$$;

create or replace function public.unread_notifications_count()
returns integer language sql security definer set search_path = public as $$
  select count(*)::int from public.notifications
  where recipient_id = auth.uid() and is_read = false;
$$;

grant execute on function public.mark_notification_read(uuid)     to authenticated;
grant execute on function public.mark_all_notifications_read()    to authenticated;
grant execute on function public.unread_notifications_count()     to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) sozlab_mentions
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.sozlab_mentions (
  id                uuid primary key default gen_random_uuid(),
  mentioned_user_id uuid not null references public.profiles(id) on delete cascade,
  mentioner_user_id uuid not null references public.profiles(id) on delete cascade,
  post_id           uuid,
  comment_id        uuid,
  mention_text      text,
  created_at        timestamptz not null default now()
);
create index if not exists sozlab_mentions_user_idx on public.sozlab_mentions(mentioned_user_id, created_at desc);

alter table public.sozlab_mentions enable row level security;
drop policy if exists sozlab_mentions_select on public.sozlab_mentions;
create policy sozlab_mentions_select on public.sozlab_mentions
  for select using (auth.uid() = mentioned_user_id or auth.uid() = mentioner_user_id);
drop policy if exists sozlab_mentions_insert on public.sozlab_mentions;
create policy sozlab_mentions_insert on public.sozlab_mentions
  for insert with check (auth.uid() = mentioner_user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) user_follows (+ notify triggers)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.user_follows (
  follower_id  uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
create index if not exists user_follows_following_idx on public.user_follows(following_id);

alter table public.user_follows enable row level security;
drop policy if exists user_follows_select on public.user_follows;
create policy user_follows_select on public.user_follows for select using (true);
drop policy if exists user_follows_write on public.user_follows;
create policy user_follows_write on public.user_follows
  for all using (auth.uid() = follower_id) with check (auth.uid() = follower_id);

-- New follower → notify the followed user.
-- All trigger functions below are wrapped so a notification failure can NEVER
-- abort the underlying insert (posting / following / publishing must not break).
-- Column access goes through to_jsonb(new) so a missing column yields NULL
-- instead of a runtime "record has no field" error across schema variants.
create or replace function public.notify_new_follower()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications(recipient_id, actor_user_id, notification_type, title, target_type, target_post_id, metadata)
  values (new.following_id, new.follower_id, 'new_follower', 'Sizni kuzatishni boshlashdi', 'profile', null,
          jsonb_build_object('follower_id', new.follower_id));
  return new;
exception when others then
  return new;
end $$;
drop trigger if exists trg_notify_new_follower on public.user_follows;
create trigger trg_notify_new_follower after insert on public.user_follows
  for each row execute function public.notify_new_follower();

-- Followed user publishes a new So'zLab post → notify followers.
create or replace function public.notify_followers_new_post()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  j           jsonb := to_jsonb(new);
  poster      uuid  := nullif(j->>'user_id', '')::uuid;
  post_status text  := coalesce(j->>'status', 'published');
  post_text   text  := coalesce(j->>'content', j->>'body', '');
  post_id     uuid  := nullif(j->>'id', '')::uuid;
begin
  if post_status <> 'published' then return new; end if;
  if poster is null then return new; end if;
  insert into public.notifications(recipient_id, actor_user_id, notification_type, title, body, target_type, target_post_id)
  select f.follower_id, poster, 'new_content', 'Yangi ijod joylandi',
         left(post_text, 140), 'sozlab_post', post_id
  from public.user_follows f
  where f.following_id = poster;
  return new;
exception when others then
  return new;
end $$;
drop trigger if exists trg_notify_followers_new_post on public.sozlab_posts;
create trigger trg_notify_followers_new_post after insert on public.sozlab_posts
  for each row execute function public.notify_followers_new_post();

-- Helper: when a content row becomes published, notify followers of the author
-- (best-effort author→profile match by name).
create or replace function public.notify_followers_new_content(
  p_title text, p_author text, p_content_type text, p_content_id text)
returns void language plpgsql security definer set search_path = public as $$
declare author_profile uuid;
begin
  if p_author is null then return; end if;
  select id into author_profile from public.profiles
   where coalesce(pen_name, display_name, full_name) = p_author limit 1;
  if author_profile is null then return; end if;
  insert into public.notifications(recipient_id, actor_user_id, notification_type, title, body, target_type, content_type, content_id)
  select f.follower_id, author_profile, 'new_content', 'Yangi ijod joylandi', p_title, 'content', p_content_type, p_content_id
  from public.user_follows f where f.following_id = author_profile;
exception when others then
  return;
end $$;

create or replace function public.notify_new_book_published()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  j          jsonb := to_jsonb(new);
  new_status text  := j->>'status';
  old_status text  := case when tg_op = 'UPDATE' then (to_jsonb(old))->>'status' else null end;
begin
  if new_status = 'published' and (tg_op = 'INSERT' or old_status is distinct from 'published') then
    perform public.notify_followers_new_content(j->>'title', j->>'author', 'book', j->>'id');
  end if;
  return new;
exception when others then
  return new;
end $$;
drop trigger if exists trg_notify_new_book on public.books;
create trigger trg_notify_new_book after insert or update of status on public.books
  for each row execute function public.notify_new_book_published();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) creator_content_submissions (poem → monolog / reel / video)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.creator_content_submissions (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles(id) on delete cascade,
  media_type         text not null default 'monologue' check (media_type in ('monologue','reel','video')),
  base_content_type  text,    -- 'poem' etc.
  base_content_id    text,
  base_content_title text,
  title              text,
  description        text,
  media_url          text,
  thumbnail_url      text,
  status             text not null default 'pending'
                       check (status in ('pending','approved','rejected','revision_required','archived')),
  rejection_reason   text,
  reviewed_by        uuid,
  reviewed_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists creator_content_user_idx    on public.creator_content_submissions(user_id, status);
create index if not exists creator_content_base_idx     on public.creator_content_submissions(base_content_type, base_content_id, status);

alter table public.creator_content_submissions enable row level security;
drop policy if exists creator_content_insert on public.creator_content_submissions;
create policy creator_content_insert on public.creator_content_submissions
  for insert with check (auth.uid() = user_id);
drop policy if exists creator_content_select_own on public.creator_content_submissions;
create policy creator_content_select_own on public.creator_content_submissions
  for select using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6) content_reviews (5-star + comment) + views
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.content_reviews (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles(id) on delete cascade,
  content_type      text not null check (content_type in
                      ('book','poem','article','script','story','tale','guide','novel')),
  content_id        text not null,
  content_title     text,
  content_author    text,
  content_cover_url text,
  rating            int  not null check (rating between 1 and 5),
  comment           text,
  sozlab_post_id    uuid references public.sozlab_posts(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, content_type, content_id)
);
create index if not exists content_reviews_content_idx on public.content_reviews(content_type, content_id);

alter table public.content_reviews enable row level security;
drop policy if exists content_reviews_select on public.content_reviews;
create policy content_reviews_select on public.content_reviews for select using (true);
drop policy if exists content_reviews_write on public.content_reviews;
create policy content_reviews_write on public.content_reviews
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop view if exists public.mobile_content_reviews;
create view public.mobile_content_reviews
with (security_invoker = true) as
select
  r.id, r.user_id, r.content_type, r.content_id, r.content_title, r.content_author,
  r.content_cover_url, r.rating, r.comment, r.sozlab_post_id, r.created_at, r.updated_at,
  coalesce(p.pen_name, p.display_name, p.full_name) as reviewer_name,
  p.avatar_url        as reviewer_avatar_url,
  p.verification_type as reviewer_verification_type
from public.content_reviews r
left join public.profiles p on p.id = r.user_id;

drop view if exists public.content_review_stats;
create view public.content_review_stats as
select content_type, content_id,
       round(avg(rating)::numeric, 2) as avg_rating,
       count(*)                       as reviews_count
from public.content_reviews
group by content_type, content_id;

grant select on public.mobile_content_reviews to anon, authenticated;
grant select on public.content_review_stats   to anon, authenticated;

-- ============================================================================
-- End of migration.
-- ============================================================================
