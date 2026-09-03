begin;


-- ============================================================
-- 1. ACTIVE SEASON-LONG WEEK
--
-- Replaces the old "earliest unfinished NFL week" helper with:
--   a) earliest unresolved NFL week
--   b) if the prior week just finished, hold that prior week until
--      the shared Tuesday 6 AM ET rollover gate allows advancement
--
-- This function is already used by the Season-Long entry UI, so
-- future-prepared lineup rows cannot make the app jump early.
-- ============================================================

create or replace function public.get_active_season_long_week(
  p_season integer
)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_candidate_week integer;
  v_previous_week integer;
  v_last_week integer;
  v_gate jsonb;
begin
  -- Earliest NFL week that is still genuinely unresolved.
  -- Canceled games are treated as administratively resolved.
  select
    min(x.week)
  into
    v_candidate_week
  from (
    select
      g.week
    from public.nfl_games g
    where g.season = p_season
      and g.season_type = 2
    group by
      g.week
    having count(*) filter (
      where not (
        coalesce(g.status_completed, false) = true
        or public.normalize_nfl_game_status(
             coalesce(
               nullif(g.status_name, ''),
               nullif(g.status_type, ''),
               g.status_detail
             )
           ) in ('final', 'canceled')
      )
    ) > 0
  ) x;


  -- If every loaded regular-season week is resolved, remain on the
  -- final loaded week instead of returning NULL.
  if v_candidate_week is null then
    select
      max(g.week)
    into
      v_last_week
    from public.nfl_games g
    where g.season = p_season
      and g.season_type = 2;

    return
      coalesce(
        v_last_week,
        1
      );
  end if;


  -- Find the immediately preceding loaded NFL week.
  select
    max(g.week)
  into
    v_previous_week
  from public.nfl_games g
  where g.season = p_season
    and g.season_type = 2
    and g.week < v_candidate_week;


  if v_previous_week is null then
    return v_candidate_week;
  end if;


  -- If the prior week is complete but has not crossed the Tuesday
  -- 6 AM ET boundary, keep the app on the prior fantasy week.
  --
  -- If the prior week has an unresolved/postponed game, the same
  -- gate also keeps that prior week active until it is resolved.
  v_gate :=
    public.get_g365_week_rollover_gate(
      p_season,
      v_previous_week,
      now(),
      6
    );


  if coalesce(
       (v_gate ->> 'allowed')::boolean,
       false
     ) = false
     and coalesce(
       v_gate ->> 'reason',
       ''
     ) in (
       'waiting_for_tuesday_rollover',
       'nfl_week_unresolved'
     )
  then
    return v_previous_week;
  end if;


  return v_candidate_week;
end;
$function$;


grant execute
on function public.get_active_season_long_week(integer)
to authenticated;


-- ============================================================
-- 2. H2H WEEK SCORE SYNC
--
-- Replaces the original two-inner-join implementation so:
--   • live home/away scores update whenever score rows exist
--   • BYE rows can finish cleanly
--   • BYEs never manufacture a fantasy opponent or result
-- ============================================================

create or replace function public.sync_season_long_h2h_week(
  p_league_id uuid,
  p_season integer,
  p_week integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_updated integer := 0;
begin
  update public.season_long_matchups m
  set
    home_points =
      coalesce(
        (
          select s.fantasy_points
          from public.season_long_weekly_scores s
          where s.league_id = m.league_id
            and s.season = m.season
            and s.week = m.week
            and s.fantasy_team_id =
              m.home_fantasy_team_id
          limit 1
        ),
        0
      ),

    away_points =
      case
        when m.away_fantasy_team_id is null
          then null
        else
          coalesce(
            (
              select s.fantasy_points
              from public.season_long_weekly_scores s
              where s.league_id = m.league_id
                and s.season = m.season
                and s.week = m.week
                and s.fantasy_team_id =
                  m.away_fantasy_team_id
              limit 1
            ),
            0
          )
      end,

    home_score_final =
      coalesce(
        (
          select s.is_final
          from public.season_long_weekly_scores s
          where s.league_id = m.league_id
            and s.season = m.season
            and s.week = m.week
            and s.fantasy_team_id =
              m.home_fantasy_team_id
          limit 1
        ),
        false
      ),

    away_score_final =
      case
        when m.away_fantasy_team_id is null
          then true
        else
          coalesce(
            (
              select s.is_final
              from public.season_long_weekly_scores s
              where s.league_id = m.league_id
                and s.season = m.season
                and s.week = m.week
                and s.fantasy_team_id =
                  m.away_fantasy_team_id
              limit 1
            ),
            false
          )
      end,

    is_final =
      coalesce(
        (
          select s.is_final
          from public.season_long_weekly_scores s
          where s.league_id = m.league_id
            and s.season = m.season
            and s.week = m.week
            and s.fantasy_team_id =
              m.home_fantasy_team_id
          limit 1
        ),
        false
      )
      and
      (
        m.away_fantasy_team_id is null
        or
        coalesce(
          (
            select s.is_final
            from public.season_long_weekly_scores s
            where s.league_id = m.league_id
              and s.season = m.season
              and s.week = m.week
              and s.fantasy_team_id =
                m.away_fantasy_team_id
            limit 1
          ),
          false
        )
      ),

    winner_fantasy_team_id =
      case
        when m.away_fantasy_team_id is null
          then null

        when not (
          coalesce(
            (
              select s.is_final
              from public.season_long_weekly_scores s
              where s.league_id = m.league_id
                and s.season = m.season
                and s.week = m.week
                and s.fantasy_team_id =
                  m.home_fantasy_team_id
              limit 1
            ),
            false
          )
          and
          coalesce(
            (
              select s.is_final
              from public.season_long_weekly_scores s
              where s.league_id = m.league_id
                and s.season = m.season
                and s.week = m.week
                and s.fantasy_team_id =
                  m.away_fantasy_team_id
              limit 1
            ),
            false
          )
        )
          then null

        when coalesce(
          (
            select s.fantasy_points
            from public.season_long_weekly_scores s
            where s.league_id = m.league_id
              and s.season = m.season
              and s.week = m.week
              and s.fantasy_team_id =
                m.home_fantasy_team_id
            limit 1
          ),
          0
        )
        >
        coalesce(
          (
            select s.fantasy_points
            from public.season_long_weekly_scores s
            where s.league_id = m.league_id
              and s.season = m.season
              and s.week = m.week
              and s.fantasy_team_id =
                m.away_fantasy_team_id
            limit 1
          ),
          0
        )
          then m.home_fantasy_team_id

        when coalesce(
          (
            select s.fantasy_points
            from public.season_long_weekly_scores s
            where s.league_id = m.league_id
              and s.season = m.season
              and s.week = m.week
              and s.fantasy_team_id =
                m.away_fantasy_team_id
            limit 1
          ),
          0
        )
        >
        coalesce(
          (
            select s.fantasy_points
            from public.season_long_weekly_scores s
            where s.league_id = m.league_id
              and s.season = m.season
              and s.week = m.week
              and s.fantasy_team_id =
                m.home_fantasy_team_id
            limit 1
          ),
          0
        )
          then m.away_fantasy_team_id

        else null
      end,

    is_tie =
      case
        when m.away_fantasy_team_id is null
          then false

        when not (
          coalesce(
            (
              select s.is_final
              from public.season_long_weekly_scores s
              where s.league_id = m.league_id
                and s.season = m.season
                and s.week = m.week
                and s.fantasy_team_id =
                  m.home_fantasy_team_id
              limit 1
            ),
            false
          )
          and
          coalesce(
            (
              select s.is_final
              from public.season_long_weekly_scores s
              where s.league_id = m.league_id
                and s.season = m.season
                and s.week = m.week
                and s.fantasy_team_id =
                  m.away_fantasy_team_id
              limit 1
            ),
            false
          )
        )
          then false

        else
          coalesce(
            (
              select s.fantasy_points
              from public.season_long_weekly_scores s
              where s.league_id = m.league_id
                and s.season = m.season
                and s.week = m.week
                and s.fantasy_team_id =
                  m.home_fantasy_team_id
              limit 1
            ),
            0
          )
          =
          coalesce(
            (
              select s.fantasy_points
              from public.season_long_weekly_scores s
              where s.league_id = m.league_id
                and s.season = m.season
                and s.week = m.week
                and s.fantasy_team_id =
                  m.away_fantasy_team_id
              limit 1
            ),
            0
          )
      end,

    updated_at =
      now()

  where m.league_id = p_league_id
    and m.season = p_season
    and m.week = p_week
    and m.matchup_type = 'regular_season';

  get diagnostics
    v_updated =
      row_count;

  return v_updated;
end;
$function$;


-- ============================================================
-- 3. H2H STANDINGS
--
-- BYE matchups are excluded from W-L-T, PF and PA.
-- ============================================================

create or replace function public.rebuild_season_long_h2h_standings(
  p_league_id uuid,
  p_season integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_count integer := 0;
begin
  delete
  from public.season_long_h2h_standings
  where league_id = p_league_id
    and season = p_season;


  with active_teams as (
    select
      ft.id as fantasy_team_id
    from public.fantasy_teams ft
    where ft.league_id = p_league_id
      and ft.active = true
  ),

  results as (
    select
      m.home_fantasy_team_id
        as fantasy_team_id,

      case
        when m.is_tie
          then 0
        when m.winner_fantasy_team_id =
             m.home_fantasy_team_id
          then 1
        else 0
      end
        as wins,

      case
        when m.is_tie
          then 0
        when m.winner_fantasy_team_id =
             m.away_fantasy_team_id
          then 1
        else 0
      end
        as losses,

      case
        when m.is_tie
          then 1
        else 0
      end
        as ties,

      coalesce(
        m.home_points,
        0
      )
        as points_for,

      coalesce(
        m.away_points,
        0
      )
        as points_against,

      m.week

    from public.season_long_matchups m

    where m.league_id = p_league_id
      and m.season = p_season
      and m.matchup_type = 'regular_season'
      and m.is_final = true
      and m.away_fantasy_team_id is not null


    union all


    select
      m.away_fantasy_team_id
        as fantasy_team_id,

      case
        when m.is_tie
          then 0
        when m.winner_fantasy_team_id =
             m.away_fantasy_team_id
          then 1
        else 0
      end
        as wins,

      case
        when m.is_tie
          then 0
        when m.winner_fantasy_team_id =
             m.home_fantasy_team_id
          then 1
        else 0
      end
        as losses,

      case
        when m.is_tie
          then 1
        else 0
      end
        as ties,

      coalesce(
        m.away_points,
        0
      )
        as points_for,

      coalesce(
        m.home_points,
        0
      )
        as points_against,

      m.week

    from public.season_long_matchups m

    where m.league_id = p_league_id
      and m.season = p_season
      and m.matchup_type = 'regular_season'
      and m.is_final = true
      and m.away_fantasy_team_id is not null
  ),

  aggregated as (
    select
      at.fantasy_team_id,

      coalesce(
        sum(r.wins),
        0
      )::integer
        as wins,

      coalesce(
        sum(r.losses),
        0
      )::integer
        as losses,

      coalesce(
        sum(r.ties),
        0
      )::integer
        as ties,

      coalesce(
        sum(r.points_for),
        0
      )::numeric
        as points_for,

      coalesce(
        sum(r.points_against),
        0
      )::numeric
        as points_against,

      count(r.week)::integer
        as games_played

    from active_teams at

    left join results r
      on r.fantasy_team_id =
         at.fantasy_team_id

    group by
      at.fantasy_team_id
  ),

  ranked as (
    select
      a.*,

      case
        when a.games_played = 0
          then 0::numeric

        else
          (
            a.wins
            +
            (a.ties * 0.5)
          )
          /
          a.games_played::numeric
      end
        as win_percentage,

      row_number() over (
        order by
          case
            when a.games_played = 0
              then 0::numeric
            else
              (
                a.wins
                +
                (a.ties * 0.5)
              )
              /
              a.games_played::numeric
          end desc,

          a.points_for desc,

          (
            a.points_for
            -
            a.points_against
          ) desc,

          a.fantasy_team_id asc
      )::integer
        as current_rank

    from aggregated a
  )

  insert into public.season_long_h2h_standings (
    league_id,
    fantasy_team_id,
    season,
    wins,
    losses,
    ties,
    points_for,
    points_against,
    games_played,
    win_percentage,
    current_rank,
    streak_type,
    streak_count,
    updated_at
  )

  select
    p_league_id,
    r.fantasy_team_id,
    p_season,
    r.wins,
    r.losses,
    r.ties,
    r.points_for,
    r.points_against,
    r.games_played,
    r.win_percentage,
    r.current_rank,
    null,
    0,
    now()

  from ranked r;


  get diagnostics
    v_count =
      row_count;

  return v_count;
end;
$function$;


-- ============================================================
-- 4. WEEKLY H2H CONVENIENCE FINALIZER
-- ============================================================

create or replace function public.finalize_season_long_h2h_week(
  p_league_id uuid,
  p_season integer,
  p_week integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_matchups integer := 0;
  v_standings integer := 0;
begin
  v_matchups :=
    public.sync_season_long_h2h_week(
      p_league_id,
      p_season,
      p_week
    );

  v_standings :=
    public.rebuild_season_long_h2h_standings(
      p_league_id,
      p_season
    );

  return jsonb_build_object(
    'success', true,
    'leagueId', p_league_id,
    'season', p_season,
    'week', p_week,
    'matchupsUpdated', v_matchups,
    'standingsRows', v_standings
  );
end;
$function$;


-- ============================================================
-- 5. SEASON-LONG WEEKLY LIFECYCLE
--
-- Keeps the proven lifecycle flow and adds:
--   • Season-Long active-week gate
--   • live H2H matchup synchronization
--   • final H2H standings/results rebuild
--
-- IMPORTANT:
-- The NEXT week may still be prepared ahead of time. This is
-- intentional. get_active_season_long_week() controls what the
-- user sees as ACTIVE.
-- ============================================================

create or replace function public.run_season_long_weekly_lifecycle()
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_current_season integer;
  v_current_week integer;

  v_provider_week integer;

  v_next_season integer;
  v_next_week integer;

  v_scoring_result jsonb;
  v_finalize_result jsonb;

  v_current_preparation_result jsonb;
  v_next_preparation_result jsonb;

  v_current_week_games integer := 0;
  v_current_week_final_games integer := 0;

  v_current_week_first_kickoff timestamptz;
  v_current_week_complete boolean := false;

  v_current_week_prepared boolean := false;
  v_next_week_prepared boolean := false;

  v_rollover_gate jsonb;

  v_league record;

  v_leagues_lock_checked integer := 0;
  v_players_locked integer := 0;
  v_lock_count integer := 0;

  v_h2h_leagues_checked integer := 0;
  v_h2h_matchups_synced integer := 0;
  v_h2h_standings_rows integer := 0;

  v_h2h_sync_count integer := 0;
  v_h2h_finalize_result jsonb;
begin
  -- ----------------------------------------------------------
  -- Resolve NFL season from the existing provider helper.
  -- ----------------------------------------------------------
  select
    r.season,
    r.week
  into
    v_current_season,
    v_provider_week
  from public.get_current_nfl_regular_season_week() r;


  if v_current_season is null then
    return jsonb_build_object(
      'success',
      false,
      'reason',
      'No current NFL regular-season season could be resolved.'
    );
  end if;


  -- ----------------------------------------------------------
  -- Resolve the USER-FACING active Season-Long fantasy week.
  --
  -- This is the key Tuesday 6 AM / postponed-game protection.
  -- ----------------------------------------------------------
  v_current_week :=
    public.get_active_season_long_week(
      v_current_season
    );


  if v_current_week is null then
    return jsonb_build_object(
      'success',
      false,
      'reason',
      'No active Season-Long week could be resolved.',
      'season',
      v_current_season
    );
  end if;


  perform
    public.lock_season_long_lifecycle_week(
      v_current_season,
      v_current_week
    );


  -- ----------------------------------------------------------
  -- NFL state for the ACTIVE fantasy week.
  -- ----------------------------------------------------------
  select
    count(*)::integer,

    count(*) filter (
      where
        coalesce(
          g.status_completed,
          false
        ) = true
        or
        public.normalize_nfl_game_status(
          coalesce(
            nullif(g.status_name, ''),
            nullif(g.status_type, ''),
            g.status_detail
          )
        ) in (
          'final',
          'canceled'
        )
    )::integer,

    min(
      g.kickoff_at
    )

  into
    v_current_week_games,
    v_current_week_final_games,
    v_current_week_first_kickoff

  from public.nfl_games g

  where g.season =
        v_current_season
    and g.season_type =
        2
    and g.week =
        v_current_week;


  v_current_week_complete :=
    (
      v_current_week_games > 0
      and
      v_current_week_games =
        v_current_week_final_games
    );


  v_rollover_gate :=
    public.get_g365_week_rollover_gate(
      v_current_season,
      v_current_week,
      now(),
      6
    );


  -- ----------------------------------------------------------
  -- Keep current-week shared context/projections refreshed while
  -- the NFL week is not complete.
  -- ----------------------------------------------------------
  if not v_current_week_complete then

    v_current_preparation_result :=
      public.prepare_active_season_long_week(
        v_current_season,
        v_current_week
      );

    v_current_week_prepared :=
      coalesce(
        (
          v_current_preparation_result
          ->> 'success'
        )::boolean,
        false
      );

  end if;


  -- ----------------------------------------------------------
  -- Synchronize player/game lineup locks.
  -- ----------------------------------------------------------
  for v_league in

    select
      l.id as league_id

    from public.leagues l

    where l.league_type =
          'season_long'
      and l.season =
          v_current_season
      and l.status in (
        'setup',
        'active'
      )

    order by
      l.id

  loop

    v_leagues_lock_checked :=
      v_leagues_lock_checked
      +
      1;

    v_lock_count :=
      public.sync_season_long_lineup_locks(
        v_league.league_id,
        v_current_season,
        v_current_week
      );

    v_players_locked :=
      v_players_locked
      +
      coalesce(
        v_lock_count,
        0
      );

  end loop;


  -- ----------------------------------------------------------
  -- Live Season-Long fantasy scoring.
  -- ----------------------------------------------------------
  v_scoring_result :=
    public.refresh_active_season_long_scoring(
      v_current_season,
      v_current_week
    );


  -- ----------------------------------------------------------
  -- Push LIVE scores into H2H matchup cards.
  -- ----------------------------------------------------------
  for v_league in

    select
      l.id as league_id

    from public.leagues l

    join public.season_long_settings s
      on s.league_id =
         l.id

    where l.league_type =
          'season_long'
      and l.season =
          v_current_season
      and l.status in (
        'setup',
        'active'
      )
      and s.competition_format =
          'head_to_head'

    order by
      l.id

  loop

    v_h2h_leagues_checked :=
      v_h2h_leagues_checked
      +
      1;

    v_h2h_sync_count :=
      public.sync_season_long_h2h_week(
        v_league.league_id,
        v_current_season,
        v_current_week
      );

    v_h2h_matchups_synced :=
      v_h2h_matchups_synced
      +
      coalesce(
        v_h2h_sync_count,
        0
      );

  end loop;


  -- ----------------------------------------------------------
  -- Finalize fantasy scores only after every NFL game in this
  -- fantasy week is resolved.
  --
  -- A postponed/suspended/delayed game keeps this FALSE.
  -- ----------------------------------------------------------
  if v_current_week_complete then

    v_finalize_result :=
      public.finalize_season_long_week(
        v_current_season,
        v_current_week
      );


    -- --------------------------------------------------------
    -- Final H2H result / W-L-T pass.
    -- --------------------------------------------------------
    for v_league in

      select
        l.id as league_id

      from public.leagues l

      join public.season_long_settings s
        on s.league_id =
           l.id

      where l.league_type =
            'season_long'
        and l.season =
            v_current_season
        and l.status in (
          'setup',
          'active'
        )
        and s.competition_format =
            'head_to_head'

      order by
        l.id

    loop

      v_h2h_finalize_result :=
        public.finalize_season_long_h2h_week(
          v_league.league_id,
          v_current_season,
          v_current_week
        );

      v_h2h_standings_rows :=
        v_h2h_standings_rows
        +
        coalesce(
          (
            v_h2h_finalize_result
            ->> 'standingsRows'
          )::integer,
          0
        );

    end loop;

  end if;


  -- ----------------------------------------------------------
  -- Resolve and PREPARE following week.
  --
  -- This does not activate it. The user-facing active-week helper
  -- remains on the completed week until Tuesday 6 AM ET.
  -- ----------------------------------------------------------
  select
    r.season,
    r.week
  into
    v_next_season,
    v_next_week

  from public.get_following_nfl_regular_season_week(
    v_current_season,
    v_current_week
  ) r;


  if v_next_season is not null
     and v_next_week is not null
  then

    v_next_preparation_result :=
      public.prepare_active_season_long_week(
        v_next_season,
        v_next_week
      );

    v_next_week_prepared :=
      coalesce(
        (
          v_next_preparation_result
          ->> 'success'
        )::boolean,
        false
      );

  end if;


  return jsonb_build_object(
    'success',
      true,

    'currentSeason',
      v_current_season,

    'providerWeek',
      v_provider_week,

    'currentWeek',
      v_current_week,

    'currentWeekGames',
      v_current_week_games,

    'currentWeekFinalGames',
      v_current_week_final_games,

    'currentWeekFirstKickoff',
      v_current_week_first_kickoff,

    'currentWeekComplete',
      v_current_week_complete,

    'currentWeekPrepared',
      v_current_week_prepared,

    'currentPreparationMode',
      'per_game_kickoff_freeze',

    'currentPreparationResult',
      v_current_preparation_result,

    'leaguesLockChecked',
      v_leagues_lock_checked,

    'playersLocked',
      v_players_locked,

    'scoringResult',
      v_scoring_result,

    'finalizeResult',
      v_finalize_result,

    'h2hLeaguesChecked',
      v_h2h_leagues_checked,

    'h2hMatchupsSynced',
      v_h2h_matchups_synced,

    'h2hStandingsRows',
      v_h2h_standings_rows,

    'rolloverGate',
      v_rollover_gate,

    'nextSeason',
      v_next_season,

    'nextWeek',
      v_next_week,

    'nextWeekPrepared',
      v_next_week_prepared,

    'nextPreparationResult',
      v_next_preparation_result
  );
end;
$function$;


-- ============================================================
-- 6. PERMISSIONS
-- ============================================================

grant execute
on function public.sync_season_long_h2h_week(
  uuid,
  integer,
  integer
)
to authenticated;


grant execute
on function public.rebuild_season_long_h2h_standings(
  uuid,
  integer
)
to authenticated;


grant execute
on function public.finalize_season_long_h2h_week(
  uuid,
  integer,
  integer
)
to authenticated;


grant execute
on function public.run_season_long_weekly_lifecycle()
to authenticated;


commit;


-- ============================================================
-- VERIFICATION
-- ============================================================

select
  routine_name,
  data_type
from information_schema.routines
where routine_schema =
      'public'
  and routine_name in (
    'get_active_season_long_week',
    'sync_season_long_h2h_week',
    'rebuild_season_long_h2h_standings',
    'finalize_season_long_h2h_week',
    'run_season_long_weekly_lifecycle'
  )
order by
  routine_name;