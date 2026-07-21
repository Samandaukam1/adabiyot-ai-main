-- Public profile monologues supplement.
--
-- The production `get_public_author_works(uuid)` and
-- `get_my_author_works()` RPCs remain the canonical book/article/poem/
-- screenplay sources. Monologues live in a separate, owner-RLS table, so this
-- narrowly scoped RPC exposes approved monologues without broadening that
-- table's select policy or replacing the existing works RPC contract.

drop function if exists public.get_public_profile_monologues(uuid);
create function public.get_public_profile_monologues(p_profile_or_author_id uuid)
returns table (
  content_type text,
  content_id uuid,
  title text,
  cover_url text,
  media_url text,
  description text,
  status text,
  is_published boolean,
  author_id uuid,
  author_profile_id uuid,
  created_at timestamptz,
  published_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_author_id uuid;
  v_profile_id uuid;
begin
  if p_profile_or_author_id is null then
    return;
  end if;

  -- Public routes can carry either profiles.id or authors.id.
  select p.id, p.author_id
    into v_profile_id, v_author_id
  from public.profiles p
  where p.id = p_profile_or_author_id
  limit 1;

  if v_profile_id is null then
    v_author_id := p_profile_or_author_id;
    select p.id into v_profile_id
    from public.profiles p
    where p.author_id = v_author_id
    limit 1;
  end if;

  return query
  select
    'monologue'::text,
    m.id,
    coalesce(
      nullif(btrim(m.title), ''),
      nullif(btrim(m.base_content_title), ''),
      'Nomsiz monolog'
    ),
    m.thumbnail_url,
    m.media_url,
    m.description,
    m.status,
    true,
    v_author_id,
    v_profile_id,
    m.created_at,
    coalesce(m.reviewed_at, m.created_at)
  from public.creator_content_submissions m
  where v_profile_id is not null
    and m.user_id = v_profile_id
    and m.media_type = 'monologue'
    and m.status = 'approved'
  order by coalesce(m.reviewed_at, m.created_at) desc;
end;
$$;

revoke all on function public.get_public_profile_monologues(uuid) from public;
grant execute on function public.get_public_profile_monologues(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
