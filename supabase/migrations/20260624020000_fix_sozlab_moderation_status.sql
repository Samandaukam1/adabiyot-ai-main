-- Keep So'zLab post moderation status compatible with the live constraint.
--
-- The mobile app publishes user posts immediately and stores moderation state
-- separately. New rows should default to "pending"; "active" remains accepted
-- so older clients / already inserted rows do not break.

alter table public.sozlab_posts
  add column if not exists moderation_status text not null default 'pending';

alter table public.sozlab_posts
  alter column moderation_status set default 'pending';

update public.sozlab_posts
set moderation_status = 'pending'
where moderation_status is null
   or moderation_status not in ('pending', 'approved', 'rejected', 'flagged', 'active');

alter table public.sozlab_posts
  alter column moderation_status set not null;

alter table public.sozlab_posts
  drop constraint if exists sozlab_posts_moderation_status_check;

alter table public.sozlab_posts
  add constraint sozlab_posts_moderation_status_check
  check (moderation_status in ('pending', 'approved', 'rejected', 'flagged', 'active'));
