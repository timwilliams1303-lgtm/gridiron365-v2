-- ============================================================
-- GRIDIRON365 V2
-- MIGRATION 002
-- LEAGUE FORMAT FOUNDATION
--
-- Supports:
--   Traditional Draft
--   Weekly Salary Cap
--   Weekly No Salary Cap
--   NFL Playoffs Salary Cap
--   NFL Playoffs No Salary Cap
-- ============================================================

begin;


-- ============================================================
-- 1. REPLACE ORIGINAL LEAGUE TYPE CONSTRAINT
-- ============================================================

alter table public.leagues
drop constraint if exists
    leagues_type_check;


alter table public.leagues
add constraint
    leagues_type_check
check (
    league_type in (
        'traditional',
        'weekly',
        'nfl_playoffs'
    )
);


-- ============================================================
-- 2. PLAYER SELECTION MODE
-- ============================================================

alter table public.leagues
add column
    player_selection_mode text
    not null
    default 'draft';


alter table public.leagues
add constraint
    leagues_player_selection_mode_check
check (
    player_selection_mode in (
        'draft',
        'salary_cap',
        'no_salary_cap'
    )
);


-- ============================================================
-- 3. VALID TYPE + MODE COMBINATIONS
-- ============================================================

alter table public.leagues
add constraint
    leagues_format_combination_check
check (
    (
        league_type = 'traditional'
        and
        player_selection_mode = 'draft'
    )
    or
    (
        league_type in (
            'weekly',
            'nfl_playoffs'
        )
        and
        player_selection_mode in (
            'salary_cap',
            'no_salary_cap'
        )
    )
);


-- ============================================================
-- 4. TEAM LIMIT
--
-- Traditional ultimately gets a 12-team enforcement rule.
--
-- Weekly and NFL Playoffs can support a large number of
-- entries, so max_teams may be NULL = no configured league cap.
-- ============================================================

alter table public.league_settings
alter column max_teams
drop not null;


alter table public.league_settings
drop constraint if exists
    league_settings_max_teams_check;


alter table public.league_settings
add constraint
    league_settings_max_teams_check
check (
    max_teams is null
    or max_teams >= 2
);


-- ============================================================
-- 5. INDEX FOR LEAGUE FORMAT LOOKUPS
-- ============================================================

create index
    idx_leagues_format
on public.leagues (
    league_type,
    player_selection_mode,
    status
);


commit;