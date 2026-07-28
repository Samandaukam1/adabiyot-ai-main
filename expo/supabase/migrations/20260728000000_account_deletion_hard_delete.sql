-- Real, irreversible account deletion (Apple App Review guideline 5.1.1 (v)).
--
-- Replaces the "file a request, an admin reviews it" flow with a single-pass
-- hard delete. The client never touches this directly: the `delete-own-account`
-- Edge Function identifies the caller from their JWT and then, with the service
-- role, calls `delete_user_account_data()` followed by `auth.admin.deleteUser()`.
--
-- No table or column name is hard-coded below. The purge is driven by the
-- Postgres catalog: every single-column foreign key in `public` that points at
-- `auth.users(id)` or `public.profiles(id)` is treated as "this row belongs to
-- that user" and deleted — except the moderation/audit columns listed in
-- ADMIN_COLUMNS, which record who ACTED on a row rather than who owns it.
-- That way a table added later is covered automatically and this file never
-- goes stale.
--
-- Idempotent: safe to re-run.

/* ─────────────────────  deletion audit (no PII)  ─────────────────────── */

-- Proof that a deletion happened, for support / App Review questions. It holds
-- NO personal data: the account is identified only by a SHA-256 hash of its id,
-- which cannot be reversed into an account that no longer exists.
create table if not exists public.account_deletion_audit (
  id uuid primary key default gen_random_uuid(),
  user_id_hash text not null,
  deleted_at timestamptz not null default now(),
  rows_deleted jsonb not null default '{}'::jsonb,
  client text
);

create index if not exists account_deletion_audit_deleted_at_idx
  on public.account_deletion_audit (deleted_at desc);

alter table public.account_deletion_audit enable row level security;
-- No policies at all: only the service role (Edge Function) may read or write.

/* ─────────────────  one deletion per account at a time  ──────────────── */

-- A row-based lock rather than `pg_advisory_lock`: PostgREST pools connections,
-- so a session-scoped lock taken in one request could not be released by the
-- next. Rows are transient — released in the Edge Function's `finally`, and any
-- row left behind by a crashed run expires after LOCK_STALE_AFTER.
create table if not exists public.account_deletion_locks (
  user_id uuid primary key,
  started_at timestamptz not null default now()
);

alter table public.account_deletion_locks enable row level security;
-- No policies: service role only.

create or replace function public.try_account_deletion_lock(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  LOCK_STALE_AFTER constant interval := interval '2 minutes';
begin
  if p_user_id is null then
    return false;
  end if;

  delete from public.account_deletion_locks
   where started_at < now() - LOCK_STALE_AFTER;

  insert into public.account_deletion_locks (user_id) values (p_user_id);
  return true;
exception
  when unique_violation then
    return false;  -- a deletion for this account is already running
end;
$$;

create or replace function public.release_account_deletion_lock(p_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.account_deletion_locks where user_id = p_user_id;
$$;

revoke all on function public.try_account_deletion_lock(uuid) from public;
revoke all on function public.try_account_deletion_lock(uuid) from anon, authenticated;
revoke all on function public.release_account_deletion_lock(uuid) from public;
revoke all on function public.release_account_deletion_lock(uuid) from anon, authenticated;
grant execute on function public.try_account_deletion_lock(uuid) to service_role;
grant execute on function public.release_account_deletion_lock(uuid) to service_role;

/* ─────────────────────  the purge itself  ────────────────────────────── */

create or replace function public.delete_user_account_data(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Columns that record an ADMIN action on someone else's row. Deleting by
  -- these would erase other people's records, so they are skipped; the FKs are
  -- declared `on delete set null`, so removing the auth user blanks them.
  ADMIN_COLUMNS constant text[] := array[
    'processed_by', 'reviewed_by', 'approved_by', 'rejected_by',
    'moderated_by', 'resolved_by', 'assigned_to', 'updated_by',
    'deleted_by', 'admin_id', 'verified_by', 'published_by'
  ];
  -- Escape hatch: tables that must survive a deletion for legal/accounting
  -- reasons. Empty by default — everything the user owns is deleted, which is
  -- what guideline 5.1.1 (v) asks for. If bookkeeping later requires keeping,
  -- say, settled payment rows, add the table name here (the FK to the deleted
  -- auth user is `on delete set null` / `cascade`, so it resolves itself).
  KEEP_TABLES constant text[] := array[]::text[];
  rec          record;
  pending      text[] := '{}';
  next_pending text[];
  item         text;
  parts        text[];
  affected     bigint;
  total        bigint := 0;
  report       jsonb := '{}'::jsonb;
  pass         int;
begin
  if p_user_id is null then
    raise exception 'delete_user_account_data: p_user_id is required'
      using errcode = '22004';
  end if;

  -- Discover the ownership columns from the catalog.
  for rec in
    select distinct cl.relname as table_name, att.attname as column_name
      from pg_constraint con
      join pg_class cl on cl.oid = con.conrelid
      join pg_namespace ns on ns.oid = cl.relnamespace
      join pg_class fcl on fcl.oid = con.confrelid
      join pg_namespace fns on fns.oid = fcl.relnamespace
      join lateral unnest(con.conkey) as k(attnum) on true
      join pg_attribute att on att.attrelid = cl.oid and att.attnum = k.attnum
     where con.contype = 'f'
       and cl.relkind = 'r'
       and ns.nspname = 'public'
       and array_length(con.conkey, 1) = 1
       and (
             (fns.nspname = 'auth'   and fcl.relname = 'users')
          or (fns.nspname = 'public' and fcl.relname = 'profiles')
           )
       -- `profiles` itself is deleted last, after everything referencing it.
       and cl.relname <> 'profiles'
       and not (cl.relname = any (KEEP_TABLES))
       and not (att.attname = any (ADMIN_COLUMNS))
  loop
    pending := pending || (rec.table_name || '|' || rec.column_name);
  end loop;

  -- Several passes: table A may be referenced by table B (both user-owned), and
  -- the catalog gives no ordering. A row that still blocks after the last pass
  -- is a real problem and must surface as an error — never a silent success.
  for pass in 1..6 loop
    exit when coalesce(array_length(pending, 1), 0) = 0;
    next_pending := '{}';

    foreach item in array pending loop
      parts := string_to_array(item, '|');
      begin
        execute format('delete from public.%I where %I = $1', parts[1], parts[2])
          using p_user_id;
        get diagnostics affected = row_count;
        if affected > 0 then
          total := total + affected;
          report := report || jsonb_build_object(
            parts[1] || '.' || parts[2],
            coalesce((report ->> (parts[1] || '.' || parts[2]))::bigint, 0) + affected
          );
        end if;
      exception
        when foreign_key_violation then
          -- A dependent row is cleared by another entry in this list.
          next_pending := next_pending || item;
        when undefined_table or undefined_column then
          -- Dropped between the catalog read and the delete — nothing to do.
          null;
      end;
    end loop;

    pending := next_pending;
  end loop;

  if coalesce(array_length(pending, 1), 0) > 0 then
    raise exception 'delete_user_account_data: could not clear %',
      array_to_string(pending, ', ')
      using errcode = '23503';
  end if;

  -- Finally the profile row. `auth.users` is removed by the Edge Function via
  -- the Admin API, which is the only way to clear the auth identity/session.
  delete from public.profiles where id = p_user_id;
  get diagnostics affected = row_count;
  if affected > 0 then
    total := total + affected;
    report := report || jsonb_build_object('profiles.id', affected);
  end if;

  return jsonb_build_object('total', total, 'tables', report);
end;
$$;

revoke all on function public.delete_user_account_data(uuid) from public;
revoke all on function public.delete_user_account_data(uuid) from anon, authenticated;
-- Service role only: the Edge Function is the sole caller. A signed-in client
-- must never be able to pass someone else's id.
grant execute on function public.delete_user_account_data(uuid) to service_role;

/* ─────────────────  retire the old request-based flow  ───────────────── */

-- The app no longer files deletion requests — deletion is immediate — so the
-- RPCs are dropped to make sure nothing keeps calling them. The
-- `account_deletion_requests` TABLE is intentionally left in place: rows that
-- were filed before this migration are still a record the team may need.
drop function if exists public.request_my_account_deletion(text);
drop function if exists public.get_my_account_deletion_request();
