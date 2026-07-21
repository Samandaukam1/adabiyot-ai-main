-- App version settings for the "Ilovani yangilang" (update available) modal.
--
-- The user panel only READS these rows (anon/authenticated) via the
-- get_app_version_settings() RPC. The admin panel manages the values.
-- Idempotent: safe to re-run.

create table if not exists public.app_version_settings (
  id uuid primary key default gen_random_uuid(),
  platform text not null unique check (platform in ('ios', 'android')),
  latest_version text not null default '1.0.0',
  minimum_supported_version text not null default '1.0.0',
  build_number integer,
  minimum_build_number integer,
  force_update boolean not null default false,
  update_title text,
  update_message text,
  app_store_url text,
  play_market_url text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.app_version_settings enable row level security;

-- Public read so the app can check for updates before/without auth.
drop policy if exists "app_version_settings_public_read" on public.app_version_settings;
create policy "app_version_settings_public_read"
  on public.app_version_settings
  for select
  using (true);

-- No client-side write policies: only the admin panel (service role) mutates rows.

-- Read-only accessor used by the user panel.
create or replace function public.get_app_version_settings(p_platform text)
returns public.app_version_settings
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.app_version_settings
  where platform = p_platform
  limit 1;
$$;

grant execute on function public.get_app_version_settings(text) to anon, authenticated;

-- Seed default rows so the check has data to read (no forced update by default).
insert into public.app_version_settings
  (platform, latest_version, minimum_supported_version, force_update, update_title, update_message)
values
  ('android', '1.0.0', '1.0.0', false, 'Ilovani yangilang',
   'AdabiyotX ilovasining yangi versiyasi mavjud. Yangi imkoniyatlar va barqaror ishlash uchun ilovani yangilang.'),
  ('ios', '1.0.0', '1.0.0', false, 'Ilovani yangilang',
   'AdabiyotX ilovasining yangi versiyasi mavjud. Yangi imkoniyatlar va barqaror ishlash uchun ilovani yangilang.')
on conflict (platform) do nothing;
