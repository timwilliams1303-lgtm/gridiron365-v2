begin;

alter table public.season_long_settings
  drop constraint if exists
  season_long_settings_playoff_team_count_check;

alter table public.season_long_settings
  add constraint season_long_settings_playoff_team_count_check
  check (playoff_team_count >= 2);

comment on column public.season_long_settings.playoff_team_count is
  'Commissioner-selected H2H playoff field size. Minimum 2; maximum is the league active-team count and is validated by application/playoff lifecycle logic.';

commit;

-- Verification
select
  conname,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where conname =
  'season_long_settings_playoff_team_count_check';