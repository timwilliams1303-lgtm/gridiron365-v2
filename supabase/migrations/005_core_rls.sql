-- ============================================================
-- GRIDIRON365 V2
-- MIGRATION 005
-- CORE ROW LEVEL SECURITY
--
-- PURPOSE
--   Allow authenticated users to safely access:
--     profiles
--     leagues
--     league_members
--     fantasy_teams
--     league_settings
--
-- RULES
--   profiles
--     - users can read/update their own profile
--
--   league_members
--     - users can read memberships for leagues they belong to
--
--   leagues
--     - users can read leagues they belong to
--
--   fantasy_teams
--     - league members can read teams in their leagues
--
--   league_settings
--     - league members can read settings
--     - commissioner can update settings
--
-- IMPORTANT
--   League creation still happens through
--   create_league_transaction().
-- ============================================================

begin;


-- ============================================================
-- 1. PROFILES
-- ============================================================

drop policy if exists
    "Users can view own profile"
on public.profiles;


create policy
    "Users can view own profile"
on public.profiles
for select
to authenticated
using (
    user_id =
    auth.uid()
);


drop policy if exists
    "Users can update own profile"
on public.profiles;


create policy
    "Users can update own profile"
on public.profiles
for update
to authenticated
using (
    user_id =
    auth.uid()
)
with check (
    user_id =
    auth.uid()
);


-- ============================================================
-- 2. LEAGUE MEMBERS
--
-- IMPORTANT:
--   The direct "user_id = auth.uid()" clause lets My Leagues
--   find the user's own memberships without recursion.
--
--   The EXISTS clause lets league members view the other
--   membership rows in leagues they belong to.
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

    exists (
        select
            1
        from public.league_members self_membership
        where self_membership.league_id =
              league_members.league_id
          and self_membership.user_id =
              auth.uid()
    )
);


-- ============================================================
-- 3. LEAGUES
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

    exists (
        select
            1
        from public.league_members membership
        where membership.league_id =
              leagues.id
          and membership.user_id =
              auth.uid()
    )
);


-- ============================================================
-- 4. FANTASY TEAMS
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

    exists (
        select
            1
        from public.league_members membership
        where membership.league_id =
              fantasy_teams.league_id
          and membership.user_id =
              auth.uid()
    )
);


-- ============================================================
-- 5. LEAGUE SETTINGS — READ
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
    exists (
        select
            1
        from public.league_members membership
        where membership.league_id =
              league_settings.league_id
          and membership.user_id =
              auth.uid()
    )
);


-- ============================================================
-- 6. LEAGUE SETTINGS — COMMISSIONER UPDATE
-- ============================================================

drop policy if exists
    "Commissioners can update league settings"
on public.league_settings;


create policy
    "Commissioners can update league settings"
on public.league_settings
for update
to authenticated
using (
    exists (
        select
            1
        from public.leagues league
        where league.id =
              league_settings.league_id
          and league.commissioner_user_id =
              auth.uid()
    )
)
with check (
    exists (
        select
            1
        from public.leagues league
        where league.id =
              league_settings.league_id
          and league.commissioner_user_id =
              auth.uid()
    )
);


commit;