begin;

alter table public.pickem_settings
  add column if not exists missing_pick_policy text not null default 'count_as_losses';

alter table public.pickem_settings
  drop constraint if exists pickem_settings_missing_pick_policy_check;

alter table public.pickem_settings
  add constraint pickem_settings_missing_pick_policy_check
  check (missing_pick_policy in ('count_as_losses','no_penalty','disqualify_week'));

alter table public.pickem_weeks
  add column if not exists missing_pick_policy text not null default 'count_as_losses';

alter table public.pickem_weeks
  drop constraint if exists pickem_weeks_missing_pick_policy_check;

alter table public.pickem_weeks
  add constraint pickem_weeks_missing_pick_policy_check
  check (missing_pick_policy in ('count_as_losses','no_penalty','disqualify_week'));

alter table public.pickem_weekly_results
  add column if not exists missing_picks integer not null default 0,
  add column if not exists is_disqualified boolean not null default false;

alter table public.pickem_weekly_results
  drop constraint if exists pickem_weekly_results_missing_picks_check;

alter table public.pickem_weekly_results
  add constraint pickem_weekly_results_missing_picks_check
  check (missing_picks >= 0);

-- Existing unstarted/setup weeks inherit the league setting.
update public.pickem_weeks w
set
  missing_pick_policy = s.missing_pick_policy,
  updated_at = now()
from public.pickem_settings s
where s.league_id = w.league_id
  and w.status = 'setup'
  and not exists (
    select 1
    from public.pickem_games g
    where g.pickem_week_id = w.id
      and (g.is_started = true or g.kickoff_at <= now())
  );

-- Keep automatically-created weeks snapshotted from commissioner settings.
create or replace function public.apply_pickem_scoring_snapshot()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_settings public.pickem_settings%rowtype;
begin
  select *
  into v_settings
  from public.pickem_settings
  where league_id = new.league_id;

  if found then
    new.scoring_mode := v_settings.scoring_mode;
    new.win_points := v_settings.win_points;
    new.push_points := v_settings.push_points;
    new.loss_points := v_settings.loss_points;
    new.confidence_points := v_settings.confidence_points;
    new.confidence_push_multiplier := v_settings.confidence_push_multiplier;
    new.missing_pick_policy := v_settings.missing_pick_policy;
  end if;

  return new;
end;
$$;

-- New settings RPC. V2 remains available for older clients; the Pick'em
-- commissioner UI should call V3 after this migration.
create or replace function public.save_pickem_settings_v3(
  p_league_id uuid,
  p_football_scope text,
  p_picks_per_week integer,
  p_pick_lock_mode text,
  p_minimum_source_books integer,
  p_scoring_mode text,
  p_win_points numeric,
  p_push_points numeric,
  p_loss_points numeric,
  p_confidence_points numeric[],
  p_confidence_push_multiplier numeric,
  p_missing_pick_policy text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
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
$$;

grant execute on function public.save_pickem_settings_v3(
  uuid,text,integer,text,integer,text,numeric,numeric,numeric,numeric[],numeric,text
) to authenticated;

-- Live refresh shows how many picks are still missing, but it does not apply
-- a missing-pick penalty before finalization.
create or replace function public.refresh_pickem_week_results(p_pickem_week_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
$$;

-- Finalization applies the week snapshot only after all eligible games are final.
create or replace function public.finalize_pickem_week(p_pickem_week_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
$$;

-- Badge engine: weekly rank already excludes DQ cards. Complete-card badges
-- also require zero missing picks so penalties/non-submissions do not create
-- artificial achievement or infamy badges.
create or replace function public.award_pickem_week_badges(p_pickem_week_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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

  if v_week.status <> 'final' then
    return jsonb_build_object('success',true,'awarded',false,'reason','week_not_final');
  end if;

  delete from public.pickem_badge_awards
  where league_id = v_week.league_id
    and season = v_week.season
    and week = v_week.week;

  with results as (
    select
      r.fantasy_team_id, r.wins, r.losses, r.pushes, r.pending, r.points,
      r.weekly_rank, r.missing_picks, r.is_disqualified, w.required_picks
    from public.pickem_weekly_results r
    join public.pickem_weeks w on w.id = r.pickem_week_id
    where r.pickem_week_id = v_week.id
      and r.is_final = true
  ),
  awards as (
    select fantasy_team_id,
      'WEEKLY_CHAMP'::text badge_key,
      'Weekly Champ'::text badge_name,
      'WEEKLY'::text badge_category,
      jsonb_build_object(
        'emoji','🏆','detail','Finished #1 in the official weekly Pick''em standings.',
        'wins',wins,'losses',losses,'pushes',pushes,'points',points
      ) details
    from results
    where weekly_rank = 1 and is_disqualified = false

    union all
    select fantasy_team_id,'PERFECT_CARD','Perfect Card','ACHIEVEMENT',
      jsonb_build_object(
        'emoji','🔥','detail','Won every required ATS pick on the weekly card.',
        'record',format('%s-%s-%s',wins,losses,pushes),'requiredPicks',required_picks
      )
    from results
    where missing_picks = 0 and is_disqualified = false
      and wins = required_picks and losses = 0 and pushes = 0 and pending = 0

    union all
    select fantasy_team_id,'HEATER','On a Heater','ACHIEVEMENT',
      jsonb_build_object(
        'emoji','🌋','detail','Won at least 80% of the required ATS picks this week.',
        'wins',wins,'requiredPicks',required_picks
      )
    from results
    where missing_picks = 0 and is_disqualified = false
      and required_picks >= 5
      and wins::numeric / required_picks::numeric >= 0.80
      and losses + pushes + wins = required_picks

    union all
    select fantasy_team_id,'ICE_COLD','Ice Cold','INFAMY',
      jsonb_build_object(
        'emoji','🥶','detail','Finished a complete weekly card without a single ATS win.',
        'losses',losses,'pushes',pushes
      )
    from results
    where missing_picks = 0 and is_disqualified = false
      and wins = 0 and pending = 0 and losses + pushes > 0

    union all
    select fantasy_team_id,'WRONG_WAY','Wrong Way','INFAMY',
      jsonb_build_object(
        'emoji','🧭','detail','Lost every completed ATS selection on the weekly card.',
        'losses',losses
      )
    from results
    where missing_picks = 0 and is_disqualified = false
      and losses = required_picks and wins = 0 and pushes = 0 and pending = 0

    union all
    select fantasy_team_id,'PUSH_MAGNET','Push Magnet','WEEKLY',
      jsonb_build_object(
        'emoji','🧲','detail','Recorded multiple pushes against the frozen G365 Spread.',
        'pushes',pushes
      )
    from results
    where pushes >= 2 and is_disqualified = false
  )
  insert into public.pickem_badge_awards (
    league_id, fantasy_team_id, season, week,
    badge_key, badge_name, badge_category, details
  )
  select
    v_week.league_id, awards.fantasy_team_id, v_week.season, v_week.week,
    awards.badge_key, awards.badge_name, awards.badge_category, awards.details
  from awards
  on conflict (league_id,fantasy_team_id,season,week,badge_key)
  do update set
    badge_name = excluded.badge_name,
    badge_category = excluded.badge_category,
    details = excluded.details;

  get diagnostics v_rows = row_count;
  return jsonb_build_object('success',true,'awarded',true,'rows',v_rows);
end;
$$;

commit;
