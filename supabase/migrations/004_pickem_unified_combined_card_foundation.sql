begin;


-- ============================================================
-- 1. PRIVATE HELPER
-- ============================================================

create or replace function private.g365_pickem_is_mixed_with_nhl(
  p_league_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select coalesce(
    (
      select
        coalesce(ps.enabled_sports, array[]::text[])
          @> array['nhl']::text[]
        and
        coalesce(ps.enabled_sports, array[]::text[])
          && array['cfb','nfl']::text[]
      from public.pickem_settings ps
      where ps.league_id = p_league_id
    ),
    false
  );
$$;

revoke all on function private.g365_pickem_is_mixed_with_nhl(uuid)
  from public, anon, authenticated;

grant execute on function private.g365_pickem_is_mixed_with_nhl(uuid)
  to service_role;


-- ============================================================
-- 2. UNIFIED CARD STATUS
-- ============================================================

create or replace function public.get_pickem_unified_card_status(
  p_league_id uuid,
  p_season integer,
  p_week integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private, auth, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_team_id bigint;

  v_week public.pickem_weeks%rowtype;
  v_period public.nhl_pickem_periods%rowtype;

  v_required integer := 5;

  v_football_selected integer := 0;
  v_nhl_selected integer := 0;
  v_total_selected integer := 0;

  v_football_confidence integer := 0;
  v_nhl_confidence integer := 0;
  v_confidence_assigned integer := 0;
  v_missing_confidence integer := 0;

  v_scoring_mode text := 'record_only';
begin
  if v_user is null then
    raise exception using
      errcode = '42501',
      message = 'You must be signed in.';
  end if;

  if not private.is_league_member(p_league_id, v_user) then
    raise exception using
      errcode = '42501',
      message = 'You are not a member of this Pick''em league.';
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
      message = 'An active Pick''em entry could not be found for this member.';
  end if;

  select *
  into v_week
  from public.pickem_weeks
  where league_id = p_league_id
    and season = p_season
    and week = p_week;

  if not found then
    select coalesce(ps.picks_per_week,5),
           coalesce(ps.scoring_mode,'record_only')
    into v_required, v_scoring_mode
    from public.pickem_settings ps
    where ps.league_id = p_league_id;

    return jsonb_build_object(
      'success', true,
      'weekReady', false,
      'leagueId', p_league_id,
      'season', p_season,
      'week', p_week,
      'fantasyTeamId', v_team_id,
      'requiredPicks', coalesce(v_required,5),
      'footballPicks', 0,
      'nhlPicks', 0,
      'selectedPicks', 0,
      'remainingPicks', coalesce(v_required,5),
      'scoringMode', coalesce(v_scoring_mode,'record_only'),
      'confidenceAssigned', 0,
      'missingConfidence', 0,
      'isComplete', false
    );
  end if;

  v_required := coalesce(v_week.required_picks,5);
  v_scoring_mode := coalesce(v_week.scoring_mode,'record_only');

  select
    count(*)::integer,
    count(*) filter (
      where p.confidence_value is not null
    )::integer
  into
    v_football_selected,
    v_football_confidence
  from public.pickem_picks p
  where p.pickem_week_id = v_week.id
    and p.fantasy_team_id = v_team_id
    and coalesce(p.result,'pending') <> 'void';

  select *
  into v_period
  from public.nhl_pickem_periods
  where league_id = p_league_id
    and season = p_season
    and period_number = p_week;

  if found then
    select
      count(*)::integer,
      count(*) filter (
        where p.confidence_value is not null
      )::integer
    into
      v_nhl_selected,
      v_nhl_confidence
    from public.nhl_pickem_picks p
    where p.nhl_pickem_period_id = v_period.id
      and p.fantasy_team_id = v_team_id
      and coalesce(p.result,'pending') <> 'void';
  end if;

  v_total_selected :=
    coalesce(v_football_selected,0) +
    coalesce(v_nhl_selected,0);

  v_confidence_assigned :=
    coalesce(v_football_confidence,0) +
    coalesce(v_nhl_confidence,0);

  v_missing_confidence :=
    case
      when v_scoring_mode = 'confidence'
      then greatest(v_total_selected - v_confidence_assigned,0)
      else 0
    end;

  return jsonb_build_object(
    'success', true,
    'weekReady', true,
    'leagueId', p_league_id,
    'season', p_season,
    'week', p_week,
    'pickemWeekId', v_week.id,
    'nhlPickemPeriodId',
      case
        when v_period.id is null then null
        else v_period.id
      end,
    'fantasyTeamId', v_team_id,
    'requiredPicks', v_required,
    'footballPicks', coalesce(v_football_selected,0),
    'nhlPicks', coalesce(v_nhl_selected,0),
    'selectedPicks', v_total_selected,
    'remainingPicks', greatest(v_required - v_total_selected,0),
    'scoringMode', v_scoring_mode,
    'confidenceAssigned', v_confidence_assigned,
    'missingConfidence', v_missing_confidence,
    'isComplete',
      (
        v_total_selected = v_required
        and (
          v_scoring_mode <> 'confidence'
          or v_confidence_assigned = v_required
        )
      )
  );
end;
$$;

revoke all on function public.get_pickem_unified_card_status(uuid,integer,integer)
  from public, anon;

grant execute on function public.get_pickem_unified_card_status(uuid,integer,integer)
  to authenticated, service_role;


-- ============================================================
-- 3. COMBINED MAXIMUM GUARD - FOOTBALL PICK INSERTS
-- ============================================================

create or replace function private.g365_guard_unified_football_pick_limit()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_week public.pickem_weeks%rowtype;
  v_required integer := 5;
  v_football_count integer := 0;
  v_nhl_count integer := 0;
begin
  if not private.g365_pickem_is_mixed_with_nhl(new.league_id) then
    return new;
  end if;

  select *
  into v_week
  from public.pickem_weeks
  where id = new.pickem_week_id;

  if not found then
    return new;
  end if;

  v_required := coalesce(v_week.required_picks,5);

  select count(*)::integer
  into v_football_count
  from public.pickem_picks p
  where p.pickem_week_id = v_week.id
    and p.fantasy_team_id = new.fantasy_team_id
    and coalesce(p.result,'pending') <> 'void';

  select count(*)::integer
  into v_nhl_count
  from public.nhl_pickem_picks np
  join public.nhl_pickem_periods period
    on period.id = np.nhl_pickem_period_id
  where period.league_id = new.league_id
    and period.season = v_week.season
    and period.period_number = v_week.week
    and np.fantasy_team_id = new.fantasy_team_id
    and coalesce(np.result,'pending') <> 'void';

  if coalesce(v_football_count,0) + coalesce(v_nhl_count,0) >= v_required then
    raise exception using
      errcode = '22023',
      message = format(
        'Your G365 Pick''em card already has the required %s total picks across all enabled sports.',
        v_required
      );
  end if;

  return new;
end;
$$;


drop trigger if exists trg_g365_unified_football_pick_limit
  on public.pickem_picks;

create trigger trg_g365_unified_football_pick_limit
before insert on public.pickem_picks
for each row
execute function private.g365_guard_unified_football_pick_limit();


-- ============================================================
-- 4. COMBINED MAXIMUM GUARD - NHL PICK INSERTS
-- ============================================================

create or replace function private.g365_guard_unified_nhl_pick_limit()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_period public.nhl_pickem_periods%rowtype;
  v_week public.pickem_weeks%rowtype;
  v_required integer := 5;
  v_football_count integer := 0;
  v_nhl_count integer := 0;
begin
  if not private.g365_pickem_is_mixed_with_nhl(new.league_id) then
    return new;
  end if;

  select *
  into v_period
  from public.nhl_pickem_periods
  where id = new.nhl_pickem_period_id;

  if not found then
    return new;
  end if;

  select *
  into v_week
  from public.pickem_weeks
  where league_id = new.league_id
    and season = v_period.season
    and week = v_period.period_number;

  if not found then
    return new;
  end if;

  v_required := coalesce(v_week.required_picks,5);

  select count(*)::integer
  into v_football_count
  from public.pickem_picks p
  where p.pickem_week_id = v_week.id
    and p.fantasy_team_id = new.fantasy_team_id
    and coalesce(p.result,'pending') <> 'void';

  select count(*)::integer
  into v_nhl_count
  from public.nhl_pickem_picks p
  where p.nhl_pickem_period_id = v_period.id
    and p.fantasy_team_id = new.fantasy_team_id
    and coalesce(p.result,'pending') <> 'void';

  if coalesce(v_football_count,0) + coalesce(v_nhl_count,0) >= v_required then
    raise exception using
      errcode = '22023',
      message = format(
        'Your G365 Pick''em card already has the required %s total picks across all enabled sports.',
        v_required
      );
  end if;

  return new;
end;
$$;


drop trigger if exists trg_g365_unified_nhl_pick_limit
  on public.nhl_pickem_picks;

create trigger trg_g365_unified_nhl_pick_limit
before insert on public.nhl_pickem_picks
for each row
execute function private.g365_guard_unified_nhl_pick_limit();


-- ============================================================
-- 5. PERMISSIONS
-- ============================================================

revoke all on function private.g365_guard_unified_football_pick_limit()
  from public, anon, authenticated;

revoke all on function private.g365_guard_unified_nhl_pick_limit()
  from public, anon, authenticated;

grant execute on function private.g365_guard_unified_football_pick_limit()
  to service_role;

grant execute on function private.g365_guard_unified_nhl_pick_limit()
  to service_role;


commit;


-- ============================================================
-- VERIFICATION
-- ============================================================

select
  ps.league_id,
  l.name,
  ps.enabled_sports,
  ps.picks_per_week,
  private.g365_pickem_is_mixed_with_nhl(ps.league_id) as mixed_with_nhl
from public.pickem_settings ps
join public.leagues l
  on l.id = ps.league_id
where l.league_type = 'pickem'
order by l.name;


select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n
  on n.oid = p.pronamespace
where n.nspname in ('public','private')
  and p.proname in (
    'g365_pickem_is_mixed_with_nhl',
    'get_pickem_unified_card_status',
    'g365_guard_unified_football_pick_limit',
    'g365_guard_unified_nhl_pick_limit'
  )
order by n.nspname, p.proname;


select
  tg.tgname as trigger_name,
  c.relname as table_name
from pg_trigger tg
join pg_class c
  on c.oid = tg.tgrelid
join pg_namespace n
  on n.oid = c.relnamespace
where not tg.tgisinternal
  and n.nspname = 'public'
  and tg.tgname in (
    'trg_g365_unified_football_pick_limit',
    'trg_g365_unified_nhl_pick_limit'
  )
order by c.relname, tg.tgname;
