-- ════════════════════════════════════════════════════════════════════════════
-- OPTIONAL — Muallif (adib) verification_type backfill
-- ════════════════════════════════════════════════════════════════════════════
-- NOT required for the app: the mobile app now DERIVES the badge on the client
-- from `account_type = 'author'` / `author_id` (see lib/auth.ts +
-- types/profile.ts `resolveVerificationType`), so a linked Muallif already shows
-- the green "Adib" tick on the profile, public page and So'zLab.
--
-- Run this in the Supabase SQL editor only if you also want the DB column itself
-- (and therefore the admin panel / web) to reflect the badge. Idempotent: it
-- only fills rows still at the default 'none' and never downgrades a real badge.
-- ════════════════════════════════════════════════════════════════════════════

-- Linked authors (Muallif) → green "Adib" badge.
update public.profiles
set verification_type = 'adib_green'
where coalesce(verification_type, 'none') = 'none'
  and (account_type = 'author' or author_id is not null)
  and coalesce(is_creator, false) = false;

-- Author + creator → gold badge.
update public.profiles
set verification_type = 'creator_adib_gold'
where coalesce(verification_type, 'none') = 'none'
  and coalesce(is_creator, false) = true
  and (account_type = 'author' or author_id is not null or coalesce(is_adib, false) = true);

-- Plain creators (no author link) → blue "Ijodkor" badge.
update public.profiles
set verification_type = 'creator_blue'
where coalesce(verification_type, 'none') = 'none'
  and coalesce(is_creator, false) = true
  and account_type <> 'author'
  and author_id is null
  and coalesce(is_adib, false) = false;
