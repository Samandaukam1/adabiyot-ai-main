-- Review-mode feature flags + account deletion requests.
--
-- Two independent things the App Store / Play Market review pass needs:
--   1. `app_feature_flags` — key/value switches the admin panel toggles and the
--      user app only READS (anon + authenticated). Used to hide the Settings
--      "Tariflar" menu and to open every book for free during a review.
--   2. `account_deletion_requests` + `request_my_account_deletion(reason)` —
--      the in-app "Akkauntni o'chirish" request both stores require.
--
-- Idempotent: safe to re-run.

/* ────────────────────────  app_feature_flags  ────────────────────────── */

create table if not exists public.app_feature_flags (
  key text primary key,
  enabled boolean not null default false,
  description text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.app_feature_flags enable row level security;

-- Public read: the flags gate UI that must resolve before/without a session.
drop policy if exists "app_feature_flags_public_read" on public.app_feature_flags;
create policy "app_feature_flags_public_read"
  on public.app_feature_flags
  for select
  using (true);

-- No client-side write policies: only the admin panel (service role) mutates rows.

-- Defaults match the app-side fallbacks: tariffs visible, review mode off.
insert into public.app_feature_flags (key, enabled, description)
values
  ('tariffs_visible', true,
   'Sozlamalardagi "Tariflar / Mening tarifim / Mening xaridlarim" bo''limi ko''rinadi'),
  ('review_mode_free_books', false,
   'App Store / Play Market ko''rib chiqishi uchun barcha kitoblar bepul o''qiladi')
on conflict (key) do nothing;

-- Read-only accessor, so the app can fetch every flag in one round trip even if
-- table-level grants change later.
create or replace function public.get_app_feature_flags()
returns setof public.app_feature_flags
language sql
stable
security definer
set search_path = public
as $$
  select * from public.app_feature_flags;
$$;

grant execute on function public.get_app_feature_flags() to anon, authenticated;

/* ──────────────────  account_deletion_requests  ──────────────────────── */

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  email text,
  reason text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'completed')),
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  processed_by uuid,
  admin_note text,
  created_at timestamptz not null default now()
);

-- One open request per user — a repeat tap must not queue a second row.
create unique index if not exists account_deletion_requests_pending_uidx
  on public.account_deletion_requests (user_id)
  where status = 'pending';

create index if not exists account_deletion_requests_status_idx
  on public.account_deletion_requests (status, requested_at desc);

alter table public.account_deletion_requests enable row level security;

-- Users may read (only) their own requests, so Settings can show the status.
drop policy if exists "account_deletion_requests_own_read" on public.account_deletion_requests;
create policy "account_deletion_requests_own_read"
  on public.account_deletion_requests
  for select
  to authenticated
  using (user_id = auth.uid());

-- Inserts go through the RPC below (security definer), never straight from the
-- client, so `status` / `user_id` can never be spoofed.

create or replace function public.request_my_account_deletion(reason text default null)
returns public.account_deletion_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_row public.account_deletion_requests;
begin
  if v_user_id is null then
    raise exception 'Akkauntni o''chirish uchun avval akkauntga kiring'
      using errcode = '28000';
  end if;

  -- Already asked → return the open request instead of failing on the index.
  select * into v_row
  from public.account_deletion_requests
  where user_id = v_user_id and status = 'pending'
  limit 1;

  if found then
    return v_row;
  end if;

  select u.email into v_email from auth.users u where u.id = v_user_id;

  insert into public.account_deletion_requests (user_id, email, reason)
  values (v_user_id, v_email, nullif(btrim(reason), ''))
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.request_my_account_deletion(text) to authenticated;

-- Lets Settings show "so'rov yuborilgan" without a table read.
create or replace function public.get_my_account_deletion_request()
returns public.account_deletion_requests
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.account_deletion_requests
  where user_id = auth.uid()
  order by requested_at desc
  limit 1;
$$;

grant execute on function public.get_my_account_deletion_request() to authenticated;
