-- ════════════════════════════════════════════════════════════════════════════
-- "Ariza qoldirish" — author / publishing applications (CRM)
-- ════════════════════════════════════════════════════════════════════════════
-- A visitor of the user app fills the "Adib bo'lish uchun ariza" form; the row
-- lands in author_applications_crm and shows up in the admin panel CRM section.
-- Idempotent — safe to re-run.

create table if not exists public.author_applications_crm (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users(id) on delete set null,
  first_name       text not null,
  last_name        text not null,
  phone            text not null,
  telegram_contact text not null,
  content_type     text not null,
  word_count       integer,
  region           text not null,
  gender           text not null,
  age              integer not null,
  status           text not null default 'new',   -- new | contacted | approved | rejected
  created_at       timestamptz not null default now()
);

create index if not exists author_applications_crm_created_idx
  on public.author_applications_crm (created_at desc);
create index if not exists author_applications_crm_status_idx
  on public.author_applications_crm (status);
create index if not exists author_applications_crm_user_idx
  on public.author_applications_crm (user_id);

-- RLS on. Direct table access is denied for anon/authenticated: rows are written
-- only through the security-definer RPC below, and read only by the admin panel
-- (service role bypasses RLS). This keeps applicants' contact details private.
alter table public.author_applications_crm enable row level security;

-- Let an authenticated applicant read back their own submissions (optional, for a
-- future "my applications" view). No insert/update/delete policies → those paths
-- go exclusively through the RPC / service role.
drop policy if exists author_applications_crm_select_own on public.author_applications_crm;
create policy author_applications_crm_select_own
  on public.author_applications_crm
  for select
  to authenticated
  using (user_id = auth.uid());

-- ── submit_author_application_crm() ─────────────────────────────────────────
-- Called by the user app. Validates, stamps the caller (auth.uid() when signed
-- in, null for a guest) and inserts. Returns the new row id.
create or replace function public.submit_author_application_crm(
  p_first_name       text,
  p_last_name        text,
  p_phone            text,
  p_telegram_contact text,
  p_content_type     text,
  p_word_count       integer,
  p_region           text,
  p_gender           text,
  p_age              integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id    uuid;
  v_first text := btrim(coalesce(p_first_name, ''));
  v_last  text := btrim(coalesce(p_last_name, ''));
  v_phone text := replace(btrim(coalesce(p_phone, '')), ' ', '');
  v_tg    text := btrim(coalesce(p_telegram_contact, ''));
begin
  -- Server-side guards mirroring the client validation.
  if char_length(v_first) < 2 then
    raise exception 'Ismingizni kiriting';
  end if;
  if char_length(v_last) < 2 then
    raise exception 'Familiyangizni kiriting';
  end if;
  if v_phone !~ '^\+998[0-9]{9}$' then
    raise exception 'Telefon raqam +998 formatida bo''lishi kerak';
  end if;
  if char_length(v_tg) = 0 then
    raise exception 'Telegram profilingizni yozing';
  end if;
  if coalesce(btrim(p_content_type), '') = '' then
    raise exception 'Chop etmoqchi bo''lgan material turini tanlang';
  end if;
  if coalesce(btrim(p_region), '') = '' then
    raise exception 'Viloyatingizni tanlang';
  end if;
  if coalesce(btrim(p_gender), '') = '' then
    raise exception 'Jinsingizni tanlang';
  end if;
  if p_age is null or p_age < 7 or p_age > 100 then
    raise exception 'Yoshingizni to''g''ri kiriting';
  end if;
  if p_word_count is not null and p_word_count <= 0 then
    raise exception 'So''z soni 0 dan katta bo''lishi kerak';
  end if;

  insert into public.author_applications_crm(
    user_id, first_name, last_name, phone, telegram_contact,
    content_type, word_count, region, gender, age
  )
  values (
    auth.uid(), v_first, v_last, v_phone, v_tg,
    btrim(p_content_type), p_word_count, btrim(p_region), btrim(p_gender), p_age
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.submit_author_application_crm(
  text, text, text, text, text, integer, text, text, integer
) to anon, authenticated;
