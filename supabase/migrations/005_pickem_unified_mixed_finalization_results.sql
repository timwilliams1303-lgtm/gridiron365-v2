begin;


-- ============================================================
-- 1. PRESERVE THE CURRENT VERIFIED FINALIZERS
-- ============================================================

do $$
begin
  if to_regprocedure(
       'public.finalize_pickem_week_legacy_g365(bigint)'
     ) is null
     and to_regprocedure(
       'public.finalize_pickem_week(bigint)'
     ) is not null
  then
    alter function public.finalize_pickem_week(bigint)
      rename to finalize_pickem_week_legacy_g365;
  end if;

  if to_regprocedure(
       'public.finalize_nhl_pickem_period_legacy_g365(bigint)'
     ) is null
     and to_regprocedure(
       'public.finalize_nhl_pickem_period(bigint)'
     ) is not null
  then
    alter function public.finalize_nhl_pickem_period(bigint)
      rename to finalize_nhl_pickem_period_legacy_g365;
  end if;
end
$$;


-- ============================================================
-- 2. UNIFIED MIXED-WEEK FINALIZER
-- ============================================================

create or replace function public.finalize_pickem_unified_week(
  p_pickem_week_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, auth, pg_temp
as $$
declare
  v_week public.pickem_weeks%rowtype;
  v_settings public.pickem_settings%rowtype;
  v_period public.nhl_pickem_periods%rowtype;

  v_nhl_enabled boolean := false;
  v_football_enabled boolean := false;

  v_expected_nhl_games integer := 0;
  v_unfinished_football integer := 0;
  v_unresolved_nhl integer := 0;
  v_pending_football_picks integer := 0;
  v_pending_nhl_picks integer := 0;

  v_overfilled_cards integer := 0;
  v_confidence_incomplete integer := 0;
  v_confidence_duplicates integer := 0;

  v_rows integer := 0;
  v_nhl_rows integer := 0;
  v_user uuid := auth.uid();
begin
  select *
  into v_week
  from public.pickem_weeks
  where id = p_pickem_week_id
  for update;

  if not found then
    raise exception 'Pick''em week could not be found.';
  end if;

  select *
  into v_settings
  from public.pickem_settings
  where league_id = v_week.league_id;

  if not found then
    raise exception 'Pick''em settings could not be found.';
  end if;

  v_nhl_enabled :=
    coalesce(v_settings.enabled_sports, array[]::text[])
      @> array['nhl']::text[];

  v_football_enabled :=
    coalesce(v_settings.enabled_sports, array[]::text[])
      && array['cfb','nfl']::text[];

  if not (
    v_nhl_enabled
    and v_football_enabled
  ) then
    raise exception
      'Unified Pick''em finalization is only for mixed Football + NHL leagues.';
  end if;

  if v_week.status = 'final' then
    return jsonb_build_object(
      'success', true,
      'finalized', true,
      'alreadyFinal', true,
      'week', v_week.week
    );
  end if;

  -- Preserve the Football contest gate.
  if v_week.finalize_not_before is not null
     and now() < v_week.finalize_not_before
  then
    return jsonb_build_object(
      'success', true,
      'finalized', false,
      'reason', 'finalize_gate_not_reached',
      'week', v_week.week
    );
  end if;

  -- Football games must be resolved.
  select count(*)::integer
  into v_unfinished_football
  from public.pickem_games g
  where g.pickem_week_id = v_week.id
    and g.is_eligible = true
    and g.is_final = false;

  if v_unfinished_football > 0 then
    update public.pickem_weeks
    set
      status = 'awaiting_finalization',
      updated_at = now()
    where id = v_week.id;

    return jsonb_build_object(
      'success', true,
      'finalized', false,
      'reason', 'football_games_still_unfinished',
      'unfinishedFootballGames', v_unfinished_football
    );
  end if;

  -- If authoritative regular-season NHL games exist in this master
  -- contest window, the corresponding NHL period must exist before
  -- the mixed week may close.
  select count(*)::integer
  into v_expected_nhl_games
  from public.nhl_games ng
  where ng.season = v_week.season
    and ng.kickoff_at >= v_week.slate_starts_at
    and ng.kickoff_at < v_week.slate_ends_at
    and coalesce(ng.season_type, 'regular') = 'regular';

  select *
  into v_period
  from public.nhl_pickem_periods p
  where p.league_id = v_week.league_id
    and p.season = v_week.season
    and p.period_number = v_week.week;

  if v_expected_nhl_games > 0
     and v_period.id is null
  then
    return jsonb_build_object(
      'success', true,
      'finalized', false,
      'reason', 'waiting_for_nhl_period',
      'expectedNhlGames', v_expected_nhl_games
    );
  end if;

  if v_period.id is not null then
    if now() < v_period.ends_at then
      return jsonb_build_object(
        'success', true,
        'finalized', false,
        'reason', 'nhl_period_not_ended',
        'nhlPickemPeriodId', v_period.id
      );
    end if;

    -- Grade completed frozen NHL games first.
    perform public.grade_nhl_pickem_game(g.id)
    from public.nhl_pickem_games g
    join public.nhl_games ng
      on ng.id = g.nhl_game_id
    where g.nhl_pickem_period_id = v_period.id
      and g.line_status = 'frozen'
      and ng.status_completed = true
      and (
        g.graded_at is null
        or g.final_home_score is distinct from ng.home_score
        or g.final_away_score is distinct from ng.away_score
      );

    select count(*)::integer
    into v_unresolved_nhl
    from public.nhl_pickem_games g
    join public.nhl_games ng
      on ng.id = g.nhl_game_id
    where g.nhl_pickem_period_id = v_period.id
      and (
        g.line_status = 'pending'
        or (
          g.line_status = 'frozen'
          and (
            ng.status_completed = false
            or g.graded_at is null
          )
        )
      );

    if v_unresolved_nhl > 0 then
      return jsonb_build_object(
        'success', true,
        'finalized', false,
        'reason', 'nhl_games_unresolved',
        'unresolvedNhlGames', v_unresolved_nhl
      );
    end if;
  end if;

  -- Defensive Football grading.
  perform public.grade_pickem_game(g.id)
  from public.pickem_games g
  where g.pickem_week_id = v_week.id
    and g.is_eligible = true
    and g.is_final = true
    and exists (
      select 1
      from public.pickem_picks p
      where p.pickem_game_id = g.id
        and p.pickem_week_id = v_week.id
        and coalesce(p.result,'pending') = 'pending'
    );

  select count(*)::integer
  into v_pending_football_picks
  from public.pickem_picks p
  join public.pickem_games g
    on g.id = p.pickem_game_id
  where p.pickem_week_id = v_week.id
    and g.is_eligible = true
    and coalesce(p.result,'pending') = 'pending';

  if v_period.id is not null then
    select count(*)::integer
    into v_pending_nhl_picks
    from public.nhl_pickem_picks p
    join public.nhl_pickem_games g
      on g.id = p.nhl_pickem_game_id
    where p.nhl_pickem_period_id = v_period.id
      and g.line_status = 'frozen'
      and coalesce(p.result,'pending') = 'pending';
  end if;

  if v_pending_football_picks + v_pending_nhl_picks > 0 then
    return jsonb_build_object(
      'success', true,
      'finalized', false,
      'reason', 'picks_still_pending',
      'footballPendingPicks', v_pending_football_picks,
      'nhlPendingPicks', v_pending_nhl_picks
    );
  end if;

  -- Ensure no legacy/pre-trigger card exceeds the combined required total.
  with card_counts as (
    select
      ft.id as fantasy_team_id,
      (
        select count(*)
        from public.pickem_picks p
        where p.pickem_week_id = v_week.id
          and p.fantasy_team_id = ft.id
          and coalesce(p.result,'pending') <> 'void'
      )
      +
      (
        select count(*)
        from public.nhl_pickem_picks np
        where v_period.id is not null
          and np.nhl_pickem_period_id = v_period.id
          and np.fantasy_team_id = ft.id
          and coalesce(np.result,'pending') <> 'void'
      ) as submitted
    from public.fantasy_teams ft
    where ft.league_id = v_week.league_id
      and coalesce(ft.active,true) = true
  )
  select count(*)::integer
  into v_overfilled_cards
  from card_counts
  where submitted > v_week.required_picks;

  if v_overfilled_cards > 0 then
    return jsonb_build_object(
      'success', false,
      'finalized', false,
      'reason', 'combined_card_overfilled',
      'overfilledCards', v_overfilled_cards
    );
  end if;

  -- Confidence mode is safe to finalize only if the combined card has
  -- one assigned, unique confidence value per submitted pick.
  if v_week.scoring_mode = 'confidence' then
    with combined_confidence as (
      select
        p.fantasy_team_id,
        p.confidence_value
      from public.pickem_picks p
      where p.pickem_week_id = v_week.id
        and coalesce(p.result,'pending') <> 'void'

      union all

      select
        p.fantasy_team_id,
        p.confidence_value
      from public.nhl_pickem_picks p
      where v_period.id is not null
        and p.nhl_pickem_period_id = v_period.id
        and coalesce(p.result,'pending') <> 'void'
    )
    select count(*)::integer
    into v_confidence_incomplete
    from combined_confidence
    where confidence_value is null;

    with combined_confidence as (
      select
        p.fantasy_team_id,
        p.confidence_value
      from public.pickem_picks p
      where p.pickem_week_id = v_week.id
        and coalesce(p.result,'pending') <> 'void'
        and p.confidence_value is not null

      union all

      select
        p.fantasy_team_id,
        p.confidence_value
      from public.nhl_pickem_picks p
      where v_period.id is not null
        and p.nhl_pickem_period_id = v_period.id
        and coalesce(p.result,'pending') <> 'void'
        and p.confidence_value is not null
    ),
    duplicates as (
      select fantasy_team_id, confidence_value
      from combined_confidence
      group by fantasy_team_id, confidence_value
      having count(*) > 1
    )
    select count(*)::integer
    into v_confidence_duplicates
    from duplicates;

    if v_confidence_incomplete > 0
       or v_confidence_duplicates > 0
    then
      return jsonb_build_object(
        'success', true,
        'finalized', false,
        'reason', 'mixed_confidence_not_ready',
        'missingConfidenceAssignments', v_confidence_incomplete,
        'duplicateConfidenceValues', v_confidence_duplicates
      );
    end if;
  end if;

  -- ==========================================================
  -- AUTHORITATIVE COMBINED WEEKLY RESULTS
  -- ==========================================================

  with football as (
    select
      ft.id as fantasy_team_id,
      count(p.id) filter (
        where coalesce(p.result,'pending') <> 'void'
      )::integer as submitted,
      count(p.id) filter (
        where p.result = 'win'
      )::integer as wins,
      count(p.id) filter (
        where p.result = 'loss'
      )::integer as losses,
      count(p.id) filter (
        where p.result = 'push'
      )::integer as pushes,
      coalesce(sum(
        case
          when coalesce(p.result,'pending') <> 'void'
            then p.points_awarded
          else 0
        end
      ),0)::numeric as points
    from public.fantasy_teams ft
    left join public.pickem_picks p
      on p.fantasy_team_id = ft.id
     and p.pickem_week_id = v_week.id
    where ft.league_id = v_week.league_id
      and coalesce(ft.active,true) = true
    group by ft.id
  ),
  hockey as (
    select
      ft.id as fantasy_team_id,
      count(p.id) filter (
        where coalesce(p.result,'pending') <> 'void'
      )::integer as submitted,
      count(p.id) filter (
        where p.result = 'win'
      )::integer as wins,
      count(p.id) filter (
        where p.result = 'loss'
      )::integer as losses,
      count(p.id) filter (
        where p.result = 'push'
      )::integer as pushes,
      coalesce(sum(
        case
          when coalesce(p.result,'pending') <> 'void'
            then p.points_awarded
          else 0
        end
      ),0)::numeric as points
    from public.fantasy_teams ft
    left join public.nhl_pickem_picks p
      on p.fantasy_team_id = ft.id
     and v_period.id is not null
     and p.nhl_pickem_period_id = v_period.id
    where ft.league_id = v_week.league_id
      and coalesce(ft.active,true) = true
    group by ft.id
  ),
  combined as (
    select
      f.fantasy_team_id,
      coalesce(f.submitted,0) + coalesce(h.submitted,0) as submitted,
      coalesce(f.wins,0) + coalesce(h.wins,0) as raw_wins,
      coalesce(f.losses,0) + coalesce(h.losses,0) as raw_losses,
      coalesce(f.pushes,0) + coalesce(h.pushes,0) as raw_pushes,
      coalesce(f.points,0) + coalesce(h.points,0) as raw_points
    from football f
    join hockey h
      on h.fantasy_team_id = f.fantasy_team_id
  ),
  prepared as (
    select
      c.*,
      greatest(v_week.required_picks - c.submitted,0)::integer as missing_picks
    from combined c
  )
  insert into public.pickem_weekly_results (
    league_id,
    pickem_week_id,
    fantasy_team_id,
    wins,
    losses,
    pushes,
    pending,
    points,
    is_final,
    weekly_rank,
    finalized_at,
    missing_picks,
    is_disqualified,
    updated_at
  )
  select
    v_week.league_id,
    v_week.id,
    p.fantasy_team_id,
    p.raw_wins,
    (
      p.raw_losses
      + case
          when v_week.missing_pick_policy = 'count_as_losses'
            then p.missing_picks
          else 0
        end
    )::integer,
    p.raw_pushes,
    0,
    p.raw_points,
    false,
    null,
    null,
    p.missing_picks,
    (
      v_week.missing_pick_policy = 'disqualify_week'
      and p.missing_picks > 0
    ),
    now()
  from prepared p
  on conflict (pickem_week_id, fantasy_team_id)
  do update
  set wins = excluded.wins,
      losses = excluded.losses,
      pushes = excluded.pushes,
      pending = 0,
      points = excluded.points,
      is_final = false,
      weekly_rank = null,
      finalized_at = null,
      missing_picks = excluded.missing_picks,
      is_disqualified = excluded.is_disqualified,
      updated_at = now();

  get diagnostics v_rows = row_count;

  -- Rank the authoritative combined card.
  update public.pickem_weekly_results
  set weekly_rank = null
  where pickem_week_id = v_week.id;

  if v_week.scoring_mode = 'record_only' then
    with ranked as (
      select
        id,
        dense_rank() over (
          order by wins desc, losses asc, pushes desc
        )::integer as rnk
      from public.pickem_weekly_results
      where pickem_week_id = v_week.id
        and is_disqualified = false
    )
    update public.pickem_weekly_results r
    set weekly_rank = ranked.rnk
    from ranked
    where r.id = ranked.id;
  else
    with ranked as (
      select
        id,
        dense_rank() over (
          order by points desc, wins desc, losses asc, pushes desc
        )::integer as rnk
      from public.pickem_weekly_results
      where pickem_week_id = v_week.id
        and is_disqualified = false
    )
    update public.pickem_weekly_results r
    set weekly_rank = ranked.rnk
    from ranked
    where r.id = ranked.id;
  end if;

  update public.pickem_weekly_results
  set
    is_final = true,
    finalized_at = now(),
    updated_at = now()
  where pickem_week_id = v_week.id;

  -- ==========================================================
  -- NHL COMPATIBILITY RESULTS
  --
  -- These are NHL-only raw performance rows for existing NHL
  -- recap/award infrastructure. Missing picks are intentionally 0
  -- because the REQUIRED count belongs to the combined G365 card.
  -- ==========================================================

  if v_period.id is not null then
    insert into public.nhl_pickem_period_results (
      league_id,
      nhl_pickem_period_id,
      entry_id,
      fantasy_team_id,
      required_picks,
      submitted_picks,
      missing_picks,
      wins,
      pushes,
      losses,
      ungraded,
      points,
      rank,
      is_period_winner,
      finalized_at,
      updated_at
    )
    select
      e.league_id,
      v_period.id,
      e.id,
      e.fantasy_team_id,
      count(p.id)::integer,
      count(p.id)::integer,
      0,
      count(p.id) filter (where p.result = 'win')::integer,
      count(p.id) filter (where p.result = 'push')::integer,
      count(p.id) filter (where p.result = 'loss')::integer,
      count(p.id) filter (
        where p.result is null
           or p.result = 'ungraded'
      )::integer,
      coalesce(sum(p.points_awarded),0)::numeric,
      null,
      false,
      now(),
      now()
    from public.nhl_pickem_entries e
    left join public.nhl_pickem_picks p
      on p.entry_id = e.id
     and p.nhl_pickem_period_id = v_period.id
    where e.league_id = v_period.league_id
      and e.season = v_period.season
      and e.active = true
    group by e.id, e.league_id, e.fantasy_team_id
    on conflict (nhl_pickem_period_id, entry_id)
    do update
    set required_picks = excluded.required_picks,
        submitted_picks = excluded.submitted_picks,
        missing_picks = 0,
        wins = excluded.wins,
        pushes = excluded.pushes,
        losses = excluded.losses,
        ungraded = excluded.ungraded,
        points = excluded.points,
        rank = null,
        is_period_winner = false,
        finalized_at = excluded.finalized_at,
        updated_at = now();

    -- Rank only entries that actually made at least one NHL pick.
    with ranked as (
      select
        r.id,
        rank() over (
          order by
            case
              when v_week.scoring_mode = 'record_only'
                then r.wins::numeric + (r.pushes::numeric * 0.5)
              else r.points
            end desc,
            r.wins desc,
            r.pushes desc,
            r.losses asc,
            r.entry_id asc
        )::integer as rnk
      from public.nhl_pickem_period_results r
      where r.nhl_pickem_period_id = v_period.id
        and r.submitted_picks > 0
    )
    update public.nhl_pickem_period_results r
    set
      rank = ranked.rnk,
      is_period_winner = (ranked.rnk = 1),
      updated_at = now()
    from ranked
    where r.id = ranked.id;

    select count(*)::integer
    into v_nhl_rows
    from public.nhl_pickem_period_results r
    where r.nhl_pickem_period_id = v_period.id;

    update public.nhl_pickem_periods
    set
      status = 'final',
      finalized_at = now(),
      updated_at = now()
    where id = v_period.id;

    perform public.rebuild_nhl_pickem_standings(
      v_period.league_id,
      v_period.season
    );
  end if;

  -- Mark the master G365 Pick'em week final LAST, after every result row
  -- has been written. Existing Football final-week award/badge triggers can
  -- now consume the combined authoritative result.
  update public.pickem_weeks
  set
    status = 'final',
    finalized_at = now(),
    finalized_by = v_user,
    updated_at = now()
  where id = v_week.id;

  return jsonb_build_object(
    'success', true,
    'finalized', true,
    'leagueId', v_week.league_id,
    'season', v_week.season,
    'week', v_week.week,
    'pickemWeekId', v_week.id,
    'nhlPickemPeriodId',
      case
        when v_period.id is null then null
        else v_period.id
      end,
    'combinedResultRows', v_rows,
    'nhlCompatibilityRows', v_nhl_rows,
    'requiredPicks', v_week.required_picks,
    'scoringMode', v_week.scoring_mode,
    'missingPickPolicy', v_week.missing_pick_policy
  );
end;
$$;


-- ============================================================
-- 3. RESTORE THE PUBLIC FOOTBALL FINALIZER NAME AS A ROUTER
-- ============================================================

create or replace function public.finalize_pickem_week(
  p_pickem_week_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_league_id uuid;
begin
  select w.league_id
  into v_league_id
  from public.pickem_weeks w
  where w.id = p_pickem_week_id;

  if not found then
    raise exception 'Pick''em week could not be found.';
  end if;

  if private.g365_pickem_is_mixed_with_nhl(v_league_id) then
    return public.finalize_pickem_unified_week(
      p_pickem_week_id
    );
  end if;

  return public.finalize_pickem_week_legacy_g365(
    p_pickem_week_id
  );
end;
$$;


-- ============================================================
-- 4. RESTORE NHL FINALIZER NAME AS A ROUTER
-- ============================================================

create or replace function public.finalize_nhl_pickem_period(
  p_nhl_pickem_period_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_period public.nhl_pickem_periods%rowtype;
  v_week_id bigint;
begin
  select *
  into v_period
  from public.nhl_pickem_periods
  where id = p_nhl_pickem_period_id;

  if not found then
    raise exception 'NHL Pick''em period could not be found.';
  end if;

  if private.g365_pickem_is_mixed_with_nhl(
       v_period.league_id
     )
  then
    select w.id
    into v_week_id
    from public.pickem_weeks w
    where w.league_id = v_period.league_id
      and w.season = v_period.season
      and w.week = v_period.period_number;

    if not found then
      return jsonb_build_object(
        'success', true,
        'finalized', false,
        'reason', 'waiting_for_master_pickem_week',
        'periodId', v_period.id
      );
    end if;

    return public.finalize_pickem_unified_week(
      v_week_id
    );
  end if;

  return public.finalize_nhl_pickem_period_legacy_g365(
    p_nhl_pickem_period_id
  );
end;
$$;


-- ============================================================
-- 5. PERMISSIONS
-- ============================================================

revoke all on function public.finalize_pickem_unified_week(bigint)
  from public, anon, authenticated;

grant execute on function public.finalize_pickem_unified_week(bigint)
  to service_role;

-- Preserve Football's member/API compatibility while the server-side
-- cron route remains the normal production caller.
revoke all on function public.finalize_pickem_week(bigint)
  from public, anon;

grant execute on function public.finalize_pickem_week(bigint)
  to authenticated, service_role;

-- NHL lifecycle remains service-only.
revoke all on function public.finalize_nhl_pickem_period(bigint)
  from public, anon, authenticated;

grant execute on function public.finalize_nhl_pickem_period(bigint)
  to service_role;


commit;


-- ============================================================
-- VERIFICATION
-- ============================================================

select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n
  on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'finalize_pickem_week',
    'finalize_pickem_week_legacy_g365',
    'finalize_pickem_unified_week',
    'finalize_nhl_pickem_period',
    'finalize_nhl_pickem_period_legacy_g365'
  )
order by p.proname;


select
  l.id as league_id,
  l.name,
  ps.enabled_sports,
  private.g365_pickem_is_mixed_with_nhl(l.id) as mixed_with_nhl
from public.leagues l
join public.pickem_settings ps
  on ps.league_id = l.id
where l.league_type = 'pickem'
order by l.name;
