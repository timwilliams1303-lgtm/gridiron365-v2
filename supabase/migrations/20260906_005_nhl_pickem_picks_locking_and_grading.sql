-- Gridiron365 / G365 NHL Pick'em picks, locking, confidence, and grading
-- Migration: 20260906_005_nhl_pickem_picks_locking_and_grading.sql
-- Depends on:
--   20260906_002_nhl_pickem_foundation.sql
--   20260906_003_nhl_pickem_league_creation_settings.sql
--   20260906_004_nhl_pickem_daily_games_and_line_freeze.sql
--
-- Purpose:
--   * Save/remove a member's own NHL Pick'em selections through secured RPCs.
--   * Enforce frozen G365 lines and per-game puck-drop locks.
--   * Enforce commissioner market mode and same-game multi-market setting.
--   * Enforce the configured required-pick maximum.
--   * Snapshot the official G365 Puck Line / G365 Total onto every pick.
--   * Support confidence values without duplicates inside one period card.
--   * Lock due picks when their selected NHL game starts.
--   * Grade puck-line and total picks from authoritative final NHL scores,
--     including overtime/shootout final scores stored in public.nhl_games.
--   * Keep Football Pick'em untouched.

begin;

-- -----------------------------------------------------------------------------
-- Harden member writes.
--
-- Migration 1 allowed authenticated users direct DML on nhl_pickem_picks.
-- From this migration forward all member mutations go through secured RPCs so
-- users cannot bypass line snapshots, required-pick counts, market restrictions,
-- or puck-drop locking.
-- -----------------------------------------------------------------------------

revoke insert, update, delete on public.nhl_pickem_picks from authenticated;
grant select on public.nhl_pickem_picks to authenticated;

-- -----------------------------------------------------------------------------
-- Internal ownership/context helper.
-- -----------------------------------------------------------------------------

create or replace function private.get_nhl_pickem_owned_entry(
  p_league_id uuid,
  p_season integer,
  p_user_id uuid
)
returns public.nhl_pickem_entries
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_entry public.nhl_pickem_entries%rowtype;
begin
  if p_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  perform private.assert_nhl_pickem_league(p_league_id);

  if not exists (
    select 1
    from public.league_members lm
    where lm.league_id = p_league_id
      and lm.user_id = p_user_id
  ) then
    raise exception 'You are not a member of this NHL Pick''em league.';
  end if;

  select e.*
    into v_entry
  from public.nhl_pickem_entries e
  join public.fantasy_teams ft
    on ft.id = e.fantasy_team_id
  where e.league_id = p_league_id
    and e.season = p_season
    and e.user_id = p_user_id
    and e.active = true
    and ft.owner_id = p_user_id
    and ft.active = true
  order by e.id
  limit 1;

  if not found then
    raise exception 'Your NHL Pick''em entry could not be found.';
  end if;

  return v_entry;
end;
$$;

-- -----------------------------------------------------------------------------
-- Save or change one pick.
--
-- selected_side:
--   puck_line -> home | away
--   total     -> over | under
--
-- Picks may only be made after official G365 markets are frozen and before that
-- specific NHL game's puck drop. The official frozen values are copied to the
-- pick so future display/grading uses the exact line the member selected.
-- -----------------------------------------------------------------------------

create or replace function public.save_nhl_pickem_pick(
  p_league_id uuid,
  p_season integer,
  p_period_number integer,
  p_nhl_pickem_game_id bigint,
  p_market_type text,
  p_selected_side text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_entry public.nhl_pickem_entries%rowtype;
  v_period public.nhl_pickem_periods%rowtype;
  v_game public.nhl_pickem_games%rowtype;
  v_nhl_game public.nhl_games%rowtype;
  v_settings public.nhl_pickem_settings%rowtype;
  v_existing public.nhl_pickem_picks%rowtype;
  v_pick_id bigint;
  v_existing_count integer := 0;
  v_same_game_other_market integer := 0;
begin
  v_entry := private.get_nhl_pickem_owned_entry(
    p_league_id,
    p_season,
    v_user_id
  );

  select *
    into v_settings
  from public.nhl_pickem_settings
  where league_id = p_league_id;

  if not found then
    raise exception 'NHL Pick''em settings could not be found.';
  end if;

  select *
    into v_period
  from public.nhl_pickem_periods
  where league_id = p_league_id
    and season = p_season
    and period_number = p_period_number;

  if not found then
    raise exception 'NHL Pick''em period could not be found.';
  end if;

  if v_period.status = 'final' then
    raise exception 'This NHL Pick''em period is already final.';
  end if;

  select *
    into v_game
  from public.nhl_pickem_games
  where id = p_nhl_pickem_game_id
    and league_id = p_league_id
    and season = p_season
    and nhl_pickem_period_id = v_period.id;

  if not found then
    raise exception 'NHL Pick''em game is not part of this contest period.';
  end if;

  if not v_game.eligible
     or not v_game.is_frozen
     or v_game.line_status <> 'frozen'
  then
    raise exception 'Official G365 markets are not available for this game.';
  end if;

  select *
    into v_nhl_game
  from public.nhl_games
  where id = v_game.nhl_game_id;

  if not found then
    raise exception 'Authoritative NHL game could not be found.';
  end if;

  if now() >= v_nhl_game.kickoff_at then
    raise exception 'This NHL game has already reached puck drop.';
  end if;

  if p_market_type not in ('puck_line','total') then
    raise exception 'Invalid NHL Pick''em market type.';
  end if;

  if p_market_type = 'puck_line' then
    if v_settings.market_mode = 'total_only' then
      raise exception 'This league does not use the G365 Puck Line market.';
    end if;

    if p_selected_side not in ('home','away') then
      raise exception 'Puck-line selections must be home or away.';
    end if;

    if v_game.official_home_puck_line is null
       or v_game.official_away_puck_line is null
    then
      raise exception 'The official G365 Puck Line is unavailable.';
    end if;
  else
    if v_settings.market_mode = 'puck_line_only' then
      raise exception 'This league does not use the G365 Total market.';
    end if;

    if p_selected_side not in ('over','under') then
      raise exception 'Total selections must be over or under.';
    end if;

    if v_game.official_total is null then
      raise exception 'The official G365 Total is unavailable.';
    end if;
  end if;

  select *
    into v_existing
  from public.nhl_pickem_picks p
  where p.entry_id = v_entry.id
    and p.nhl_pickem_period_id = v_period.id
    and p.nhl_pickem_game_id = v_game.id
    and p.market_type = p_market_type
  limit 1;

  if v_existing.id is not null
     and (
       v_existing.locked_at is not null
       or now() >= v_nhl_game.kickoff_at
     )
  then
    raise exception 'This pick is locked.';
  end if;

  if not v_settings.allow_same_game_multiple_markets then
    select count(*)
      into v_same_game_other_market
    from public.nhl_pickem_picks p
    where p.entry_id = v_entry.id
      and p.nhl_pickem_period_id = v_period.id
      and p.nhl_pickem_game_id = v_game.id
      and p.market_type <> p_market_type;

    if v_same_game_other_market > 0 then
      raise exception
        'This league does not allow both NHL markets from the same game.';
    end if;
  end if;

  if v_existing.id is null then
    select count(*)
      into v_existing_count
    from public.nhl_pickem_picks p
    where p.entry_id = v_entry.id
      and p.nhl_pickem_period_id = v_period.id;

    if v_existing_count >= v_settings.picks_per_period then
      raise exception
        'You already have the maximum % picks for this period.',
        v_settings.picks_per_period;
    end if;

    insert into public.nhl_pickem_picks (
      league_id,
      nhl_pickem_period_id,
      nhl_pickem_game_id,
      entry_id,
      fantasy_team_id,
      user_id,
      market_type,
      selected_side,
      snapshot_home_puck_line,
      snapshot_away_puck_line,
      snapshot_total,
      confidence_value,
      locked_at,
      result,
      points_awarded,
      graded_at
    )
    values (
      p_league_id,
      v_period.id,
      v_game.id,
      v_entry.id,
      v_entry.fantasy_team_id,
      v_user_id,
      p_market_type,
      p_selected_side,
      v_game.official_home_puck_line,
      v_game.official_away_puck_line,
      v_game.official_total,
      null,
      null,
      null,
      0,
      null
    )
    returning id into v_pick_id;
  else
    update public.nhl_pickem_picks
    set selected_side = p_selected_side,
        snapshot_home_puck_line = v_game.official_home_puck_line,
        snapshot_away_puck_line = v_game.official_away_puck_line,
        snapshot_total = v_game.official_total,
        result = null,
        points_awarded = 0,
        graded_at = null,
        updated_at = now()
    where id = v_existing.id
    returning id into v_pick_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'pickId', v_pick_id,
    'leagueId', p_league_id,
    'season', p_season,
    'periodNumber', p_period_number,
    'entryId', v_entry.id,
    'gameId', v_game.id,
    'marketType', p_market_type,
    'selectedSide', p_selected_side,
    'homePuckLine', v_game.official_home_puck_line,
    'awayPuckLine', v_game.official_away_puck_line,
    'g365Total', v_game.official_total,
    'kickoffAt', v_nhl_game.kickoff_at
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Remove one unlocked pick.
-- -----------------------------------------------------------------------------

create or replace function public.remove_nhl_pickem_pick(
  p_league_id uuid,
  p_season integer,
  p_period_number integer,
  p_nhl_pickem_game_id bigint,
  p_market_type text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_entry public.nhl_pickem_entries%rowtype;
  v_period public.nhl_pickem_periods%rowtype;
  v_pick public.nhl_pickem_picks%rowtype;
  v_kickoff_at timestamptz;
begin
  v_entry := private.get_nhl_pickem_owned_entry(
    p_league_id,
    p_season,
    v_user_id
  );

  select *
    into v_period
  from public.nhl_pickem_periods
  where league_id = p_league_id
    and season = p_season
    and period_number = p_period_number;

  if not found then
    raise exception 'NHL Pick''em period could not be found.';
  end if;

  select p.*
    into v_pick
  from public.nhl_pickem_picks p
  where p.entry_id = v_entry.id
    and p.nhl_pickem_period_id = v_period.id
    and p.nhl_pickem_game_id = p_nhl_pickem_game_id
    and p.market_type = p_market_type;

  if not found then
    return jsonb_build_object(
      'success', true,
      'removed', false,
      'reason', 'pick_not_found'
    );
  end if;

  select ng.kickoff_at
    into v_kickoff_at
  from public.nhl_pickem_games pg
  join public.nhl_games ng
    on ng.id = pg.nhl_game_id
  where pg.id = v_pick.nhl_pickem_game_id;

  if v_pick.locked_at is not null or now() >= v_kickoff_at then
    raise exception 'This pick is locked and cannot be removed.';
  end if;

  delete from public.nhl_pickem_picks
  where id = v_pick.id;

  return jsonb_build_object(
    'success', true,
    'removed', true,
    'pickId', v_pick.id
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Confidence scoring.
--
-- Each confidence value must be one of the commissioner's configured values and
-- may only be used once on a member's card for that contest period.
-- -----------------------------------------------------------------------------

create or replace function public.set_nhl_pickem_confidence_value(
  p_league_id uuid,
  p_season integer,
  p_period_number integer,
  p_nhl_pickem_game_id bigint,
  p_market_type text,
  p_confidence_value numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_entry public.nhl_pickem_entries%rowtype;
  v_period public.nhl_pickem_periods%rowtype;
  v_settings public.nhl_pickem_settings%rowtype;
  v_pick public.nhl_pickem_picks%rowtype;
  v_kickoff_at timestamptz;
begin
  v_entry := private.get_nhl_pickem_owned_entry(
    p_league_id,
    p_season,
    v_user_id
  );

  select *
    into v_settings
  from public.nhl_pickem_settings
  where league_id = p_league_id;

  if v_settings.scoring_mode <> 'confidence' then
    raise exception 'This NHL Pick''em league is not using confidence scoring.';
  end if;

  if p_confidence_value is null
     or not (p_confidence_value = any(v_settings.confidence_points))
  then
    raise exception 'That confidence value is not configured for this league.';
  end if;

  select *
    into v_period
  from public.nhl_pickem_periods
  where league_id = p_league_id
    and season = p_season
    and period_number = p_period_number;

  if not found then
    raise exception 'NHL Pick''em period could not be found.';
  end if;

  select p.*
    into v_pick
  from public.nhl_pickem_picks p
  where p.entry_id = v_entry.id
    and p.nhl_pickem_period_id = v_period.id
    and p.nhl_pickem_game_id = p_nhl_pickem_game_id
    and p.market_type = p_market_type;

  if not found then
    raise exception 'Create the NHL Pick''em selection before assigning confidence.';
  end if;

  select ng.kickoff_at
    into v_kickoff_at
  from public.nhl_pickem_games pg
  join public.nhl_games ng
    on ng.id = pg.nhl_game_id
  where pg.id = v_pick.nhl_pickem_game_id;

  if v_pick.locked_at is not null or now() >= v_kickoff_at then
    raise exception 'This pick is locked.';
  end if;

  if exists (
    select 1
    from public.nhl_pickem_picks p
    where p.entry_id = v_entry.id
      and p.nhl_pickem_period_id = v_period.id
      and p.id <> v_pick.id
      and p.confidence_value = p_confidence_value
  ) then
    raise exception 'That confidence value is already assigned to another pick.';
  end if;

  update public.nhl_pickem_picks
  set confidence_value = p_confidence_value,
      updated_at = now()
  where id = v_pick.id;

  return jsonb_build_object(
    'success', true,
    'pickId', v_pick.id,
    'confidenceValue', p_confidence_value
  );
end;
$$;

-- Assign the first available configured confidence value to a pick.
create or replace function public.assign_nhl_pickem_default_confidence(
  p_pick_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_pick public.nhl_pickem_picks%rowtype;
  v_settings public.nhl_pickem_settings%rowtype;
  v_value numeric;
  v_kickoff_at timestamptz;
begin
  select *
    into v_pick
  from public.nhl_pickem_picks
  where id = p_pick_id
    and user_id = v_user_id;

  if not found then
    raise exception 'Your NHL Pick''em pick could not be found.';
  end if;

  select *
    into v_settings
  from public.nhl_pickem_settings
  where league_id = v_pick.league_id;

  if v_settings.scoring_mode <> 'confidence' then
    return jsonb_build_object(
      'success', true,
      'pickId', v_pick.id,
      'assigned', false,
      'reason', 'confidence_mode_not_enabled'
    );
  end if;

  select ng.kickoff_at
    into v_kickoff_at
  from public.nhl_pickem_games pg
  join public.nhl_games ng on ng.id = pg.nhl_game_id
  where pg.id = v_pick.nhl_pickem_game_id;

  if v_pick.locked_at is not null or now() >= v_kickoff_at then
    raise exception 'This pick is locked.';
  end if;

  select c.value
    into v_value
  from unnest(v_settings.confidence_points) with ordinality as c(value, ord)
  where not exists (
    select 1
    from public.nhl_pickem_picks p
    where p.entry_id = v_pick.entry_id
      and p.nhl_pickem_period_id = v_pick.nhl_pickem_period_id
      and p.id <> v_pick.id
      and p.confidence_value = c.value
  )
  order by c.ord
  limit 1;

  if v_value is null then
    raise exception 'No unused confidence values remain for this period.';
  end if;

  update public.nhl_pickem_picks
  set confidence_value = v_value,
      updated_at = now()
  where id = v_pick.id;

  return jsonb_build_object(
    'success', true,
    'pickId', v_pick.id,
    'assigned', true,
    'confidenceValue', v_value
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Lock all picks whose selected game's puck drop has arrived.
-- -----------------------------------------------------------------------------

create or replace function public.lock_due_nhl_pickem_picks()
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_locked integer := 0;
begin
  with locked as (
    update public.nhl_pickem_picks p
    set locked_at = coalesce(p.locked_at, ng.kickoff_at),
        updated_at = now()
    from public.nhl_pickem_games pg
    join public.nhl_games ng
      on ng.id = pg.nhl_game_id
    where p.nhl_pickem_game_id = pg.id
      and p.locked_at is null
      and now() >= ng.kickoff_at
    returning p.id
  )
  select count(*)
    into v_locked
  from locked;

  return jsonb_build_object(
    'success', true,
    'lockedPicks', v_locked
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Internal points calculation.
-- -----------------------------------------------------------------------------

create or replace function private.calculate_nhl_pickem_result_points(
  p_result text,
  p_scoring_mode text,
  p_win_points numeric,
  p_push_points numeric,
  p_loss_points numeric,
  p_confidence_value numeric,
  p_confidence_push_multiplier numeric
)
returns numeric
language sql
immutable
set search_path = public, private, pg_temp
as $$
  select case
    when p_result not in ('win','push','loss') then 0::numeric
    when p_scoring_mode = 'record_only' then 0::numeric
    when p_scoring_mode = 'standard' then
      case p_result
        when 'win' then coalesce(p_win_points, 0)
        when 'push' then coalesce(p_push_points, 0)
        else coalesce(p_loss_points, 0)
      end
    when p_scoring_mode = 'confidence' then
      case p_result
        when 'win' then coalesce(p_confidence_value, 0)
        when 'push' then
          coalesce(p_confidence_value, 0)
          * coalesce(p_confidence_push_multiplier, 0)
        else 0::numeric
      end
    else 0::numeric
  end;
$$;

-- -----------------------------------------------------------------------------
-- Grade one finalized NHL Pick'em game.
--
-- Puck Line:
--   home pick -> final_home + home_line vs final_away
--   away pick -> final_away + away_line vs final_home
--
-- Total:
--   final_home + final_away compared to the frozen snapshot total.
--
-- Authoritative public.nhl_games scores already include the completed NHL game
-- result (including OT/shootout winner). No regulation-only rewrite is done.
-- -----------------------------------------------------------------------------

create or replace function public.grade_nhl_pickem_game(
  p_nhl_pickem_game_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_game public.nhl_pickem_games%rowtype;
  v_nhl_game public.nhl_games%rowtype;
  v_settings public.nhl_pickem_settings%rowtype;
  v_graded integer := 0;
begin
  select *
    into v_game
  from public.nhl_pickem_games
  where id = p_nhl_pickem_game_id
  for update;

  if not found then
    raise exception 'NHL Pick''em game could not be found.';
  end if;

  if v_game.line_status <> 'frozen' or not v_game.is_frozen then
    return jsonb_build_object(
      'success', true,
      'gameId', v_game.id,
      'graded', 0,
      'reason', 'game_has_no_frozen_g365_market'
    );
  end if;

  select *
    into v_nhl_game
  from public.nhl_games
  where id = v_game.nhl_game_id;

  if not found then
    raise exception 'Authoritative NHL game could not be found.';
  end if;

  if not v_nhl_game.status_completed then
    return jsonb_build_object(
      'success', true,
      'gameId', v_game.id,
      'graded', 0,
      'reason', 'nhl_game_not_final'
    );
  end if;

  select *
    into v_settings
  from public.nhl_pickem_settings
  where league_id = v_game.league_id;

  if not found then
    raise exception 'NHL Pick''em settings could not be found.';
  end if;

  -- Ensure all selections on this game are locked before grading.
  update public.nhl_pickem_picks
  set locked_at = coalesce(locked_at, v_nhl_game.kickoff_at),
      updated_at = now()
  where nhl_pickem_game_id = v_game.id
    and locked_at is null;

  with results as (
    select
      p.id,
      case
        when p.market_type = 'puck_line'
             and p.selected_side = 'home'
        then
          case
            when (v_nhl_game.home_score::numeric + p.snapshot_home_puck_line)
                 > v_nhl_game.away_score::numeric
              then 'win'
            when (v_nhl_game.home_score::numeric + p.snapshot_home_puck_line)
                 = v_nhl_game.away_score::numeric
              then 'push'
            else 'loss'
          end

        when p.market_type = 'puck_line'
             and p.selected_side = 'away'
        then
          case
            when (v_nhl_game.away_score::numeric + p.snapshot_away_puck_line)
                 > v_nhl_game.home_score::numeric
              then 'win'
            when (v_nhl_game.away_score::numeric + p.snapshot_away_puck_line)
                 = v_nhl_game.home_score::numeric
              then 'push'
            else 'loss'
          end

        when p.market_type = 'total'
             and p.selected_side = 'over'
        then
          case
            when (v_nhl_game.home_score + v_nhl_game.away_score)::numeric
                 > p.snapshot_total
              then 'win'
            when (v_nhl_game.home_score + v_nhl_game.away_score)::numeric
                 = p.snapshot_total
              then 'push'
            else 'loss'
          end

        when p.market_type = 'total'
             and p.selected_side = 'under'
        then
          case
            when (v_nhl_game.home_score + v_nhl_game.away_score)::numeric
                 < p.snapshot_total
              then 'win'
            when (v_nhl_game.home_score + v_nhl_game.away_score)::numeric
                 = p.snapshot_total
              then 'push'
            else 'loss'
          end

        else 'ungraded'
      end as result
    from public.nhl_pickem_picks p
    where p.nhl_pickem_game_id = v_game.id
  ),
  graded as (
    update public.nhl_pickem_picks p
    set result = r.result,
        points_awarded =
          private.calculate_nhl_pickem_result_points(
            r.result,
            v_settings.scoring_mode,
            v_settings.win_points,
            v_settings.push_points,
            v_settings.loss_points,
            p.confidence_value,
            v_settings.confidence_push_multiplier
          ),
        graded_at = now(),
        updated_at = now()
    from results r
    where p.id = r.id
    returning p.id
  )
  select count(*)
    into v_graded
  from graded;

  update public.nhl_pickem_games
  set final_home_score = v_nhl_game.home_score,
      final_away_score = v_nhl_game.away_score,
      graded_at = now(),
      updated_at = now()
  where id = v_game.id;

  return jsonb_build_object(
    'success', true,
    'gameId', v_game.id,
    'nhlGameId', v_game.nhl_game_id,
    'finalHomeScore', v_nhl_game.home_score,
    'finalAwayScore', v_nhl_game.away_score,
    'gradedPicks', v_graded
  );
end;
$$;

-- Grade every frozen contest game whose authoritative NHL game is final.
create or replace function public.grade_final_nhl_pickem_games(
  p_limit integer default 250
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  r record;
  v_result jsonb;
  v_games integer := 0;
  v_picks integer := 0;
begin
  if p_limit is null or p_limit < 1 or p_limit > 1000 then
    raise exception 'Grade limit must be between 1 and 1000.';
  end if;

  for r in
    select pg.id
    from public.nhl_pickem_games pg
    join public.nhl_games ng
      on ng.id = pg.nhl_game_id
    where pg.line_status = 'frozen'
      and pg.is_frozen = true
      and ng.status_completed = true
      and (
        pg.graded_at is null
        or pg.final_home_score is distinct from ng.home_score
        or pg.final_away_score is distinct from ng.away_score
      )
    order by ng.kickoff_at, pg.id
    limit p_limit
  loop
    v_result := public.grade_nhl_pickem_game(r.id);
    v_games := v_games + 1;
    v_picks :=
      v_picks + coalesce((v_result ->> 'gradedPicks')::integer, 0);
  end loop;

  return jsonb_build_object(
    'success', true,
    'gamesGraded', v_games,
    'picksGraded', v_picks
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Permissions
-- -----------------------------------------------------------------------------

revoke all on function private.get_nhl_pickem_owned_entry(uuid,integer,uuid)
  from public, anon, authenticated;

revoke all on function private.calculate_nhl_pickem_result_points(
  text,text,numeric,numeric,numeric,numeric,numeric
) from public, anon, authenticated;

grant execute on function public.save_nhl_pickem_pick(
  uuid,integer,integer,bigint,text,text
) to authenticated;

grant execute on function public.remove_nhl_pickem_pick(
  uuid,integer,integer,bigint,text
) to authenticated;

grant execute on function public.set_nhl_pickem_confidence_value(
  uuid,integer,integer,bigint,text,numeric
) to authenticated;

grant execute on function public.assign_nhl_pickem_default_confidence(bigint)
  to authenticated;

-- Lifecycle/grading are backend-only.
revoke all on function public.lock_due_nhl_pickem_picks()
  from public, anon, authenticated;
revoke all on function public.grade_nhl_pickem_game(bigint)
  from public, anon, authenticated;
revoke all on function public.grade_final_nhl_pickem_games(integer)
  from public, anon, authenticated;

grant execute on function public.lock_due_nhl_pickem_picks()
  to service_role;
grant execute on function public.grade_nhl_pickem_game(bigint)
  to service_role;
grant execute on function public.grade_final_nhl_pickem_games(integer)
  to service_role;

commit;

-- -----------------------------------------------------------------------------
-- Verification
-- -----------------------------------------------------------------------------

select
  'nhl_pickem_pick_write_functions' as check_name,
  (
    to_regprocedure(
      'public.save_nhl_pickem_pick(uuid,integer,integer,bigint,text,text)'
    ) is not null
    and to_regprocedure(
      'public.remove_nhl_pickem_pick(uuid,integer,integer,bigint,text)'
    ) is not null
  ) as pass

union all

select
  'nhl_pickem_confidence_functions',
  (
    to_regprocedure(
      'public.set_nhl_pickem_confidence_value(uuid,integer,integer,bigint,text,numeric)'
    ) is not null
    and to_regprocedure(
      'public.assign_nhl_pickem_default_confidence(bigint)'
    ) is not null
  )

union all

select
  'nhl_pickem_lock_function',
  to_regprocedure(
    'public.lock_due_nhl_pickem_picks()'
  ) is not null

union all

select
  'nhl_pickem_grading_functions',
  (
    to_regprocedure(
      'public.grade_nhl_pickem_game(bigint)'
    ) is not null
    and to_regprocedure(
      'public.grade_final_nhl_pickem_games(integer)'
    ) is not null
  )

union all

select
  'nhl_pickem_member_direct_dml_blocked',
  (
    not has_table_privilege(
      'authenticated',
      'public.nhl_pickem_picks',
      'INSERT'
    )
    and not has_table_privilege(
      'authenticated',
      'public.nhl_pickem_picks',
      'UPDATE'
    )
    and not has_table_privilege(
      'authenticated',
      'public.nhl_pickem_picks',
      'DELETE'
    )
    and has_table_privilege(
      'authenticated',
      'public.nhl_pickem_picks',
      'SELECT'
    )
  )

union all

select
  'nhl_pickem_grading_service_only',
  (
    has_function_privilege(
      'service_role',
      'public.grade_nhl_pickem_game(bigint)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'authenticated',
      'public.grade_nhl_pickem_game(bigint)',
      'EXECUTE'
    )
    and has_function_privilege(
      'service_role',
      'public.lock_due_nhl_pickem_picks()',
      'EXECUTE'
    )
    and not has_function_privilege(
      'authenticated',
      'public.lock_due_nhl_pickem_picks()',
      'EXECUTE'
    )
  );
