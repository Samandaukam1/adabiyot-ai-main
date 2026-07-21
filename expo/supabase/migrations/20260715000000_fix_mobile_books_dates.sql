-- Align the mobile_books view with the Expo user-panel reader/list hooks.
-- The live view missed created_at, so PostgREST rejected order=created_at.
-- This view exposes created_at, updated_at, and published_at while staying
-- tolerant of older books-table variants by reading optional fields from JSON.

drop view if exists public.mobile_books;

create view public.mobile_books
with (security_invoker = true) as
with book_rows as (
  select to_jsonb(b) as j
  from public.books b
)
select
  (j->>'id')::uuid as id,
  coalesce(j->>'title', 'Nomsiz asar') as title,
  coalesce(j->>'author', 'Noma''lum muallif') as author,
  j->>'publisher' as publisher,
  j->>'publisher_type' as publisher_type,
  j->>'genre' as genre,
  j->>'description' as description,
  j->>'cover_url' as cover_url,
  j->>'file_url' as file_url,
  j->>'pdf_url' as pdf_url,
  j->>'audio_url' as audio_url,
  coalesce(nullif(j->>'price', '')::numeric, 0) as price,
  coalesce(nullif(j->>'is_free', '')::boolean, true) as is_free,
  coalesce(j->>'status', 'published') as status,
  j->>'submission_status' as submission_status,
  coalesce(nullif(j->>'created_at', '')::timestamptz, now()) as created_at,
  coalesce(
    nullif(j->>'updated_at', '')::timestamptz,
    nullif(j->>'published_at', '')::timestamptz,
    nullif(j->>'created_at', '')::timestamptz,
    now()
  ) as updated_at,
  nullif(j->>'published_at', '')::timestamptz as published_at,
  coalesce(nullif(j->>'has_internal_reader', '')::boolean, false) as has_internal_reader,
  j->>'content_mode' as content_mode,
  j->>'raw_content' as raw_content,
  j->>'cleaned_content' as cleaned_content,
  nullif(j->>'content_version', '')::integer as content_version,
  coalesce(nullif(j->>'toc_generated', '')::boolean, false) as toc_generated
from book_rows
where j->>'id' is not null
  and coalesce(j->>'status', 'published') = 'published'
  and coalesce(j->>'submission_status', 'published') in ('approved_by_company', 'published');

grant select on public.mobile_books to anon, authenticated;
