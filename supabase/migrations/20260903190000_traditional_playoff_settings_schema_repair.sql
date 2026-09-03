begin;

alter table public.league_settings
  add column if not exists regular_season_weeks integer,
  add column if not exists playoff_team_count integer,
  add column if not exists playoff_start_week integer,
  add column if not exists playoff_weeks integer,
  add column if not exists playoff_reseeding boolean,
  add column if not exists consolation_bracket_enabled boolean,
  add column if not exists standings_tiebreaker text,
  add column if not exists playoff_tiebreaker text;

-- Preserve existing values. Only fill rows where the value is missing.
update public.league_settings
set
  regular_season_weeks =
    coalesce(regular_season_weeks, 14),
  playoff_team_count =
    coalesce(playoff_team_count, 6),
  playoff_start_week =
    coalesce(playoff_start_week, 15),
  playoff_weeks =
    coalesce(playoff_weeks, 3),
  playoff_reseeding =
    coalesce(playoff_reseeding, false),
  consolation_bracket_enabled =
    coalesce(consolation_bracket_enabled, true),
  standings_tiebreaker =
    coalesce(
      nullif(trim(standings_tiebreaker), ''),
      'points_for'
    ),
  playoff_tiebreaker =
    coalesce(
      nullif(trim(playoff_tiebreaker), ''),
      'higher_seed'
    );

alter table public.league_settings
  alter column regular_season_weeks set default 14,
  alter column playoff_team_count set default 6,
  alter column playoff_start_week set default 15,
  alter column playoff_weeks set default 3,
  alter column playoff_reseeding set default false,
  alter column consolation_bracket_enabled set default true,
  alter column standings_tiebreaker set default 'points_for',
  alter column playoff_tiebreaker set default 'higher_seed';

commit;


-- ============================================================
-- VERIFICATION
-- ============================================================

select
  column_name,
  data_type,
  column_default,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'league_settings'
  and column_name in (
    'regular_season_weeks',
    'playoff_team_count',
    'playoff_start_week',
    'playoff_weeks',
    'playoff_reseeding',
    'consolation_bracket_enabled',
    'standings_tiebreaker',
    'playoff_tiebreaker'
  )
order by column_name;
