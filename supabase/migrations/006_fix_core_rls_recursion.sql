-- ============================================================
-- GRIDIRON365 V2
-- MIGRATION 006
-- FIX CORE RLS RECURSION
-- ============================================================

begin;


-- ============================================================
-- 1. PRIVATE SCHEMA FOR RLS HELPERS
-- ============================================================

create schema if not exists private;


-- ============================================================
-- 2. LEAGUE MEMBERSHIP HELPER
--
-- SECURITY DEFINER allows this helper to inspect
-- league_members without recursively applying the
-- league_members RLS policy.
-- ============================================================

create or replace function private.is_league_member(
    p_league_id uuid,
    p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$

    select exists (
        select
            1
        from public.league_members lm
        where lm.league_id =
              p_league_id
          and lm.user_id =
              p_user_id
    );

$function$;


revoke all
on function private.is_league_member(
    uuid,
    uuid
)
from public;


grant execute
on function private.is_league_member(
    uuid,
    uuid
)
to authenticated;


-- ============================================================
-- 3. FIX LEAGUE MEMBERS POLICY
-- ============================================================

drop policy if exists
    "League members can view memberships"
on public.league_members;


create policy
    "League members can view memberships"
on public.league_members
for select
to authenticated
using (
    user_id =
    auth.uid()

    or

    private.is_league_member(
        league_id,
        auth.uid()
    )
);


-- ============================================================
-- 4. REBUILD LEAGUES POLICY USING SAME HELPER
-- ============================================================

drop policy if exists
    "League members can view leagues"
on public.leagues;


create policy
    "League members can view leagues"
on public.leagues
for select
to authenticated
using (
    commissioner_user_id =
    auth.uid()

    or

    private.is_league_member(
        id,
        auth.uid()
    )
);


-- ============================================================
-- 5. REBUILD FANTASY TEAM POLICY
-- ============================================================

drop policy if exists
    "League members can view fantasy teams"
on public.fantasy_teams;


create policy
    "League members can view fantasy teams"
on public.fantasy_teams
for select
to authenticated
using (
    owner_id =
    auth.uid()

    or

    private.is_league_member(
        league_id,
        auth.uid()
    )
);


-- ============================================================
-- 6. REBUILD LEAGUE SETTINGS READ POLICY
-- ============================================================

drop policy if exists
    "League members can view league settings"
on public.league_settings;


create policy
    "League members can view league settings"
on public.league_settings
for select
to authenticated
using (
    private.is_league_member(
        league_id,
        auth.uid()
    )
);


commit;