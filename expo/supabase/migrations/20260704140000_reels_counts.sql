-- Keep reels.likes_count / comments_count / saves_count / shares_count accurate
-- via triggers on reel_likes / reel_saves / reel_comments, plus a one-time
-- backfill. Idempotent. Uses the EXISTING plural column names the app already
-- reads. Does NOT touch upload/moderation.

-- Ensure the count columns exist (they usually already do).
alter table if exists public.reels
  add column if not exists likes_count int not null default 0,
  add column if not exists comments_count int not null default 0,
  add column if not exists saves_count int not null default 0,
  add column if not exists shares_count int not null default 0;

-- ── likes ──────────────────────────────────────────────────────────────────
create or replace function public.reels_likes_count() returns trigger
  language plpgsql security definer as $$
begin
  if tg_op = 'INSERT' then
    update public.reels set likes_count = likes_count + 1 where id = new.reel_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.reels set likes_count = greatest(0, likes_count - 1) where id = old.reel_id;
    return old;
  end if;
  return null;
end; $$;
drop trigger if exists reels_likes_count_trg on public.reel_likes;
create trigger reels_likes_count_trg after insert or delete on public.reel_likes
  for each row execute function public.reels_likes_count();

-- ── saves ──────────────────────────────────────────────────────────────────
create or replace function public.reels_saves_count() returns trigger
  language plpgsql security definer as $$
begin
  if tg_op = 'INSERT' then
    update public.reels set saves_count = saves_count + 1 where id = new.reel_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.reels set saves_count = greatest(0, saves_count - 1) where id = old.reel_id;
    return old;
  end if;
  return null;
end; $$;
drop trigger if exists reels_saves_count_trg on public.reel_saves;
create trigger reels_saves_count_trg after insert or delete on public.reel_saves
  for each row execute function public.reels_saves_count();

-- ── comments (counts every non-deleted comment, incl. replies) ─────────────
create or replace function public.reels_comments_count() returns trigger
  language plpgsql security definer as $$
begin
  if tg_op = 'INSERT' then
    update public.reels set comments_count = comments_count + 1 where id = new.reel_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.reels set comments_count = greatest(0, comments_count - 1) where id = old.reel_id;
    return old;
  end if;
  return null;
end; $$;
drop trigger if exists reels_comments_count_trg on public.reel_comments;
create trigger reels_comments_count_trg after insert or delete on public.reel_comments
  for each row execute function public.reels_comments_count();

-- ── one-time backfill from the real interaction tables ─────────────────────
update public.reels r set
  likes_count    = coalesce((select count(*) from public.reel_likes l where l.reel_id = r.id), 0),
  saves_count    = coalesce((select count(*) from public.reel_saves s where s.reel_id = r.id), 0),
  comments_count = coalesce((select count(*) from public.reel_comments c where c.reel_id = r.id and coalesce(c.is_deleted, false) = false), 0);
