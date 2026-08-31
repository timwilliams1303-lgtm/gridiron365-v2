begin;

-- Weekly scoring snapshots. Weeks keep the scoring rules that apply
-- to them even if the commissioner changes future-week settings later.
alter table public.pickem_weeks
  add column if not exists scoring_mode text not null default 'record_only',
  add column if not exists win_points numeric(8,2) not null default 1.00,
  add column if not exists push_points numeric(8,2) not null default 0.50,
  add column if not exists loss_points numeric(8,2) not null default 0.00,
  add column if not exists confidence_points jsonb not null default '[50,40,30,20,10]'::jsonb,
  add column if not exists confidence_push_multiplier numeric(5,2) not null default 0.50;

alter table public.pickem_weeks
  drop constraint if exists pickem_weeks_scoring_mode_check;

alter table public.pickem_weeks
  add constraint pickem_weeks_scoring_mode_check
  check (scoring_mode in (
    'record_only',
    'standard',
    'three_one_zero',
    'custom',
    'confidence'
  ));

alter table public.pickem_weeks
  drop constraint if exists pickem_weeks_confidence_push_multiplier_check;

alter table public.pickem_weeks
  add constraint pickem_weeks_confidence_push_multiplier_check
  check (confidence_push_multiplier in (0,0.5,1));

-- Per-pick confidence assignment.
alter table public.pickem_picks
  add column if not exists confidence_value numeric(8,2);

create unique index if not exists pickem_picks_week_team_confidence_unique
  on public.pickem_picks(pickem_week_id, fantasy_team_id, confidence_value)
  where confidence_value is not null
    and result <> 'void';

-- Backfill existing unstarted/setup weeks from current league settings.
update public.pickem_weeks w
set
  scoring_mode = s.scoring_mode,
  win_points = s.win_points,
  push_points = s.push_points,
  loss_points = s.loss_points,
  confidence_points = s.confidence_points,
  confidence_push_multiplier = s.confidence_push_multiplier,
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

-- Keep automatically-created future weeks synchronized with commissioner settings.
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
  end if;

  return new;
end;
$$;

drop trigger if exists trg_pickem_week_scoring_snapshot
  on public.pickem_weeks;

create trigger trg_pickem_week_scoring_snapshot
before insert on public.pickem_weeks
for each row
execute function public.apply_pickem_scoring_snapshot();

-- Commissioner settings save. Future/unstarted weeks are updated immediately.
create or replace function public.save_pickem_settings_v2(
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
  p_confidence_push_multiplier numeric
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

  if p_scoring_mode not in (
    'record_only','standard','three_one_zero','custom','confidence'
  ) then
    raise exception using errcode = '22023', message = 'Invalid Pick''em scoring mode.';
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
      raise exception using errcode = '22023',
        message = 'Confidence point values must be unique.';
    end if;
  end if;

  v_confidence_json := coalesce(to_jsonb(p_confidence_points),'[]'::jsonb);

  insert into public.pickem_settings (
    league_id,
    season,
    football_scope,
    picks_per_week,
    pick_lock_mode,
    minimum_source_books,
    scoring_mode,
    win_points,
    push_points,
    loss_points,
    confidence_points,
    confidence_push_multiplier,
    updated_at
  ) values (
    p_league_id,
    v_season,
    p_football_scope,
    p_picks_per_week,
    p_pick_lock_mode,
    p_minimum_source_books,
    p_scoring_mode,
    p_win_points,
    p_push_points,
    p_loss_points,
    v_confidence_json,
    p_confidence_push_multiplier,
    now()
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
    updated_at = now();

  update public.pickem_weeks w
  set
    required_picks = p_picks_per_week,
    scoring_mode = p_scoring_mode,
    win_points = p_win_points,
    push_points = p_push_points,
    loss_points = p_loss_points,
    confidence_points = v_confidence_json,
    confidence_push_multiplier = p_confidence_push_multiplier,
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
    'scoringMode', p_scoring_mode
  );
end;
$$;

grant execute on function public.save_pickem_settings_v2(
  uuid,text,integer,text,integer,text,numeric,numeric,numeric,numeric[],numeric
) to authenticated;

-- Auto-assign the highest remaining confidence value when a new confidence pick is created.
create or replace function public.assign_pickem_default_confidence(
  p_pick_id bigint
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pick public.pickem_picks%rowtype;
  v_week public.pickem_weeks%rowtype;
  v_value numeric;
begin
  select *
  into v_pick
  from public.pickem_picks
  where id = p_pick_id
  for update;

  if not found then
    return null;
  end if;

  select *
  into v_week
  from public.pickem_weeks
  where id = v_pick.pickem_week_id;

  if v_week.scoring_mode <> 'confidence' then
    update public.pickem_picks
    set confidence_value = null
    where id = v_pick.id;
    return null;
  end if;

  if v_pick.confidence_value is not null then
    return v_pick.confidence_value;
  end if;

  select candidate.value
  into v_value
  from (
    select (jsonb_array_elements_text(v_week.confidence_points))::numeric as value
  ) candidate
  where not exists (
    select 1
    from public.pickem_picks p
    where p.pickem_week_id = v_pick.pickem_week_id
      and p.fantasy_team_id = v_pick.fantasy_team_id
      and p.result <> 'void'
      and p.confidence_value = candidate.value
  )
  order by candidate.value desc
  limit 1;

  update public.pickem_picks
  set confidence_value = v_value,
      updated_at = now()
  where id = v_pick.id;

  return v_value;
end;
$$;

-- Recreate pick-save with automatic confidence assignment.
create or replace function public.save_pickem_pick(
  p_league_id uuid,
  p_season integer,
  p_week integer,
  p_pickem_game_id bigint,
  p_selected_side text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_team_id bigint;
  v_week public.pickem_weeks%rowtype;
  v_game public.pickem_games%rowtype;
  v_lock_mode text;
  v_earliest_selected_kickoff timestamptz;
  v_existing_id bigint;
  v_count integer := 0;
  v_pick_id bigint;
begin
  if p_selected_side not in ('home','away') then
    raise exception using errcode = '22023', message = 'Pick side must be home or away.';
  end if;

  select ft.id
  into v_team_id
  from public.fantasy_teams ft
  where ft.league_id = p_league_id
    and ft.owner_id = v_user
    and coalesce(ft.active,true) = true
  order by ft.id
  limit 1;

  if not found then
    raise exception using errcode = '42501', message = 'You do not own an active entry in this Pick''em league.';
  end if;

  select *
  into v_week
  from public.pickem_weeks
  where league_id = p_league_id
    and season = p_season
    and week = p_week
  for update;

  if not found then
    raise exception 'Pick''em week has not been initialized.';
  end if;

  if v_week.status = 'final' then
    raise exception using errcode = '22023', message = 'This Pick''em week is already final.';
  end if;

  select *
  into v_game
  from public.pickem_games
  where id = p_pickem_game_id
    and league_id = p_league_id
    and pickem_week_id = v_week.id
  for update;

  if not found then
    raise exception 'Selected Pick''em game could not be found on this week''s card.';
  end if;

  if not v_game.is_eligible
     or v_game.spread_status <> 'frozen'
     or v_game.g365_home_spread is null then
    raise exception using errcode = '22023', message = 'This game does not have an eligible frozen G365 Spread.';
  end if;

  if v_game.is_started or v_game.is_final or now() >= v_game.kickoff_at then
    raise exception using errcode = '22023', message = 'This game is already locked.';
  end if;

  select pick_lock_mode
  into v_lock_mode
  from public.pickem_settings
  where league_id = p_league_id;

  if v_lock_mode = 'full_card' then
    select min(g.kickoff_at)
    into v_earliest_selected_kickoff
    from public.pickem_picks p
    join public.pickem_games g
      on g.id = p.pickem_game_id
    where p.pickem_week_id = v_week.id
      and p.fantasy_team_id = v_team_id
      and p.result <> 'void';

    if v_earliest_selected_kickoff is not null
       and now() >= v_earliest_selected_kickoff then
      raise exception using errcode = '22023', message = 'Your full weekly card is locked.';
    end if;
  end if;

  select id
  into v_existing_id
  from public.pickem_picks
  where pickem_week_id = v_week.id
    and fantasy_team_id = v_team_id
    and pickem_game_id = v_game.id;

  if v_existing_id is null then
    select count(*)::integer
    into v_count
    from public.pickem_picks
    where pickem_week_id = v_week.id
      and fantasy_team_id = v_team_id
      and result <> 'void';

    if v_count >= v_week.required_picks then
      raise exception using errcode = '22023',
        message = format('You may select exactly %s games this week.', v_week.required_picks);
    end if;

    insert into public.pickem_picks (
      league_id,
      pickem_week_id,
      fantasy_team_id,
      pickem_game_id,
      selected_side,
      frozen_home_spread,
      submitted_at,
      updated_at
    ) values (
      p_league_id,
      v_week.id,
      v_team_id,
      v_game.id,
      p_selected_side,
      v_game.g365_home_spread,
      now(),
      now()
    )
    returning id into v_pick_id;

    perform public.assign_pickem_default_confidence(v_pick_id);
  else
    update public.pickem_picks
    set selected_side = p_selected_side,
        frozen_home_spread = v_game.g365_home_spread,
        updated_at = now()
    where id = v_existing_id;

    v_pick_id := v_existing_id;
    perform public.assign_pickem_default_confidence(v_pick_id);
  end if;

  select count(*)::integer
  into v_count
  from public.pickem_picks
  where pickem_week_id = v_week.id
    and fantasy_team_id = v_team_id
    and result <> 'void';

  return jsonb_build_object(
    'success', true,
    'selectedPicks', v_count,
    'requiredPicks', v_week.required_picks,
    'remainingPicks', greatest(v_week.required_picks - v_count,0),
    'isComplete',
      v_count = v_week.required_picks
      and (
        v_week.scoring_mode <> 'confidence'
        or not exists (
          select 1
          from public.pickem_picks p
          where p.pickem_week_id = v_week.id
            and p.fantasy_team_id = v_team_id
            and p.result <> 'void'
            and p.confidence_value is null
        )
      )
  );
end;
$$;

grant execute on function public.save_pickem_pick(uuid,integer,integer,bigint,text)
to authenticated;

-- Change a confidence value. If another pick already owns that value,
-- the two picks swap confidence values so the UX stays simple.
create or replace function public.set_pickem_confidence_value(
  p_league_id uuid,
  p_season integer,
  p_week integer,
  p_pickem_game_id bigint,
  p_confidence_value numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_team_id bigint;
  v_week public.pickem_weeks%rowtype;
  v_pick public.pickem_picks%rowtype;
  v_other public.pickem_picks%rowtype;
  v_allowed boolean := false;
  v_temp numeric;
begin
  select ft.id
  into v_team_id
  from public.fantasy_teams ft
  where ft.league_id = p_league_id
    and ft.owner_id = v_user
    and coalesce(ft.active,true) = true
  order by ft.id
  limit 1;

  if not found then
    raise exception using errcode = '42501', message = 'You do not own an active Pick''em entry.';
  end if;

  select *
  into v_week
  from public.pickem_weeks
  where league_id = p_league_id
    and season = p_season
    and week = p_week;

  if not found then
    raise exception 'Pick''em week could not be found.';
  end if;

  if v_week.scoring_mode <> 'confidence' then
    raise exception using errcode = '22023', message = 'This league week is not using confidence scoring.';
  end if;

  select exists (
    select 1
    from jsonb_array_elements_text(v_week.confidence_points) value
    where value::numeric = p_confidence_value
  )
  into v_allowed;

  if not v_allowed then
    raise exception using errcode = '22023', message = 'That confidence value is not available for this week.';
  end if;

  select p.*
  into v_pick
  from public.pickem_picks p
  join public.pickem_games g
    on g.id = p.pickem_game_id
  where p.pickem_week_id = v_week.id
    and p.fantasy_team_id = v_team_id
    and p.pickem_game_id = p_pickem_game_id
    and p.result <> 'void'
  for update of p;

  if not found then
    raise exception using errcode = '22023', message = 'Select this game before assigning confidence.';
  end if;

  if exists (
    select 1
    from public.pickem_games g
    where g.id = v_pick.pickem_game_id
      and (g.is_started or g.is_final or now() >= g.kickoff_at)
  ) then
    raise exception using errcode = '22023', message = 'This pick is locked.';
  end if;

  if v_pick.confidence_value = p_confidence_value then
    return jsonb_build_object('success',true,'confidenceValue',p_confidence_value);
  end if;

  select *
  into v_other
  from public.pickem_picks
  where pickem_week_id = v_week.id
    and fantasy_team_id = v_team_id
    and result <> 'void'
    and confidence_value = p_confidence_value
    and id <> v_pick.id
  for update;

  if found then
    v_temp := v_pick.confidence_value;

    -- Clear first to satisfy the partial unique index.
    update public.pickem_picks
    set confidence_value = null,
        updated_at = now()
    where id in (v_pick.id, v_other.id);

    update public.pickem_picks
    set confidence_value = p_confidence_value,
        updated_at = now()
    where id = v_pick.id;

    update public.pickem_picks
    set confidence_value = v_temp,
        updated_at = now()
    where id = v_other.id;
  else
    update public.pickem_picks
    set confidence_value = p_confidence_value,
        updated_at = now()
    where id = v_pick.id;
  end if;

  return jsonb_build_object(
    'success',true,
    'confidenceValue',p_confidence_value
  );
end;
$$;

grant execute on function public.set_pickem_confidence_value(
  uuid,integer,integer,bigint,numeric
) to authenticated;

-- Confidence-aware card completion status.
create or replace function public.get_pickem_my_card_status(
  p_league_id uuid,
  p_season integer,
  p_week integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_team_id bigint;
  v_week public.pickem_weeks%rowtype;
  v_selected integer := 0;
  v_missing_confidence integer := 0;
begin
  select ft.id
  into v_team_id
  from public.fantasy_teams ft
  where ft.league_id = p_league_id
    and ft.owner_id = v_user
    and coalesce(ft.active,true) = true
  order by ft.id
  limit 1;

  if not found then
    raise exception using errcode = '42501', message = 'A Pick''em entry could not be found for this member.';
  end if;

  select *
  into v_week
  from public.pickem_weeks
  where league_id = p_league_id
    and season = p_season
    and week = p_week;

  if not found then
    return jsonb_build_object(
      'success',true,
      'weekReady',false,
      'selectedPicks',0,
      'requiredPicks',coalesce(
        (select picks_per_week from public.pickem_settings where league_id = p_league_id),
        5
      ),
      'remainingPicks',coalesce(
        (select picks_per_week from public.pickem_settings where league_id = p_league_id),
        5
      ),
      'isComplete',false
    );
  end if;

  select
    count(*)::integer,
    count(*) filter (where confidence_value is null)::integer
  into
    v_selected,
    v_missing_confidence
  from public.pickem_picks
  where pickem_week_id = v_week.id
    and fantasy_team_id = v_team_id
    and result <> 'void';

  return jsonb_build_object(
    'success',true,
    'weekReady',true,
    'pickemWeekId',v_week.id,
    'selectedPicks',v_selected,
    'requiredPicks',v_week.required_picks,
    'remainingPicks',greatest(v_week.required_picks-v_selected,0),
    'missingConfidence',
      case when v_week.scoring_mode = 'confidence' then v_missing_confidence else 0 end,
    'isComplete',
      v_selected = v_week.required_picks
      and (v_week.scoring_mode <> 'confidence' or v_missing_confidence = 0)
  );
end;
$$;

grant execute on function public.get_pickem_my_card_status(uuid,integer,integer)
to authenticated;

-- Grade picks using the WEEK snapshot, not mutable league settings.
create or replace function public.grade_pickem_game(p_pickem_game_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.pickem_games%rowtype;
  v_week public.pickem_weeks%rowtype;
  v_home_ats numeric;
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
    return jsonb_build_object('success',true,'graded',false,'reason','game_not_final');
  end if;

  if v_game.g365_home_spread is null then
    return jsonb_build_object('success',true,'graded',false,'reason','no_frozen_spread');
  end if;

  select *
  into v_week
  from public.pickem_weeks
  where id = v_game.pickem_week_id;

  v_home_ats :=
    coalesce(v_game.home_score,0)
    + v_game.g365_home_spread
    - coalesce(v_game.away_score,0);

  update public.pickem_picks p
  set
    result = case
      when v_home_ats = 0 then 'push'
      when p.selected_side = 'home' and v_home_ats > 0 then 'win'
      when p.selected_side = 'away' and v_home_ats < 0 then 'win'
      else 'loss'
    end,
    points_awarded = case
      when v_week.scoring_mode = 'record_only'
        then 0
      when v_week.scoring_mode = 'confidence'
        and v_home_ats = 0
        then coalesce(p.confidence_value,0) * v_week.confidence_push_multiplier
      when v_week.scoring_mode = 'confidence'
        and (
          (p.selected_side = 'home' and v_home_ats > 0)
          or
          (p.selected_side = 'away' and v_home_ats < 0)
        )
        then coalesce(p.confidence_value,0)
      when v_week.scoring_mode = 'confidence'
        then 0
      when v_home_ats = 0
        then v_week.push_points
      when (
        (p.selected_side = 'home' and v_home_ats > 0)
        or
        (p.selected_side = 'away' and v_home_ats < 0)
      )
        then v_week.win_points
      else v_week.loss_points
    end,
    locked_at = coalesce(p.locked_at,v_game.kickoff_at),
    graded_at = now(),
    updated_at = now()
  where p.pickem_game_id = p_pickem_game_id
    and p.result <> 'void';

  get diagnostics v_rows = row_count;

  perform public.refresh_pickem_week_results(v_game.pickem_week_id);

  return jsonb_build_object(
    'success',true,
    'graded',true,
    'picksGraded',v_rows,
    'scoringMode',v_week.scoring_mode
  );
end;
$$;

-- Ranking is mode-aware. Record Only ranks by ATS record.
create or replace function public.finalize_pickem_week(p_pickem_week_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week public.pickem_weeks%rowtype;
  v_unfinished integer;
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

  if v_week.finalize_not_before is not null
     and now() < v_week.finalize_not_before then
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
    set status = 'awaiting_finalization',
        updated_at = now()
    where id = v_week.id;

    return jsonb_build_object(
      'success',true,
      'finalized',false,
      'reason','games_still_unfinished',
      'unfinishedGames',v_unfinished
    );
  end if;

  perform public.refresh_pickem_week_results(v_week.id);

  if v_week.scoring_mode = 'record_only' then
    with ranked as (
      select
        id,
        dense_rank() over (
          order by wins desc, losses asc, pushes desc
        ) as rnk
      from public.pickem_weekly_results
      where pickem_week_id = v_week.id
    )
    update public.pickem_weekly_results r
    set
      is_final = true,
      weekly_rank = ranked.rnk,
      finalized_at = now(),
      updated_at = now()
    from ranked
    where r.id = ranked.id;
  else
    with ranked as (
      select
        id,
        dense_rank() over (
          order by points desc, wins desc, losses asc
        ) as rnk
      from public.pickem_weekly_results
      where pickem_week_id = v_week.id
    )
    update public.pickem_weekly_results r
    set
      is_final = true,
      weekly_rank = ranked.rnk,
      finalized_at = now(),
      updated_at = now()
    from ranked
    where r.id = ranked.id;
  end if;

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
    'scoringMode',v_week.scoring_mode
  );
end;
$$;

-- Recreate safe league-picks RPC with confidence value included only
-- when that individual pick is visible.
drop function if exists public.get_pickem_league_picks(uuid,integer,integer);

create function public.get_pickem_league_picks(
  p_league_id uuid,
  p_season integer,
  p_week integer
)
returns table (
  fantasy_team_id bigint,
  team_name text,
  pick_id bigint,
  game_id bigint,
  sport text,
  kickoff_at timestamptz,
  away_team_name text,
  home_team_name text,
  away_score integer,
  home_score integer,
  status_type text,
  status_name text,
  status_detail text,
  period integer,
  display_clock text,
  is_final boolean,
  pick_visible boolean,
  selected_side text,
  frozen_home_spread numeric,
  confidence_value numeric,
  pick_result text,
  points_awarded numeric
)
language sql
stable
security definer
set search_path = public, auth
as $$
  with me as (
    select auth.uid() as user_id
  ),
  rows as (
    select
      ft.id as fantasy_team_id,
      ft.team_name,
      ft.owner_id,
      p.id as pick_id,
      g.id as game_id,
      g.sport,
      g.kickoff_at,
      g.away_team_name,
      g.home_team_name,
      g.away_score,
      g.home_score,
      g.status_type,
      g.status_name,
      g.status_detail,
      g.period,
      g.display_clock,
      g.is_final,
      p.selected_side,
      p.frozen_home_spread,
      p.confidence_value,
      p.result as pick_result,
      p.points_awarded,
      (
        ft.owner_id = me.user_id
        or now() >= g.kickoff_at
        or g.is_started
        or g.is_final
      ) as visible
    from public.fantasy_teams ft
    cross join me
    join public.league_members lm
      on lm.league_id = p_league_id
     and lm.user_id = me.user_id
    left join public.pickem_weeks w
      on w.league_id = p_league_id
     and w.season = p_season
     and w.week = p_week
    left join public.pickem_picks p
      on p.pickem_week_id = w.id
     and p.fantasy_team_id = ft.id
    left join public.pickem_games g
      on g.id = p.pickem_game_id
    where ft.league_id = p_league_id
      and coalesce(ft.active,true) = true
  )
  select
    fantasy_team_id,
    team_name,
    pick_id,
    case when visible then game_id else null end,
    case when visible then sport else null end,
    case when visible then kickoff_at else null end,
    case when visible then away_team_name else null end,
    case when visible then home_team_name else null end,
    case when visible then away_score else null end,
    case when visible then home_score else null end,
    case when visible then status_type else null end,
    case when visible then status_name else null end,
    case when visible then status_detail else null end,
    case when visible then period else null end,
    case when visible then display_clock else null end,
    case when visible then is_final else false end,
    coalesce(visible,false),
    case when visible then selected_side else null end,
    case when visible then frozen_home_spread else null end,
    case when visible then confidence_value else null end,
    case when visible then pick_result else null end,
    case when visible then points_awarded else null end
  from rows
  order by
    team_name,
    case when visible then kickoff_at else null end nulls last,
    pick_id;
$$;

grant execute on function public.get_pickem_league_picks(uuid,integer,integer)
to authenticated;

commit;
