begin;

-- ============================================================
-- G365 SEASON-LONG FORMAT RULES
-- Total Points runs straight through the season and never has
-- fantasy playoffs. H2H may enable/disable playoffs.
-- ============================================================

update public.season_long_settings
set
  playoffs_enabled = false,
  updated_at = now()
where coalesce(competition_format, 'total_points') = 'total_points'
  and coalesce(playoffs_enabled, false) = true;

alter table public.season_long_settings
drop constraint if exists season_long_total_points_no_playoffs_check;

alter table public.season_long_settings
add constraint season_long_total_points_no_playoffs_check
check (
  competition_format = 'head_to_head'
  or playoffs_enabled = false
);

commit;

-- Verification
select
  league_id,
  competition_format,
  playoffs_enabled
from public.season_long_settings
order by league_id;
