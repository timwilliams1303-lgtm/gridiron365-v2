begin;

CREATE OR REPLACE FUNCTION public.auto_grade_final_pickem_game()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.is_final = true
     and (
       old.is_final is distinct from new.is_final
       or old.home_score is distinct from new.home_score
       or old.away_score is distinct from new.away_score
     )
  then
    perform public.grade_pickem_game(new.id);
  end if;

  return new;
end;
$function$;


CREATE OR REPLACE FUNCTION public.finalize_pickem_week(p_pickem_week_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_week public.pickem_weeks%rowtype;
  v_game record;
  v_unfinished integer := 0;
  v_saved_pending integer := 0;
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

  if v_week.status = 'final' then
    return jsonb_build_object('success',true,'finalized',true,'alreadyFinal',true);
  end if;

  if v_week.finalize_not_before is not null and now() < v_week.finalize_not_before then
    return jsonb_build_object(
      'success',true,'finalized',false,'reason','monday_night_gate_not_reached'
    );
  end if;

  select count(*)
  into v_unfinished
  from public.pickem_games
  where pickem_week_id = v_week.id
    and is_eligible = true
    and is_final = false;

  if v_unfinished > 0 then
    update public.pickem_weeks
    set status = 'awaiting_finalization', updated_at = now()
    where id = v_week.id;

    return jsonb_build_object(
      'success',true,'finalized',false,
      'reason','games_still_unfinished','unfinishedGames',v_unfinished
    );
  end if;

  -- Defensive final grading: grade any final game that still owns a saved
  -- pending pick. grade_pickem_game uses each pick's frozen_home_spread.
  for v_game in
    select distinct g.id
    from public.pickem_games g
    join public.pickem_picks p on p.pickem_game_id = g.id
    where g.pickem_week_id = v_week.id
      and g.is_eligible = true
      and g.is_final = true
      and p.result = 'pending'
      and p.frozen_home_spread is not null
  loop
    perform public.grade_pickem_game(v_game.id);
  end loop;

  perform public.refresh_pickem_week_results(v_week.id);

  select count(*)
  into v_saved_pending
  from public.pickem_picks p
  join public.pickem_games g on g.id = p.pickem_game_id
  where p.pickem_week_id = v_week.id
    and p.result = 'pending'
    and g.is_eligible = true;

  if v_saved_pending > 0 then
    update public.pickem_weeks
    set status = 'awaiting_finalization', updated_at = now()
    where id = v_week.id;

    return jsonb_build_object(
      'success',true,'finalized',false,
      'reason','picks_still_pending','pendingPicks',v_saved_pending
    );
  end if;

  -- Apply the configured missing-pick policy. Missing penalties never add
  -- pick rows and never award points.
  if v_week.missing_pick_policy = 'count_as_losses' then
    update public.pickem_weekly_results
    set
      losses = losses + missing_picks,
      is_disqualified = false,
      updated_at = now()
    where pickem_week_id = v_week.id;
  elsif v_week.missing_pick_policy = 'disqualify_week' then
    update public.pickem_weekly_results
    set
      is_disqualified = (missing_picks > 0),
      updated_at = now()
    where pickem_week_id = v_week.id;
  else
    update public.pickem_weekly_results
    set is_disqualified = false, updated_at = now()
    where pickem_week_id = v_week.id;
  end if;

  -- Rank eligible cards only. Disqualified cards keep weekly_rank = null.
  update public.pickem_weekly_results
  set weekly_rank = null
  where pickem_week_id = v_week.id;

  if v_week.scoring_mode = 'record_only' then
    with ranked as (
      select id,
             dense_rank() over (order by wins desc, losses asc, pushes desc) as rnk
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
      select id,
             dense_rank() over (order by points desc, wins desc, losses asc) as rnk
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

  update public.pickem_weeks
  set
    status = 'final',
    finalized_at = now(),
    finalized_by = v_user,
    updated_at = now()
  where id = v_week.id;

  return jsonb_build_object(
    'success',true,
    'finalized',true,
    'week',v_week.week,
    'scoringMode',v_week.scoring_mode,
    'missingPickPolicy',v_week.missing_pick_policy
  );
end;
$function$;


CREATE OR REPLACE FUNCTION public.freeze_pickem_g365_spread(p_pickem_game_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_league_id uuid;
  v_min_books integer;
  v_count integer;
  v_median numeric(6,2);
  v_user uuid := auth.uid();

  v_existing_spread numeric(6,2);
  v_existing_status text;
  v_existing_source_count integer;
  v_existing_method text;
  v_existing_frozen_at timestamptz;
begin
  -- Lock the game row so two freeze attempts cannot race each other.
  select
    g.league_id,
    s.minimum_source_books,
    g.g365_home_spread,
    g.spread_status,
    g.consensus_source_count,
    g.consensus_method,
    g.spread_frozen_at
  into
    v_league_id,
    v_min_books,
    v_existing_spread,
    v_existing_status,
    v_existing_source_count,
    v_existing_method,
    v_existing_frozen_at
  from public.pickem_games g
  join public.pickem_settings s
    on s.league_id = g.league_id
  where g.id = p_pickem_game_id
  for update of g;

  if not found then
    raise exception 'Pick''em game could not be found.';
  end if;

  -- Preserve existing commissioner authorization behavior.
  if v_user is not null and not exists (
    select 1
    from public.league_members lm
    where lm.league_id = v_league_id
      and lm.user_id = v_user
      and lm.role in ('commissioner', 'co_commissioner')
  ) then
    raise exception using
      errcode = '42501',
      message = 'Commissioner access is required.';
  end if;

  -- ==========================================================
  -- CRITICAL IMMUTABILITY GUARD
  --
  -- Once a G365 line is frozen, NEVER calculate it again.
  -- Later sportsbook movement remains available in
  -- pickem_line_sources for auditing, but cannot alter the
  -- official contest spread.
  -- ==========================================================

  if v_existing_status = 'frozen' then
    return jsonb_build_object(
      'success', true,
      'alreadyFrozen', true,
      'gameId', p_pickem_game_id,
      'g365HomeSpread', v_existing_spread,
      'sourceCount', coalesce(v_existing_source_count, 0),
      'method', coalesce(
        v_existing_method,
        'median_latest_per_sportsbook'
      ),
      'frozenAt', v_existing_frozen_at
    );
  end if;

  -- ==========================================================
  -- Calculate consensus using latest line from each sportsbook.
  -- ==========================================================

  with latest as (
    select distinct on (sportsbook_key)
      sportsbook_key,
      home_spread
    from public.pickem_line_sources
    where pickem_game_id = p_pickem_game_id
      and home_spread is not null
    order by
      sportsbook_key,
      captured_at desc,
      id desc
  )
  select
    count(*),
    percentile_cont(0.5)
      within group (order by home_spread)::numeric(6,2)
  into
    v_count,
    v_median
  from latest;

  -- ==========================================================
  -- Exclude games that do not have enough trustworthy books.
  -- ==========================================================

  if v_count < v_min_books then
    update public.pickem_games
    set
      spread_status = 'excluded',
      is_eligible = false,
      exclusion_reason = format(
        'Only %s trustworthy source lines were available; %s required.',
        v_count,
        v_min_books
      ),
      consensus_source_count = v_count,
      updated_at = now()
    where id = p_pickem_game_id;

    return jsonb_build_object(
      'success', false,
      'excluded', true,
      'gameId', p_pickem_game_id,
      'sourceCount', v_count,
      'requiredSourceCount', v_min_books
    );
  end if;

  -- ==========================================================
  -- FIRST AND ONLY OFFICIAL FREEZE
  -- ==========================================================

  update public.pickem_games
  set
    g365_home_spread = v_median,
    spread_status = 'frozen',
    spread_published_at = coalesce(
      spread_published_at,
      now()
    ),
    spread_frozen_at = now(),
    consensus_source_count = v_count,
    consensus_method = 'median_latest_per_sportsbook',
    is_eligible = true,
    exclusion_reason = null,
    updated_at = now()
  where id = p_pickem_game_id;

  return jsonb_build_object(
    'success', true,
    'alreadyFrozen', false,
    'gameId', p_pickem_game_id,
    'g365HomeSpread', v_median,
    'sourceCount', v_count,
    'method', 'median_latest_per_sportsbook'
  );
end;
$function$;


CREATE OR REPLACE FUNCTION public.grade_pickem_game(p_pickem_game_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_game public.pickem_games%rowtype;
  v_week public.pickem_weeks%rowtype;
  v_rows integer := 0;
begin
  select *
  into v_game
  from public.pickem_games
  where id = p_pickem_game_id
  for update;

  if not found then
    raise exception 'Pick''em game could not be found.';
  end if;

  if not v_game.is_final then
    return jsonb_build_object(
      'success', true,
      'graded', false,
      'reason', 'game_not_final'
    );
  end if;

  select *
  into v_week
  from public.pickem_weeks
  where id = v_game.pickem_week_id;

  /*
   * Grade every saved pick against THAT PICK'S frozen
   * official G365 spread.
   *
   * Never use a later/current game-row spread to alter
   * the line a participant originally received.
   */
  update public.pickem_picks p
  set
    result = case
      when (
        coalesce(v_game.home_score, 0)
        + p.frozen_home_spread
        - coalesce(v_game.away_score, 0)
      ) = 0
        then 'push'

      when p.selected_side = 'home'
       and (
        coalesce(v_game.home_score, 0)
        + p.frozen_home_spread
        - coalesce(v_game.away_score, 0)
       ) > 0
        then 'win'

      when p.selected_side = 'away'
       and (
        coalesce(v_game.home_score, 0)
        + p.frozen_home_spread
        - coalesce(v_game.away_score, 0)
       ) < 0
        then 'win'

      else 'loss'
    end,

    points_awarded = case
      when v_week.scoring_mode = 'record_only'
        then 0

      when v_week.scoring_mode = 'confidence'
       and (
        coalesce(v_game.home_score, 0)
        + p.frozen_home_spread
        - coalesce(v_game.away_score, 0)
       ) = 0
        then
          coalesce(p.confidence_value, 0)
          * v_week.confidence_push_multiplier

      when v_week.scoring_mode = 'confidence'
       and (
         (
           p.selected_side = 'home'
           and (
             coalesce(v_game.home_score, 0)
             + p.frozen_home_spread
             - coalesce(v_game.away_score, 0)
           ) > 0
         )
         or
         (
           p.selected_side = 'away'
           and (
             coalesce(v_game.home_score, 0)
             + p.frozen_home_spread
             - coalesce(v_game.away_score, 0)
           ) < 0
         )
       )
        then coalesce(p.confidence_value, 0)

      when v_week.scoring_mode = 'confidence'
        then 0

      when (
        coalesce(v_game.home_score, 0)
        + p.frozen_home_spread
        - coalesce(v_game.away_score, 0)
      ) = 0
        then v_week.push_points

      when (
        (
          p.selected_side = 'home'
          and (
            coalesce(v_game.home_score, 0)
            + p.frozen_home_spread
            - coalesce(v_game.away_score, 0)
          ) > 0
        )
        or
        (
          p.selected_side = 'away'
          and (
            coalesce(v_game.home_score, 0)
            + p.frozen_home_spread
            - coalesce(v_game.away_score, 0)
          ) < 0
        )
      )
        then v_week.win_points

      else v_week.loss_points
    end,

    locked_at =
      coalesce(
        p.locked_at,
        v_game.kickoff_at
      ),

    graded_at = now(),
    updated_at = now()

  where p.pickem_game_id = p_pickem_game_id
    and p.result <> 'void'
    and p.frozen_home_spread is not null;

  get diagnostics
    v_rows = row_count;

  perform public.refresh_pickem_week_results(
    v_game.pickem_week_id
  );

  return jsonb_build_object(
    'success', true,
    'graded', true,
    'picksGraded', v_rows,
    'scoringMode', v_week.scoring_mode
  );
end;
$function$;


CREATE OR REPLACE FUNCTION public.refresh_pickem_week_results(p_pickem_week_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_week public.pickem_weeks%rowtype;
  v_rows integer := 0;
begin
  select * into v_week
  from public.pickem_weeks
  where id = p_pickem_week_id;

  if not found then
    raise exception 'Pick''em week could not be found.';
  end if;

  insert into public.pickem_weekly_results (
    league_id, pickem_week_id, fantasy_team_id,
    wins, losses, pushes, pending, points,
    missing_picks, is_disqualified, is_final, updated_at
  )
  select
    v_week.league_id,
    v_week.id,
    ft.id,
    count(p.id) filter (where p.result = 'win')::integer,
    count(p.id) filter (where p.result = 'loss')::integer,
    count(p.id) filter (where p.result = 'push')::integer,
    count(p.id) filter (where p.result = 'pending')::integer,
    coalesce(sum(p.points_awarded),0),
    greatest(
      v_week.required_picks - count(p.id) filter (where p.id is not null and p.result <> 'void')::integer,
      0
    ),
    false,
    false,
    now()
  from public.fantasy_teams ft
  left join public.pickem_picks p
    on p.fantasy_team_id = ft.id
   and p.pickem_week_id = v_week.id
   and p.result <> 'void'
  where ft.league_id = v_week.league_id
    and coalesce(ft.active,true) = true
  group by ft.id
  on conflict (pickem_week_id, fantasy_team_id)
  do update set
    wins = excluded.wins,
    losses = excluded.losses,
    pushes = excluded.pushes,
    pending = excluded.pending,
    points = excluded.points,
    missing_picks = excluded.missing_picks,
    is_disqualified = false,
    is_final = false,
    weekly_rank = null,
    finalized_at = null,
    updated_at = now();

  get diagnostics v_rows = row_count;
  return jsonb_build_object('success',true,'rows',v_rows);
end;
$function$;


CREATE OR REPLACE FUNCTION public.save_pickem_settings_v3(p_league_id uuid, p_football_scope text, p_picks_per_week integer, p_pick_lock_mode text, p_minimum_source_books integer, p_scoring_mode text, p_win_points numeric, p_push_points numeric, p_loss_points numeric, p_confidence_points numeric[], p_confidence_push_multiplier numeric, p_missing_pick_policy text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_user uuid := auth.uid();
  v_season integer;
  v_confidence_json jsonb;
begin
  if v_user is null then
    raise exception using errcode = '42501', message = 'You must be signed in.';
  end if;

  if not exists (
    select 1
    from public.league_members lm
    where lm.league_id = p_league_id
      and lm.user_id = v_user
      and lm.role in ('commissioner','co_commissioner')
  ) then
    raise exception using errcode = '42501', message = 'Commissioner access is required.';
  end if;

  select season
  into v_season
  from public.leagues
  where id = p_league_id
    and league_type = 'pickem';

  if not found then
    raise exception 'Pick''em league could not be found.';
  end if;

  if p_football_scope not in ('college_nfl','college_only','nfl_only') then
    raise exception using errcode = '22023', message = 'Invalid football scope.';
  end if;

  if p_picks_per_week not between 1 and 20 then
    raise exception using errcode = '22023', message = 'Picks required per week must be between 1 and 20.';
  end if;

  if p_pick_lock_mode not in ('per_game','full_card') then
    raise exception using errcode = '22023', message = 'Invalid pick lock mode.';
  end if;

  if p_minimum_source_books not between 1 and 20 then
    raise exception using errcode = '22023', message = 'Minimum sportsbook sources must be between 1 and 20.';
  end if;

  if p_scoring_mode not in ('record_only','standard','three_one_zero','custom','confidence') then
    raise exception using errcode = '22023', message = 'Invalid Pick''em scoring mode.';
  end if;

  if p_missing_pick_policy not in ('count_as_losses','no_penalty','disqualify_week') then
    raise exception using errcode = '22023', message = 'Invalid missing-pick policy.';
  end if;

  if p_win_points < 0 or p_push_points < 0 or p_loss_points < 0 then
    raise exception using errcode = '22023', message = 'Pick scoring values cannot be negative.';
  end if;

  if p_confidence_push_multiplier not in (0,0.5,1) then
    raise exception using errcode = '22023', message = 'Invalid confidence push credit.';
  end if;

  if p_scoring_mode = 'confidence' then
    if coalesce(array_length(p_confidence_points,1),0) <> p_picks_per_week then
      raise exception using errcode = '22023',
        message = 'Confidence scoring requires exactly one value per required pick.';
    end if;

    if exists (
      select 1
      from unnest(p_confidence_points) value
      group by value
      having count(*) > 1
    ) then
      raise exception using errcode = '22023', message = 'Confidence point values must be unique.';
    end if;
  end if;

  v_confidence_json := coalesce(to_jsonb(p_confidence_points),'[]'::jsonb);

  insert into public.pickem_settings (
    league_id, season, football_scope, picks_per_week, pick_lock_mode,
    minimum_source_books, scoring_mode, win_points, push_points, loss_points,
    confidence_points, confidence_push_multiplier, missing_pick_policy, updated_at
  ) values (
    p_league_id, v_season, p_football_scope, p_picks_per_week, p_pick_lock_mode,
    p_minimum_source_books, p_scoring_mode, p_win_points, p_push_points, p_loss_points,
    v_confidence_json, p_confidence_push_multiplier, p_missing_pick_policy, now()
  )
  on conflict (league_id)
  do update set
    football_scope = excluded.football_scope,
    picks_per_week = excluded.picks_per_week,
    pick_lock_mode = excluded.pick_lock_mode,
    minimum_source_books = excluded.minimum_source_books,
    scoring_mode = excluded.scoring_mode,
    win_points = excluded.win_points,
    push_points = excluded.push_points,
    loss_points = excluded.loss_points,
    confidence_points = excluded.confidence_points,
    confidence_push_multiplier = excluded.confidence_push_multiplier,
    missing_pick_policy = excluded.missing_pick_policy,
    updated_at = now();

  -- Only unlocked weeks receive changed settings. Started weeks keep snapshots.
  update public.pickem_weeks w
  set
    required_picks = p_picks_per_week,
    scoring_mode = p_scoring_mode,
    win_points = p_win_points,
    push_points = p_push_points,
    loss_points = p_loss_points,
    confidence_points = v_confidence_json,
    confidence_push_multiplier = p_confidence_push_multiplier,
    missing_pick_policy = p_missing_pick_policy,
    updated_at = now()
  where w.league_id = p_league_id
    and w.status = 'setup'
    and not exists (
      select 1
      from public.pickem_games g
      where g.pickem_week_id = w.id
        and (g.is_started = true or g.kickoff_at <= now())
    );

  return jsonb_build_object(
    'success', true,
    'leagueId', p_league_id,
    'scoringMode', p_scoring_mode,
    'missingPickPolicy', p_missing_pick_policy
  );
end;
$function$;

notify pgrst, 'reload schema';

commit;
