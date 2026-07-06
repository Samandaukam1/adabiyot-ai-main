-- AdabiyotX So'zLab — post edit / soft-delete / report support.
--
-- Adds edit + soft-delete + moderation columns to sozlab_posts, a reports
-- table, and permissive anon policies (the mobile app is anonymous).

-- 1) Edit / soft-delete / moderation columns ------------------------------
alter table public.sozlab_posts
  add column if not exists is_edited boolean not null default false,
  add column if not exists edited_at timestamptz,
  add column if not exists is_deleted boolean not null default false,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid,
  add column if not exists reports_count integer not null default 0,
  add column if not exists moderation_status text not null default 'active';

-- 2) Allow the anonymous app to update its posts (edit + soft-delete) ------
grant update on public.sozlab_posts to anon, authenticated;
drop policy if exists "SozLab public can update" on public.sozlab_posts;
create policy "SozLab public can update"
on public.sozlab_posts
for update
to anon, authenticated
using (user_id is null or user_id = auth.uid())
with check (user_id is null or user_id = auth.uid());

-- 3) Reports table --------------------------------------------------------
create table if not exists public.sozlab_post_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  post_id uuid not null references public.sozlab_posts(id) on delete cascade,
  reporter_user_id uuid,
  reported_user_id uuid,
  reason text not null check (reason in (
    'spam', 'offensive', 'violence', 'hate', 'adult', 'copyright', 'false_info', 'other'
  )),
  description text,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'dismissed', 'actioned'))
);

create index if not exists sozlab_post_reports_post_idx on public.sozlab_post_reports (post_id);

alter table public.sozlab_post_reports enable row level security;

grant insert on public.sozlab_post_reports to anon, authenticated;
drop policy if exists "SozLab public can report" on public.sozlab_post_reports;
create policy "SozLab public can report"
on public.sozlab_post_reports
for insert
to anon, authenticated
with check (
  status = 'pending'
  and (reporter_user_id is null or reporter_user_id = auth.uid())
);

-- 4) Mobile read view (excludes soft-deleted posts) -----------------------
drop view if exists public.mobile_sozlab_posts;
create view public.mobile_sozlab_posts
  with (security_invoker = true) as
select
  id, user_id, title, content, post_type, status,
  improved_content, image_url,
  attached_content_id, attached_content_type, attached_content_title,
  attached_content_cover_url, attached_content_author,
  is_edited, edited_at, reports_count, moderation_status,
  likes_count, comments_count, created_at, updated_at
from public.sozlab_posts
where status = 'published' and is_deleted = false;

grant select on public.mobile_sozlab_posts to anon, authenticated;
