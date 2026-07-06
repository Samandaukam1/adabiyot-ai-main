create extension if not exists pgcrypto;

create table if not exists public.sozlab_posts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  author_id uuid references auth.users(id) on delete set null,
  display_name text not null default 'So''zLab foydalanuvchisi',
  type text not null default 'thought',
  target_kind text not null,
  target_id text,
  target_title text not null,
  target_author text,
  body text not null,
  improved_body text,
  improvement_model text,
  status text not null default 'published',
  likes_count integer not null default 0,
  comments_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  constraint sozlab_posts_type_check
    check (type in ('thought', 'quote', 'review', 'discussion')),
  constraint sozlab_posts_target_kind_check
    check (target_kind in ('book', 'poem', 'screenplay', 'other')),
  constraint sozlab_posts_status_check
    check (status in ('published', 'hidden', 'deleted')),
  constraint sozlab_posts_body_length_check
    check (char_length(btrim(body)) between 1 and 4000),
  constraint sozlab_posts_target_title_length_check
    check (char_length(btrim(target_title)) between 1 and 220),
  constraint sozlab_posts_counts_check
    check (likes_count >= 0 and comments_count >= 0)
);

create table if not exists public.sozlab_comments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  post_id uuid not null references public.sozlab_posts(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  display_name text not null default 'So''zLab foydalanuvchisi',
  body text not null,
  status text not null default 'published',
  constraint sozlab_comments_status_check
    check (status in ('published', 'hidden', 'deleted')),
  constraint sozlab_comments_body_length_check
    check (char_length(btrim(body)) between 1 and 2000)
);

create index if not exists sozlab_posts_created_at_idx
  on public.sozlab_posts (created_at desc)
  where status = 'published';

create index if not exists sozlab_posts_target_idx
  on public.sozlab_posts (target_kind, target_id)
  where status = 'published';

create index if not exists sozlab_comments_post_id_idx
  on public.sozlab_comments (post_id, created_at);

create or replace function public.set_sozlab_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_sozlab_posts_updated_at on public.sozlab_posts;
create trigger set_sozlab_posts_updated_at
before update on public.sozlab_posts
for each row execute function public.set_sozlab_updated_at();

create or replace function public.refresh_sozlab_comments_count()
returns trigger
language plpgsql
as $$
declare
  target_post_id uuid;
begin
  target_post_id = coalesce(new.post_id, old.post_id);

  update public.sozlab_posts
  set comments_count = (
    select count(*)::integer
    from public.sozlab_comments
    where post_id = target_post_id and status = 'published'
  )
  where id = target_post_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists refresh_sozlab_comments_count_insert on public.sozlab_comments;
create trigger refresh_sozlab_comments_count_insert
after insert on public.sozlab_comments
for each row execute function public.refresh_sozlab_comments_count();

drop trigger if exists refresh_sozlab_comments_count_update on public.sozlab_comments;
create trigger refresh_sozlab_comments_count_update
after update of status on public.sozlab_comments
for each row execute function public.refresh_sozlab_comments_count();

drop trigger if exists refresh_sozlab_comments_count_delete on public.sozlab_comments;
create trigger refresh_sozlab_comments_count_delete
after delete on public.sozlab_comments
for each row execute function public.refresh_sozlab_comments_count();

alter table public.sozlab_posts enable row level security;
alter table public.sozlab_comments enable row level security;

drop policy if exists "SozLab published posts are readable" on public.sozlab_posts;
create policy "SozLab published posts are readable"
on public.sozlab_posts
for select
using (status = 'published');

drop policy if exists "SozLab posts can be created" on public.sozlab_posts;
create policy "SozLab posts can be created"
on public.sozlab_posts
for insert
with check (
  status = 'published'
  and (author_id is null or author_id = auth.uid())
);

drop policy if exists "SozLab authors can update own posts" on public.sozlab_posts;
create policy "SozLab authors can update own posts"
on public.sozlab_posts
for update
using (author_id = auth.uid())
with check (author_id = auth.uid());

drop policy if exists "SozLab authors can delete own posts" on public.sozlab_posts;
create policy "SozLab authors can delete own posts"
on public.sozlab_posts
for delete
using (author_id = auth.uid());

drop policy if exists "SozLab published comments are readable" on public.sozlab_comments;
create policy "SozLab published comments are readable"
on public.sozlab_comments
for select
using (status = 'published');

drop policy if exists "SozLab comments can be created" on public.sozlab_comments;
create policy "SozLab comments can be created"
on public.sozlab_comments
for insert
with check (
  status = 'published'
  and (author_id is null or author_id = auth.uid())
);

drop policy if exists "SozLab comment authors can update own comments" on public.sozlab_comments;
create policy "SozLab comment authors can update own comments"
on public.sozlab_comments
for update
using (author_id = auth.uid())
with check (author_id = auth.uid());

drop policy if exists "SozLab comment authors can delete own comments" on public.sozlab_comments;
create policy "SozLab comment authors can delete own comments"
on public.sozlab_comments
for delete
using (author_id = auth.uid());
