-- Gridiron365 / G365 NHL Pick'em daily game + official line freeze pipeline
-- Migration: 20260906_004_nhl_pickem_daily_games_and_line_freeze.sql
-- Depends on:
--   20260906_002_nhl_pickem_foundation.sql
--   20260906_003_nhl_pickem_league_creation_settings.sql
--
-- Platform rules implemented here:
--   * Contest periods are Monday-Sunday Eastern.
--   * Every NHL game's G365 betting snapshot is scheduled for 11:00 AM Eastern
--     on that game's local Eastern calendar date.
--   * No pre-11:00 AM collection is accepted by the protected source-ingest RPC.
--   * One official source snapshot is collected for the game/day.
--   * Consensus moneyline determines the proprietary G365 Puck Line.
--   * Consensus total is the median sportsbook total, normalized to 0.5 goals.
--   * Required source coverage follows the league's minimum_source_books setting.
--   * Once finalized, a game is either FROZEN or EXCLUDED. It is not repriced.
--   * Frozen official G365 lines and their audit source rows are immutable.
--   * Existing Football Pick'em tables/functions are not modified.

begin;

-- -----------------------------------------------------------------------------
-- Freeze/finalization state.
--
-- Migration 1 used a general frozen-row check that required BOTH puck line and
-- total. NHL Pick'em supports puck-line-only and total-only leagues, so this
-- migration snapshots the market mode at finalization and makes the constraint
-- correctly market-aware.
-- -----------------------------------------------------------------------------

alter table public.nhl_pickem_games
  add column if not exists market_mode_at_freeze text;

alter table public.nhl_pickem_games
  add column if not exists line_status text not null default 'pending';

alter table public.nhl_pickem_games
  add column if not exists line_finalized_at timestamptz;

do $$
declare
  r record;
begin
  -- Remove the unnamed Migration-1 frozen-line check, regardless of the
  -- auto-generated constraint name.
  for r in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.nhl_pickem_games'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%is_frozen%'
      and pg_get_constraintdef(c.oid) ilike '%official_home_puck_line%'
      and pg_get_constraintdef(c.oid) ilike '%official_total%'
  loop
    execute format(
      'alter table public.nhl_pickem_games drop constraint %I',
      r.conname
    );
  end loop;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'nhl_pickem_games_market_mode_at_freeze_check'
      and conrelid = 'public.nhl_pickem_games'::regclass
  ) then
    alter table public.nhl_pickem_games
      add constraint nhl_pickem_games_market_mode_at_freeze_check
      check (
        market_mode_at_freeze is null
        or market_mode_at_freeze in (
          'puck_line_only',
          'total_only',
          'puck_line_and_total'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'nhl_pickem_games_line_status_check'
      and conrelid = 'public.nhl_pickem_games'::regclass
  ) then
    alter table public.nhl_pickem_games
      add constraint nhl_pickem_games_line_status_check
      check (line_status in ('pending','frozen','excluded'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'nhl_pickem_games_frozen_market_presence_check'
      and conrelid = 'public.nhl_pickem_games'::regclass
  ) then
    alter table public.nhl_pickem_games
      add constraint nhl_pickem_games_frozen_market_presence_check
      check (
        is_frozen = false
        or (
          frozen_at is not null
          and line_status = 'frozen'
          and line_finalized_at is not null
          and market_mode_at_freeze is not null
          and (
            (
              market_mode_at_freeze = 'puck_line_only'
              and official_home_puck_line is not null
              and official_away_puck_line is not null
            )
            or
            (
              market_mode_at_freeze = 'total_only'
              and official_total is not null
            )
            or
            (
              market_mode_at_freeze = 'puck_line_and_total'
              and official_home_puck_line is not null
              and official_away_puck_line is not null
              and official_total is not null
            )
          )
        )
      );
  end if;
end
$$;

create index if not exists idx_nhl_pickem_games_line_status_due
  on public.nhl_pickem_games(line_status, freeze_scheduled_at)
  where line_status = 'pending';

-- -----------------------------------------------------------------------------
-- Harden frozen game immutability.
--
-- Final scores and graded_at intentionally remain mutable after line freeze so
-- the future grading lifecycle can store authoritative completed results.
-- -----------------------------------------------------------------------------

create or replace function private.enforce_nhl_pickem_frozen_game_immutability()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if old.line_status in ('frozen','excluded') then
    if new.line_status is distinct from old.line_status
       or new.line_finalized_at is distinct from old.line_finalized_at
       or new.eligible is distinct from old.eligible
       or new.excluded_reason is distinct from old.excluded_reason
       or new.freeze_scheduled_at is distinct from old.freeze_scheduled_at
       or new.market_mode_at_freeze is distinct from old.market_mode_at_freeze
       or new.is_frozen is distinct from old.is_frozen
       or new.frozen_at is distinct from old.frozen_at
       or new.consensus_favorite_team_id is distinct from old.consensus_favorite_team_id
       or new.consensus_favorite_moneyline is distinct from old.consensus_favorite_moneyline
       or new.consensus_underdog_team_id is distinct from old.consensus_underdog_team_id
       or new.official_home_puck_line is distinct from old.official_home_puck_line
       or new.official_away_puck_line is distinct from old.official_away_puck_line
       or new.official_total is distinct from old.official_total
       or new.puck_line_source_count is distinct from old.puck_line_source_count
       or new.total_source_count is distinct from old.total_source_count
    then
      raise exception
        'Finalized G365 NHL Pick''em line decisions are immutable.';
    end if;
  elsif old.is_frozen then
    -- Compatibility guard for any row frozen by the prior migration.
    if new.is_frozen is distinct from old.is_frozen
       or new.frozen_at is distinct from old.frozen_at
       or new.consensus_favorite_team_id is distinct from old.consensus_favorite_team_id
       or new.consensus_favorite_moneyline is distinct from old.consensus_favorite_moneyline
       or new.consensus_underdog_team_id is distinct from old.consensus_underdog_team_id
       or new.official_home_puck_line is distinct from old.official_home_puck_line
       or new.official_away_puck_line is distinct from old.official_away_puck_line
       or new.official_total is distinct from old.official_total
       or new.puck_line_source_count is distinct from old.puck_line_source_count
       or new.total_source_count is distinct from old.total_source_count
    then
      raise exception 'Frozen G365 NHL Pick''em lines are immutable.';
    end if;
  end if;

  return new;
end;
$$;

-- Existing trigger already points to this function, but recreate idempotently.
drop trigger if exists trg_nhl_pickem_games_frozen_immutability
  on public.nhl_pickem_games;

create trigger trg_nhl_pickem_games_frozen_immutability
before update on public.nhl_pickem_games
for each row
execute function private.enforce_nhl_pickem_frozen_game_immutability();

-- -----------------------------------------------------------------------------
-- Audit source immutability.
--
-- Source records may only be written while their contest game is pending.
-- Once the game is frozen OR excluded, sportsbook evidence is permanent.
-- -----------------------------------------------------------------------------

create or replace function private.enforce_nhl_pickem_line_source_immutability()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_game_id bigint;
  v_status text;
begin
  v_game_id := coalesce(new.nhl_pickem_game_id, old.nhl_pickem_game_id);

  select g.line_status
    into v_status
  from public.nhl_pickem_games g
  where g.id = v_game_id;

  if v_status is null then
    raise exception 'NHL Pick''em game could not be found.';
  end if;

  if v_status <> 'pending' then
    raise exception
      'G365 NHL Pick''em source audit rows are immutable after line finalization.';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_nhl_pickem_line_sources_immutability
  on public.nhl_pickem_line_sources;

create trigger trg_nhl_pickem_line_sources_immutability
before insert or update or delete on public.nhl_pickem_line_sources
for each row
execute function private.enforce_nhl_pickem_line_source_immutability();

-- -----------------------------------------------------------------------------
-- Prepare all NHL games belonging to one contest period.
--
-- freeze_scheduled_at is always 11:00 AM America/New_York on the game's
-- Eastern calendar date.
--
-- Games whose puck drop is at/before 11:00 AM Eastern cannot satisfy the
-- platform's fixed same-day 11:00 AM snapshot rule, so they are permanently
-- excluded from that league/period.
-- -----------------------------------------------------------------------------

create or replace function public.prepare_nhl_pickem_period_games(
  p_nhl_pickem_period_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_period public.nhl_pickem_periods%rowtype;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_excluded integer := 0;
begin
  select *
    into v_period
  from public.nhl_pickem_periods
  where id = p_nhl_pickem_period_id;

  if not found then
    raise exception 'NHL Pick''em period could not be found.';
  end if;

  -- Confirm league type before writing anything.
  perform private.assert_nhl_pickem_league(v_period.league_id);

  with source_games as (
    select
      ng.id as nhl_game_id,
      ng.season,
      ng.kickoff_at,
      (
        (
          (ng.kickoff_at at time zone 'America/New_York')::date
          + time '11:00:00'
        ) at time zone 'America/New_York'
      ) as freeze_at
    from public.nhl_games ng
    where ng.season = v_period.season
      and ng.kickoff_at >= v_period.starts_at
      and ng.kickoff_at < v_period.ends_at
      and coalesce(ng.season_type, 'regular') = 'regular'
  ),
  upserted as (
    insert into public.nhl_pickem_games (
      nhl_pickem_period_id,
      nhl_game_id,
      league_id,
      season,
      eligible,
      excluded_reason,
      freeze_scheduled_at,
      line_status,
      line_finalized_at
    )
    select
      v_period.id,
      sg.nhl_game_id,
      v_period.league_id,
      sg.season,
      (sg.kickoff_at > sg.freeze_at),
      case
        when sg.kickoff_at <= sg.freeze_at
          then 'kickoff_at_or_before_11am_eastern_freeze'
        else null
      end,
      sg.freeze_at,
      case
        when sg.kickoff_at <= sg.freeze_at then 'excluded'
        else 'pending'
      end,
      case
        when sg.kickoff_at <= sg.freeze_at then now()
        else null
      end
    from source_games sg
    on conflict (league_id, nhl_pickem_period_id, nhl_game_id)
    do update
    set freeze_scheduled_at = excluded.freeze_scheduled_at,
        eligible = excluded.eligible,
        excluded_reason = excluded.excluded_reason,
        line_status = excluded.line_status,
        line_finalized_at = excluded.line_finalized_at,
        updated_at = now()
    where public.nhl_pickem_games.line_status = 'pending'
      and public.nhl_pickem_games.is_frozen = false
    returning
      (xmax = 0) as was_inserted,
      line_status
  )
  select
    count(*) filter (where was_inserted),
    count(*) filter (where not was_inserted),
    count(*) filter (where line_status = 'excluded')
  into
    v_inserted,
    v_updated,
    v_excluded
  from upserted;

  return jsonb_build_object(
    'success', true,
    'periodId', v_period.id,
    'leagueId', v_period.league_id,
    'season', v_period.season,
    'inserted', coalesce(v_inserted, 0),
    'updated', coalesce(v_updated, 0),
    'excluded', coalesce(v_excluded, 0)
  );
end;
$$;

-- Prepare every non-final NHL Pick'em period that overlaps the requested
-- look-ahead horizon. Intended for the daily schedule-discovery backend.
create or replace function public.prepare_active_nhl_pickem_games(
  p_lookahead_days integer default 8
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  r record;
  v_result jsonb;
  v_periods integer := 0;
  v_games_touched integer := 0;
begin
  if p_lookahead_days is null
     or p_lookahead_days < 1
     or p_lookahead_days > 31
  then
    raise exception 'NHL Pick''em look-ahead days must be between 1 and 31.';
  end if;

  for r in
    select p.id
    from public.nhl_pickem_periods p
    join public.leagues l
      on l.id = p.league_id
    where l.league_type = 'nhl_pickem'
      and p.status <> 'final'
      and p.ends_at > now()
      and p.starts_at < now() + make_interval(days => p_lookahead_days)
    order by p.starts_at, p.id
  loop
    v_result := public.prepare_nhl_pickem_period_games(r.id);
    v_periods := v_periods + 1;
    v_games_touched :=
      v_games_touched
      + coalesce((v_result ->> 'inserted')::integer, 0)
      + coalesce((v_result ->> 'updated')::integer, 0);
  end loop;

  return jsonb_build_object(
    'success', true,
    'periodsPrepared', v_periods,
    'gamesTouched', v_games_touched,
    'lookaheadDays', p_lookahead_days
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Protected 11:00 AM source ingest.
--
-- The route/service should parse a provider's same-day NHL response into one
-- consolidated row per sportsbook/game containing moneyline and/or total.
-- Sportsbook native spread values may also be stored for audit, but the
-- proprietary official G365 Puck Line is derived from MONEYLINE consensus.
-- -----------------------------------------------------------------------------

create or replace function public.add_nhl_pickem_line_source(
  p_nhl_pickem_game_id bigint,
  p_source_provider text,
  p_sportsbook_key text,
  p_sportsbook_name text,
  p_source_event_id text,
  p_source_market_key text,
  p_home_moneyline numeric,
  p_away_moneyline numeric,
  p_home_puck_line numeric,
  p_away_puck_line numeric,
  p_total numeric,
  p_raw_audit jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_game public.nhl_pickem_games%rowtype;
  v_nhl_game public.nhl_games%rowtype;
  v_id bigint;
  v_book_identity text;
begin
  select *
    into v_game
  from public.nhl_pickem_games
  where id = p_nhl_pickem_game_id
  for update;

  if not found then
    raise exception 'NHL Pick''em game could not be found.';
  end if;

  if v_game.line_status <> 'pending' or v_game.is_frozen then
    raise exception 'This NHL Pick''em game has already finalized its G365 lines.';
  end if;

  if v_game.freeze_scheduled_at is null then
    raise exception 'This NHL Pick''em game does not have an 11:00 AM freeze schedule.';
  end if;

  if now() < v_game.freeze_scheduled_at then
    raise exception
      'G365 NHL Pick''em odds cannot be collected before 11:00 AM Eastern.';
  end if;

  select *
    into v_nhl_game
  from public.nhl_games
  where id = v_game.nhl_game_id;

  if not found then
    raise exception 'Authoritative NHL game could not be found.';
  end if;

  if now() >= v_nhl_game.kickoff_at then
    raise exception 'G365 NHL Pick''em odds cannot be collected after puck drop.';
  end if;

  if nullif(btrim(coalesce(p_source_provider, '')), '') is null then
    raise exception 'Source provider is required.';
  end if;

  if p_home_moneyline is null
     and p_away_moneyline is null
     and p_total is null
     and p_home_puck_line is null
     and p_away_puck_line is null
  then
    raise exception 'At least one sportsbook market value is required.';
  end if;

  v_book_identity := lower(
    coalesce(
      nullif(btrim(p_sportsbook_key), ''),
      nullif(btrim(p_sportsbook_name), ''),
      nullif(btrim(p_source_provider), '')
    )
  );

  -- Daily rule is one consolidated snapshot per sportsbook/game. Make retries
  -- idempotent by updating that pending source row rather than duplicating it.
  select s.id
    into v_id
  from public.nhl_pickem_line_sources s
  where s.nhl_pickem_game_id = p_nhl_pickem_game_id
    and lower(
      coalesce(
        nullif(btrim(s.sportsbook_key), ''),
        nullif(btrim(s.sportsbook_name), ''),
        nullif(btrim(s.source_provider), '')
      )
    ) = v_book_identity
  order by s.id
  limit 1;

  if v_id is null then
    insert into public.nhl_pickem_line_sources (
      nhl_pickem_game_id,
      source_provider,
      sportsbook_key,
      sportsbook_name,
      source_event_id,
      source_market_key,
      home_moneyline,
      away_moneyline,
      home_puck_line,
      away_puck_line,
      total,
      collected_at,
      raw_audit
    )
    values (
      p_nhl_pickem_game_id,
      btrim(p_source_provider),
      nullif(btrim(p_sportsbook_key), ''),
      nullif(btrim(p_sportsbook_name), ''),
      nullif(btrim(p_source_event_id), ''),
      nullif(btrim(p_source_market_key), ''),
      p_home_moneyline,
      p_away_moneyline,
      p_home_puck_line,
      p_away_puck_line,
      p_total,
      now(),
      coalesce(p_raw_audit, '{}'::jsonb)
    )
    returning id into v_id;
  else
    update public.nhl_pickem_line_sources
    set source_provider = btrim(p_source_provider),
        sportsbook_key = coalesce(
          nullif(btrim(p_sportsbook_key), ''),
          sportsbook_key
        ),
        sportsbook_name = coalesce(
          nullif(btrim(p_sportsbook_name), ''),
          sportsbook_name
        ),
        source_event_id = coalesce(
          nullif(btrim(p_source_event_id), ''),
          source_event_id
        ),
        source_market_key = coalesce(
          nullif(btrim(p_source_market_key), ''),
          source_market_key
        ),
        home_moneyline = coalesce(p_home_moneyline, home_moneyline),
        away_moneyline = coalesce(p_away_moneyline, away_moneyline),
        home_puck_line = coalesce(p_home_puck_line, home_puck_line),
        away_puck_line = coalesce(p_away_puck_line, away_puck_line),
        total = coalesce(p_total, total),
        collected_at = now(),
        raw_audit = coalesce(raw_audit, '{}'::jsonb)
                    || coalesce(p_raw_audit, '{}'::jsonb)
    where id = v_id;
  end if;

  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Finalize one game's official G365 markets.
--
-- Consensus:
--   * home/away moneyline: median across qualifying books.
--   * favorite: side with lower median American moneyline.
--   * G365 favorite puck line:
--       -100..-149 => -0.5
--       -150..-199 => -1.0
--       -200..-249 => -1.5
--       -250..-299 => -2.0
--       <= -300     => -2.5
--   * underdog receives the exact opposite line.
--   * total: median sportsbook total rounded to nearest 0.5.
--
-- If a REQUIRED market lacks minimum trustworthy books, the game is permanently
-- excluded for that league/day rather than repriced later.
-- -----------------------------------------------------------------------------

create or replace function public.finalize_nhl_pickem_game_lines(
  p_nhl_pickem_game_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_game public.nhl_pickem_games%rowtype;
  v_settings public.nhl_pickem_settings%rowtype;
  v_nhl_game public.nhl_games%rowtype;

  v_home_ml numeric;
  v_away_ml numeric;
  v_total numeric;

  v_puck_books integer := 0;
  v_total_books integer := 0;

  v_favorite_team_id bigint;
  v_underdog_team_id bigint;
  v_favorite_ml numeric;
  v_favorite_line numeric;
  v_home_line numeric;
  v_away_line numeric;

  v_reason text;
  v_needs_puck boolean;
  v_needs_total boolean;
begin
  select *
    into v_game
  from public.nhl_pickem_games
  where id = p_nhl_pickem_game_id
  for update;

  if not found then
    raise exception 'NHL Pick''em game could not be found.';
  end if;

  if v_game.line_status = 'frozen' then
    return jsonb_build_object(
      'success', true,
      'gameId', v_game.id,
      'status', 'frozen',
      'alreadyFinalized', true
    );
  elsif v_game.line_status = 'excluded' then
    return jsonb_build_object(
      'success', true,
      'gameId', v_game.id,
      'status', 'excluded',
      'reason', v_game.excluded_reason,
      'alreadyFinalized', true
    );
  end if;

  select *
    into v_settings
  from public.nhl_pickem_settings
  where league_id = v_game.league_id;

  if not found then
    raise exception 'NHL Pick''em settings could not be found.';
  end if;

  select *
    into v_nhl_game
  from public.nhl_games
  where id = v_game.nhl_game_id;

  if not found then
    raise exception 'Authoritative NHL game could not be found.';
  end if;

  if v_game.freeze_scheduled_at is null then
    raise exception 'NHL Pick''em game is missing its 11:00 AM freeze schedule.';
  end if;

  if now() < v_game.freeze_scheduled_at then
    raise exception 'This G365 NHL Pick''em line is not due to freeze yet.';
  end if;

  if now() >= v_nhl_game.kickoff_at then
    update public.nhl_pickem_games
    set eligible = false,
        excluded_reason = 'line_not_finalized_before_puck_drop',
        market_mode_at_freeze = v_settings.market_mode,
        line_status = 'excluded',
        line_finalized_at = now(),
        is_frozen = false,
        frozen_at = null,
        updated_at = now()
    where id = v_game.id;

    return jsonb_build_object(
      'success', true,
      'gameId', v_game.id,
      'status', 'excluded',
      'reason', 'line_not_finalized_before_puck_drop'
    );
  end if;

  v_needs_puck :=
    v_settings.market_mode in ('puck_line_only','puck_line_and_total');

  v_needs_total :=
    v_settings.market_mode in ('total_only','puck_line_and_total');

  -- One consolidated pending row per book is expected. The DISTINCT book
  -- identity also guards against accidental duplicate provider rows.
  with source_rows as (
    select distinct on (
      lower(
        coalesce(
          nullif(btrim(s.sportsbook_key), ''),
          nullif(btrim(s.sportsbook_name), ''),
          nullif(btrim(s.source_provider), '')
        )
      )
    )
      s.*
    from public.nhl_pickem_line_sources s
    where s.nhl_pickem_game_id = v_game.id
    order by
      lower(
        coalesce(
          nullif(btrim(s.sportsbook_key), ''),
          nullif(btrim(s.sportsbook_name), ''),
          nullif(btrim(s.source_provider), '')
        )
      ),
      s.collected_at desc,
      s.id desc
  ),
  ml as (
    select
      percentile_cont(0.5) within group (order by home_moneyline)
        filter (where home_moneyline is not null and away_moneyline is not null)
        as home_ml,
      percentile_cont(0.5) within group (order by away_moneyline)
        filter (where home_moneyline is not null and away_moneyline is not null)
        as away_ml,
      count(*)
        filter (where home_moneyline is not null and away_moneyline is not null)
        as puck_books,
      percentile_cont(0.5) within group (order by total)
        filter (where total is not null)
        as total_median,
      count(*)
        filter (where total is not null)
        as total_books
    from source_rows
  )
  select
    ml.home_ml,
    ml.away_ml,
    ml.puck_books,
    ml.total_median,
    ml.total_books
  into
    v_home_ml,
    v_away_ml,
    v_puck_books,
    v_total,
    v_total_books
  from ml;

  v_puck_books := coalesce(v_puck_books, 0);
  v_total_books := coalesce(v_total_books, 0);

  if v_needs_puck and v_puck_books < v_settings.minimum_source_books then
    v_reason := format(
      'insufficient_moneyline_sources_%s_of_%s',
      v_puck_books,
      v_settings.minimum_source_books
    );
  elsif v_needs_total and v_total_books < v_settings.minimum_source_books then
    v_reason := format(
      'insufficient_total_sources_%s_of_%s',
      v_total_books,
      v_settings.minimum_source_books
    );
  elsif v_needs_puck and (v_home_ml is null or v_away_ml is null) then
    v_reason := 'missing_consensus_moneyline';
  elsif v_needs_puck and v_home_ml = v_away_ml then
    v_reason := 'consensus_moneyline_tied';
  else
    v_reason := null;
  end if;

  if v_reason is null and v_needs_puck then
    if v_home_ml < v_away_ml then
      v_favorite_team_id := v_nhl_game.home_team_id;
      v_underdog_team_id := v_nhl_game.away_team_id;
      v_favorite_ml := v_home_ml;
    else
      v_favorite_team_id := v_nhl_game.away_team_id;
      v_underdog_team_id := v_nhl_game.home_team_id;
      v_favorite_ml := v_away_ml;
    end if;

    v_favorite_line :=
      public.get_g365_nhl_favorite_puck_line(v_favorite_ml);

    if v_favorite_line is null then
      v_reason := 'favorite_moneyline_outside_g365_ladder';
    else
      if v_favorite_team_id = v_nhl_game.home_team_id then
        v_home_line := v_favorite_line;
        v_away_line := -v_favorite_line;
      else
        v_away_line := v_favorite_line;
        v_home_line := -v_favorite_line;
      end if;
    end if;
  end if;

  if v_reason is null and v_needs_total then
    if v_total is null or v_total <= 0 then
      v_reason := 'invalid_consensus_total';
    else
      -- Normalize to whole/half goal increments.
      v_total := round(v_total * 2) / 2;
    end if;
  end if;

  if v_reason is not null then
    update public.nhl_pickem_games
    set eligible = false,
        excluded_reason = v_reason,
        market_mode_at_freeze = v_settings.market_mode,
        consensus_favorite_team_id = v_favorite_team_id,
        consensus_favorite_moneyline = v_favorite_ml,
        consensus_underdog_team_id = v_underdog_team_id,
        official_home_puck_line = null,
        official_away_puck_line = null,
        official_total = null,
        puck_line_source_count = v_puck_books,
        total_source_count = v_total_books,
        is_frozen = false,
        frozen_at = null,
        line_status = 'excluded',
        line_finalized_at = now(),
        updated_at = now()
    where id = v_game.id;

    return jsonb_build_object(
      'success', true,
      'gameId', v_game.id,
      'status', 'excluded',
      'reason', v_reason,
      'puckLineSourceCount', v_puck_books,
      'totalSourceCount', v_total_books
    );
  end if;

  update public.nhl_pickem_games
  set eligible = true,
      excluded_reason = null,
      market_mode_at_freeze = v_settings.market_mode,
      consensus_favorite_team_id = case
        when v_needs_puck then v_favorite_team_id
        else null
      end,
      consensus_favorite_moneyline = case
        when v_needs_puck then v_favorite_ml
        else null
      end,
      consensus_underdog_team_id = case
        when v_needs_puck then v_underdog_team_id
        else null
      end,
      official_home_puck_line = case
        when v_needs_puck then v_home_line
        else null
      end,
      official_away_puck_line = case
        when v_needs_puck then v_away_line
        else null
      end,
      official_total = case
        when v_needs_total then v_total
        else null
      end,
      puck_line_source_count = v_puck_books,
      total_source_count = v_total_books,
      is_frozen = true,
      frozen_at = now(),
      line_status = 'frozen',
      line_finalized_at = now(),
      updated_at = now()
  where id = v_game.id;

  return jsonb_build_object(
    'success', true,
    'gameId', v_game.id,
    'status', 'frozen',
    'marketMode', v_settings.market_mode,
    'favoriteTeamId', case when v_needs_puck then v_favorite_team_id else null end,
    'favoriteMoneyline', case when v_needs_puck then v_favorite_ml else null end,
    'homePuckLine', case when v_needs_puck then v_home_line else null end,
    'awayPuckLine', case when v_needs_puck then v_away_line else null end,
    'g365Total', case when v_needs_total then v_total else null end,
    'puckLineSourceCount', v_puck_books,
    'totalSourceCount', v_total_books
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Queue used by the 11:00 AM odds route.
-- Returns only games that are DUE, still pending, and have not started.
-- -----------------------------------------------------------------------------

create or replace function public.get_due_nhl_pickem_line_games(
  p_limit integer default 250
)
returns table (
  nhl_pickem_game_id bigint,
  league_id uuid,
  nhl_game_id bigint,
  season integer,
  kickoff_at timestamptz,
  freeze_scheduled_at timestamptz,
  market_mode text,
  minimum_source_books integer,
  espn_event_id text,
  home_team_id bigint,
  away_team_id bigint
)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if p_limit is null or p_limit < 1 or p_limit > 1000 then
    raise exception 'Queue limit must be between 1 and 1000.';
  end if;

  return query
  select
    g.id,
    g.league_id,
    g.nhl_game_id,
    g.season,
    ng.kickoff_at,
    g.freeze_scheduled_at,
    s.market_mode,
    s.minimum_source_books,
    ng.espn_event_id,
    ng.home_team_id,
    ng.away_team_id
  from public.nhl_pickem_games g
  join public.nhl_games ng
    on ng.id = g.nhl_game_id
  join public.nhl_pickem_settings s
    on s.league_id = g.league_id
  where g.line_status = 'pending'
    and g.eligible = true
    and g.freeze_scheduled_at is not null
    and g.freeze_scheduled_at <= now()
    and ng.kickoff_at > now()
  order by g.freeze_scheduled_at, ng.kickoff_at, g.id
  limit p_limit;
end;
$$;

-- -----------------------------------------------------------------------------
-- Finalize every currently due pending game after the route has inserted the
-- one-time sportsbook snapshot.
-- -----------------------------------------------------------------------------

create or replace function public.finalize_due_nhl_pickem_lines(
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
  v_processed integer := 0;
  v_frozen integer := 0;
  v_excluded integer := 0;
begin
  if p_limit is null or p_limit < 1 or p_limit > 1000 then
    raise exception 'Finalize limit must be between 1 and 1000.';
  end if;

  for r in
    select g.id
    from public.nhl_pickem_games g
    join public.nhl_games ng
      on ng.id = g.nhl_game_id
    where g.line_status = 'pending'
      and g.freeze_scheduled_at is not null
      and g.freeze_scheduled_at <= now()
    order by g.freeze_scheduled_at, g.id
    limit p_limit
  loop
    v_result := public.finalize_nhl_pickem_game_lines(r.id);
    v_processed := v_processed + 1;

    if v_result ->> 'status' = 'frozen' then
      v_frozen := v_frozen + 1;
    elsif v_result ->> 'status' = 'excluded' then
      v_excluded := v_excluded + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'success', true,
    'processed', v_processed,
    'frozen', v_frozen,
    'excluded', v_excluded
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Permissions.
--
-- These pipeline functions are backend/service functions. Normal authenticated
-- league members should never be able to inject sportsbook lines or freeze
-- official G365 markets from the client.
-- -----------------------------------------------------------------------------

revoke all on function public.prepare_nhl_pickem_period_games(bigint)
  from public, anon, authenticated;

revoke all on function public.prepare_active_nhl_pickem_games(integer)
  from public, anon, authenticated;

revoke all on function public.add_nhl_pickem_line_source(
  bigint,text,text,text,text,text,numeric,numeric,numeric,numeric,numeric,jsonb
) from public, anon, authenticated;

revoke all on function public.finalize_nhl_pickem_game_lines(bigint)
  from public, anon, authenticated;

revoke all on function public.get_due_nhl_pickem_line_games(integer)
  from public, anon, authenticated;

revoke all on function public.finalize_due_nhl_pickem_lines(integer)
  from public, anon, authenticated;

grant execute on function public.prepare_nhl_pickem_period_games(bigint)
  to service_role;

grant execute on function public.prepare_active_nhl_pickem_games(integer)
  to service_role;

grant execute on function public.add_nhl_pickem_line_source(
  bigint,text,text,text,text,text,numeric,numeric,numeric,numeric,numeric,jsonb
) to service_role;

grant execute on function public.finalize_nhl_pickem_game_lines(bigint)
  to service_role;

grant execute on function public.get_due_nhl_pickem_line_games(integer)
  to service_role;

grant execute on function public.finalize_due_nhl_pickem_lines(integer)
  to service_role;

commit;

-- -----------------------------------------------------------------------------
-- Verification
-- -----------------------------------------------------------------------------

select
  'nhl_pickem_daily_pipeline_functions' as check_name,
  (
    to_regprocedure(
      'public.prepare_nhl_pickem_period_games(bigint)'
    ) is not null
    and to_regprocedure(
      'public.prepare_active_nhl_pickem_games(integer)'
    ) is not null
    and to_regprocedure(
      'public.get_due_nhl_pickem_line_games(integer)'
    ) is not null
  ) as pass

union all

select
  'nhl_pickem_line_ingest_and_freeze',
  (
    to_regprocedure(
      'public.add_nhl_pickem_line_source(bigint,text,text,text,text,text,numeric,numeric,numeric,numeric,numeric,jsonb)'
    ) is not null
    and to_regprocedure(
      'public.finalize_nhl_pickem_game_lines(bigint)'
    ) is not null
    and to_regprocedure(
      'public.finalize_due_nhl_pickem_lines(integer)'
    ) is not null
  )

union all

select
  'nhl_pickem_line_state_columns',
  (
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'nhl_pickem_games'
        and column_name = 'market_mode_at_freeze'
    )
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'nhl_pickem_games'
        and column_name = 'line_status'
    )
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'nhl_pickem_games'
        and column_name = 'line_finalized_at'
    )
  )

union all

select
  'nhl_pickem_frozen_market_constraint',
  exists (
    select 1
    from pg_constraint
    where conname = 'nhl_pickem_games_frozen_market_presence_check'
      and conrelid = 'public.nhl_pickem_games'::regclass
  )

union all

select
  'nhl_pickem_source_immutability',
  exists (
    select 1
    from pg_trigger
    where tgname = 'trg_nhl_pickem_line_sources_immutability'
      and tgrelid = 'public.nhl_pickem_line_sources'::regclass
      and not tgisinternal
  )

union all

select
  'nhl_pickem_service_only_pipeline',
  (
    has_function_privilege(
      'service_role',
      'public.finalize_nhl_pickem_game_lines(bigint)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'authenticated',
      'public.finalize_nhl_pickem_game_lines(bigint)',
      'EXECUTE'
    )
    and has_function_privilege(
      'service_role',
      'public.add_nhl_pickem_line_source(bigint,text,text,text,text,text,numeric,numeric,numeric,numeric,numeric,jsonb)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'authenticated',
      'public.add_nhl_pickem_line_source(bigint,text,text,text,text,text,numeric,numeric,numeric,numeric,numeric,jsonb)',
      'EXECUTE'
    )
  );