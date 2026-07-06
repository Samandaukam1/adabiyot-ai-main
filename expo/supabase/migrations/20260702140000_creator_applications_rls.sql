-- ════════════════════════════════════════════════════════════════════════════
-- creator_applications — RLS so the user app can submit "Ijodkor bo'lish"
-- ════════════════════════════════════════════════════════════════════════════
-- Idempotent. Run in the Supabase SQL editor. Lets a signed-in user INSERT their
-- OWN application (so it reaches the admin panel) and read their own rows for the
-- pending/rejected gating. The admin panel uses the service role, which bypasses
-- RLS entirely, so its review/approve/reject flow is unaffected.
--
-- Table columns (already exist in prod): id, user_id, full_name, username, phone,
-- bio, reason, portfolio_url, instagram_url, telegram_url, status, created_at,
-- updated_at, reviewed_at, admin_note.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.creator_applications enable row level security;

-- RLS runs on top of table privileges — make sure the authenticated role has the
-- grants the policies below authorise (Supabase default, restated idempotently).
grant select, insert on public.creator_applications to authenticated;

-- A user may submit an application only for themselves.
drop policy if exists "Users insert own creator application" on public.creator_applications;
create policy "Users insert own creator application"
  on public.creator_applications for insert
  to authenticated
  with check (user_id = auth.uid());

-- A user may read only their own applications (drives the app's status gating).
drop policy if exists "Users read own creator applications" on public.creator_applications;
create policy "Users read own creator applications"
  on public.creator_applications for select
  to authenticated
  using (user_id = auth.uid());

-- NOTE: the app also sets profiles.creator_status = 'pending' right after the
-- insert (see lib/creator.ts). That relies on the existing profiles self-update
-- policy (id = auth.uid()), which already powers profile edits — no change here.
-- Approval/rejection (is_creator, creator_status='approved'/'rejected',
-- creator_badge) stays admin-only via the service role.
