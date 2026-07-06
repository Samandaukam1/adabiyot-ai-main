-- Reels metadata columns for the creator upload + owner-edit flow. Idempotent.
-- Makes the attached-literature columns OPTIONAL so a reel can be posted without
-- attaching any adabiyot. Does NOT touch video/status/moderation columns.

alter table if exists public.reels
  add column if not exists thumbnail_url text,
  add column if not exists title text,
  add column if not exists caption text,
  add column if not exists description text,
  add column if not exists linked_content_type text,
  add column if not exists linked_content_id text,
  add column if not exists linked_content_title text;

-- Drop NOT NULL on the attachment columns if it was set (attachment is optional).
do $$
begin
  begin alter table public.reels alter column linked_content_type drop not null; exception when others then null; end;
  begin alter table public.reels alter column linked_content_id drop not null; exception when others then null; end;
  begin alter table public.reels alter column linked_content_title drop not null; exception when others then null; end;
end $$;

notify pgrst, 'reload schema';
