begin;

-- ============================================================
-- 1. SHARED NFL WEEK ROLLOVER GATE
-- ============================================================

create or replace function public.get_g365_week_rollover_gate(
  p_season integer,
  p_week integer,
  p_reference_time timestamptz default now(),
  p_rollover_hour_et integer default 6
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_game_count integer := 0;
  v_final_count integer := 0;
  v_canceled_count integer := 0;
  v_unresolved_count integer := 0;

  v_first_kickoff timestamptz;
  v_last_kickoff timestamptz;

  v_tuesday_date date;
  v_rollover_at timestamptz;

  v_allowed boolean := false;
begin
  if p_week is null
     or p_week < 1
     or p_week > 18
  then
    return jsonb_build_object(
      'success', false,
      'allowed', false,
      'reason', 'invalid_week',
      'season', p_season,
      'week', p_week
    );
  end if;

  if p_rollover_hour_et < 0
     or p_rollover_hour_et > 23
  then
    return jsonb_build_object(
      'success', false,
      'allowed', false,
      'reason', 'invalid_rollover_hour',
      'season', p_season,
      'week', p_week
    );
  end if;

  -- ----------------------------------------------------------
  -- NFL regular-season games only.
  --
  -- status_completed is the strongest current DB signal.
  -- Status text is also checked so postponed/suspended/delayed
  -- games can never accidentally pass the gate.
  -- ----------------------------------------------------------

  select
    count(*)::integer,

    count(*) filter (
      where coalesce(g.status_completed, false) = true
         or public.normalize_nfl_game_status(
              coalesce(
                nullif(g.status_name, ''),
                nullif(g.status_type, ''),
                g.status_detail
              )
            ) = 'final'
    )::integer,

    count(*) filter (
      where public.normalize_nfl_game_status(
              coalesce(
                nullif(g.status_name, ''),
                nullif(g.status_type, ''),
                g.status_detail
              )
            ) = 'canceled'
    )::integer,

    count(*) filter (
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
    )::integer,

    min(g.kickoff_at),
    max(g.kickoff_at)

  into
    v_game_count,
    v_final_count,
    v_canceled_count,
    v_unresolved_count,
    v_first_kickoff,
    v_last_kickoff

  from public.nfl_games g

  where g.season = p_season
    and g.season_type = 2
    and g.week = p_week;

  if v_game_count = 0 then
    return jsonb_build_object(
      'success', true,
      'allowed', false,
      'reason', 'nfl_schedule_missing',
      'season', p_season,
      'week', p_week,
      'gameCount', 0,
      'finalGameCount', 0,
      'canceledGameCount', 0,
      'unresolvedGameCount', 0
    );
  end if;

  -- ----------------------------------------------------------
  -- Derive the Tuesday that ends this NFL fantasy week.
  --
  -- Example:
  --   First kickoff Thursday Sep 10
  --   Week-ending Tuesday is Sep 15
  --   Rollover becomes Tuesday Sep 15 at 6:00 AM ET.
  --
  -- We derive this from the week's first kickoff so a postponed
  -- game's later rescheduled kickoff does not move the intended
  -- original week boundary.
  -- ----------------------------------------------------------

  v_tuesday_date :=
    (
      date_trunc(
        'week',
        v_first_kickoff at time zone 'America/New_York'
      )
      + interval '8 days'
    )::date;

  v_rollover_at :=
    (
      v_tuesday_date::timestamp
      + make_interval(hours => p_rollover_hour_et)
    )
    at time zone 'America/New_York';

  v_allowed :=
    v_unresolved_count = 0
    and p_reference_time >= v_rollover_at;

  return jsonb_build_object(
    'success', true,

    'allowed', v_allowed,

    'reason',
      case
        when v_unresolved_count > 0
          then 'nfl_week_unresolved'

        when p_reference_time < v_rollover_at
          then 'waiting_for_tuesday_rollover'

        else 'ready'
      end,

    'season', p_season,
    'week', p_week,

    'gameCount', v_game_count,
    'finalGameCount', v_final_count,
    'canceledGameCount', v_canceled_count,
    'unresolvedGameCount', v_unresolved_count,

    'firstKickoffAt', v_first_kickoff,
    'lastKickoffAt', v_last_kickoff,

    'rolloverHourET', p_rollover_hour_et,
    'rolloverAt', v_rollover_at,
    'checkedAt', p_reference_time
  );
end;
$function$;


grant execute
on function public.get_g365_week_rollover_gate(
  integer,
  integer,
  timestamptz,
  integer
)
to authenticated;


-- ============================================================
-- 2. PRESERVE CURRENT TRADITIONAL REGULAR-SEASON ADVANCE LOGIC
-- ============================================================

do $$
begin
  if to_regprocedure(
       'public.auto_advance_traditional_week_ungated(uuid)'
     ) is null
     and to_regprocedure(
       'public.auto_advance_traditional_week(uuid)'
     ) is not null
  then
    alter function public.auto_advance_traditional_week(uuid)
      rename to auto_advance_traditional_week_ungated;
  end if;
end
$$;


-- Do not allow authenticated clients to bypass the safety wrapper.
revoke execute
on function public.auto_advance_traditional_week_ungated(uuid)
from public;

revoke execute
on function public.auto_advance_traditional_week_ungated(uuid)
from authenticated;

revoke execute
on function public.auto_advance_traditional_week_ungated(uuid)
from anon;


-- ============================================================
-- 3. HARD-GATED TRADITIONAL REGULAR-SEASON AUTO ADVANCE
-- ============================================================

create or replace function public.auto_advance_traditional_week(
  p_league_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_season integer;
  v_week integer;
  v_phase text;

  v_gate jsonb;
  v_result jsonb;
begin
  -- ----------------------------------------------------------
  -- Current production Traditional code uses
  -- traditional_week_progress. Read it first.
  -- ----------------------------------------------------------

  if to_regclass(
       'public.traditional_week_progress'
     ) is not null
  then
    execute
      'select season, active_week, phase
         from public.traditional_week_progress
        where league_id = $1
        limit 1'
    into
      v_season,
      v_week,
      v_phase
    using
      p_league_id;
  end if;

  -- ----------------------------------------------------------
  -- Fallback for Traditional installs still using
  -- traditional_season_state.
  -- ----------------------------------------------------------

  if v_season is null
     and to_regclass(
       'public.traditional_season_state'
     ) is not null
  then
    execute
      'select season, active_week, phase
         from public.traditional_season_state
        where league_id = $1
        limit 1'
    into
      v_season,
      v_week,
      v_phase
    using
      p_league_id;
  end if;

  if v_season is null
     or v_week is null
  then
    return jsonb_build_object(
      'success', false,
      'advanced', false,
      'leagueId', p_league_id,
      'reason', 'traditional_week_state_missing',
      'message',
        'Traditional active week could not be resolved.'
    );
  end if;

  -- ----------------------------------------------------------
  -- HARD SAFETY GATE
  --
  -- This is deliberately inside the RPC itself, not only in the
  -- API route. Any caller receives the same protection.
  -- ----------------------------------------------------------

  v_gate :=
    public.get_g365_week_rollover_gate(
      v_season,
      v_week,
      now(),
      6
    );

  if coalesce(
       (v_gate ->> 'allowed')::boolean,
       false
     ) = false
  then
    return jsonb_build_object(
      'success', true,
      'advanced', false,

      'leagueId', p_league_id,
      'season', v_season,
      'activeWeek', v_week,
      'completedWeek', null,
      'phase', v_phase,

      'reason',
        coalesce(
          v_gate ->> 'reason',
          'rollover_blocked'
        ),

      'message',
        case
          when v_gate ->> 'reason' =
               'nfl_week_unresolved'
          then
            format(
              'Week %s cannot advance because %s NFL game(s) are still unresolved, delayed, suspended, postponed, live, or scheduled.',
              v_week,
              coalesce(
                v_gate ->> 'unresolvedGameCount',
                '1'
              )
            )

          when v_gate ->> 'reason' =
               'waiting_for_tuesday_rollover'
          then
            format(
              'Week %s is complete but remains active until Tuesday at 6:00 AM Eastern.',
              v_week
            )

          when v_gate ->> 'reason' =
               'nfl_schedule_missing'
          then
            format(
              'Week %s cannot advance because the NFL schedule is not loaded.',
              v_week
            )

          else
            'Traditional week advancement is currently blocked by the G365 weekly rollover safety gate.'
        end,

      'rolloverGate',
        v_gate
    );
  end if;

  -- ----------------------------------------------------------
  -- Once the NFL week is resolved AND Tuesday 6 AM ET has
  -- arrived, run the exact Traditional advance implementation
  -- that was already in production.
  -- ----------------------------------------------------------

  v_result :=
    public.auto_advance_traditional_week_ungated(
      p_league_id
    );

  return
    coalesce(
      v_result,
      '{}'::jsonb
    )
    ||
    jsonb_build_object(
      'rolloverGate',
      v_gate
    );
end;
$function$;


grant execute
on function public.auto_advance_traditional_week(uuid)
to authenticated;


-- ============================================================
-- 4. PRESERVE CURRENT TRADITIONAL PLAYOFF ADVANCE LOGIC
-- ============================================================

do $$
begin
  if to_regprocedure(
       'public.auto_advance_traditional_playoffs_ungated(uuid)'
     ) is null
     and to_regprocedure(
       'public.auto_advance_traditional_playoffs(uuid)'
     ) is not null
  then
    alter function public.auto_advance_traditional_playoffs(uuid)
      rename to auto_advance_traditional_playoffs_ungated;
  end if;
end
$$;


revoke execute
on function public.auto_advance_traditional_playoffs_ungated(uuid)
from public;

revoke execute
on function public.auto_advance_traditional_playoffs_ungated(uuid)
from authenticated;

revoke execute
on function public.auto_advance_traditional_playoffs_ungated(uuid)
from anon;


-- ============================================================
-- 5. HARD-GATED TRADITIONAL PLAYOFF AUTO ADVANCE
--
-- Traditional playoffs are played during NFL regular-season
-- weeks, so they use the same Tuesday-morning protection.
-- ============================================================

create or replace function public.auto_advance_traditional_playoffs(
  p_league_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_season integer;
  v_week integer;

  v_gate jsonb;
begin
  select
    s.season,
    s.active_week
  into
    v_season,
    v_week
  from public.traditional_season_state s
  where s.league_id = p_league_id
  limit 1;

  if not found
     or v_season is null
     or v_week is null
  then
    return false;
  end if;

  v_gate :=
    public.get_g365_week_rollover_gate(
      v_season,
      v_week,
      now(),
      6
    );

  if coalesce(
       (v_gate ->> 'allowed')::boolean,
       false
     ) = false
  then
    return false;
  end if;

  return
    public.auto_advance_traditional_playoffs_ungated(
      p_league_id
    );
end;
$function$;


grant execute
on function public.auto_advance_traditional_playoffs(uuid)
to authenticated;


-- ============================================================
-- 6. SEASON-LONG SAFETY NOTE
--
-- Existing finalize_season_long_week(season, week) ALREADY blocks
-- finalization unless all NFL regular-season games are complete.
--
-- Season-Long H2H and all new weekly formats should call:
--
--   get_g365_week_rollover_gate(season, week, now(), 6)
--
-- before changing their ACTIVE fantasy week.
--
-- The helper is installed now so there is one common standard
-- across G365 moving forward.
-- ============================================================


commit;


-- ============================================================
-- VERIFICATION
-- ============================================================

select
  routine_name,
  data_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'get_g365_week_rollover_gate',
    'auto_advance_traditional_week',
    'auto_advance_traditional_week_ungated',
    'auto_advance_traditional_playoffs',
    'auto_advance_traditional_playoffs_ungated'
  )
order by routine_name;