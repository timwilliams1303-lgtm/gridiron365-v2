-- ============================================================
-- GRIDIRON365 V2
-- MIGRATION 004
-- CLEAN LEAGUE CREATION TRANSACTION
--
-- PURPOSE
--   Creates a league atomically.
--
-- CREATES:
--   leagues
--   league_members
--   league_settings
--
-- TRADITIONAL ONLY:
--   fantasy_teams
--
-- FORMATS:
--   traditional + draft
--   weekly + salary_cap
--   weekly + no_salary_cap
--   nfl_playoffs + salary_cap
--   nfl_playoffs + no_salary_cap
--
-- IMPORTANT
--   Weekly / NFL Playoffs will use contest entries later,
--   not Traditional fantasy_teams.
-- ============================================================

begin;


-- ============================================================
-- 1. MAKE TRADITIONAL-ONLY SETTINGS NULLABLE
--
-- max_teams:
--   traditional = 12
--   weekly/playoffs = NULL (no configured participant cap)
--
-- regular_season_weeks:
--   traditional = required
--   weekly/playoffs = NULL
-- ============================================================

alter table public.league_settings
alter column regular_season_weeks
drop not null;


alter table public.league_settings
drop constraint if exists
    league_settings_regular_weeks_check;


alter table public.league_settings
add constraint
    league_settings_regular_weeks_check
check (
    regular_season_weeks is null
    or (
        regular_season_weeks >= 1
        and regular_season_weeks <= 18
    )
);


-- ============================================================
-- 2. ATOMIC LEAGUE CREATION
-- ============================================================

create or replace function public.create_league_transaction(
    p_name text,
    p_league_type text,
    p_player_selection_mode text,
    p_season integer,
    p_team_name text default null,
    p_regular_season_weeks integer default 14
)
returns jsonb
language plpgsql
security definer
set search_path =
    pg_catalog,
    public,
    auth
as $function$

declare
    v_user_id uuid :=
        auth.uid();

    v_league_id uuid;

    v_team_id bigint;

    v_clean_name text :=
        trim(
            coalesce(
                p_name,
                ''
            )
        );

    v_clean_team_name text :=
        trim(
            coalesce(
                p_team_name,
                ''
            )
        );

    v_league_type text :=
        lower(
            trim(
                coalesce(
                    p_league_type,
                    ''
                )
            )
        );

    v_selection_mode text :=
        lower(
            trim(
                coalesce(
                    p_player_selection_mode,
                    ''
                )
            )
        );

    v_max_teams integer;

    v_regular_season_weeks integer;

begin

    -- ========================================================
    -- AUTHENTICATION
    -- ========================================================

    if v_user_id is null then
        raise exception
        using
            errcode = '42501',
            message =
                'You must be signed in to create a league.';
    end if;


    -- ========================================================
    -- LEAGUE NAME
    -- ========================================================

    if length(
        v_clean_name
    ) < 1
    or length(
        v_clean_name
    ) > 100
    then
        raise exception
        using
            errcode = '22023',
            message =
                'League name must be between 1 and 100 characters.';
    end if;


    -- ========================================================
    -- SEASON
    -- ========================================================

    if p_season is null
    or p_season < 2000
    or p_season > 2200
    then
        raise exception
        using
            errcode = '22023',
            message =
                'A valid league season is required.';
    end if;


    -- ========================================================
    -- FORMAT VALIDATION
    -- ========================================================

    if v_league_type not in (
        'traditional',
        'weekly',
        'nfl_playoffs'
    )
    then
        raise exception
        using
            errcode = '22023',
            message =
                'The selected league type is invalid.';
    end if;


    if v_selection_mode not in (
        'draft',
        'salary_cap',
        'no_salary_cap'
    )
    then
        raise exception
        using
            errcode = '22023',
            message =
                'The selected player selection mode is invalid.';
    end if;


    -- Traditional must always be draft.
    if v_league_type =
       'traditional'
       and v_selection_mode <>
           'draft'
    then
        raise exception
        using
            errcode = '22023',
            message =
                'Traditional leagues must use a draft.';
    end if;


    -- Weekly / NFL Playoffs cannot use draft mode.
    if v_league_type in (
        'weekly',
        'nfl_playoffs'
    )
    and v_selection_mode not in (
        'salary_cap',
        'no_salary_cap'
    )
    then
        raise exception
        using
            errcode = '22023',
            message =
                'Weekly and NFL Playoffs leagues must use Salary Cap or No Salary Cap.';
    end if;


    -- ========================================================
    -- TRADITIONAL SETTINGS
    -- ========================================================

    if v_league_type =
       'traditional'
    then

        if length(
            v_clean_team_name
        ) < 1
        or length(
            v_clean_team_name
        ) > 100
        then
            raise exception
            using
                errcode = '22023',
                message =
                    'A Traditional league requires a team name between 1 and 100 characters.';
        end if;


        if p_regular_season_weeks
           is null
        or p_regular_season_weeks < 1
        or p_regular_season_weeks > 18
        then
            raise exception
            using
                errcode = '22023',
                message =
                    'Traditional regular-season weeks must be between 1 and 18.';
        end if;


        v_max_teams :=
            12;

        v_regular_season_weeks :=
            p_regular_season_weeks;

    else

        -- Weekly and NFL Playoff contests are not
        -- restricted to Traditional's 12-team model.

        v_max_teams :=
            null;

        v_regular_season_weeks :=
            null;

    end if;


    -- ========================================================
    -- CREATE LEAGUE
    -- ========================================================

    insert into public.leagues (
        name,
        league_type,
        season,
        commissioner_user_id,
        status,
        player_selection_mode
    )
    values (
        v_clean_name,
        v_league_type,
        p_season,
        v_user_id,
        'setup',
        v_selection_mode
    )
    returning
        id
    into
        v_league_id;


    -- ========================================================
    -- COMMISSIONER MEMBERSHIP
    -- ========================================================

    insert into public.league_members (
        league_id,
        user_id,
        role
    )
    values (
        v_league_id,
        v_user_id,
        'commissioner'
    );


    -- ========================================================
    -- LEAGUE SETTINGS
    -- ========================================================

    insert into public.league_settings (
        league_id,
        season,
        max_teams,
        regular_season_weeks
    )
    values (
        v_league_id,
        p_season,
        v_max_teams,
        v_regular_season_weeks
    );


    -- ========================================================
    -- TRADITIONAL COMMISSIONER TEAM
    --
    -- Weekly and NFL Playoffs will use contest-entry
    -- tables later instead of fantasy_teams.
    -- ========================================================

    if v_league_type =
       'traditional'
    then

        insert into public.fantasy_teams (
            league_id,
            owner_id,
            team_name,
            active
        )
        values (
            v_league_id,
            v_user_id,
            v_clean_team_name,
            true
        )
        returning
            id
        into
            v_team_id;

    end if;


    -- ========================================================
    -- RESULT
    -- ========================================================

    return jsonb_build_object(
        'success',
            true,

        'leagueId',
            v_league_id,

        'leagueType',
            v_league_type,

        'playerSelectionMode',
            v_selection_mode,

        'season',
            p_season,

        'role',
            'commissioner',

        'fantasyTeamId',
            v_team_id
    );

end;

$function$;


-- ============================================================
-- 3. PERMISSIONS
-- ============================================================

revoke all
on function public.create_league_transaction(
    text,
    text,
    text,
    integer,
    text,
    integer
)
from public;


revoke all
on function public.create_league_transaction(
    text,
    text,
    text,
    integer,
    text,
    integer
)
from anon;


grant execute
on function public.create_league_transaction(
    text,
    text,
    text,
    integer,
    text,
    integer
)
to authenticated;


commit;