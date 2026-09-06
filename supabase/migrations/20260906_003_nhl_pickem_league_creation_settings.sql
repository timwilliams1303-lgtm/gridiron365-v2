-- Gridiron365 / G365 NHL Pick'em league creation + settings + member entry initialization
-- Migration: 20260906_003_nhl_pickem_league_creation_settings.sql
-- Depends on: 20260906_002_nhl_pickem_foundation.sql
-- Purpose:
--   1) Create NHL Pick'em leagues transactionally.
--   2) Guarantee creator membership/team/franchise/entry/standings identity.
--   3) Provide commissioner-safe settings updates.
--   4) Provide reusable multi-user entry initialization for invited/authorized members.
--   5) Provide Monday-Sunday Eastern season-period generation.
--
-- IMPORTANT:
--   Existing Football Pick'em tables/functions are not modified.

begin;

-- -----------------------------------------------------------------------------
-- Complete the shared foreign-key identity links introduced in Migration 1.
-- -----------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'leagues_nhl_pickem_history_id_fkey'
      and conrelid = 'public.leagues'::regclass
  ) then
    alter table public.leagues
      add constraint leagues_nhl_pickem_history_id_fkey
      foreign key (nhl_pickem_history_id)
      references public.nhl_pickem_histories(id)
      on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'fantasy_teams_nhl_pickem_franchise_id_fkey'
      and conrelid = 'public.fantasy_teams'::regclass
  ) then
    alter table public.fantasy_teams
      add constraint fantasy_teams_nhl_pickem_franchise_id_fkey
      foreign key (nhl_pickem_franchise_id)
      references public.nhl_pickem_franchises(id)
      on delete set null;
  end if;
end
$$;

create index if not exists idx_leagues_nhl_pickem_history_id
  on public.leagues(nhl_pickem_history_id);

create index if not exists idx_fantasy_teams_nhl_pickem_franchise_id
  on public.fantasy_teams(nhl_pickem_franchise_id);

-- -----------------------------------------------------------------------------
-- Internal helpers
-- -----------------------------------------------------------------------------

create or replace function private.assert_nhl_pickem_league(
  p_league_id uuid
)
returns public.leagues
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_league public.leagues%rowtype;
begin
  select *
    into v_league
  from public.leagues
  where id = p_league_id;

  if not found then
    raise exception 'NHL Pick''em league could not be found.';
  end if;

  if v_league.league_type <> 'nhl_pickem' then
    raise exception 'League % is not a G365 NHL Pick''em league.', p_league_id;
  end if;

  return v_league;
end;
$$;

create or replace function private.assert_nhl_pickem_commissioner(
  p_league_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  perform private.assert_nhl_pickem_league(p_league_id);

  if p_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  if not exists (
    select 1
    from public.leagues l
    where l.id = p_league_id
      and l.commissioner_user_id = p_user_id
  ) then
    raise exception 'Only the NHL Pick''em commissioner can perform this action.';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Ensure one user's NHL Pick'em identities.
--
-- Security rule:
--   * Existing league members may repair/ensure their own entry.
--   * The commissioner may initialize another user, including creating membership.
--   * This function does NOT let an arbitrary user self-join a private league.
--
-- This is intentionally reusable by the future invitation-acceptance flow after
-- the invitation has been validated.
-- -----------------------------------------------------------------------------

create or replace function public.ensure_nhl_pickem_member_entry(
  p_league_id uuid,
  p_user_id uuid,
  p_entry_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_league public.leagues%rowtype;
  v_history_id uuid;
  v_is_member boolean := false;
  v_is_commissioner boolean := false;
  v_entry_name text;
  v_franchise_id uuid;
  v_team_id bigint;
  v_entry_id bigint;
begin
  if p_user_id is null then
    raise exception 'A valid user ID is required.';
  end if;

  v_league := private.assert_nhl_pickem_league(p_league_id);

  v_is_member := exists (
    select 1
    from public.league_members lm
    where lm.league_id = p_league_id
      and lm.user_id = p_user_id
  );

  v_is_commissioner := (
    v_actor is not null
    and v_actor = v_league.commissioner_user_id
  );

  if v_actor is null then
    raise exception 'Authentication is required.';
  end if;

  if v_actor <> p_user_id and not v_is_commissioner then
    raise exception 'You cannot initialize another member''s NHL Pick''em entry.';
  end if;

  if not v_is_member then
    if not v_is_commissioner then
      raise exception 'You must already be a member of this league.';
    end if;

    insert into public.league_members (
      league_id,
      user_id,
      role
    )
    values (
      p_league_id,
      p_user_id,
      'member'
    );

    v_is_member := true;
  end if;

  v_history_id := public.ensure_nhl_pickem_history_identity(p_league_id);

  v_entry_name := nullif(btrim(coalesce(p_entry_name, '')), '');

  -- Prefer an existing NHL Pick'em team owned by this user.
  select
    ft.id,
    ft.nhl_pickem_franchise_id
  into
    v_team_id,
    v_franchise_id
  from public.fantasy_teams ft
  where ft.league_id = p_league_id
    and ft.owner_id = p_user_id
    and ft.active = true
  order by
    (ft.nhl_pickem_franchise_id is not null) desc,
    ft.id
  limit 1;

  if v_team_id is not null then
    if v_entry_name is null then
      select ft.team_name
        into v_entry_name
      from public.fantasy_teams ft
      where ft.id = v_team_id;
    end if;
  end if;

  if v_entry_name is null then
    v_entry_name := 'My NHL Pick''em Entry';
  end if;

  if v_franchise_id is null then
    insert into public.nhl_pickem_franchises (
      history_id,
      owner_id,
      display_name,
      active
    )
    values (
      v_history_id,
      p_user_id,
      v_entry_name,
      true
    )
    returning id into v_franchise_id;
  else
    update public.nhl_pickem_franchises
    set owner_id = p_user_id,
        display_name = v_entry_name,
        active = true,
        updated_at = now()
    where id = v_franchise_id;
  end if;

  if v_team_id is null then
    insert into public.fantasy_teams (
      league_id,
      owner_id,
      team_name,
      active,
      is_cpu,
      nhl_pickem_franchise_id
    )
    values (
      p_league_id,
      p_user_id,
      v_entry_name,
      true,
      false,
      v_franchise_id
    )
    returning id into v_team_id;
  else
    update public.fantasy_teams
    set nhl_pickem_franchise_id = v_franchise_id,
        team_name = case
          when p_entry_name is not null
               and nullif(btrim(p_entry_name), '') is not null
            then v_entry_name
          else team_name
        end,
        updated_at = now()
    where id = v_team_id;
  end if;

  select e.id
    into v_entry_id
  from public.nhl_pickem_entries e
  where e.league_id = p_league_id
    and e.season = v_league.season
    and e.fantasy_team_id = v_team_id
  limit 1;

  if v_entry_id is null then
    insert into public.nhl_pickem_entries (
      league_id,
      fantasy_team_id,
      user_id,
      franchise_id,
      season,
      entry_name,
      active
    )
    values (
      p_league_id,
      v_team_id,
      p_user_id,
      v_franchise_id,
      v_league.season,
      v_entry_name,
      true
    )
    returning id into v_entry_id;
  else
    update public.nhl_pickem_entries
    set user_id = p_user_id,
        franchise_id = v_franchise_id,
        entry_name = v_entry_name,
        active = true,
        updated_at = now()
    where id = v_entry_id;
  end if;

  insert into public.nhl_pickem_standings (
    league_id,
    season,
    entry_id,
    fantasy_team_id
  )
  select
    p_league_id,
    v_league.season,
    v_entry_id,
    v_team_id
  where not exists (
    select 1
    from public.nhl_pickem_standings s
    where s.league_id = p_league_id
      and s.season = v_league.season
      and s.entry_id = v_entry_id
  );

  return jsonb_build_object(
    'success', true,
    'leagueId', p_league_id,
    'season', v_league.season,
    'userId', p_user_id,
    'fantasyTeamId', v_team_id,
    'franchiseId', v_franchise_id,
    'entryId', v_entry_id,
    'entryName', v_entry_name
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Transactional league creation.
--
-- Creator guarantees:
--   league
--   NHL Pick'em history
--   commissioner league_members row
--   default NHL Pick'em settings
--   franchise
--   fantasy team owned by authenticated creator
--   NHL Pick'em entry
--   standings row
-- -----------------------------------------------------------------------------

create or replace function public.create_nhl_pickem_league_transaction(
  p_name text,
  p_season integer,
  p_entry_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_league_id uuid;
  v_history_id uuid;
  v_franchise_id uuid;
  v_team_id bigint;
  v_entry_id bigint;
  v_name text;
  v_entry_name text;
begin
  if v_user_id is null then
    raise exception 'Authentication is required to create an NHL Pick''em league.';
  end if;

  v_name := nullif(btrim(coalesce(p_name, '')), '');
  v_entry_name := nullif(btrim(coalesce(p_entry_name, '')), '');

  if v_name is null then
    raise exception 'League name is required.';
  end if;

  if p_season is null or p_season < 2020 or p_season > 2100 then
    raise exception 'A valid NHL season is required.';
  end if;

  if v_entry_name is null then
    raise exception 'Entry name is required.';
  end if;

  insert into public.leagues (
    name,
    league_type,
    season,
    commissioner_user_id,
    status,
    player_selection_mode
  )
  values (
    v_name,
    'nhl_pickem',
    p_season,
    v_user_id,
    'setup',
    'standard'
  )
  returning id into v_league_id;

  v_history_id := public.ensure_nhl_pickem_history_identity(v_league_id);

  insert into public.league_members (
    league_id,
    user_id,
    role
  )
  values (
    v_league_id,
    v_user_id,
    'commissioner'
  );

  insert into public.nhl_pickem_settings (
    league_id
  )
  values (
    v_league_id
  );

  insert into public.nhl_pickem_franchises (
    history_id,
    owner_id,
    display_name,
    active
  )
  values (
    v_history_id,
    v_user_id,
    v_entry_name,
    true
  )
  returning id into v_franchise_id;

  insert into public.fantasy_teams (
    league_id,
    owner_id,
    team_name,
    active,
    is_cpu,
    nhl_pickem_franchise_id
  )
  values (
    v_league_id,
    v_user_id,
    v_entry_name,
    true,
    false,
    v_franchise_id
  )
  returning id into v_team_id;

  insert into public.nhl_pickem_entries (
    league_id,
    fantasy_team_id,
    user_id,
    franchise_id,
    season,
    entry_name,
    active
  )
  values (
    v_league_id,
    v_team_id,
    v_user_id,
    v_franchise_id,
    p_season,
    v_entry_name,
    true
  )
  returning id into v_entry_id;

  insert into public.nhl_pickem_standings (
    league_id,
    season,
    entry_id,
    fantasy_team_id
  )
  values (
    v_league_id,
    p_season,
    v_entry_id,
    v_team_id
  );

  return jsonb_build_object(
    'success', true,
    'leagueId', v_league_id,
    'leagueType', 'nhl_pickem',
    'season', p_season,
    'historyId', v_history_id,
    'fantasyTeamId', v_team_id,
    'franchiseId', v_franchise_id,
    'entryId', v_entry_id,
    'entryName', v_entry_name
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Commissioner settings.
--
-- The contest timezone and daily official line-freeze time are intentionally
-- NOT exposed here:
--   America/New_York
--   11:00 AM Eastern
-- Those are G365 NHL Pick'em platform rules, not commissioner options.
-- -----------------------------------------------------------------------------

create or replace function public.save_nhl_pickem_settings(
  p_league_id uuid,
  p_picks_per_period integer,
  p_market_mode text,
  p_allow_same_game_multiple_markets boolean,
  p_minimum_source_books integer,
  p_scoring_mode text,
  p_win_points numeric,
  p_push_points numeric,
  p_loss_points numeric,
  p_confidence_points numeric[],
  p_confidence_push_multiplier numeric,
  p_missing_pick_policy text
)
returns public.nhl_pickem_settings
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_result public.nhl_pickem_settings%rowtype;
begin
  perform private.assert_nhl_pickem_commissioner(
    p_league_id,
    v_user_id
  );

  if p_picks_per_period is null or p_picks_per_period < 1 or p_picks_per_period > 50 then
    raise exception 'Required picks per period must be between 1 and 50.';
  end if;

  if p_market_mode not in (
    'puck_line_only',
    'total_only',
    'puck_line_and_total'
  ) then
    raise exception 'Invalid NHL Pick''em market mode.';
  end if;

  if p_minimum_source_books is null
     or p_minimum_source_books < 1
     or p_minimum_source_books > 50
  then
    raise exception 'Minimum source books must be between 1 and 50.';
  end if;

  if p_scoring_mode not in (
    'record_only',
    'standard',
    'confidence'
  ) then
    raise exception 'Invalid NHL Pick''em scoring mode.';
  end if;

  if p_missing_pick_policy not in (
    'loss',
    'ungraded'
  ) then
    raise exception 'Invalid missing-pick policy.';
  end if;

  if p_confidence_push_multiplier is null
     or p_confidence_push_multiplier < 0
  then
    raise exception 'Confidence push multiplier cannot be negative.';
  end if;

  if p_scoring_mode = 'confidence' then
    if p_confidence_points is null
       or cardinality(p_confidence_points) <> p_picks_per_period
    then
      raise exception
        'Confidence mode requires exactly % confidence values.',
        p_picks_per_period;
    end if;

    if exists (
      select 1
      from unnest(p_confidence_points) as x(value)
      where x.value is null or x.value < 0
    ) then
      raise exception 'Confidence values must be non-negative numbers.';
    end if;
  end if;

  insert into public.nhl_pickem_settings (
    league_id,
    picks_per_period,
    market_mode,
    allow_same_game_multiple_markets,
    pick_lock_mode,
    minimum_source_books,
    scoring_mode,
    win_points,
    push_points,
    loss_points,
    confidence_points,
    confidence_push_multiplier,
    missing_pick_policy,
    contest_timezone,
    line_freeze_local_time
  )
  values (
    p_league_id,
    p_picks_per_period,
    p_market_mode,
    coalesce(p_allow_same_game_multiple_markets, false),
    'game',
    p_minimum_source_books,
    p_scoring_mode,
    coalesce(p_win_points, 1),
    coalesce(p_push_points, 0.5),
    coalesce(p_loss_points, 0),
    coalesce(
      p_confidence_points,
      array[50,40,30,20,10]::numeric[]
    ),
    p_confidence_push_multiplier,
    p_missing_pick_policy,
    'America/New_York',
    time '11:00:00'
  )
  on conflict (league_id)
  do update
  set picks_per_period = excluded.picks_per_period,
      market_mode = excluded.market_mode,
      allow_same_game_multiple_markets = excluded.allow_same_game_multiple_markets,
      pick_lock_mode = 'game',
      minimum_source_books = excluded.minimum_source_books,
      scoring_mode = excluded.scoring_mode,
      win_points = excluded.win_points,
      push_points = excluded.push_points,
      loss_points = excluded.loss_points,
      confidence_points = excluded.confidence_points,
      confidence_push_multiplier = excluded.confidence_push_multiplier,
      missing_pick_policy = excluded.missing_pick_policy,
      contest_timezone = 'America/New_York',
      line_freeze_local_time = time '11:00:00',
      updated_at = now()
  returning *
  into v_result;

  return v_result;
end;
$$;

-- -----------------------------------------------------------------------------
-- Monday-Sunday Eastern contest-period generation.
--
-- p_anchor_date may be any date in the first desired contest week.
-- The function normalizes it to that week's Monday in America/New_York.
-- Each period is [Monday 00:00 ET, next Monday 00:00 ET).
-- -----------------------------------------------------------------------------

create or replace function public.ensure_nhl_pickem_season_periods(
  p_league_id uuid,
  p_season integer,
  p_anchor_date date,
  p_period_count integer
)
returns integer
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_league public.leagues%rowtype;
  v_first_monday date;
  v_i integer;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_created integer := 0;
begin
  perform private.assert_nhl_pickem_commissioner(
    p_league_id,
    v_user_id
  );

  v_league := private.assert_nhl_pickem_league(p_league_id);

  if p_season <> v_league.season then
    raise exception
      'Requested season % does not match league season %.',
      p_season,
      v_league.season;
  end if;

  if p_anchor_date is null then
    raise exception 'An NHL season anchor date is required.';
  end if;

  if p_period_count is null or p_period_count < 1 or p_period_count > 60 then
    raise exception 'Period count must be between 1 and 60.';
  end if;

  -- ISO DOW: Monday=1 ... Sunday=7.
  v_first_monday :=
    p_anchor_date - (extract(isodow from p_anchor_date)::integer - 1);

  for v_i in 1..p_period_count loop
    v_starts_at :=
      (
        (v_first_monday + ((v_i - 1) * 7))::timestamp
        at time zone 'America/New_York'
      );

    v_ends_at :=
      (
        (v_first_monday + (v_i * 7))::timestamp
        at time zone 'America/New_York'
      );

    insert into public.nhl_pickem_periods (
      league_id,
      season,
      period_number,
      starts_at,
      ends_at,
      status
    )
    values (
      p_league_id,
      p_season,
      v_i,
      v_starts_at,
      v_ends_at,
      case
        when now() < v_starts_at then 'upcoming'
        when now() >= v_ends_at then 'locked'
        else 'open'
      end
    )
    on conflict (league_id, season, period_number)
    do update
    set starts_at = excluded.starts_at,
        ends_at = excluded.ends_at,
        status = case
          when public.nhl_pickem_periods.status = 'final'
            then 'final'
          when now() < excluded.starts_at
            then 'upcoming'
          when now() >= excluded.ends_at
            then 'locked'
          else 'open'
        end,
        updated_at = now();

    if found then
      v_created := v_created + 1;
    end if;
  end loop;

  return v_created;
end;
$$;

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------

revoke all on function private.assert_nhl_pickem_league(uuid) from public;
revoke all on function private.assert_nhl_pickem_commissioner(uuid, uuid) from public;

grant execute on function public.ensure_nhl_pickem_member_entry(uuid, uuid, text)
  to authenticated;

grant execute on function public.create_nhl_pickem_league_transaction(text, integer, text)
  to authenticated;

grant execute on function public.save_nhl_pickem_settings(
  uuid,
  integer,
  text,
  boolean,
  integer,
  text,
  numeric,
  numeric,
  numeric,
  numeric[],
  numeric,
  text
) to authenticated;

grant execute on function public.ensure_nhl_pickem_season_periods(
  uuid,
  integer,
  date,
  integer
) to authenticated;

commit;

-- -----------------------------------------------------------------------------
-- Verification
-- -----------------------------------------------------------------------------

select
  'nhl_pickem_creation_functions' as check_name,
  (
    to_regprocedure(
      'public.create_nhl_pickem_league_transaction(text,integer,text)'
    ) is not null
    and to_regprocedure(
      'public.ensure_nhl_pickem_member_entry(uuid,uuid,text)'
    ) is not null
  ) as pass;

select
  'nhl_pickem_settings_function' as check_name,
  to_regprocedure(
    'public.save_nhl_pickem_settings(uuid,integer,text,boolean,integer,text,numeric,numeric,numeric,numeric[],numeric,text)'
  ) is not null as pass;

select
  'nhl_pickem_period_function' as check_name,
  to_regprocedure(
    'public.ensure_nhl_pickem_season_periods(uuid,integer,date,integer)'
  ) is not null as pass;

select
  'nhl_pickem_identity_fks' as check_name,
  (
    exists (
      select 1
      from pg_constraint
      where conname = 'leagues_nhl_pickem_history_id_fkey'
        and conrelid = 'public.leagues'::regclass
    )
    and exists (
      select 1
      from pg_constraint
      where conname = 'fantasy_teams_nhl_pickem_franchise_id_fkey'
        and conrelid = 'public.fantasy_teams'::regclass
    )
  ) as pass;

select
  'nhl_pickem_platform_rules' as check_name,
  (
    exists (
      select 1
      from public.nhl_pickem_settings s
      where s.contest_timezone <> 'America/New_York'
         or s.line_freeze_local_time <> time '11:00:00'
    ) = false
  ) as pass;