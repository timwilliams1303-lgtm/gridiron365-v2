begin;

-- ============================================================
-- 1. PLAYOFF SEEDS
-- ============================================================

create table if not exists public.season_long_playoff_seeds (
  league_id uuid not null
    references public.leagues(id)
    on delete cascade,

  season integer not null,

  fantasy_team_id bigint not null
    references public.fantasy_teams(id)
    on delete cascade,

  seed integer not null,
  wins integer not null default 0,
  losses integer not null default 0,
  ties integer not null default 0,
  points_for numeric(14,2) not null default 0,
  points_against numeric(14,2) not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (
    league_id,
    season,
    fantasy_team_id
  ),

  constraint season_long_playoff_seeds_seed_check
    check (seed between 1 and 16)
);

create unique index if not exists
season_long_playoff_seeds_unique_seed
on public.season_long_playoff_seeds (
  league_id,
  season,
  seed
);

create index if not exists
season_long_playoff_seeds_lookup
on public.season_long_playoff_seeds (
  league_id,
  season,
  seed
);


-- ============================================================
-- 2. PLAYOFF STATE
-- ============================================================

create table if not exists public.season_long_playoff_state (
  league_id uuid not null
    references public.leagues(id)
    on delete cascade,

  season integer not null,

  status text not null default 'not_started',
  playoff_team_count integer not null,
  bracket_size integer not null,
  round_count integer not null,
  current_round integer not null default 0,
  playoff_start_week integer not null,
  champion_fantasy_team_id bigint
    references public.fantasy_teams(id)
    on delete set null,

  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),

  primary key (
    league_id,
    season
  ),

  constraint season_long_playoff_state_status_check
    check (
      status in (
        'not_started',
        'active',
        'complete'
      )
    ),

  constraint season_long_playoff_state_team_count_check
    check (playoff_team_count between 2 and 16),

  constraint season_long_playoff_state_bracket_size_check
    check (bracket_size in (2,4,8,16)),

  constraint season_long_playoff_state_round_count_check
    check (round_count between 1 and 4),

  constraint season_long_playoff_state_week_check
    check (playoff_start_week between 1 and 18)
);


-- ============================================================
-- 3. BRACKET METADATA ON EXISTING MATCHUPS
-- ============================================================

alter table public.season_long_matchups
  add column if not exists playoff_slot integer,
  add column if not exists home_seed integer,
  add column if not exists away_seed integer,
  add column if not exists resolved_by_commissioner boolean
    not null default false,
  add column if not exists tiebreak_note text;

create index if not exists
season_long_matchups_playoff_lookup
on public.season_long_matchups (
  league_id,
  season,
  matchup_type,
  playoff_round,
  playoff_slot
);

-- Existing week/team uniqueness remains useful because a fantasy team
-- can participate in only one matchup in a fantasy week.


-- ============================================================
-- 4. HELPER: SEED FOR A TEAM
-- ============================================================

create or replace function public.get_season_long_playoff_seed(
  p_league_id uuid,
  p_season integer,
  p_fantasy_team_id bigint
)
returns integer
language sql
stable
security definer
set search_path = public
as $function$
  select s.seed
  from public.season_long_playoff_seeds s
  where s.league_id = p_league_id
    and s.season = p_season
    and s.fantasy_team_id = p_fantasy_team_id
  limit 1;
$function$;


-- ============================================================
-- 5. HELPER: SYNC PLAYOFF SCORES FOR ONE WEEK
-- ============================================================

create or replace function public.sync_season_long_playoff_week(
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
            and s.fantasy_team_id = m.home_fantasy_team_id
          limit 1
        ),
        0
      ),

    away_points =
      coalesce(
        (
          select s.fantasy_points
          from public.season_long_weekly_scores s
          where s.league_id = m.league_id
            and s.season = m.season
            and s.week = m.week
            and s.fantasy_team_id = m.away_fantasy_team_id
          limit 1
        ),
        0
      ),

    home_score_final =
      coalesce(
        (
          select s.is_final
          from public.season_long_weekly_scores s
          where s.league_id = m.league_id
            and s.season = m.season
            and s.week = m.week
            and s.fantasy_team_id = m.home_fantasy_team_id
          limit 1
        ),
        false
      ),

    away_score_final =
      coalesce(
        (
          select s.is_final
          from public.season_long_weekly_scores s
          where s.league_id = m.league_id
            and s.season = m.season
            and s.week = m.week
            and s.fantasy_team_id = m.away_fantasy_team_id
          limit 1
        ),
        false
      ),

    is_final =
      case
        when m.resolved_by_commissioner then true
        else
          coalesce(
            (
              select s.is_final
              from public.season_long_weekly_scores s
              where s.league_id = m.league_id
                and s.season = m.season
                and s.week = m.week
                and s.fantasy_team_id = m.home_fantasy_team_id
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
                and s.fantasy_team_id = m.away_fantasy_team_id
              limit 1
            ),
            false
          )
      end,

    winner_fantasy_team_id =
      case
        when m.resolved_by_commissioner
          then m.winner_fantasy_team_id

        when not (
          coalesce(
            (
              select s.is_final
              from public.season_long_weekly_scores s
              where s.league_id = m.league_id
                and s.season = m.season
                and s.week = m.week
                and s.fantasy_team_id = m.home_fantasy_team_id
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
                and s.fantasy_team_id = m.away_fantasy_team_id
              limit 1
            ),
            false
          )
        )
          then null

        when
          coalesce(
            (
              select s.fantasy_points
              from public.season_long_weekly_scores s
              where s.league_id = m.league_id
                and s.season = m.season
                and s.week = m.week
                and s.fantasy_team_id = m.home_fantasy_team_id
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
                and s.fantasy_team_id = m.away_fantasy_team_id
              limit 1
            ),
            0
          )
          then m.home_fantasy_team_id

        when
          coalesce(
            (
              select s.fantasy_points
              from public.season_long_weekly_scores s
              where s.league_id = m.league_id
                and s.season = m.season
                and s.week = m.week
                and s.fantasy_team_id = m.away_fantasy_team_id
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
                and s.fantasy_team_id = m.home_fantasy_team_id
              limit 1
            ),
            0
          )
          then m.away_fantasy_team_id

        else null
      end,

    is_tie =
      case
        when m.resolved_by_commissioner then false

        when not (
          coalesce(
            (
              select s.is_final
              from public.season_long_weekly_scores s
              where s.league_id = m.league_id
                and s.season = m.season
                and s.week = m.week
                and s.fantasy_team_id = m.home_fantasy_team_id
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
                and s.fantasy_team_id = m.away_fantasy_team_id
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
                and s.fantasy_team_id = m.home_fantasy_team_id
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
                and s.fantasy_team_id = m.away_fantasy_team_id
              limit 1
            ),
            0
          )
      end,

    updated_at = now()

  where m.league_id = p_league_id
    and m.season = p_season
    and m.week = p_week
    and m.matchup_type = 'playoff';

  get diagnostics v_updated = row_count;

  return v_updated;
end;
$function$;


-- ============================================================
-- 6. START PLAYOFFS
--
-- Seeds from FINAL regular-season standings.
--
-- Example: 6 teams
--   bracket size = 8
--   Round 1:
--     #3 vs #6
--     #4 vs #5
--   #1 and #2 receive byes.
-- ============================================================

create or replace function public.start_season_long_h2h_playoffs(
  p_league_id uuid,
  p_season integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_format text;
  v_playoffs_enabled boolean;
  v_playoff_team_count integer;
  v_regular_season_weeks integer;

  v_active_team_count integer;
  v_standing_count integer;
  v_unfinal_regular_matchups integer;

  v_bracket_size integer := 2;
  v_round_count integer := 1;
  v_playoff_start_week integer;

  v_seed integer;
  v_opponent_seed integer;
  v_bye_count integer;

  v_home_team_id bigint;
  v_away_team_id bigint;

  v_slot integer := 0;
  v_matchups_created integer := 0;
begin
  select
    s.competition_format,
    s.playoffs_enabled,
    s.playoff_team_count,
    s.regular_season_weeks
  into
    v_format,
    v_playoffs_enabled,
    v_playoff_team_count,
    v_regular_season_weeks
  from public.season_long_settings s
  where s.league_id = p_league_id;

  if v_format is null then
    raise exception 'Season-Long settings were not found for this league.';
  end if;

  if v_format <> 'head_to_head' then
    raise exception 'Season-Long league is not configured for Head-to-Head.';
  end if;

  if not coalesce(v_playoffs_enabled, false) then
    raise exception 'Head-to-Head playoffs are disabled for this league.';
  end if;

  select count(*)::integer
  into v_active_team_count
  from public.fantasy_teams ft
  where ft.league_id = p_league_id
    and ft.active = true;

  if v_active_team_count < 2 then
    raise exception 'At least two active teams are required for playoffs.';
  end if;

  if v_playoff_team_count > v_active_team_count then
    raise exception
      'Playoff team count (%) exceeds active team count (%).',
      v_playoff_team_count,
      v_active_team_count;
  end if;

  -- Every scheduled regular-season matchup through the configured
  -- regular-season end must be final before playoff seeding.
  select count(*)::integer
  into v_unfinal_regular_matchups
  from public.season_long_matchups m
  where m.league_id = p_league_id
    and m.season = p_season
    and m.matchup_type = 'regular_season'
    and m.week <= v_regular_season_weeks
    and m.is_final = false;

  if v_unfinal_regular_matchups > 0 then
    raise exception
      'Regular season is not complete. % matchup(s) are still unresolved.',
      v_unfinal_regular_matchups;
  end if;

  perform public.rebuild_season_long_h2h_standings(
    p_league_id,
    p_season
  );

  select count(*)::integer
  into v_standing_count
  from public.season_long_h2h_standings s
  where s.league_id = p_league_id
    and s.season = p_season;

  if v_standing_count < v_playoff_team_count then
    raise exception
      'Only % ranked team(s) are available for a % team playoff.',
      v_standing_count,
      v_playoff_team_count;
  end if;

  v_bracket_size := 2;
  v_round_count := 1;

  while v_bracket_size < v_playoff_team_count loop
    v_bracket_size := v_bracket_size * 2;
    v_round_count := v_round_count + 1;
  end loop;

  v_playoff_start_week := v_regular_season_weeks + 1;

  if v_playoff_start_week + v_round_count - 1 > 18 then
    raise exception
      'Configured regular season leaves insufficient NFL weeks for a % round playoff.',
      v_round_count;
  end if;

  delete from public.season_long_matchups
  where league_id = p_league_id
    and season = p_season
    and matchup_type in ('playoff', 'consolation');

  delete from public.season_long_playoff_seeds
  where league_id = p_league_id
    and season = p_season;

  insert into public.season_long_playoff_seeds (
    league_id,
    season,
    fantasy_team_id,
    seed,
    wins,
    losses,
    ties,
    points_for,
    points_against,
    created_at,
    updated_at
  )
  select
    p_league_id,
    p_season,
    s.fantasy_team_id,
    row_number() over (
      order by
        s.current_rank asc,
        s.win_percentage desc,
        s.points_for desc,
        (s.points_for - s.points_against) desc,
        s.fantasy_team_id asc
    )::integer,
    s.wins,
    s.losses,
    s.ties,
    s.points_for,
    s.points_against,
    now(),
    now()
  from public.season_long_h2h_standings s
  where s.league_id = p_league_id
    and s.season = p_season
  order by
    s.current_rank asc,
    s.win_percentage desc,
    s.points_for desc,
    (s.points_for - s.points_against) desc,
    s.fantasy_team_id asc
  limit v_playoff_team_count;

  insert into public.season_long_playoff_state (
    league_id,
    season,
    status,
    playoff_team_count,
    bracket_size,
    round_count,
    current_round,
    playoff_start_week,
    champion_fantasy_team_id,
    started_at,
    completed_at,
    updated_at
  )
  values (
    p_league_id,
    p_season,
    'active',
    v_playoff_team_count,
    v_bracket_size,
    v_round_count,
    1,
    v_playoff_start_week,
    null,
    now(),
    null,
    now()
  )
  on conflict (league_id, season)
  do update set
    status = excluded.status,
    playoff_team_count = excluded.playoff_team_count,
    bracket_size = excluded.bracket_size,
    round_count = excluded.round_count,
    current_round = excluded.current_round,
    playoff_start_week = excluded.playoff_start_week,
    champion_fantasy_team_id = null,
    started_at = excluded.started_at,
    completed_at = null,
    updated_at = now();

  -- Number of top seeds that skip Round 1.
  v_bye_count := v_bracket_size - v_playoff_team_count;

  -- Create only the real Round-1 games. Top bye seeds are not given
  -- fake matchup rows or fake wins.
  --
  -- Pairing follows standard seed order:
  --   bracket 8 -> 1v8, 4v5, 2v7, 3v6
  -- When low seeds do not exist, the corresponding high seed has a bye.
  --
  -- For the current default 6-team format:
  --   1v8 -> #1 bye
  --   2v7 -> #2 bye
  --   4v5 -> game
  --   3v6 -> game
  for v_seed in 1..(v_bracket_size / 2) loop
    v_opponent_seed := v_bracket_size + 1 - v_seed;

    if v_seed <= v_playoff_team_count
       and v_opponent_seed <= v_playoff_team_count
    then
      select s.fantasy_team_id
      into v_home_team_id
      from public.season_long_playoff_seeds s
      where s.league_id = p_league_id
        and s.season = p_season
        and s.seed = v_seed;

      select s.fantasy_team_id
      into v_away_team_id
      from public.season_long_playoff_seeds s
      where s.league_id = p_league_id
        and s.season = p_season
        and s.seed = v_opponent_seed;

      v_slot := v_slot + 1;

      insert into public.season_long_matchups (
        league_id,
        season,
        week,
        home_fantasy_team_id,
        away_fantasy_team_id,
        home_points,
        away_points,
        home_score_final,
        away_score_final,
        is_final,
        winner_fantasy_team_id,
        is_tie,
        matchup_type,
        playoff_round,
        playoff_slot,
        home_seed,
        away_seed,
        resolved_by_commissioner,
        tiebreak_note,
        created_at,
        updated_at
      )
      values (
        p_league_id,
        p_season,
        v_playoff_start_week,
        v_home_team_id,
        v_away_team_id,
        0,
        0,
        false,
        false,
        false,
        null,
        false,
        'playoff',
        1,
        v_slot,
        v_seed,
        v_opponent_seed,
        false,
        null,
        now(),
        now()
      );

      v_matchups_created := v_matchups_created + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'success', true,
    'leagueId', p_league_id,
    'season', p_season,
    'playoffTeamCount', v_playoff_team_count,
    'bracketSize', v_bracket_size,
    'roundCount', v_round_count,
    'byeCount', v_bye_count,
    'playoffStartWeek', v_playoff_start_week,
    'currentRound', 1,
    'matchupsCreated', v_matchups_created
  );
end;
$function$;


-- ============================================================
-- 7. ADVANCE PLAYOFFS
--
-- The function may be called repeatedly by lifecycle/cron.
-- It is idempotent:
--   • no advancement until all current-round games are final
--   • no advancement while a tied game lacks a resolved winner
--   • no advancement before Tuesday 6 AM ET
--   • no duplicate next-round rows
-- ============================================================

create or replace function public.advance_season_long_h2h_playoffs(
  p_league_id uuid,
  p_season integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_state public.season_long_playoff_state%rowtype;
  v_reseed boolean := true;

  v_current_week integer;
  v_next_week integer;
  v_next_round integer;

  v_gate jsonb;
  v_gate_allowed boolean := false;

  v_current_matchups integer := 0;
  v_final_matchups integer := 0;
  v_unresolved_ties integer := 0;

  v_remaining_team_ids bigint[];
  v_remaining_count integer := 0;

  v_team_id bigint;
  v_seed integer;

  v_sorted_team_ids bigint[];
  v_sorted_seed_ids integer[];

  v_pair_count integer;
  v_pair integer;
  v_home_team_id bigint;
  v_away_team_id bigint;
  v_home_seed integer;
  v_away_seed integer;

  v_matchups_created integer := 0;
  v_champion_team_id bigint;
begin
  select *
  into v_state
  from public.season_long_playoff_state s
  where s.league_id = p_league_id
    and s.season = p_season;

  if not found then
    return jsonb_build_object(
      'success', true,
      'advanced', false,
      'reason', 'playoffs_not_started',
      'leagueId', p_league_id,
      'season', p_season
    );
  end if;

  if v_state.status = 'complete' then
    return jsonb_build_object(
      'success', true,
      'advanced', false,
      'reason', 'playoffs_complete',
      'leagueId', p_league_id,
      'season', p_season,
      'championFantasyTeamId', v_state.champion_fantasy_team_id
    );
  end if;

  select coalesce(s.reseed_playoffs, true)
  into v_reseed
  from public.season_long_settings s
  where s.league_id = p_league_id;

  v_current_week :=
    v_state.playoff_start_week
    + v_state.current_round
    - 1;

  perform public.sync_season_long_playoff_week(
    p_league_id,
    p_season,
    v_current_week
  );

  select
    count(*)::integer,
    count(*) filter (
      where m.is_final = true
    )::integer,
    count(*) filter (
      where m.is_final = true
        and (
          m.is_tie = true
          or m.winner_fantasy_team_id is null
        )
    )::integer
  into
    v_current_matchups,
    v_final_matchups,
    v_unresolved_ties
  from public.season_long_matchups m
  where m.league_id = p_league_id
    and m.season = p_season
    and m.matchup_type = 'playoff'
    and m.playoff_round = v_state.current_round;

  if v_current_matchups = 0 then
    return jsonb_build_object(
      'success', true,
      'advanced', false,
      'reason', 'current_round_matchups_missing',
      'currentRound', v_state.current_round,
      'week', v_current_week
    );
  end if;

  if v_final_matchups < v_current_matchups then
    return jsonb_build_object(
      'success', true,
      'advanced', false,
      'reason', 'current_round_not_final',
      'currentRound', v_state.current_round,
      'week', v_current_week,
      'matchups', v_current_matchups,
      'finalMatchups', v_final_matchups
    );
  end if;

  if v_unresolved_ties > 0 then
    return jsonb_build_object(
      'success', true,
      'advanced', false,
      'reason', 'playoff_tiebreak_required',
      'currentRound', v_state.current_round,
      'week', v_current_week,
      'unresolvedTies', v_unresolved_ties
    );
  end if;

  v_gate :=
    public.get_g365_week_rollover_gate(
      p_season,
      v_current_week,
      now(),
      6
    );

  v_gate_allowed :=
    coalesce(
      (v_gate ->> 'allowed')::boolean,
      false
    );

  if not v_gate_allowed then
    return jsonb_build_object(
      'success', true,
      'advanced', false,
      'reason', coalesce(
        v_gate ->> 'reason',
        'rollover_gate_blocked'
      ),
      'currentRound', v_state.current_round,
      'week', v_current_week,
      'rolloverGate', v_gate
    );
  end if;

  -- Championship round complete.
  if v_state.current_round >= v_state.round_count then
    select m.winner_fantasy_team_id
    into v_champion_team_id
    from public.season_long_matchups m
    where m.league_id = p_league_id
      and m.season = p_season
      and m.matchup_type = 'playoff'
      and m.playoff_round = v_state.current_round
      and m.is_final = true
    order by m.playoff_slot, m.id
    limit 1;

    if v_champion_team_id is null then
      return jsonb_build_object(
        'success', true,
        'advanced', false,
        'reason', 'championship_winner_missing'
      );
    end if;

    update public.season_long_playoff_state
    set
      status = 'complete',
      champion_fantasy_team_id = v_champion_team_id,
      completed_at = now(),
      updated_at = now()
    where league_id = p_league_id
      and season = p_season;

    return jsonb_build_object(
      'success', true,
      'advanced', true,
      'completed', true,
      'leagueId', p_league_id,
      'season', p_season,
      'championFantasyTeamId', v_champion_team_id
    );
  end if;

  v_next_round := v_state.current_round + 1;
  v_next_week := v_current_week + 1;

  -- Idempotency: if the next round already exists, just move state forward.
  if exists (
    select 1
    from public.season_long_matchups m
    where m.league_id = p_league_id
      and m.season = p_season
      and m.matchup_type = 'playoff'
      and m.playoff_round = v_next_round
  ) then
    update public.season_long_playoff_state
    set
      current_round = v_next_round,
      updated_at = now()
    where league_id = p_league_id
      and season = p_season;

    return jsonb_build_object(
      'success', true,
      'advanced', true,
      'reason', 'next_round_already_exists',
      'currentRound', v_next_round,
      'week', v_next_week
    );
  end if;

  -- Build remaining field:
  --   1) winners from current round
  --   2) bye seeds that have not yet appeared in a playoff matchup
  select array_agg(x.fantasy_team_id order by x.seed)
  into v_remaining_team_ids
  from (
    select
      m.winner_fantasy_team_id as fantasy_team_id,
      public.get_season_long_playoff_seed(
        p_league_id,
        p_season,
        m.winner_fantasy_team_id
      ) as seed
    from public.season_long_matchups m
    where m.league_id = p_league_id
      and m.season = p_season
      and m.matchup_type = 'playoff'
      and m.playoff_round = v_state.current_round
      and m.is_final = true
      and m.winner_fantasy_team_id is not null

    union

    select
      s.fantasy_team_id,
      s.seed
    from public.season_long_playoff_seeds s
    where s.league_id = p_league_id
      and s.season = p_season
      and not exists (
        select 1
        from public.season_long_matchups pm
        where pm.league_id = s.league_id
          and pm.season = s.season
          and pm.matchup_type = 'playoff'
          and pm.playoff_round <= v_state.current_round
          and (
            pm.home_fantasy_team_id = s.fantasy_team_id
            or pm.away_fantasy_team_id = s.fantasy_team_id
          )
      )
  ) x;

  v_remaining_count :=
    coalesce(
      array_length(v_remaining_team_ids, 1),
      0
    );

  -- A normal next round must have an even number of teams.
  if v_remaining_count < 2
     or mod(v_remaining_count, 2) <> 0
  then
    return jsonb_build_object(
      'success', false,
      'advanced', false,
      'reason', 'invalid_remaining_playoff_field',
      'remainingTeams', v_remaining_count,
      'currentRound', v_state.current_round
    );
  end if;

  -- Sort remaining teams by original seed.
  select
    array_agg(x.fantasy_team_id order by x.seed),
    array_agg(x.seed order by x.seed)
  into
    v_sorted_team_ids,
    v_sorted_seed_ids
  from (
    select
      u.team_id as fantasy_team_id,
      public.get_season_long_playoff_seed(
        p_league_id,
        p_season,
        u.team_id
      ) as seed
    from unnest(v_remaining_team_ids) as u(team_id)
  ) x;

  v_pair_count := v_remaining_count / 2;

  -- Reseeding pairs highest remaining seed with lowest remaining seed.
  --
  -- Fixed bracket uses the same original-seed ordering at the first
  -- advancement point, then preserves created bracket slots thereafter.
  -- For the common 6-team bracket this yields:
  --   reseed ON  -> #1 gets lowest surviving seed
  --   reseed OFF -> fixed semifinal paths from Round 1 slots
  if v_reseed or v_state.current_round > 1 then
    for v_pair in 1..v_pair_count loop
      v_home_team_id := v_sorted_team_ids[v_pair];
      v_home_seed := v_sorted_seed_ids[v_pair];

      v_away_team_id :=
        v_sorted_team_ids[
          v_remaining_count - v_pair + 1
        ];
      v_away_seed :=
        v_sorted_seed_ids[
          v_remaining_count - v_pair + 1
        ];

      insert into public.season_long_matchups (
        league_id,
        season,
        week,
        home_fantasy_team_id,
        away_fantasy_team_id,
        matchup_type,
        playoff_round,
        playoff_slot,
        home_seed,
        away_seed,
        created_at,
        updated_at
      )
      values (
        p_league_id,
        p_season,
        v_next_week,
        v_home_team_id,
        v_away_team_id,
        'playoff',
        v_next_round,
        v_pair,
        v_home_seed,
        v_away_seed,
        now(),
        now()
      );

      v_matchups_created := v_matchups_created + 1;
    end loop;
  else
    -- Fixed-bracket Round 2:
    -- Pair teams according to standard bracket quarters rather than
    -- re-ranking based on which seeds survived.
    --
    -- For 6 teams:
    --   #1 vs winner of #4/#5
    --   #2 vs winner of #3/#6
    --
    -- Identify the two Round-1 winners by their original bracket path.
    if v_state.playoff_team_count = 6
       and v_state.bracket_size = 8
       and v_state.current_round = 1
    then
      -- Slot 1 in Stage 5A is #3/#6 and slot 2 is #4/#5 because
      -- v_seed loops upward. Resolve explicitly by seed membership,
      -- so this remains safe even if row order changes.
      select m.winner_fantasy_team_id
      into v_away_team_id
      from public.season_long_matchups m
      where m.league_id = p_league_id
        and m.season = p_season
        and m.matchup_type = 'playoff'
        and m.playoff_round = 1
        and (
          m.home_seed in (4,5)
          or m.away_seed in (4,5)
        )
      limit 1;

      select s.fantasy_team_id
      into v_home_team_id
      from public.season_long_playoff_seeds s
      where s.league_id = p_league_id
        and s.season = p_season
        and s.seed = 1;

      insert into public.season_long_matchups (
        league_id, season, week,
        home_fantasy_team_id, away_fantasy_team_id,
        matchup_type, playoff_round, playoff_slot,
        home_seed, away_seed, created_at, updated_at
      )
      values (
        p_league_id, p_season, v_next_week,
        v_home_team_id, v_away_team_id,
        'playoff', v_next_round, 1,
        1,
        public.get_season_long_playoff_seed(
          p_league_id, p_season, v_away_team_id
        ),
        now(), now()
      );

      select m.winner_fantasy_team_id
      into v_away_team_id
      from public.season_long_matchups m
      where m.league_id = p_league_id
        and m.season = p_season
        and m.matchup_type = 'playoff'
        and m.playoff_round = 1
        and (
          m.home_seed in (3,6)
          or m.away_seed in (3,6)
        )
      limit 1;

      select s.fantasy_team_id
      into v_home_team_id
      from public.season_long_playoff_seeds s
      where s.league_id = p_league_id
        and s.season = p_season
        and s.seed = 2;

      insert into public.season_long_matchups (
        league_id, season, week,
        home_fantasy_team_id, away_fantasy_team_id,
        matchup_type, playoff_round, playoff_slot,
        home_seed, away_seed, created_at, updated_at
      )
      values (
        p_league_id, p_season, v_next_week,
        v_home_team_id, v_away_team_id,
        'playoff', v_next_round, 2,
        2,
        public.get_season_long_playoff_seed(
          p_league_id, p_season, v_away_team_id
        ),
        now(), now()
      );

      v_matchups_created := 2;
    else
      -- Generic fixed fallback: original seed order. This keeps the
      -- bracket deterministic for commissioner-selected sizes other
      -- than the default 6-team format.
      for v_pair in 1..v_pair_count loop
        v_home_team_id := v_sorted_team_ids[v_pair];
        v_home_seed := v_sorted_seed_ids[v_pair];

        v_away_team_id :=
          v_sorted_team_ids[
            v_remaining_count - v_pair + 1
          ];
        v_away_seed :=
          v_sorted_seed_ids[
            v_remaining_count - v_pair + 1
          ];

        insert into public.season_long_matchups (
          league_id,
          season,
          week,
          home_fantasy_team_id,
          away_fantasy_team_id,
          matchup_type,
          playoff_round,
          playoff_slot,
          home_seed,
          away_seed,
          created_at,
          updated_at
        )
        values (
          p_league_id,
          p_season,
          v_next_week,
          v_home_team_id,
          v_away_team_id,
          'playoff',
          v_next_round,
          v_pair,
          v_home_seed,
          v_away_seed,
          now(),
          now()
        );

        v_matchups_created := v_matchups_created + 1;
      end loop;
    end if;
  end if;

  update public.season_long_playoff_state
  set
    current_round = v_next_round,
    updated_at = now()
  where league_id = p_league_id
    and season = p_season;

  return jsonb_build_object(
    'success', true,
    'advanced', true,
    'completed', false,
    'leagueId', p_league_id,
    'season', p_season,
    'currentRound', v_next_round,
    'week', v_next_week,
    'matchupsCreated', v_matchups_created,
    'reseeded', v_reseed
  );
end;
$function$;


-- ============================================================
-- 8. COMMISSIONER PLAYOFF TIEBREAK RESOLUTION
--
-- Only changes a matchup that is:
--   • a playoff matchup
--   • score-final
--   • tied
-- The selected winner must be one of the two teams.
-- ============================================================

create or replace function public.resolve_season_long_playoff_tiebreak(
  p_league_id uuid,
  p_season integer,
  p_matchup_id bigint,
  p_winner_fantasy_team_id bigint,
  p_note text default 'Commissioner playoff tiebreak'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_is_commissioner boolean := false;
  v_matchup public.season_long_matchups%rowtype;
begin
  if v_user_id is null then
    raise exception 'You must be signed in.';
  end if;

  select
    exists (
      select 1
      from public.leagues l
      where l.id = p_league_id
        and l.commissioner_user_id = v_user_id
    )
    or
    exists (
      select 1
      from public.league_members lm
      where lm.league_id = p_league_id
        and lm.user_id = v_user_id
        and lm.role in ('commissioner', 'co_commissioner')
    )
  into v_is_commissioner;

  if not v_is_commissioner then
    raise exception 'Commissioner access is required.';
  end if;

  select *
  into v_matchup
  from public.season_long_matchups m
  where m.id = p_matchup_id
    and m.league_id = p_league_id
    and m.season = p_season
    and m.matchup_type = 'playoff';

  if not found then
    raise exception 'Playoff matchup was not found.';
  end if;

  if not (
    v_matchup.home_score_final
    and v_matchup.away_score_final
  ) then
    raise exception 'The playoff matchup is not score-final yet.';
  end if;

  if not v_matchup.is_tie then
    raise exception 'This playoff matchup is not tied.';
  end if;

  if p_winner_fantasy_team_id not in (
    v_matchup.home_fantasy_team_id,
    v_matchup.away_fantasy_team_id
  ) then
    raise exception 'The selected winner is not in this playoff matchup.';
  end if;

  update public.season_long_matchups
  set
    winner_fantasy_team_id = p_winner_fantasy_team_id,
    is_tie = false,
    is_final = true,
    resolved_by_commissioner = true,
    tiebreak_note = nullif(trim(coalesce(p_note, '')), ''),
    updated_at = now()
  where id = p_matchup_id;

  return jsonb_build_object(
    'success', true,
    'matchupId', p_matchup_id,
    'winnerFantasyTeamId', p_winner_fantasy_team_id
  );
end;
$function$;


-- ============================================================
-- 9. LIFECYCLE CONVENIENCE CHECK
--
-- Safe to call from the main Season-Long lifecycle.
-- Starts playoffs only after regular-season results are complete and
-- the rollover gate for the final regular-season week is open.
-- Once active, syncs/advances the playoff bracket.
-- ============================================================

create or replace function public.run_season_long_h2h_playoff_lifecycle(
  p_league_id uuid,
  p_season integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_format text;
  v_enabled boolean;
  v_regular_weeks integer;
  v_state_status text;
  v_gate jsonb;
  v_gate_allowed boolean := false;
  v_unfinal integer := 0;
begin
  select
    s.competition_format,
    s.playoffs_enabled,
    s.regular_season_weeks
  into
    v_format,
    v_enabled,
    v_regular_weeks
  from public.season_long_settings s
  where s.league_id = p_league_id;

  if v_format <> 'head_to_head'
     or not coalesce(v_enabled, false)
  then
    return jsonb_build_object(
      'success', true,
      'action', 'skipped',
      'reason', 'playoffs_not_applicable'
    );
  end if;

  select s.status
  into v_state_status
  from public.season_long_playoff_state s
  where s.league_id = p_league_id
    and s.season = p_season;

  if v_state_status = 'active' then
    return public.advance_season_long_h2h_playoffs(
      p_league_id,
      p_season
    );
  end if;

  if v_state_status = 'complete' then
    return jsonb_build_object(
      'success', true,
      'action', 'complete',
      'reason', 'playoffs_complete'
    );
  end if;

  select count(*)::integer
  into v_unfinal
  from public.season_long_matchups m
  where m.league_id = p_league_id
    and m.season = p_season
    and m.matchup_type = 'regular_season'
    and m.week <= v_regular_weeks
    and m.is_final = false;

  if v_unfinal > 0 then
    return jsonb_build_object(
      'success', true,
      'action', 'waiting',
      'reason', 'regular_season_not_final',
      'unresolvedMatchups', v_unfinal
    );
  end if;

  v_gate :=
    public.get_g365_week_rollover_gate(
      p_season,
      v_regular_weeks,
      now(),
      6
    );

  v_gate_allowed :=
    coalesce(
      (v_gate ->> 'allowed')::boolean,
      false
    );

  if not v_gate_allowed then
    return jsonb_build_object(
      'success', true,
      'action', 'waiting',
      'reason', coalesce(
        v_gate ->> 'reason',
        'rollover_gate_blocked'
      ),
      'rolloverGate', v_gate
    );
  end if;

  return public.start_season_long_h2h_playoffs(
    p_league_id,
    p_season
  );
end;
$function$;


-- ============================================================
-- 10. PERMISSIONS
-- ============================================================

alter table public.season_long_playoff_seeds
  enable row level security;

alter table public.season_long_playoff_state
  enable row level security;

drop policy if exists
  "League members can view season long playoff seeds"
on public.season_long_playoff_seeds;

create policy
  "League members can view season long playoff seeds"
on public.season_long_playoff_seeds
for select
to authenticated
using (
  exists (
    select 1
    from public.league_members lm
    where lm.league_id =
      season_long_playoff_seeds.league_id
      and lm.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.leagues l
    where l.id =
      season_long_playoff_seeds.league_id
      and l.commissioner_user_id = auth.uid()
  )
);

drop policy if exists
  "League members can view season long playoff state"
on public.season_long_playoff_state;

create policy
  "League members can view season long playoff state"
on public.season_long_playoff_state
for select
to authenticated
using (
  exists (
    select 1
    from public.league_members lm
    where lm.league_id =
      season_long_playoff_state.league_id
      and lm.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.leagues l
    where l.id =
      season_long_playoff_state.league_id
      and l.commissioner_user_id = auth.uid()
  )
);

grant select
on public.season_long_playoff_seeds
to authenticated;

grant select
on public.season_long_playoff_state
to authenticated;

grant execute
on function public.get_season_long_playoff_seed(
  uuid,
  integer,
  bigint
)
to authenticated;

grant execute
on function public.sync_season_long_playoff_week(
  uuid,
  integer,
  integer
)
to authenticated;

grant execute
on function public.start_season_long_h2h_playoffs(
  uuid,
  integer
)
to authenticated;

grant execute
on function public.advance_season_long_h2h_playoffs(
  uuid,
  integer
)
to authenticated;

grant execute
on function public.resolve_season_long_playoff_tiebreak(
  uuid,
  integer,
  bigint,
  bigint,
  text
)
to authenticated;

grant execute
on function public.run_season_long_h2h_playoff_lifecycle(
  uuid,
  integer
)
to authenticated;

commit;


-- ============================================================
-- VERIFICATION
-- ============================================================

select
  routine_schema,
  routine_name,
  routine_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'get_season_long_playoff_seed',
    'sync_season_long_playoff_week',
    'start_season_long_h2h_playoffs',
    'advance_season_long_h2h_playoffs',
    'resolve_season_long_playoff_tiebreak',
    'run_season_long_h2h_playoff_lifecycle'
  )
order by routine_name;

select
  table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'season_long_playoff_seeds',
    'season_long_playoff_state'
  )
order by table_name;
