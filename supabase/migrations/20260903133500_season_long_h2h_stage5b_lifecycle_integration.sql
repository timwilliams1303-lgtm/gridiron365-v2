begin;

do $do$
begin
  if to_regprocedure(
       'public.run_season_long_weekly_lifecycle_core()'
     ) is null
  then
    if to_regprocedure(
         'public.run_season_long_weekly_lifecycle()'
       ) is null
    then
      raise exception
        'run_season_long_weekly_lifecycle() was not found. Install Stage 4 first.';
    end if;

    alter function public.run_season_long_weekly_lifecycle()
      rename to run_season_long_weekly_lifecycle_core;
  end if;
end
$do$;


create or replace function public.run_season_long_weekly_lifecycle()
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_weekly_result jsonb;
  v_current_season integer;

  v_league record;
  v_playoff_result jsonb;

  v_playoff_leagues_checked integer := 0;
  v_playoff_results jsonb := '[]'::jsonb;
begin
  -- Preserve the entire proven Stage 4 lifecycle.
  v_weekly_result :=
    public.run_season_long_weekly_lifecycle_core();

  if not coalesce(
    (v_weekly_result ->> 'success')::boolean,
    false
  ) then
    return v_weekly_result;
  end if;

  v_current_season :=
    nullif(
      v_weekly_result ->> 'currentSeason',
      ''
    )::integer;

  if v_current_season is null then
    return
      v_weekly_result
      ||
      jsonb_build_object(
        'playoffLeaguesChecked', 0,
        'playoffResults', '[]'::jsonb
      );
  end if;

  for v_league in
    select
      l.id as league_id,
      l.name as league_name
    from public.leagues l
    join public.season_long_settings s
      on s.league_id = l.id
    where l.league_type = 'season_long'
      and l.season = v_current_season
      and l.status in ('setup', 'active')
      and s.competition_format = 'head_to_head'
      and coalesce(s.playoffs_enabled, false) = true
    order by l.id
  loop
    v_playoff_leagues_checked :=
      v_playoff_leagues_checked + 1;

    begin
      v_playoff_result :=
        public.run_season_long_h2h_playoff_lifecycle(
          v_league.league_id,
          v_current_season
        );

      v_playoff_results :=
        v_playoff_results
        ||
        jsonb_build_array(
          jsonb_build_object(
            'leagueId', v_league.league_id,
            'leagueName', v_league.league_name,
            'result', v_playoff_result
          )
        );

    exception
      when others then
        -- Do not let one league's playoff issue stop normal Season-Long
        -- weekly scoring/locking for every other league.
        v_playoff_results :=
          v_playoff_results
          ||
          jsonb_build_array(
            jsonb_build_object(
              'leagueId', v_league.league_id,
              'leagueName', v_league.league_name,
              'result',
                jsonb_build_object(
                  'success', false,
                  'error', sqlerrm
                )
            )
          );
    end;
  end loop;

  return
    v_weekly_result
    ||
    jsonb_build_object(
      'playoffLeaguesChecked',
        v_playoff_leagues_checked,
      'playoffResults',
        v_playoff_results
    );
end;
$function$;


grant execute
on function public.run_season_long_weekly_lifecycle_core()
to authenticated;

grant execute
on function public.run_season_long_weekly_lifecycle()
to authenticated;

commit;


-- ============================================================
-- VERIFICATION
-- ============================================================

select
  routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'run_season_long_weekly_lifecycle',
    'run_season_long_weekly_lifecycle_core',
    'run_season_long_h2h_playoff_lifecycle'
  )
order by routine_name;