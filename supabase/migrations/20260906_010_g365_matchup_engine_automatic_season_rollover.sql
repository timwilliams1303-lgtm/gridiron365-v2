-- ============================================================
-- GRIDIRON365 V2
-- G365 MATCHUP ENGINE - AUTOMATIC SEASON ROLLOVER
--
-- SAVE TO MIGRATIONS
-- File:
--   supabase/migrations/20260906_010_g365_matchup_engine_automatic_season_rollover.sql
--
-- PURPOSE
--   Removes annual developer maintenance from the Season-Long
--   matchup engine while preserving the verified 2025/2026
--   formulas as immutable templates.
--
-- DESIGN
--   * 2026 current-season views and 2025 historical views remain
--     installed as the verified template/reference implementation.
--   * Future seasons are generated automatically from those
--     templates on first use.
--   * For requested season S:
--       current-season objects use S
--       historical objects use S - 1
--   * Production matchup functions call season-aware wrappers,
--     not hardcoded _2026 relations.
--   * A template fingerprint causes already-generated future
--     views to rebuild automatically if the verified template
--     definitions are intentionally changed later.
--
-- IMPORTANT
--   This migration does NOT drop the existing _2025/_2026 views.
--   They remain available for rollback, comparison, and as the
--   source templates used to generate future seasons.
-- ============================================================

begin;

-- ============================================================
-- 1. BUILD REGISTRY
-- ============================================================

create table if not exists private.g365_matchup_season_builds (
  season integer primary key,
  prior_season integer not null,
  template_current_season integer not null default 2026,
  template_prior_season integer not null default 2025,
  template_fingerprint text not null,
  object_count integer not null default 24,
  built_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table private.g365_matchup_season_builds is
  'Tracks automatically generated G365 matchup-engine season views. Future seasons are generated from the verified 2025/2026 template dependency tree and rebuilt when the template fingerprint changes.';

revoke all on table private.g365_matchup_season_builds from public;


-- ============================================================
-- 2. TEMPLATE FINGERPRINT
-- ============================================================

create or replace function private.g365_matchup_template_fingerprint()
returns text
language sql
stable
security definer
set search_path = public, private
as $$
  with template_names(viewname) as (
    values
      ('g365_defensive_no_history_fallback_2026'),
      ('g365_defensive_player_quality_2025'),
      ('g365_defensive_projected_quality_2026'),
      ('g365_defensive_projection_fallback_2026'),
      ('g365_defensive_projections_2026'),
      ('g365_dst_offense_strength_board_2026'),
      ('g365_dst_weekly_matchup_components_2026'),
      ('g365_dst_weekly_opponents_2026'),
      ('g365_fantasypros_defensive_projections_2026'),
      ('g365_k_matchup_board_2026'),
      ('g365_kicker_projections_2026'),
      ('g365_offensive_no_history_fallback_2026'),
      ('g365_offensive_projected_quality_2026'),
      ('g365_offensive_projection_fallback_2026'),
      ('g365_offensive_projections_2026'),
      ('g365_team_defensive_personnel_strength_2026'),
      ('g365_team_dst_opponent_actual_strength_2026'),
      ('g365_team_dst_opponent_historical_strength_2025'),
      ('g365_team_dst_opponent_personnel_strength_2026'),
      ('g365_team_k_matchup_actual_2026'),
      ('g365_team_k_matchup_historical_2025'),
      ('g365_team_offensive_injury_impact_2026'),
      ('g365_team_offensive_personnel_strength_2026'),
      ('g365_team_position_personnel_matchups_2026')
  )
  select md5(
    string_agg(
      v.viewname || E'\n' || v.definition,
      E'\n-- G365 TEMPLATE OBJECT --\n'
      order by v.viewname
    )
  )
  from pg_views v
  join template_names t
    on t.viewname = v.viewname
  where v.schemaname = 'public';
$$;

revoke all on function private.g365_matchup_template_fingerprint() from public;


-- ============================================================
-- 3. AUTOMATIC SEASON OBJECT GENERATOR
-- ============================================================

create or replace function private.ensure_g365_matchup_season_objects(
  p_season integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_prior_season integer;
  v_fingerprint text;
  v_existing_fingerprint text;
  v_expected_count integer := 24;
  v_existing_count integer := 0;
  v_missing_templates text[];
  v_remaining integer := 0;
  v_progress integer := 0;
  v_pass integer := 0;
  v_record record;
  v_target_name text;
  v_target_definition text;
  v_pending_names text;
begin
  if p_season is null or p_season < 2000 or p_season > 2200 then
    raise exception 'A valid NFL season is required. Received: %', p_season;
  end if;

  v_prior_season := p_season - 1;
  v_fingerprint := private.g365_matchup_template_fingerprint();

  if v_fingerprint is null then
    raise exception 'G365 matchup template fingerprint could not be calculated.';
  end if;

  -- Verify that all 24 source templates still exist before doing any work.
  with template_names(viewname) as (
    values
      ('g365_defensive_no_history_fallback_2026'),
      ('g365_defensive_player_quality_2025'),
      ('g365_defensive_projected_quality_2026'),
      ('g365_defensive_projection_fallback_2026'),
      ('g365_defensive_projections_2026'),
      ('g365_dst_offense_strength_board_2026'),
      ('g365_dst_weekly_matchup_components_2026'),
      ('g365_dst_weekly_opponents_2026'),
      ('g365_fantasypros_defensive_projections_2026'),
      ('g365_k_matchup_board_2026'),
      ('g365_kicker_projections_2026'),
      ('g365_offensive_no_history_fallback_2026'),
      ('g365_offensive_projected_quality_2026'),
      ('g365_offensive_projection_fallback_2026'),
      ('g365_offensive_projections_2026'),
      ('g365_team_defensive_personnel_strength_2026'),
      ('g365_team_dst_opponent_actual_strength_2026'),
      ('g365_team_dst_opponent_historical_strength_2025'),
      ('g365_team_dst_opponent_personnel_strength_2026'),
      ('g365_team_k_matchup_actual_2026'),
      ('g365_team_k_matchup_historical_2025'),
      ('g365_team_offensive_injury_impact_2026'),
      ('g365_team_offensive_personnel_strength_2026'),
      ('g365_team_position_personnel_matchups_2026')
  )
  select array_agg(t.viewname order by t.viewname)
  into v_missing_templates
  from template_names t
  left join pg_views v
    on v.schemaname = 'public'
   and v.viewname = t.viewname
  where v.viewname is null;

  if coalesce(array_length(v_missing_templates, 1), 0) > 0 then
    raise exception
      'G365 matchup templates are incomplete. Missing: %',
      array_to_string(v_missing_templates, ', ');
  end if;

  -- The verified baseline season already exists. Register it and stop.
  if p_season = 2026 then
    insert into private.g365_matchup_season_builds (
      season,
      prior_season,
      template_current_season,
      template_prior_season,
      template_fingerprint,
      object_count,
      built_at,
      updated_at
    )
    values (
      2026,
      2025,
      2026,
      2025,
      v_fingerprint,
      v_expected_count,
      now(),
      now()
    )
    on conflict (season)
    do update set
      prior_season = excluded.prior_season,
      template_fingerprint = excluded.template_fingerprint,
      object_count = excluded.object_count,
      updated_at = now();

    return jsonb_build_object(
      'success', true,
      'season', p_season,
      'priorSeason', v_prior_season,
      'generated', false,
      'baselineTemplateSeason', true,
      'objectCount', v_expected_count,
      'templateFingerprint', v_fingerprint
    );
  end if;

  -- Count target objects that should exist for this season.
  with template_names(viewname) as (
    values
      ('g365_defensive_no_history_fallback_2026'),
      ('g365_defensive_player_quality_2025'),
      ('g365_defensive_projected_quality_2026'),
      ('g365_defensive_projection_fallback_2026'),
      ('g365_defensive_projections_2026'),
      ('g365_dst_offense_strength_board_2026'),
      ('g365_dst_weekly_matchup_components_2026'),
      ('g365_dst_weekly_opponents_2026'),
      ('g365_fantasypros_defensive_projections_2026'),
      ('g365_k_matchup_board_2026'),
      ('g365_kicker_projections_2026'),
      ('g365_offensive_no_history_fallback_2026'),
      ('g365_offensive_projected_quality_2026'),
      ('g365_offensive_projection_fallback_2026'),
      ('g365_offensive_projections_2026'),
      ('g365_team_defensive_personnel_strength_2026'),
      ('g365_team_dst_opponent_actual_strength_2026'),
      ('g365_team_dst_opponent_historical_strength_2025'),
      ('g365_team_dst_opponent_personnel_strength_2026'),
      ('g365_team_k_matchup_actual_2026'),
      ('g365_team_k_matchup_historical_2025'),
      ('g365_team_offensive_injury_impact_2026'),
      ('g365_team_offensive_personnel_strength_2026'),
      ('g365_team_position_personnel_matchups_2026')
  ), targets as (
    select case
      when t.viewname like '%_2025'
        then regexp_replace(t.viewname, '2025$', v_prior_season::text)
      else regexp_replace(t.viewname, '2026$', p_season::text)
    end as target_name
    from template_names t
  )
  select count(*)
  into v_existing_count
  from targets t
  join pg_views v
    on v.schemaname = 'public'
   and v.viewname = t.target_name;

  select b.template_fingerprint
  into v_existing_fingerprint
  from private.g365_matchup_season_builds b
  where b.season = p_season;

  if v_existing_count = v_expected_count
     and v_existing_fingerprint = v_fingerprint
  then
    return jsonb_build_object(
      'success', true,
      'season', p_season,
      'priorSeason', v_prior_season,
      'generated', false,
      'alreadyCurrent', true,
      'objectCount', v_existing_count,
      'templateFingerprint', v_fingerprint
    );
  end if;

  -- Build a session-local pending list. The generator retries dependency
  -- failures until all 24 transformed views have been created.
  create temporary table if not exists g365_matchup_pending_views (
    template_name text primary key,
    target_name text not null,
    target_definition text not null
  ) on commit drop;

  truncate table g365_matchup_pending_views;

  insert into g365_matchup_pending_views (
    template_name,
    target_name,
    target_definition
  )
  select
    v.viewname,
    case
      when v.viewname like '%_2025'
        then regexp_replace(v.viewname, '2025$', v_prior_season::text)
      else regexp_replace(v.viewname, '2026$', p_season::text)
    end,
    replace(
      replace(
        v.definition,
        '2026',
        p_season::text
      ),
      '2025',
      v_prior_season::text
    )
  from pg_views v
  where v.schemaname = 'public'
    and v.viewname in (
      'g365_defensive_no_history_fallback_2026',
      'g365_defensive_player_quality_2025',
      'g365_defensive_projected_quality_2026',
      'g365_defensive_projection_fallback_2026',
      'g365_defensive_projections_2026',
      'g365_dst_offense_strength_board_2026',
      'g365_dst_weekly_matchup_components_2026',
      'g365_dst_weekly_opponents_2026',
      'g365_fantasypros_defensive_projections_2026',
      'g365_k_matchup_board_2026',
      'g365_kicker_projections_2026',
      'g365_offensive_no_history_fallback_2026',
      'g365_offensive_projected_quality_2026',
      'g365_offensive_projection_fallback_2026',
      'g365_offensive_projections_2026',
      'g365_team_defensive_personnel_strength_2026',
      'g365_team_dst_opponent_actual_strength_2026',
      'g365_team_dst_opponent_historical_strength_2025',
      'g365_team_dst_opponent_personnel_strength_2026',
      'g365_team_k_matchup_actual_2026',
      'g365_team_k_matchup_historical_2025',
      'g365_team_offensive_injury_impact_2026',
      'g365_team_offensive_personnel_strength_2026',
      'g365_team_position_personnel_matchups_2026'
    );

  loop
    v_pass := v_pass + 1;
    v_progress := 0;

    for v_record in
      select
        p.template_name,
        p.target_name,
        p.target_definition
      from g365_matchup_pending_views p
      order by p.template_name
    loop
      begin
        execute format(
          'create or replace view public.%I as %s',
          v_record.target_name,
          v_record.target_definition
        );

        delete from g365_matchup_pending_views
        where template_name = v_record.template_name;

        v_progress := v_progress + 1;
      exception
        when undefined_table or undefined_object then
          -- A transformed dependency has not been generated yet.
          -- Leave this object pending and retry it on the next pass.
          null;
      end;
    end loop;

    select count(*)
    into v_remaining
    from g365_matchup_pending_views;

    exit when v_remaining = 0;

    if v_progress = 0 or v_pass >= 30 then
      select string_agg(target_name, ', ' order by target_name)
      into v_pending_names
      from g365_matchup_pending_views;

      raise exception
        'Unable to generate G365 matchup objects for season %. Unresolved views: %',
        p_season,
        coalesce(v_pending_names, '(unknown)');
    end if;
  end loop;

  insert into private.g365_matchup_season_builds (
    season,
    prior_season,
    template_current_season,
    template_prior_season,
    template_fingerprint,
    object_count,
    built_at,
    updated_at
  )
  values (
    p_season,
    v_prior_season,
    2026,
    2025,
    v_fingerprint,
    v_expected_count,
    now(),
    now()
  )
  on conflict (season)
  do update set
    prior_season = excluded.prior_season,
    template_fingerprint = excluded.template_fingerprint,
    object_count = excluded.object_count,
    built_at = now(),
    updated_at = now();

  return jsonb_build_object(
    'success', true,
    'season', p_season,
    'priorSeason', v_prior_season,
    'generated', true,
    'objectCount', v_expected_count,
    'passes', v_pass,
    'templateFingerprint', v_fingerprint
  );
end;
$$;

revoke all on function private.ensure_g365_matchup_season_objects(integer) from public;


-- ============================================================
-- 4. SEASON-AWARE RELATION WRAPPERS
--
-- These return the verified 2026 composite row types so callers keep
-- the exact same columns/types while the underlying relation name is
-- chosen from p_season at runtime.
-- ============================================================

create or replace function private.g365_k_matchup_board_for_season(
  p_season integer
)
returns setof public.g365_k_matchup_board_2026
language plpgsql
volatile
security definer
set search_path = public, private
as $$
begin
  perform private.ensure_g365_matchup_season_objects(p_season);

  return query execute format(
    'select * from public.%I',
    format('g365_k_matchup_board_%s', p_season)
  );
end;
$$;


create or replace function private.g365_team_position_personnel_matchups_for_season(
  p_season integer
)
returns setof public.g365_team_position_personnel_matchups_2026
language plpgsql
volatile
security definer
set search_path = public, private
as $$
begin
  perform private.ensure_g365_matchup_season_objects(p_season);

  return query execute format(
    'select * from public.%I',
    format('g365_team_position_personnel_matchups_%s', p_season)
  );
end;
$$;


create or replace function private.g365_dst_offense_strength_board_for_season(
  p_season integer
)
returns setof public.g365_dst_offense_strength_board_2026
language plpgsql
volatile
security definer
set search_path = public, private
as $$
begin
  perform private.ensure_g365_matchup_season_objects(p_season);

  return query execute format(
    'select * from public.%I',
    format('g365_dst_offense_strength_board_%s', p_season)
  );
end;
$$;


create or replace function private.g365_team_dst_opponent_personnel_strength_for_season(
  p_season integer
)
returns setof public.g365_team_dst_opponent_personnel_strength_2026
language plpgsql
volatile
security definer
set search_path = public, private
as $$
begin
  perform private.ensure_g365_matchup_season_objects(p_season);

  return query execute format(
    'select * from public.%I',
    format('g365_team_dst_opponent_personnel_strength_%s', p_season)
  );
end;
$$;


create or replace function private.g365_team_offensive_injury_impact_for_season(
  p_season integer
)
returns setof public.g365_team_offensive_injury_impact_2026
language plpgsql
volatile
security definer
set search_path = public, private
as $$
begin
  perform private.ensure_g365_matchup_season_objects(p_season);

  return query execute format(
    'select * from public.%I',
    format('g365_team_offensive_injury_impact_%s', p_season)
  );
end;
$$;

revoke all on function private.g365_k_matchup_board_for_season(integer) from public;
revoke all on function private.g365_team_position_personnel_matchups_for_season(integer) from public;
revoke all on function private.g365_dst_offense_strength_board_for_season(integer) from public;
revoke all on function private.g365_team_dst_opponent_personnel_strength_for_season(integer) from public;
revoke all on function private.g365_team_offensive_injury_impact_for_season(integer) from public;


-- ============================================================
-- 5. PATCH THE VERIFIED MATCHUP FUNCTIONS IN PLACE
--
-- We deliberately use pg_get_functiondef() and exact relation-name
-- replacement so every other line of the currently verified function
-- bodies remains unchanged.
-- ============================================================

do $$
declare
  v_definition text;
  v_original text;
begin
  -- ----------------------------------------------------------
  -- refresh_season_long_matchup_rankings_engine
  -- K board
  -- ----------------------------------------------------------
  select pg_get_functiondef(
    'public.refresh_season_long_matchup_rankings_engine(uuid,integer,integer)'::regprocedure
  )
  into v_definition;

  v_original := v_definition;

  v_definition := replace(
    v_definition,
    'public.g365_k_matchup_board_2026',
    'private.g365_k_matchup_board_for_season(p_season)'
  );

  if v_definition = v_original then
    raise exception
      'Expected g365_k_matchup_board_2026 reference was not found in refresh_season_long_matchup_rankings_engine.';
  end if;

  execute v_definition;


  -- ----------------------------------------------------------
  -- refresh_season_long_matchup_rankings_v5_core
  -- defensive personnel vs offensive position board
  -- ----------------------------------------------------------
  select pg_get_functiondef(
    'public.refresh_season_long_matchup_rankings_v5_core(uuid,integer,integer)'::regprocedure
  )
  into v_definition;

  v_original := v_definition;

  v_definition := replace(
    v_definition,
    'public.g365_team_position_personnel_matchups_2026',
    'private.g365_team_position_personnel_matchups_for_season(p_season)'
  );

  if v_definition = v_original then
    raise exception
      'Expected g365_team_position_personnel_matchups_2026 reference was not found in refresh_season_long_matchup_rankings_v5_core.';
  end if;

  execute v_definition;


  -- ----------------------------------------------------------
  -- refresh_season_long_matchup_rankings_v6_core
  -- DST opposing-offense overlay
  -- ----------------------------------------------------------
  select pg_get_functiondef(
    'public.refresh_season_long_matchup_rankings_v6_core(uuid,integer,integer)'::regprocedure
  )
  into v_definition;

  v_original := v_definition;

  v_definition := replace(
    v_definition,
    'public.g365_dst_offense_strength_board_2026',
    'private.g365_dst_offense_strength_board_for_season(p_season)'
  );

  v_definition := replace(
    v_definition,
    'public.g365_team_dst_opponent_personnel_strength_2026',
    'private.g365_team_dst_opponent_personnel_strength_for_season(p_season)'
  );

  v_definition := replace(
    v_definition,
    'public.g365_team_offensive_injury_impact_2026',
    'private.g365_team_offensive_injury_impact_for_season(p_season)'
  );

  if v_definition = v_original then
    raise exception
      'Expected 2026 DST dependency references were not found in refresh_season_long_matchup_rankings_v6_core.';
  end if;

  if position('public.g365_dst_offense_strength_board_2026' in v_definition) > 0
     or position('public.g365_team_dst_opponent_personnel_strength_2026' in v_definition) > 0
     or position('public.g365_team_offensive_injury_impact_2026' in v_definition) > 0
  then
    raise exception
      'One or more hardcoded 2026 DST dependency references remain in refresh_season_long_matchup_rankings_v6_core.';
  end if;

  execute v_definition;
end;
$$;


-- ============================================================
-- 6. PUBLIC VERIFICATION FUNCTION
-- ============================================================

create or replace function public.verify_g365_matchup_season_automation(
  p_season integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_build jsonb;
  v_current_count integer;
  v_prior_count integer;
  v_hardcoded_dependency_count integer;
begin
  v_build := private.ensure_g365_matchup_season_objects(p_season);

  select count(*)
  into v_current_count
  from pg_views
  where schemaname = 'public'
    and viewname in (
      format('g365_defensive_no_history_fallback_%s', p_season),
      format('g365_defensive_projected_quality_%s', p_season),
      format('g365_defensive_projection_fallback_%s', p_season),
      format('g365_defensive_projections_%s', p_season),
      format('g365_dst_offense_strength_board_%s', p_season),
      format('g365_dst_weekly_matchup_components_%s', p_season),
      format('g365_dst_weekly_opponents_%s', p_season),
      format('g365_fantasypros_defensive_projections_%s', p_season),
      format('g365_k_matchup_board_%s', p_season),
      format('g365_kicker_projections_%s', p_season),
      format('g365_offensive_no_history_fallback_%s', p_season),
      format('g365_offensive_projected_quality_%s', p_season),
      format('g365_offensive_projection_fallback_%s', p_season),
      format('g365_offensive_projections_%s', p_season),
      format('g365_team_defensive_personnel_strength_%s', p_season),
      format('g365_team_dst_opponent_actual_strength_%s', p_season),
      format('g365_team_dst_opponent_personnel_strength_%s', p_season),
      format('g365_team_offensive_injury_impact_%s', p_season),
      format('g365_team_offensive_personnel_strength_%s', p_season),
      format('g365_team_position_personnel_matchups_%s', p_season)
    );

  select count(*)
  into v_prior_count
  from pg_views
  where schemaname = 'public'
    and viewname in (
      format('g365_defensive_player_quality_%s', p_season - 1),
      format('g365_team_dst_opponent_historical_strength_%s', p_season - 1),
      format('g365_team_k_matchup_historical_%s', p_season - 1),
      format('g365_team_k_matchup_actual_%s', p_season)
    );

  select count(*)
  into v_hardcoded_dependency_count
  from pg_proc p
  join pg_namespace n
    on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'refresh_season_long_matchup_rankings_engine',
      'refresh_season_long_matchup_rankings_v5_core',
      'refresh_season_long_matchup_rankings_v6_core'
    )
    and (
      pg_get_functiondef(p.oid) like '%public.g365_k_matchup_board_2026%'
      or pg_get_functiondef(p.oid) like '%public.g365_team_position_personnel_matchups_2026%'
      or pg_get_functiondef(p.oid) like '%public.g365_dst_offense_strength_board_2026%'
      or pg_get_functiondef(p.oid) like '%public.g365_team_dst_opponent_personnel_strength_2026%'
      or pg_get_functiondef(p.oid) like '%public.g365_team_offensive_injury_impact_2026%'
    );

  return jsonb_build_object(
    'success',
      v_current_count = 20
      and v_prior_count = 4
      and v_hardcoded_dependency_count = 0,
    'season', p_season,
    'priorSeason', p_season - 1,
    'currentSeasonViews', v_current_count,
    'expectedCurrentSeasonViews', 20,
    'historicalAndActualSupportViews', v_prior_count,
    'expectedHistoricalAndActualSupportViews', 4,
    'hardcodedProductionDependencyFunctions', v_hardcoded_dependency_count,
    'build', v_build
  );
end;
$$;

grant execute on function public.verify_g365_matchup_season_automation(integer)
to authenticated;

grant execute on function public.verify_g365_matchup_season_automation(integer)
to service_role;


-- ============================================================
-- 7. REGISTER VERIFIED BASELINE
-- ============================================================

select private.ensure_g365_matchup_season_objects(2026);

commit;