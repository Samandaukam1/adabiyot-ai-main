-- ════════════════════════════════════════════════════════════════════════════
-- AdabiyotX — profiles.username (unique public @handle) + RPCs
-- ════════════════════════════════════════════════════════════════════════════
-- Idempotent. Apply in the Supabase SQL editor (or `supabase db push`).
--
-- The user picks a unique username in the app. It is:
--   • shown in the UI with a leading "@"
--   • stored in profiles.username WITHOUT the "@", always lowercase, no spaces
--   • restricted to letters, digits, underscore, hyphen and dot; must START
--     with a letter or digit; 2–40 chars
--   • globally unique (case-insensitive)
--
-- SCHEMA NOTE: the column + format check + unique index below are defined to be
-- BYTE-IDENTICAL to the admin repo's
-- `supabase/author-username-link-migration.sql`, so applying either or both (in
-- any order) is safe. This migration additionally owns the RPCs the mobile app
-- calls to claim / probe a username (the admin repo doesn't need them).
--
-- The admin panel finds a login account by this @username and links it to an
-- author (profiles.author_id + account_type='author'), which turns the account
-- into a "Muallif akkaunti" in the mobile app.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. The column ──────────────────────────────────────────────────────────
alter table public.profiles add column if not exists username text;

comment on column public.profiles.username is
  'Unique public @handle (stored lowercase, no @). Chars: a-z 0-9 . _ - ; starts alphanumeric.';

-- Normalize any pre-existing values (strip leading "@", drop spaces, lowercase)
-- so the constraint can be added safely.
update public.profiles
  set username = lower(regexp_replace(regexp_replace(username, '^@+', ''), '\s+', '', 'g'))
  where username is not null
    and username <> lower(regexp_replace(regexp_replace(username, '^@+', ''), '\s+', '', 'g'));

-- Blank out anything that still can't satisfy the format check (legacy junk).
update public.profiles
  set username = null
  where username is not null
    and username !~ '^[a-z0-9][a-z0-9._-]{1,39}$';

-- ─── 2. Format guard + case-insensitive uniqueness ──────────────────────────
alter table public.profiles drop constraint if exists profiles_username_format_check;
alter table public.profiles add constraint profiles_username_format_check
  check (username is null or username ~ '^[a-z0-9][a-z0-9._-]{1,39}$');

create unique index if not exists profiles_username_unique_idx
  on public.profiles (lower(username))
  where username is not null;

-- ─── 3. Normalize helper (strip leading @, spaces, lowercase) ───────────────
create or replace function public.normalize_username(p_username text)
returns text
language sql
immutable
as $$
  select lower(regexp_replace(regexp_replace(btrim(coalesce(p_username, '')), '^@+', ''), '\s+', '', 'g'));
$$;

-- ─── 4. Availability probe ──────────────────────────────────────────────────
-- Returns true when the (normalized) username is well-formed AND free for the
-- caller. Runs as DEFINER so a signed-in user can check names they cannot read
-- directly under profiles RLS. The caller's own current username counts as free.
create or replace function public.is_username_available(p_username text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_norm text := public.normalize_username(p_username);
begin
  if v_norm !~ '^[a-z0-9][a-z0-9._-]{1,39}$' then
    return false;
  end if;
  return not exists (
    select 1
    from public.profiles
    where lower(username) = v_norm
      and id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
  );
end;
$$;

-- ─── 5. Claim / change / clear the caller's username ────────────────────────
-- Returns the saved (normalized) username, or null when cleared. Raises a
-- friendly, machine-readable error for the app to surface:
--   AUTH_REQUIRED / USERNAME_INVALID / USERNAME_TAKEN.
create or replace function public.set_username(p_username text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_norm text := public.normalize_username(p_username);
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using message = 'Avval tizimga kiring';
  end if;

  -- Empty input clears the username.
  if v_norm = '' then
    update public.profiles set username = null, updated_at = now() where id = v_uid;
    return null;
  end if;

  if v_norm !~ '^[a-z0-9][a-z0-9._-]{1,39}$' then
    raise exception 'USERNAME_INVALID'
      using message = 'Harf yoki raqam bilan boshlansin. Faqat harf, raqam, _, - va . (2-40 belgi)';
  end if;

  if exists (
    select 1 from public.profiles
    where lower(username) = v_norm and id <> v_uid
  ) then
    raise exception 'USERNAME_TAKEN' using message = 'Bu username band';
  end if;

  update public.profiles set username = v_norm, updated_at = now() where id = v_uid;
  return v_norm;
exception
  -- Lost race against the unique index → report as taken, not a raw 23505.
  when unique_violation then
    raise exception 'USERNAME_TAKEN' using message = 'Bu username band';
  -- DB format constraint rejected it → friendly invalid message.
  when check_violation then
    raise exception 'USERNAME_INVALID'
      using message = 'Harf yoki raqam bilan boshlansin. Faqat harf, raqam, _, - va . (2-40 belgi)';
end;
$$;

grant execute on function public.normalize_username(text)   to anon, authenticated;
grant execute on function public.is_username_available(text) to anon, authenticated;
grant execute on function public.set_username(text)          to authenticated;
