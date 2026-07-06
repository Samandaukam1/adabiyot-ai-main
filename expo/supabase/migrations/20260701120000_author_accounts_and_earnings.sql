-- ════════════════════════════════════════════════════════════════════════════
-- AdabiyotX — Muallif (author) akkaunt + Daromadlar (earnings) tizimi
-- ════════════════════════════════════════════════════════════════════════════
-- Idempotent. Apply in the Supabase SQL editor (or `supabase db push`).
--
-- Admin panel links a reader profile to an `authors` row via
-- `profiles.author_id`. Once linked, the user app treats the account as a
-- "Muallif akkaunti": it can see its own works and a 50% earnings dashboard.
--
-- Creates / changes:
--   1. profiles.author_id            → links a login account to an author.
--   2. authors.is_verified           → "tasdiqlangan muallif" badge.
--      authors.encyclopedia_entry_id → link to Adiblar ensiklopediyasi entry.
--   3. author_earnings               → per-sale ledger (50% author share).
--   4. grant_author_earnings trigger → writes a ledger row when an order is paid.
--   5. Backfill for already-paid orders.
--   6. Owner-scoped read views (author only ever sees their OWN data):
--        mobile_my_author_profile       — linked author record for auth.uid()
--        mobile_my_author_works         — all works of the linked author
--        mobile_my_author_earnings      — sales history rows
--        mobile_my_author_earnings_summary — aggregate stat card numbers
--      Public author view (any reader):
--        mobile_authors_public          — published authors, safe fields only
--
-- NOTE on view security: the mobile_my_author_* views are plain (definer) views
-- owned by the migration role, so they can read `authors` / `author_earnings`
-- regardless of those tables' RLS. Each view SELF-FILTERS on `auth.uid()`, so a
-- signed-in user can only ever read rows tied to their own linked author.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. Link a login profile to an author record ────────────────────────────
alter table public.profiles
  add column if not exists author_id uuid references public.authors(id) on delete set null;

create index if not exists idx_profiles_author_id on public.profiles(author_id);

-- ─── 2. Author verification, image + bio columns (schema-drift safety) ──────
-- The live `authors` table has drifted across deployments (e.g. some are missing
-- `profile_image_url`). Add every column the views below read, idempotently, so
-- the migration always compiles regardless of the current authors shape. All are
-- nullable additive columns — no-op where they already exist.
alter table public.authors
  add column if not exists is_verified boolean not null default false;

alter table public.authors
  add column if not exists encyclopedia_entry_id uuid
    references public.adib_encyclopedia_entries(id) on delete set null;

alter table public.authors add column if not exists profile_image_url text;
alter table public.authors add column if not exists avatar_url        text;
alter table public.authors add column if not exists profession        text;
alter table public.authors add column if not exists short_bio         text;
alter table public.authors add column if not exists biography         text;
alter table public.authors add column if not exists quote             text;
-- `status` gates the public author view; older deployments may lack it.
alter table public.authors
  add column if not exists status content_status not null default 'draft';

-- ─── 3. Author earnings ledger ──────────────────────────────────────────────
create table if not exists public.author_earnings (
  id                   uuid primary key default gen_random_uuid(),
  author_id            uuid not null references public.authors(id) on delete cascade,
  order_id             uuid references public.payment_orders(id) on delete set null,
  order_number         text,
  content_type         text,
  content_id           uuid,
  content_title        text,
  sale_amount_uzs      numeric(12,2) not null default 0,
  author_share_percent numeric(5,2)  not null default 50,
  author_amount_uzs    numeric(12,2) not null default 0,
  -- pending   → sotildi, hali hisobga tushmagan
  -- available → mavjud balans (yechib olsa bo'ladi)
  -- paid_out  → muallifga to'langan
  status               text not null default 'available'
                         check (status in ('pending', 'available', 'paid_out')),
  payment_status       text,
  sold_at              timestamptz not null default now(),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (order_id)
);

create index if not exists idx_author_earnings_author  on public.author_earnings(author_id);
create index if not exists idx_author_earnings_sold_at on public.author_earnings(sold_at desc);
create index if not exists idx_author_earnings_status  on public.author_earnings(status);

alter table public.author_earnings enable row level security;

-- Direct-table RLS: a signed-in user may read only earnings of the author they
-- are linked to. (The app reads through the definer views below, but this keeps
-- the base table safe if it is ever queried directly.)
drop policy if exists "Authors read own earnings" on public.author_earnings;
create policy "Authors read own earnings"
  on public.author_earnings for select
  to authenticated
  using (
    author_id in (
      select p.author_id from public.profiles p
      where p.id = auth.uid() and p.author_id is not null
    )
  );

-- ─── 4a. Resolve author_id + title for a sold content item ──────────────────
create or replace function public.author_earnings_content(
  p_content_type text,
  p_content_id   uuid
)
returns table (author_id uuid, title text)
language sql
stable
security definer
set search_path = public
as $$
  select author_id, title from public.books       where id = p_content_id and p_content_type = 'book'
  union all
  select author_id, title from public.poems       where id = p_content_id and p_content_type = 'poem'
  union all
  select author_id, title from public.articles    where id = p_content_id and p_content_type = 'article'
  union all
  select author_id, title from public.screenplays where id = p_content_id and p_content_type = 'screenplay'
  limit 1;
$$;

-- ─── 4b. Write a ledger row when a content order becomes paid ────────────────
create or replace function public.grant_author_earnings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author_id uuid;
  v_title     text;
  v_content_id uuid;
  v_share     numeric := 50;   -- muallif ulushi: 50%
  v_amount    numeric;
begin
  -- Only act on the transition INTO paid.
  if new.status is distinct from 'paid' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'paid' then
    return new;                 -- already processed on a prior transition
  end if;
  if new.content_type is null or new.content_id is null then
    return new;                 -- subscription / non-content order → no author share
  end if;

  -- content_id may be stored as text; cast defensively.
  begin
    v_content_id := new.content_id::uuid;
  exception when others then
    return new;
  end;

  select c.author_id, c.title
    into v_author_id, v_title
  from public.author_earnings_content(new.content_type::text, v_content_id) c;

  if v_author_id is null then
    return new;                 -- content has no linked author → nothing to credit
  end if;

  v_amount := round(coalesce(new.amount_uzs, 0) * v_share / 100.0, 2);

  insert into public.author_earnings (
    author_id, order_id, order_number, content_type, content_id, content_title,
    sale_amount_uzs, author_share_percent, author_amount_uzs,
    status, payment_status, sold_at
  ) values (
    v_author_id, new.id, new.order_number, new.content_type::text, v_content_id, v_title,
    coalesce(new.amount_uzs, 0), v_share, v_amount,
    'available', new.status, coalesce(new.paid_at, now())
  )
  on conflict (order_id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_grant_author_earnings on public.payment_orders;
create trigger trg_grant_author_earnings
  after insert or update of status on public.payment_orders
  for each row execute function public.grant_author_earnings();

-- ─── 5. Backfill earnings for already-paid content orders ───────────────────
insert into public.author_earnings (
  author_id, order_id, order_number, content_type, content_id, content_title,
  sale_amount_uzs, author_share_percent, author_amount_uzs,
  status, payment_status, sold_at
)
select
  c.author_id,
  o.id,
  o.order_number,
  o.content_type,
  o.content_id::uuid,
  c.title,
  coalesce(o.amount_uzs, 0),
  50,
  round(coalesce(o.amount_uzs, 0) * 50 / 100.0, 2),
  'available',
  o.status,
  coalesce(o.paid_at, o.created_at)
from public.payment_orders o
cross join lateral public.author_earnings_content(
  o.content_type::text,
  case
    when o.content_id::text ~ '^[0-9a-f-]{36}$' then o.content_id::uuid
    else null
  end
) c
where o.status = 'paid'
  and o.content_type is not null
  and o.content_id is not null
  and c.author_id is not null
on conflict (order_id) do nothing;

-- ─── 6a. Linked author record for the signed-in user (owner only) ───────────
create or replace view public.mobile_my_author_profile as
select
  a.id,
  a.full_name,
  a.slug,
  coalesce(a.profile_image_url, a.avatar_url) as avatar_url,
  a.short_bio                        as short_description,
  a.biography                        as bio,
  a.quote,
  a.profession,
  coalesce(a.is_verified, false)     as is_verified,
  a.encyclopedia_entry_id,
  a.status,
  p.id                               as profile_id
from public.profiles p
join public.authors a on a.id = p.author_id
where p.id = auth.uid();

grant select on public.mobile_my_author_profile to authenticated;

-- ─── 6b. All works of the signed-in user's linked author (incl. drafts) ─────
create or replace view public.mobile_my_author_works as
with base as (
  select 'book'::text as content_type, b.id, b.title, b.cover_url,
         b.price::numeric as price, b.is_free, b.status::text as status,
         b.author_id, b.created_at, b.published_at
  from public.books b
  union all
  select 'poem', p.id, p.title, p.cover_url,
         p.price::numeric, p.is_free, p.status::text,
         p.author_id, p.created_at, p.published_at
  from public.poems p
  union all
  select 'article', ar.id, ar.title, ar.cover_url,
         ar.price::numeric, ar.is_free, ar.status::text,
         ar.author_id, ar.created_at, ar.published_at
  from public.articles ar
  union all
  select 'screenplay', s.id, s.title, s.cover_url,
         s.price::numeric, s.is_free, s.status::text,
         s.author_id, s.created_at, s.published_at
  from public.screenplays s
),
agg as (
  select content_type, content_id,
         count(*)                          as sales_count,
         coalesce(sum(author_amount_uzs),0) as earned_uzs
  from public.author_earnings
  group by content_type, content_id
)
select
  b.content_type,
  b.id,
  b.title,
  b.cover_url,
  b.price,
  b.is_free,
  b.status,
  b.author_id,
  b.created_at,
  b.published_at,
  coalesce(ag.sales_count, 0) as sales_count,
  coalesce(ag.earned_uzs, 0)  as earned_uzs
from base b
left join agg ag on ag.content_type = b.content_type and ag.content_id = b.id
where b.author_id in (
  select p.author_id from public.profiles p
  where p.id = auth.uid() and p.author_id is not null
)
order by b.published_at desc nulls last, b.created_at desc;

grant select on public.mobile_my_author_works to authenticated;

-- ─── 6c. Sales history rows for the signed-in author (owner only) ───────────
create or replace view public.mobile_my_author_earnings as
select
  e.id,
  e.order_id,
  e.order_number,
  e.content_type,
  e.content_id,
  e.content_title,
  e.sale_amount_uzs,
  e.author_share_percent,
  e.author_amount_uzs,
  e.status,
  e.payment_status,
  e.sold_at,
  e.created_at
from public.author_earnings e
where e.author_id in (
  select p.author_id from public.profiles p
  where p.id = auth.uid() and p.author_id is not null
)
order by e.sold_at desc;

grant select on public.mobile_my_author_earnings to authenticated;

-- ─── 6d. Aggregate stat-card numbers for the dashboard (owner only) ─────────
create or replace view public.mobile_my_author_earnings_summary as
select
  coalesce(sum(e.author_amount_uzs), 0)                                              as total_earned,
  coalesce(sum(e.author_amount_uzs) filter (where e.status = 'available'), 0)        as available_balance,
  coalesce(sum(e.author_amount_uzs) filter (where e.status = 'pending'), 0)          as pending_amount,
  coalesce(sum(e.author_amount_uzs) filter (where e.status = 'paid_out'), 0)         as paid_out_amount,
  count(*)                                                                           as sales_count,
  coalesce(sum(e.author_amount_uzs) filter (where e.sold_at::date = current_date), 0) as today_amount,
  coalesce(
    sum(e.author_amount_uzs) filter (where e.sold_at >= date_trunc('month', now())),
    0
  )                                                                                  as month_amount,
  50::numeric                                                                        as author_share_percent
from public.author_earnings e
where e.author_id in (
  select p.author_id from public.profiles p
  where p.id = auth.uid() and p.author_id is not null
);

grant select on public.mobile_my_author_earnings_summary to authenticated;

-- ─── 6e. Public author profile (any reader) — safe fields only ──────────────
create or replace view public.mobile_authors_public as
select
  a.id,
  a.full_name,
  a.slug,
  coalesce(a.profile_image_url, a.avatar_url) as avatar_url,
  a.short_bio                    as short_description,
  a.biography                    as bio,
  a.quote,
  a.profession,
  coalesce(a.is_verified, false) as is_verified,
  a.encyclopedia_entry_id,
  a.status
from public.authors a
where a.status = 'published';

grant select on public.mobile_authors_public to anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- Done. Verify (as an author-linked user):
--   select * from mobile_my_author_profile;
--   select * from mobile_my_author_works;
--   select * from mobile_my_author_earnings;
--   select * from mobile_my_author_earnings_summary;
-- ════════════════════════════════════════════════════════════════════════════
