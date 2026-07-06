-- ============================================================================
-- HOTFIX: posting is broken with `record "new" has no field "body"`.
--
-- An earlier version of the user-features migration installed the
-- notify_followers_new_post() trigger referencing new.body directly. The real
-- sozlab_posts table has `content`, not `body`, so EVERY insert now fails.
--
-- Run this snippet on its own in the Supabase SQL Editor to restore posting
-- immediately. It is also included (identically) in the main migration.
-- Safe to run even if notifications / user_follows don't exist yet — the
-- exception guard makes the trigger a no-op in that case.
-- ============================================================================

create or replace function public.notify_followers_new_post()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  j           jsonb := to_jsonb(new);
  poster      uuid  := nullif(j->>'user_id', '')::uuid;
  post_status text  := coalesce(j->>'status', 'published');
  post_text   text  := coalesce(j->>'content', j->>'body', '');
  post_id     uuid  := nullif(j->>'id', '')::uuid;
begin
  if post_status <> 'published' then return new; end if;
  if poster is null then return new; end if;
  insert into public.notifications(recipient_id, actor_user_id, notification_type, title, body, target_type, target_post_id)
  select f.follower_id, poster, 'new_content', 'Yangi ijod joylandi',
         left(post_text, 140), 'sozlab_post', post_id
  from public.user_follows f
  where f.following_id = poster;
  return new;
exception when others then
  -- Notifications must never block the post itself.
  return new;
end $$;

-- If you'd rather just disable the follower-notification until the full
-- migration runs, you can instead drop the trigger entirely:
--   drop trigger if exists trg_notify_followers_new_post on public.sozlab_posts;
