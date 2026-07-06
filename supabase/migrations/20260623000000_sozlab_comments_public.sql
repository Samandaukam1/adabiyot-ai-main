-- AdabiyotX So'zLab — allow the anonymous mobile app to read & post comments.
--
-- Deployed `sozlab_comments` columns: id, post_id, user_id, content, status,
-- created_at. Like sozlab_posts, RLS previously rejected anonymous inserts.

-- Anonymous comments have no owner.
alter table public.sozlab_comments alter column user_id drop not null;

grant select, insert on public.sozlab_comments to anon, authenticated;

drop policy if exists "SozLab public can read comments" on public.sozlab_comments;
create policy "SozLab public can read comments"
on public.sozlab_comments
for select
to anon, authenticated
using (status = 'published');

drop policy if exists "SozLab public can insert comments" on public.sozlab_comments;
create policy "SozLab public can insert comments"
on public.sozlab_comments
for insert
to anon, authenticated
with check (
  status = 'published'
  and (user_id is null or user_id = auth.uid())
);
