-- AdabiyotX profile persistence after provider login.
--
-- Provider metadata is allowed to initialize a profile once. After that,
-- visible profile fields live in public.profiles and are never overwritten by
-- Google / Apple metadata on login.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists full_name text,
  add column if not exists avatar_url text,
  add column if not exists role text,
  add column if not exists publisher_id uuid,
  add column if not exists is_active boolean default true,
  add column if not exists is_banned boolean default false,
  add column if not exists account_type text not null default 'reader',
  add column if not exists display_name text,
  add column if not exists pen_name text,
  add column if not exists bio text,
  add column if not exists cover_url text,
  add column if not exists website_url text,
  add column if not exists instagram_url text,
  add column if not exists telegram_url text,
  add column if not exists youtube_url text,
  add column if not exists is_creator boolean not null default false,
  add column if not exists is_adib boolean not null default false,
  add column if not exists is_vip boolean not null default false,
  add column if not exists has_published_work boolean default false,
  add column if not exists verification_type text not null default 'none',
  add column if not exists verification_label text,
  add column if not exists creator_status text not null default 'none',
  add column if not exists adib_status text,
  add column if not exists auth_provider text,
  add column if not exists last_login_provider text,
  add column if not exists last_login_at timestamptz,
  add column if not exists provider_email text,
  add column if not exists provider_full_name text,
  add column if not exists google_email text,
  add column if not exists apple_email text,
  add column if not exists provider_avatar_url text,
  add column if not exists profile_edited_by_user boolean not null default false,
  add column if not exists display_name_edited boolean not null default false,
  add column if not exists full_name_edited boolean not null default false,
  add column if not exists pen_name_edited boolean not null default false,
  add column if not exists avatar_edited boolean not null default false,
  add column if not exists bio_edited boolean not null default false,
  add column if not exists cover_edited boolean not null default false,
  add column if not exists phone text,
  add column if not exists phone_number text,
  add column if not exists phone_verified boolean not null default false,
  add column if not exists phone_verified_at timestamptz,
  add column if not exists phone_verification_status text not null default 'not_started';

alter table public.profiles
  alter column account_type set default 'reader',
  alter column is_creator set default false,
  alter column is_adib set default false,
  alter column is_vip set default false,
  alter column verification_type set default 'none',
  alter column creator_status set default 'none',
  alter column profile_edited_by_user set default false,
  alter column display_name_edited set default false,
  alter column full_name_edited set default false,
  alter column pen_name_edited set default false,
  alter column avatar_edited set default false,
  alter column bio_edited set default false,
  alter column cover_edited set default false,
  alter column phone_verified set default false,
  alter column phone_verification_status set default 'not_started';

update public.profiles
set
  account_type = coalesce(account_type, 'reader'),
  is_creator = coalesce(is_creator, false),
  is_adib = coalesce(is_adib, false),
  is_vip = coalesce(is_vip, false),
  verification_type = coalesce(verification_type, 'none'),
  creator_status = coalesce(creator_status, 'none'),
  profile_edited_by_user = coalesce(profile_edited_by_user, false),
  display_name_edited = coalesce(display_name_edited, false),
  full_name_edited = coalesce(full_name_edited, false),
  pen_name_edited = coalesce(pen_name_edited, false),
  avatar_edited = coalesce(avatar_edited, false),
  bio_edited = coalesce(bio_edited, false),
  cover_edited = coalesce(cover_edited, false),
  phone_verified = coalesce(phone_verified, false),
  phone_verification_status = coalesce(phone_verification_status, 'not_started');

create or replace function public.ensure_my_profile_after_login()
returns public.profiles
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_meta jsonb := '{}'::jsonb;
  v_app_meta jsonb := '{}'::jsonb;
  v_provider text;
  v_provider_email text;
  v_provider_full_name text;
  v_provider_avatar_url text;
  v_profile public.profiles%rowtype;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select
    u.email,
    coalesce(u.raw_user_meta_data, '{}'::jsonb),
    coalesce(u.raw_app_meta_data, '{}'::jsonb)
  into v_email, v_meta, v_app_meta
  from auth.users u
  where u.id = v_user_id;

  if not found then
    raise exception 'Auth user not found' using errcode = 'P0002';
  end if;

  v_provider = nullif(coalesce(v_app_meta->>'provider', v_meta->>'provider'), '');
  if v_provider not in ('google', 'apple') then
    v_provider = null;
  end if;

  v_provider_email = nullif(coalesce(v_email, v_meta->>'email'), '');
  v_provider_full_name = nullif(coalesce(v_meta->>'full_name', v_meta->>'name'), '');
  v_provider_avatar_url = nullif(coalesce(v_meta->>'avatar_url', v_meta->>'picture'), '');

  insert into public.profiles (
    id,
    display_name,
    full_name,
    avatar_url,
    account_type,
    is_creator,
    is_adib,
    is_vip,
    verification_type,
    creator_status,
    auth_provider,
    last_login_provider,
    last_login_at,
    provider_email,
    provider_full_name,
    provider_avatar_url,
    google_email,
    apple_email,
    profile_edited_by_user,
    display_name_edited,
    full_name_edited,
    pen_name_edited,
    avatar_edited,
    bio_edited,
    cover_edited,
    phone_verified,
    phone_verification_status,
    created_at,
    updated_at
  )
  values (
    v_user_id,
    v_provider_full_name,
    v_provider_full_name,
    v_provider_avatar_url,
    'reader',
    false,
    false,
    false,
    'none',
    'none',
    v_provider,
    v_provider,
    now(),
    v_provider_email,
    v_provider_full_name,
    v_provider_avatar_url,
    case when v_provider = 'google' then v_provider_email else null end,
    case when v_provider = 'apple' then v_provider_email else null end,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    'not_started',
    now(),
    now()
  )
  on conflict (id) do update
  set
    auth_provider = coalesce(public.profiles.auth_provider, excluded.auth_provider),
    last_login_provider = coalesce(excluded.last_login_provider, public.profiles.last_login_provider),
    last_login_at = excluded.last_login_at,
    provider_email = coalesce(excluded.provider_email, public.profiles.provider_email),
    provider_full_name = coalesce(excluded.provider_full_name, public.profiles.provider_full_name),
    provider_avatar_url = coalesce(excluded.provider_avatar_url, public.profiles.provider_avatar_url),
    google_email = case
      when excluded.last_login_provider = 'google'
        then coalesce(excluded.provider_email, public.profiles.google_email)
      else public.profiles.google_email
    end,
    apple_email = case
      when excluded.last_login_provider = 'apple'
        then coalesce(excluded.provider_email, public.profiles.apple_email)
      else public.profiles.apple_email
    end
  returning * into v_profile;

  return v_profile;
end;
$$;

alter table public.profiles enable row level security;

grant select, update on public.profiles to authenticated;
grant execute on function public.ensure_my_profile_after_login() to authenticated;

drop policy if exists "Profiles are readable by owner" on public.profiles;
create policy "Profiles are readable by owner"
on public.profiles
for select
to authenticated
using (id = auth.uid());

drop policy if exists "Profiles are editable by owner" on public.profiles;
create policy "Profiles are editable by owner"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());
