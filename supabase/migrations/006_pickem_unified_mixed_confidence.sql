begin;


-- ============================================================
-- 1. PRESERVE CURRENT VERIFIED FUNCTIONS
-- ============================================================

do $$
begin
  if to_regprocedure(
       'public.assign_pickem_default_confidence_legacy_g365(bigint)'
     ) is null
     and to_regprocedure(
       'public.assign_pickem_default_confidence(bigint)'
     ) is not null
  then
    alter function public.assign_pickem_default_confidence(bigint)
      rename to assign_pickem_default_confidence_legacy_g365;
  end if;

  if to_regprocedure(
       'public.assign_nhl_pickem_default_confidence_legacy_g365(bigint)'
     ) is null
     and to_regprocedure(
       'public.assign_nhl_pickem_default_confidence(bigint)'
     ) is not null
  then
    alter function public.assign_nhl_pickem_default_confidence(bigint)
      rename to assign_nhl_pickem_default_confidence_legacy_g365;
  end if;

  if to_regprocedure(
       'public.set_pickem_confidence_value_legacy_g365(uuid,integer,integer,bigint,numeric)'
     ) is null
     and to_regprocedure(
       'public.set_pickem_confidence_value(uuid,integer,integer,bigint,numeric)'
     ) is not null
  then
    alter function public.set_pickem_confidence_value(
      uuid,integer,integer,bigint,numeric
    )
      rename to set_pickem_confidence_value_legacy_g365;
  end if;

  if to_regprocedure(
       'public.set_nhl_pickem_confidence_value_legacy_g365(uuid,integer,integer,bigint,text,numeric)'
     ) is null
     and to_regprocedure(
       'public.set_nhl_pickem_confidence_value(uuid,integer,integer,bigint,text,numeric)'
     ) is not null
  then
    alter function public.set_nhl_pickem_confidence_value(
      uuid,integer,integer,bigint,text,numeric
    )
      rename to set_nhl_pickem_confidence_value_legacy_g365;
  end if;
end
$$;


-- ============================================================
-- 2. INTERNAL HELPERS
-- ============================================================

create or replace function private.g365_pickem_mixed_week_id(
  p_league_id uuid,
  p_season integer,
  p_week integer
)
returns bigint
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select w.id
  from public.pickem_weeks w
  where w.league_id = p_league_id
    and w.season = p_season
    and w.week = p_week
  limit 1
$$;


create or replace function private.g365_pickem_mixed_nhl_period_id(
  p_league_id uuid,
  p_season integer,
  p_week integer
)
returns bigint
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select p.id
  from public.nhl_pickem_periods p
  where p.league_id = p_league_id
    and p.season = p_season
    and p.period_number = p_week
  limit 1
$$;


-- ============================================================
-- 3. UNIFIED DEFAULT CONFIDENCE FOR FOOTBALL PICKS
-- ============================================================

create or replace function public.assign_pickem_default_confidence(
  p_pick_id bigint
)
returns numeric
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_pick public.pickem_picks%rowtype;
  v_week public.pickem_weeks%rowtype;
  v_period_id bigint;
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

  if not found then
    return null;
  end if;

  if not private.g365_pickem_is_mixed_with_nhl(v_week.league_id) then
    return public.assign_pickem_default_confidence_legacy_g365(
      p_pick_id
    );
  end if;

  if v_week.scoring_mode <> 'confidence' then
    update public.pickem_picks
    set confidence_value = null,
        updated_at = now()
    where id = v_pick.id;

    return null;
  end if;

  if v_pick.confidence_value is not null then
    return v_pick.confidence_value;
  end if;

  v_period_id :=
    private.g365_pickem_mixed_nhl_period_id(
      v_week.league_id,
      v_week.season,
      v_week.week
    );

  select candidate.value
  into v_value
  from (
    select
      (jsonb_array_elements_text(v_week.confidence_points))::numeric
        as value,
      row_number() over () as ord
  ) candidate
  where not exists (
    select 1
    from public.pickem_picks p
    where p.pickem_week_id = v_week.id
      and p.fantasy_team_id = v_pick.fantasy_team_id
      and p.id <> v_pick.id
      and p.result <> 'void'
      and p.confidence_value = candidate.value
  )
  and not exists (
    select 1
    from public.nhl_pickem_picks p
    where v_period_id is not null
      and p.nhl_pickem_period_id = v_period_id
      and p.fantasy_team_id = v_pick.fantasy_team_id
      and coalesce(p.result,'pending') <> 'void'
      and p.confidence_value = candidate.value
  )
  order by candidate.ord
  limit 1;

  update public.pickem_picks
  set confidence_value = v_value,
      updated_at = now()
  where id = v_pick.id;

  return v_value;
end;
$$;


-- ============================================================
-- 4. UNIFIED DEFAULT CONFIDENCE FOR NHL PICKS
-- ============================================================

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
  v_period public.nhl_pickem_periods%rowtype;
  v_week public.pickem_weeks%rowtype;
  v_value numeric;
begin
  select *
  into v_pick
  from public.nhl_pickem_picks
  where id = p_pick_id
  for update;

  if not found then
    raise exception 'Your NHL Pick''em pick could not be found.';
  end if;

  if not private.g365_pickem_is_mixed_with_nhl(v_pick.league_id) then
    return public.assign_nhl_pickem_default_confidence_legacy_g365(
      p_pick_id
    );
  end if;

  if v_user_id is not null
     and v_pick.user_id is not null
     and v_pick.user_id <> v_user_id
  then
    raise exception using
      errcode = '42501',
      message = 'You do not own this Pick''em selection.';
  end if;

  select *
  into v_period
  from public.nhl_pickem_periods
  where id = v_pick.nhl_pickem_period_id;

  if not found then
    raise exception 'NHL Pick''em period could not be found.';
  end if;

  select *
  into v_week
  from public.pickem_weeks
  where league_id = v_pick.league_id
    and season = v_period.season
    and week = v_period.period_number;

  if not found then
    raise exception 'Master Pick''em week could not be found.';
  end if;

  if v_week.scoring_mode <> 'confidence' then
    update public.nhl_pickem_picks
    set confidence_value = null,
        updated_at = now()
    where id = v_pick.id;

    return jsonb_build_object(
      'success', true,
      'pickId', v_pick.id,
      'assigned', false,
      'reason', 'confidence_mode_not_enabled'
    );
  end if;

  if v_pick.confidence_value is not null then
    return jsonb_build_object(
      'success', true,
      'pickId', v_pick.id,
      'assigned', true,
      'confidenceValue', v_pick.confidence_value
    );
  end if;

  select candidate.value
  into v_value
  from (
    select
      (jsonb_array_elements_text(v_week.confidence_points))::numeric
        as value,
      row_number() over () as ord
  ) candidate
  where not exists (
    select 1
    from public.pickem_picks p
    where p.pickem_week_id = v_week.id
      and p.fantasy_team_id = v_pick.fantasy_team_id
      and p.result <> 'void'
      and p.confidence_value = candidate.value
  )
  and not exists (
    select 1
    from public.nhl_pickem_picks p
    where p.nhl_pickem_period_id = v_period.id
      and p.fantasy_team_id = v_pick.fantasy_team_id
      and p.id <> v_pick.id
      and coalesce(p.result,'pending') <> 'void'
      and p.confidence_value = candidate.value
  )
  order by candidate.ord
  limit 1;

  if v_value is null then
    raise exception 'No unused combined confidence values remain for this G365 Pick''em card.';
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


-- ============================================================
-- 5. UNIFIED MANUAL CONFIDENCE SETTER - FOOTBALL TARGET
-- ============================================================

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
set search_path = public, private, auth, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_team_id bigint;
  v_week public.pickem_weeks%rowtype;
  v_period_id bigint;
  v_pick public.pickem_picks%rowtype;
  v_cross_pick public.nhl_pickem_picks%rowtype;
  v_allowed boolean := false;
  v_old_value numeric;
  v_cross_locked boolean := false;
begin
  if not private.g365_pickem_is_mixed_with_nhl(p_league_id) then
    return public.set_pickem_confidence_value_legacy_g365(
      p_league_id,
      p_season,
      p_week,
      p_pickem_game_id,
      p_confidence_value
    );
  end if;

  if v_user is null then
    raise exception using
      errcode = '42501',
      message = 'You must be signed in.';
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
    raise exception using
      errcode = '42501',
      message = 'You do not own an active Pick''em entry.';
  end if;

  select *
  into v_week
  from public.pickem_weeks
  where league_id = p_league_id
    and season = p_season
    and week = p_week
  for update;

  if not found then
    raise exception 'Pick''em week could not be found.';
  end if;

  if v_week.status = 'final' then
    raise exception 'This Pick''em week is already final.';
  end if;

  if v_week.scoring_mode <> 'confidence' then
    raise exception 'This league week is not using confidence scoring.';
  end if;

  select exists (
    select 1
    from jsonb_array_elements_text(v_week.confidence_points) value
    where value::numeric = p_confidence_value
  )
  into v_allowed;

  if not v_allowed then
    raise exception 'That confidence value is not available for this week.';
  end if;

  select p.*
  into v_pick
  from public.pickem_picks p
  where p.pickem_week_id = v_week.id
    and p.fantasy_team_id = v_team_id
    and p.pickem_game_id = p_pickem_game_id
    and p.result <> 'void'
  for update;

  if not found then
    raise exception 'Select this game before assigning confidence.';
  end if;

  if v_pick.locked_at is not null
     or exists (
       select 1
       from public.pickem_games g
       where g.id = v_pick.pickem_game_id
         and (
           g.is_started
           or g.is_final
           or now() >= g.kickoff_at
         )
     )
  then
    raise exception 'This pick is locked.';
  end if;

  if v_pick.confidence_value = p_confidence_value then
    return jsonb_build_object(
      'success', true,
      'confidenceValue', p_confidence_value
    );
  end if;

  v_old_value := v_pick.confidence_value;

  v_period_id :=
    private.g365_pickem_mixed_nhl_period_id(
      p_league_id,
      p_season,
      p_week
    );

  if v_period_id is not null then
    select p.*
    into v_cross_pick
    from public.nhl_pickem_picks p
    where p.nhl_pickem_period_id = v_period_id
      and p.fantasy_team_id = v_team_id
      and coalesce(p.result,'pending') <> 'void'
      and p.confidence_value = p_confidence_value
    limit 1
    for update;

    if found then
      select (
        v_cross_pick.locked_at is not null
        or now() >= ng.kickoff_at
      )
      into v_cross_locked
      from public.nhl_pickem_games pg
      join public.nhl_games ng
        on ng.id = pg.nhl_game_id
      where pg.id = v_cross_pick.nhl_pickem_game_id;

      if coalesce(v_cross_locked,false) then
        raise exception 'That confidence value belongs to a locked NHL pick.';
      end if;
    end if;
  end if;

  -- First let the mature Football function handle any same-Football swap
  -- and all Football-specific validation.
  perform public.set_pickem_confidence_value_legacy_g365(
    p_league_id,
    p_season,
    p_week,
    p_pickem_game_id,
    p_confidence_value
  );

  -- If the requested value lived on an NHL pick, swap the Football
  -- target's previous value onto that NHL pick.
  if v_cross_pick.id is not null then
    update public.nhl_pickem_picks
    set confidence_value = v_old_value,
        updated_at = now()
    where id = v_cross_pick.id;
  end if;

  return jsonb_build_object(
    'success', true,
    'confidenceValue', p_confidence_value,
    'crossSportSwap', (v_cross_pick.id is not null)
  );
end;
$$;


-- ============================================================
-- 6. UNIFIED MANUAL CONFIDENCE SETTER - NHL TARGET
-- ============================================================

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
set search_path = public, private, auth, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_team_id bigint;
  v_week public.pickem_weeks%rowtype;
  v_period public.nhl_pickem_periods%rowtype;
  v_pick public.nhl_pickem_picks%rowtype;
  v_cross_pick public.pickem_picks%rowtype;
  v_allowed boolean := false;
  v_old_value numeric;
  v_cross_locked boolean := false;
begin
  if not private.g365_pickem_is_mixed_with_nhl(p_league_id) then
    return public.set_nhl_pickem_confidence_value_legacy_g365(
      p_league_id,
      p_season,
      p_period_number,
      p_nhl_pickem_game_id,
      p_market_type,
      p_confidence_value
    );
  end if;

  if v_user is null then
    raise exception using
      errcode = '42501',
      message = 'You must be signed in.';
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
    raise exception using
      errcode = '42501',
      message = 'You do not own an active Pick''em entry.';
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

  select *
  into v_week
  from public.pickem_weeks
  where league_id = p_league_id
    and season = p_season
    and week = p_period_number
  for update;

  if not found then
    raise exception 'Master Pick''em week could not be found.';
  end if;

  if v_week.status = 'final' then
    raise exception 'This Pick''em week is already final.';
  end if;

  if v_week.scoring_mode <> 'confidence' then
    raise exception 'This league week is not using confidence scoring.';
  end if;

  select exists (
    select 1
    from jsonb_array_elements_text(v_week.confidence_points) value
    where value::numeric = p_confidence_value
  )
  into v_allowed;

  if not v_allowed then
    raise exception 'That confidence value is not available for this week.';
  end if;

  select p.*
  into v_pick
  from public.nhl_pickem_picks p
  where p.nhl_pickem_period_id = v_period.id
    and p.fantasy_team_id = v_team_id
    and p.nhl_pickem_game_id = p_nhl_pickem_game_id
    and p.market_type = p_market_type
    and coalesce(p.result,'pending') <> 'void'
  for update;

  if not found then
    raise exception 'Select this NHL market before assigning confidence.';
  end if;

  if v_pick.locked_at is not null
     or exists (
       select 1
       from public.nhl_pickem_games pg
       join public.nhl_games ng
         on ng.id = pg.nhl_game_id
       where pg.id = v_pick.nhl_pickem_game_id
         and now() >= ng.kickoff_at
     )
  then
    raise exception 'This NHL pick is locked.';
  end if;

  if v_pick.confidence_value = p_confidence_value then
    return jsonb_build_object(
      'success', true,
      'confidenceValue', p_confidence_value
    );
  end if;

  v_old_value := v_pick.confidence_value;

  select p.*
  into v_cross_pick
  from public.pickem_picks p
  where p.pickem_week_id = v_week.id
    and p.fantasy_team_id = v_team_id
    and p.result <> 'void'
    and p.confidence_value = p_confidence_value
  limit 1
  for update;

  if found then
    select (
      v_cross_pick.locked_at is not null
      or g.is_started
      or g.is_final
      or now() >= g.kickoff_at
    )
    into v_cross_locked
    from public.pickem_games g
    where g.id = v_cross_pick.pickem_game_id;

    if coalesce(v_cross_locked,false) then
      raise exception 'That confidence value belongs to a locked Football pick.';
    end if;
  end if;

  -- Mature NHL function handles same-NHL swaps and NHL lock/market checks.
  perform public.set_nhl_pickem_confidence_value_legacy_g365(
    p_league_id,
    p_season,
    p_period_number,
    p_nhl_pickem_game_id,
    p_market_type,
    p_confidence_value
  );

  if v_cross_pick.id is not null then
    update public.pickem_picks
    set confidence_value = v_old_value,
        updated_at = now()
    where id = v_cross_pick.id;
  end if;

  return jsonb_build_object(
    'success', true,
    'confidenceValue', p_confidence_value,
    'crossSportSwap', (v_cross_pick.id is not null)
  );
end;
$$;


-- ============================================================
-- 7. PERMISSIONS
-- ============================================================

revoke all on function public.assign_pickem_default_confidence(bigint)
  from public, anon, authenticated;

revoke all on function public.assign_nhl_pickem_default_confidence(bigint)
  from public, anon, authenticated;

grant execute on function public.assign_pickem_default_confidence(bigint)
  to service_role;

grant execute on function public.assign_nhl_pickem_default_confidence(bigint)
  to service_role;

-- The member-facing setter RPCs remain callable by authenticated users.
revoke all on function public.set_pickem_confidence_value(
  uuid,integer,integer,bigint,numeric
) from public, anon;

grant execute on function public.set_pickem_confidence_value(
  uuid,integer,integer,bigint,numeric
) to authenticated, service_role;

revoke all on function public.set_nhl_pickem_confidence_value(
  uuid,integer,integer,bigint,text,numeric
) from public, anon;

grant execute on function public.set_nhl_pickem_confidence_value(
  uuid,integer,integer,bigint,text,numeric
) to authenticated, service_role;


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
where n.nspname in ('public','private')
  and p.proname in (
    'assign_pickem_default_confidence',
    'assign_pickem_default_confidence_legacy_g365',
    'assign_nhl_pickem_default_confidence',
    'assign_nhl_pickem_default_confidence_legacy_g365',
    'set_pickem_confidence_value',
    'set_pickem_confidence_value_legacy_g365',
    'set_nhl_pickem_confidence_value',
    'set_nhl_pickem_confidence_value_legacy_g365'
  )
order by p.proname;