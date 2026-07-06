-- ════════════════════════════════════════════════════════════════════════════
-- Creator application notifications + badge columns
-- ════════════════════════════════════════════════════════════════════════════
-- Idempotent. Keeps the mobile app's existing notifications schema
-- (recipient_id / notification_type / body / metadata) working and adds the two
-- creator-application notification types used by the user app.

alter table public.profiles
  add column if not exists creator_badge text;

-- Widen the notification_type check constraint created by the mobile
-- notifications migration. Constraint names can drift, so find it by definition.
do $$
declare
  constraint_name text;
begin
  select conname into constraint_name
  from pg_constraint
  where conrelid = 'public.notifications'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%notification_type%'
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.notifications drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.notifications
  add constraint notifications_notification_type_check
  check (notification_type in (
    'mention',
    'comment_reply',
    'new_follower',
    'new_content',
    'rating',
    'system',
    'creator_application_submitted',
    'creator_application_approved'
  ));

-- If the admin approval path flips profiles.is_creator / creator_status, notify
-- the user exactly once when they become an approved creator. The notification
-- screen renders these as AdabiyotX system messages even though actor_user_id is
-- set to the same user for schema/RLS compatibility.
create or replace function public.notify_creator_application_approved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_author boolean;
  msg text;
begin
  if coalesce(new.is_creator, false) = true
     and new.creator_status = 'approved'
     and not (
       coalesce(old.is_creator, false) = true
       and old.creator_status = 'approved'
     ) then

    is_author :=
      new.account_type = 'author'
      or new.account_type = 'adib'
      or new.account_type = 'creator_adib'
      or new.author_id is not null;

    msg := case
      when is_author then 'Sizga Ijodkor + Muallif nishoni berildi.'
      else 'Sizga Ijodkor nishoni berildi.'
    end;

    if not exists (
      select 1
      from public.notifications n
      where n.recipient_id = new.id
        and n.notification_type = 'creator_application_approved'
    ) then
      insert into public.notifications(
        recipient_id,
        actor_user_id,
        notification_type,
        title,
        body,
        target_type,
        metadata
      )
      values (
        new.id,
        new.id,
        'creator_application_approved',
        'Qabul qilindingiz',
        msg,
        'profile',
        jsonb_build_object('profile_id', new.id)
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_creator_application_approved on public.profiles;
create trigger trg_notify_creator_application_approved
after update of is_creator, creator_status, account_type, author_id on public.profiles
for each row
execute function public.notify_creator_application_approved();
