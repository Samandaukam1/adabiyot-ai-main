-- ============================================================================
-- Universal share links — public resolver + share log
-- Run in Supabase SQL Editor (project ref: jrwtggbxveficgglccxq).
-- Safe to re-run (idempotent).
--
-- Shared links always carry the PUBLIC web URL:
--   https://adabiyotx.uz/book/{id}     https://adabiyotx.uz/reels/{id}
--   https://adabiyotx.uz/sozlab/{id}   https://adabiyotx.uz/profile/{username|id}
--
-- Creates:
--   resolve_public_share_link(p_type, p_key)  → route + target id for a link
--   share_link_events                          → who shared what (analytics)
--   log_share_link(p_type, p_key, p_channel)   → best-effort insert
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Resolver — turns a shared key into a route the app/web can open.
--    `profile` accepts either a @username or the raw profile id; everything
--    else passes its id straight through after checking the row is public.
--    SECURITY DEFINER so an anonymous visitor can resolve a username even when
--    RLS hides the profile row itself (only id/username/route leave the fn).
-- ─────────────────────────────────────────────────────────────────────────────
-- Dropped first: a `create or replace` can never change the OUT-parameter row
-- type, so re-running this file over an older resolver would fail with
-- "cannot change return type of existing function" (42P13).
drop function if exists public.resolve_public_share_link(text, text);

create function public.resolve_public_share_link(
  p_type text,
  p_key  text
)
returns table (target_type text, target_id text, route text, found boolean)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_type text := lower(coalesce(p_type, ''));
  v_key  text := btrim(coalesce(p_key, ''));
  v_id   text;
begin
  v_key := regexp_replace(v_key, '^@', '');
  if v_key = '' then
    return query select v_type, null::text, null::text, false;
    return;
  end if;

  if v_type in ('profile', 'user', 'u') then
    -- uuid → the profile id itself, otherwise look the @username up.
    if v_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      select p.id::text into v_id from public.profiles p where p.id = v_key::uuid;
    else
      select p.id::text into v_id from public.profiles p
       where lower(p.username) = lower(v_key)
       limit 1;
    end if;
    return query
      select 'profile'::text,
             v_id,
             case when v_id is null then null else '/profile/' || v_key end,
             v_id is not null;
    return;
  end if;

  if v_type in ('reel', 'reels') then
    select r.id::text into v_id from public.reels r
     where r.id::text = v_key
       and coalesce(r.status, 'approved') = 'approved'
       and coalesce(r.is_published, true) = true;
    return query select 'reel'::text, v_id,
                        case when v_id is null then null else '/reels/' || v_id end,
                        v_id is not null;
    return;
  end if;

  if v_type in ('sozlab', 'post', 'sozlab_post') then
    select s.id::text into v_id from public.sozlab_posts s
     where s.id::text = v_key
       and coalesce(s.is_deleted, false) = false
       and coalesce(s.status, 'published') <> 'deleted';
    return query select 'sozlab'::text, v_id,
                        case when v_id is null then null else '/sozlab/' || v_id end,
                        v_id is not null;
    return;
  end if;

  if v_type = 'book' then
    select b.id::text into v_id from public.books b
     where b.id::text = v_key and coalesce(b.status, 'published') = 'published';
    return query select 'book'::text, v_id,
                        case when v_id is null then null else '/book/' || v_id end,
                        v_id is not null;
    return;
  end if;

  -- poem / article / screenplay / … — no public status column guarantee here,
  -- so the route is handed back as-is and the screen decides what to show.
  return query select v_type, v_key, '/' || v_type || '/' || v_key, true;
end $$;

grant execute on function public.resolve_public_share_link(text, text) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Share log — one row per share tap (analytics; never blocks the share).
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.share_link_events (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references public.profiles(id) on delete set null,
  target_type  text not null,
  target_key   text not null,
  channel      text,
  created_at   timestamptz not null default now()
);
create index if not exists share_link_events_target_idx
  on public.share_link_events(target_type, target_key, created_at desc);

alter table public.share_link_events enable row level security;

-- Anyone may record a share; only the sharer can read their own rows back.
drop policy if exists share_link_events_insert on public.share_link_events;
create policy share_link_events_insert on public.share_link_events
  for insert with check (user_id is null or auth.uid() = user_id);
drop policy if exists share_link_events_select_own on public.share_link_events;
create policy share_link_events_select_own on public.share_link_events
  for select using (auth.uid() = user_id);

-- Same reason as above — an older signature would block the replace.
drop function if exists public.log_share_link(text, text, text);

create function public.log_share_link(
  p_type    text,
  p_key     text,
  p_channel text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.share_link_events(user_id, target_type, target_key, channel)
  values (auth.uid(), lower(coalesce(p_type, 'unknown')), coalesce(p_key, ''), p_channel);
exception when others then
  -- Analytics must never break sharing.
  return;
end $$;

grant execute on function public.log_share_link(text, text, text) to anon, authenticated;

-- ============================================================================
-- End of migration.
-- ============================================================================
