begin;

create or replace function public.generate_season_long_season_honors(
  p_league_id uuid,
  p_season integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_format text := 'total_points';
  v_regular_season_weeks integer := 18;
  v_playoffs_enabled boolean := false;

  v_active_team_count integer := 0;
  v_final_week_count integer := 0;

  v_regular_matchup_count integer := 0;
  v_regular_matchup_final_count integer := 0;

  v_playoff_status text := null;
  v_champion_team_id bigint := null;
  v_runner_up_team_id bigint := null;

  v_created integer := 0;
begin
  if not exists (
    select 1
    from public.leagues l
    where l.id = p_league_id
      and l.league_type = 'season_long'
      and l.season = p_season
  ) then
    raise exception 'Season-Long league could not be found.';
  end if;

  select
    coalesce(
      nullif(
        lower(trim(s.competition_format)),
        ''
      ),
      'total_points'
    ),
    greatest(
      1,
      coalesce(
        s.regular_season_weeks,
        18
      )
    ),
    coalesce(
      s.playoffs_enabled,
      false
    )
  into
    v_format,
    v_regular_season_weeks,
    v_playoffs_enabled
  from public.season_long_settings s
  where s.league_id = p_league_id;

  v_format :=
    replace(
      v_format,
      '-',
      '_'
    );

  select count(*)
  into v_active_team_count
  from public.fantasy_teams ft
  where ft.league_id = p_league_id
    and coalesce(ft.active, true) = true;

  if v_active_team_count = 0 then
    return jsonb_build_object(
      'success', true,
      'generated', false,
      'reason', 'no_active_teams'
    );
  end if;

  -- ==========================================================
  -- COMPLETION GATE
  -- ==========================================================

  if v_format = 'head_to_head' then
    select
      count(*),
      count(*) filter (
        where coalesce(m.is_final, false) = true
      )
    into
      v_regular_matchup_count,
      v_regular_matchup_final_count
    from public.season_long_matchups m
    where m.league_id = p_league_id
      and m.season = p_season
      and coalesce(m.matchup_type, 'regular_season') = 'regular_season'
      and m.week <= v_regular_season_weeks;

    if v_regular_matchup_count = 0
       or v_regular_matchup_final_count <> v_regular_matchup_count then
      return jsonb_build_object(
        'success', true,
        'generated', false,
        'reason', 'regular_season_not_complete',
        'format', v_format,
        'regularSeasonWeeks', v_regular_season_weeks,
        'matchups', v_regular_matchup_count,
        'finalMatchups', v_regular_matchup_final_count
      );
    end if;

    if v_playoffs_enabled then
      select
        lower(
          coalesce(
            ps.status,
            ''
          )
        ),
        ps.champion_fantasy_team_id
      into
        v_playoff_status,
        v_champion_team_id
      from public.season_long_playoff_state ps
      where ps.league_id = p_league_id
        and ps.season = p_season
      limit 1;

      if coalesce(v_playoff_status, '') not in (
           'complete',
           'completed'
         )
         or v_champion_team_id is null then
        return jsonb_build_object(
          'success', true,
          'generated', false,
          'reason', 'playoffs_not_complete',
          'format', v_format,
          'playoffStatus', v_playoff_status
        );
      end if;

      -- Championship loser = runner-up.
      select
        case
          when m.home_fantasy_team_id = v_champion_team_id
            then m.away_fantasy_team_id
          when m.away_fantasy_team_id = v_champion_team_id
            then m.home_fantasy_team_id
          else null
        end
      into v_runner_up_team_id
      from public.season_long_matchups m
      where m.league_id = p_league_id
        and m.season = p_season
        and m.matchup_type = 'playoff'
        and coalesce(m.is_final, false) = true
        and (
          m.home_fantasy_team_id = v_champion_team_id
          or
          m.away_fantasy_team_id = v_champion_team_id
        )
      order by
        coalesce(m.playoff_round, 0) desc,
        coalesce(m.playoff_slot, 0) asc,
        m.id desc
      limit 1;
    end if;

  else
    -- Total Points runs through the configured full Season-Long season.
    select count(distinct ws.fantasy_team_id)
    into v_final_week_count
    from public.season_long_weekly_scores ws
    join public.fantasy_teams ft
      on ft.id = ws.fantasy_team_id
     and ft.league_id = ws.league_id
    where ws.league_id = p_league_id
      and ws.season = p_season
      and ws.week = v_regular_season_weeks
      and ws.is_final = true
      and coalesce(ft.active, true) = true;

    if v_final_week_count <> v_active_team_count then
      return jsonb_build_object(
        'success', true,
        'generated', false,
        'reason', 'season_not_complete',
        'format', v_format,
        'configuredFinalWeek', v_regular_season_weeks,
        'activeTeams', v_active_team_count,
        'finalWeekTeams', v_final_week_count
      );
    end if;
  end if;

  -- Idempotent rebuild for this one season.
  delete from public.season_long_season_honors
  where league_id = p_league_id
    and season = p_season;

  -- ==========================================================
  -- FINAL PODIUM
  -- ==========================================================

  if v_format = 'head_to_head' then

    if v_playoffs_enabled then
      -- Champion is the actual playoff champion.
      insert into public.season_long_season_honors (
        league_id,
        fantasy_team_id,
        season,
        honor_key,
        honor_name,
        honor_category,
        honor_emoji,
        detail,
        metric_value
      )
      select
        p_league_id,
        hs.fantasy_team_id,
        p_season,
        'season_champion',
        'Season Champion',
        'SEASON',
        '🏆',
        'Won the Head-to-Head playoff championship after a ' ||
          coalesce(hs.wins, 0)::text || '-' ||
          coalesce(hs.losses, 0)::text || '-' ||
          coalesce(hs.ties, 0)::text ||
          ' regular-season record',
        coalesce(hs.wins, 0)::numeric
      from public.season_long_h2h_standings hs
      where hs.league_id = p_league_id
        and hs.season = p_season
        and hs.fantasy_team_id = v_champion_team_id
      on conflict (
        league_id,
        fantasy_team_id,
        season,
        honor_key
      )
      do update set
        honor_name = excluded.honor_name,
        honor_category = excluded.honor_category,
        honor_emoji = excluded.honor_emoji,
        detail = excluded.detail,
        metric_value = excluded.metric_value,
        updated_at = now();

      v_created := v_created + row_count;

      -- Runner-up comes from the championship matchup.
      if v_runner_up_team_id is not null then
        insert into public.season_long_season_honors (
          league_id,
          fantasy_team_id,
          season,
          honor_key,
          honor_name,
          honor_category,
          honor_emoji,
          detail,
          metric_value
        )
        select
          p_league_id,
          hs.fantasy_team_id,
          p_season,
          'season_runner_up',
          'Season Runner-Up',
          'SEASON',
          '🥈',
          'Finished as the Head-to-Head playoff runner-up',
          coalesce(hs.wins, 0)::numeric
        from public.season_long_h2h_standings hs
        where hs.league_id = p_league_id
          and hs.season = p_season
          and hs.fantasy_team_id = v_runner_up_team_id
        on conflict (
          league_id,
          fantasy_team_id,
          season,
          honor_key
        )
        do update set
          honor_name = excluded.honor_name,
          honor_category = excluded.honor_category,
          honor_emoji = excluded.honor_emoji,
          detail = excluded.detail,
          metric_value = excluded.metric_value,
          updated_at = now();

        v_created := v_created + row_count;
      end if;

      -- Third place = best final H2H standings rank not already in top two.
      insert into public.season_long_season_honors (
        league_id,
        fantasy_team_id,
        season,
        honor_key,
        honor_name,
        honor_category,
        honor_emoji,
        detail,
        metric_value
      )
      select
        p_league_id,
        hs.fantasy_team_id,
        p_season,
        'season_third_place',
        'Third Place',
        'SEASON',
        '🥉',
        'Finished third in the final Head-to-Head season results',
        coalesce(hs.wins, 0)::numeric
      from public.season_long_h2h_standings hs
      where hs.league_id = p_league_id
        and hs.season = p_season
        and hs.fantasy_team_id <> v_champion_team_id
        and (
          v_runner_up_team_id is null
          or hs.fantasy_team_id <> v_runner_up_team_id
        )
      order by
        coalesce(hs.current_rank, 999999),
        coalesce(hs.wins, 0) desc,
        coalesce(hs.points_for, 0) desc,
        hs.fantasy_team_id
      limit 1
      on conflict (
        league_id,
        fantasy_team_id,
        season,
        honor_key
      )
      do update set
        honor_name = excluded.honor_name,
        honor_category = excluded.honor_category,
        honor_emoji = excluded.honor_emoji,
        detail = excluded.detail,
        metric_value = excluded.metric_value,
        updated_at = now();

      v_created := v_created + row_count;

    else
      -- No-playoff H2H: final H2H standings determine the podium.
      with ranked as (
        select
          hs.fantasy_team_id,
          hs.wins,
          hs.losses,
          hs.ties,
          hs.points_for,
          row_number() over (
            order by
              coalesce(hs.current_rank, 999999),
              coalesce(hs.wins, 0) desc,
              coalesce(hs.points_for, 0) desc,
              hs.fantasy_team_id
          ) as finish
        from public.season_long_h2h_standings hs
        where hs.league_id = p_league_id
          and hs.season = p_season
      )
      insert into public.season_long_season_honors (
        league_id,
        fantasy_team_id,
        season,
        honor_key,
        honor_name,
        honor_category,
        honor_emoji,
        detail,
        metric_value
      )
      select
        p_league_id,
        r.fantasy_team_id,
        p_season,
        case r.finish
          when 1 then 'season_champion'
          when 2 then 'season_runner_up'
          when 3 then 'season_third_place'
        end,
        case r.finish
          when 1 then 'Season Champion'
          when 2 then 'Season Runner-Up'
          when 3 then 'Third Place'
        end,
        'SEASON',
        case r.finish
          when 1 then '🏆'
          when 2 then '🥈'
          when 3 then '🥉'
        end,
        case r.finish
          when 1 then 'Finished #1 in Head-to-Head at '
          when 2 then 'Finished #2 in Head-to-Head at '
          when 3 then 'Finished #3 in Head-to-Head at '
        end ||
          r.wins::text || '-' ||
          r.losses::text || '-' ||
          r.ties::text,
        coalesce(r.wins, 0)::numeric
      from ranked r
      where r.finish <= 3;

      get diagnostics v_created = row_count;
    end if;

    -- H2H regular-season champion is distinct from playoff champion.
    insert into public.season_long_season_honors (
      league_id,
      fantasy_team_id,
      season,
      honor_key,
      honor_name,
      honor_category,
      honor_emoji,
      detail,
      metric_value
    )
    select
      p_league_id,
      hs.fantasy_team_id,
      p_season,
      'regular_season_champion',
      'Regular Season Champion',
      'SEASON',
      '👑',
      'Finished #1 in the Head-to-Head regular season at ' ||
        coalesce(hs.wins, 0)::text || '-' ||
        coalesce(hs.losses, 0)::text || '-' ||
        coalesce(hs.ties, 0)::text ||
        ' with ' ||
        trim(
          to_char(
            coalesce(hs.points_for, 0),
            'FM999999990.00'
          )
        ) ||
        ' PF',
      coalesce(hs.wins, 0)::numeric
    from public.season_long_h2h_standings hs
    where hs.league_id = p_league_id
      and hs.season = p_season
    order by
      coalesce(hs.current_rank, 999999),
      coalesce(hs.wins, 0) desc,
      coalesce(hs.points_for, 0) desc,
      hs.fantasy_team_id
    limit 1
    on conflict (
      league_id,
      fantasy_team_id,
      season,
      honor_key
    )
    do update set
      honor_name = excluded.honor_name,
      honor_category = excluded.honor_category,
      honor_emoji = excluded.honor_emoji,
      detail = excluded.detail,
      metric_value = excluded.metric_value,
      updated_at = now();

    v_created := v_created + row_count;

  else
    -- Total Points podium = cumulative points through the configured season.
    with totals as (
      select
        ft.id as fantasy_team_id,
        coalesce(
          sum(ws.fantasy_points)
            filter (
              where ws.is_final = true
                and ws.week <= v_regular_season_weeks
            ),
          0
        )::numeric as total_points,
        coalesce(
          max(ws.fantasy_points)
            filter (
              where ws.is_final = true
                and ws.week <= v_regular_season_weeks
            ),
          0
        )::numeric as high_week
      from public.fantasy_teams ft
      left join public.season_long_weekly_scores ws
        on ws.league_id = p_league_id
       and ws.fantasy_team_id = ft.id
       and ws.season = p_season
      where ft.league_id = p_league_id
        and coalesce(ft.active, true) = true
      group by ft.id
    ),
    ranked as (
      select
        t.*,
        row_number() over (
          order by
            t.total_points desc,
            t.high_week desc,
            t.fantasy_team_id
        ) as finish
      from totals t
    )
    insert into public.season_long_season_honors (
      league_id,
      fantasy_team_id,
      season,
      honor_key,
      honor_name,
      honor_category,
      honor_emoji,
      detail,
      metric_value
    )
    select
      p_league_id,
      r.fantasy_team_id,
      p_season,
      case r.finish
        when 1 then 'season_champion'
        when 2 then 'season_runner_up'
        when 3 then 'season_third_place'
      end,
      case r.finish
        when 1 then 'Season Champion'
        when 2 then 'Season Runner-Up'
        when 3 then 'Third Place'
      end,
      'SEASON',
      case r.finish
        when 1 then '🏆'
        when 2 then '🥈'
        when 3 then '🥉'
      end,
      case r.finish
        when 1 then 'Finished #1 with '
        when 2 then 'Finished #2 with '
        when 3 then 'Finished #3 with '
      end ||
        trim(
          to_char(
            r.total_points,
            'FM999999990.00'
          )
        ) ||
        ' season points',
      r.total_points
    from ranked r
    where r.finish <= 3;

    get diagnostics v_created = row_count;
  end if;

  -- ==========================================================
  -- SHARED SEASON HONORS
  -- ==========================================================

  -- Highest single-week score. Works for both formats and both
  -- Salary / No-Salary because weekly fantasy scoring is shared.
  insert into public.season_long_season_honors (
    league_id,
    fantasy_team_id,
    season,
    honor_key,
    honor_name,
    honor_category,
    honor_emoji,
    detail,
    metric_value
  )
  select
    p_league_id,
    ws.fantasy_team_id,
    p_season,
    'season_high_score',
    'Season High Score',
    'SEASON',
    '🔥',
    'Highest single-week score: ' ||
      trim(
        to_char(
          ws.fantasy_points,
          'FM999999990.00'
        )
      ) ||
      ' points in Week ' ||
      ws.week::text,
    ws.fantasy_points
  from public.season_long_weekly_scores ws
  where ws.league_id = p_league_id
    and ws.season = p_season
    and ws.is_final = true
    and ws.fantasy_points = (
      select max(ws2.fantasy_points)
      from public.season_long_weekly_scores ws2
      where ws2.league_id = p_league_id
        and ws2.season = p_season
        and ws2.is_final = true
    )
  on conflict (
    league_id,
    fantasy_team_id,
    season,
    honor_key
  )
  do update set
    detail = excluded.detail,
    metric_value = excluded.metric_value,
    updated_at = now();

  v_created := v_created + row_count;

  return jsonb_build_object(
    'success', true,
    'generated', true,
    'leagueId', p_league_id,
    'season', p_season,
    'format', v_format,
    'regularSeasonWeeks', v_regular_season_weeks,
    'playoffsEnabled', v_playoffs_enabled,
    'championFantasyTeamId', v_champion_team_id,
    'honorsCreated', v_created
  );
end;
$function$;


revoke all
on function public.generate_season_long_season_honors(uuid, integer)
from public, anon, authenticated;

grant execute
on function public.generate_season_long_season_honors(uuid, integer)
to service_role;


-- ============================================================
-- WEEKLY SCORE TRIGGER
-- Keep weekly badges unchanged, but let the format-aware honor
-- generator decide whether the season is actually complete.
-- ============================================================

create or replace function public.run_season_long_badges_after_score()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.is_final = true then
    perform public.generate_season_long_weekly_badges(
      new.league_id,
      new.season,
      new.week
    );

    perform public.generate_season_long_season_honors(
      new.league_id,
      new.season
    );
  end if;

  return new;
end;
$function$;


-- ============================================================
-- H2H MATCHUP COMPLETION TRIGGER
-- Ensures no-playoff H2H honors are generated after the final
-- regular-season matchup is marked final.
-- ============================================================

create or replace function public.run_season_long_honors_after_matchup()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.is_final = true then
    perform public.generate_season_long_season_honors(
      new.league_id,
      new.season
    );
  end if;

  return new;
end;
$function$;

drop trigger if exists
  trg_run_season_long_honors_after_matchup
  on public.season_long_matchups;

create trigger
  trg_run_season_long_honors_after_matchup
after insert or update of
  is_final,
  winner_fantasy_team_id
on public.season_long_matchups
for each row
execute function
  public.run_season_long_honors_after_matchup();


-- ============================================================
-- H2H PLAYOFF STATE COMPLETION TRIGGER
-- Ensures the real playoff champion is permanently written to
-- the continuous Trophy Case as soon as the playoff state closes.
-- ============================================================

create or replace function public.run_season_long_honors_after_playoff_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if lower(
       coalesce(
         new.status,
         ''
       )
     ) in (
       'complete',
       'completed'
     )
     and new.champion_fantasy_team_id is not null then
    perform public.generate_season_long_season_honors(
      new.league_id,
      new.season
    );
  end if;

  return new;
end;
$function$;

drop trigger if exists
  trg_run_season_long_honors_after_playoff_state
  on public.season_long_playoff_state;

create trigger
  trg_run_season_long_honors_after_playoff_state
after insert or update of
  status,
  champion_fantasy_team_id
on public.season_long_playoff_state
for each row
execute function
  public.run_season_long_honors_after_playoff_state();


commit;


-- ============================================================
-- VERIFICATION
-- ============================================================

select
  p.proname as function_name,
  pg_get_function_identity_arguments(
    p.oid
  ) as arguments
from pg_proc p
join pg_namespace n
  on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'generate_season_long_season_honors',
    'run_season_long_badges_after_score',
    'run_season_long_honors_after_matchup',
    'run_season_long_honors_after_playoff_state'
  )
order by p.proname;

select
  tgname as trigger_name
from pg_trigger
where not tgisinternal
  and tgname in (
    'trg_run_season_long_badges_after_score',
    'trg_run_season_long_honors_after_matchup',
    'trg_run_season_long_honors_after_playoff_state'
  )
order by tgname;
