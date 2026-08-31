begin;

alter table public.pickem_weeks
  add column if not exists lifecycle_mode text not null default 'auto',
  add column if not exists slate_starts_at timestamptz,
  add column if not exists slate_ends_at timestamptz,
  add column if not exists schedule_synced_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'pickem_weeks_lifecycle_mode_check'
  ) then
    alter table public.pickem_weeks
      add constraint pickem_weeks_lifecycle_mode_check
      check (lifecycle_mode in ('auto','manual_override'));
  end if;
end
$$;

create index if not exists pickem_weeks_auto_window_idx
on public.pickem_weeks (
  season,
  slate_starts_at,
  slate_ends_at
)
where status <> 'final';

-- ------------------------------------------------------------
-- Build/refresh the entire G365 contest calendar from one ESPN
-- anchor kickoff. Existing final weeks are never changed.
-- Existing non-final weeks keep their required_picks snapshot.
-- ------------------------------------------------------------
create or replace function public.ensure_pickem_season_weeks(
  p_league_id uuid,
  p_season integer,
  p_anchor_kickoff timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_scope text;
  v_required integer;
  v_week_count integer;
  v_anchor_local timestamp;
  v_base_tuesday_local timestamp;
  v_week integer;
  v_start timestamptz;
  v_end timestamptz;
  v_line_day timestamptz;
  v_finalize timestamptz;
  v_count integer := 0;
begin
  if p_anchor_kickoff is null then
    raise exception using errcode = '22023',
      message = 'An ESPN anchor kickoff is required.';
  end if;

  select
    s.football_scope,
    s.picks_per_week
  into
    v_scope,
    v_required
  from public.pickem_settings s
  join public.leagues l
    on l.id = s.league_id
  where s.league_id = p_league_id
    and l.league_type = 'pickem'
    and l.season = p_season;

  if not found then
    raise exception 'Pick''em settings could not be found.';
  end if;

  -- NFL season drives combined/NFL contest length.
  -- College-only uses a shorter regular-season contest calendar.
  v_week_count :=
    case
      when v_scope = 'college_only' then 16
      else 18
    end;

  v_anchor_local :=
    p_anchor_kickoff at time zone 'America/New_York';

  -- PostgreSQL date_trunc('week') starts Monday.
  -- Add one day to get Tuesday 12:00 AM ET.
  v_base_tuesday_local :=
    date_trunc('week', v_anchor_local) + interval '1 day';

  -- If an unusual anchor itself occurs before Tuesday of that week,
  -- move the contest anchor back one Tuesday.
  if v_anchor_local < v_base_tuesday_local then
    v_base_tuesday_local :=
      v_base_tuesday_local - interval '7 days';
  end if;

  for v_week in 1..v_week_count loop
    v_start :=
      (
        v_base_tuesday_local +
        make_interval(days => (v_week - 1) * 7)
      ) at time zone 'America/New_York';

    v_end :=
      (
        v_base_tuesday_local +
        make_interval(days => v_week * 7)
      ) at time zone 'America/New_York';

    v_line_day :=
      (
        v_base_tuesday_local +
        make_interval(days => (v_week - 1) * 7) +
        interval '10 hours'
      ) at time zone 'America/New_York';

    v_finalize :=
      (
        v_base_tuesday_local +
        make_interval(days => v_week * 7) +
        interval '2 hours'
      ) at time zone 'America/New_York';

    insert into public.pickem_weeks (
      league_id,
      season,
      week,
      status,
      required_picks,
      opens_at,
      line_day_at,
      finalize_not_before,
      lifecycle_mode,
      slate_starts_at,
      slate_ends_at,
      schedule_synced_at,
      updated_at
    )
    values (
      p_league_id,
      p_season,
      v_week,
      'setup',
      v_required,
      v_start,
      v_line_day,
      v_finalize,
      'auto',
      v_start,
      v_end,
      now(),
      now()
    )
    on conflict (league_id, season, week)
    do update set
      opens_at =
        case
          when pickem_weeks.status = 'final'
            then pickem_weeks.opens_at
          else excluded.opens_at
        end,
      line_day_at =
        case
          when pickem_weeks.status = 'final'
            then pickem_weeks.line_day_at
          when pickem_weeks.lifecycle_mode = 'manual_override'
            then pickem_weeks.line_day_at
          else excluded.line_day_at
        end,
      finalize_not_before =
        case
          when pickem_weeks.status = 'final'
            then pickem_weeks.finalize_not_before
          when pickem_weeks.lifecycle_mode = 'manual_override'
            then pickem_weeks.finalize_not_before
          else excluded.finalize_not_before
        end,
      slate_starts_at =
        case
          when pickem_weeks.status = 'final'
            then pickem_weeks.slate_starts_at
          else excluded.slate_starts_at
        end,
      slate_ends_at =
        case
          when pickem_weeks.status = 'final'
            then pickem_weeks.slate_ends_at
          else excluded.slate_ends_at
        end,
      lifecycle_mode =
        case
          when pickem_weeks.lifecycle_mode = 'manual_override'
            then pickem_weeks.lifecycle_mode
          else 'auto'
        end,
      schedule_synced_at =
        case
          when pickem_weeks.status = 'final'
            then pickem_weeks.schedule_synced_at
          else now()
        end,
      updated_at = now();

    v_count := v_count + 1;
  end loop;

  return jsonb_build_object(
    'success', true,
    'leagueId', p_league_id,
    'season', p_season,
    'footballScope', v_scope,
    'weeksPrepared', v_count,
    'anchorKickoff', p_anchor_kickoff
  );
end;
$$;

revoke all on function public.ensure_pickem_season_weeks(uuid,integer,timestamptz)
from public, anon, authenticated;

grant execute on function public.ensure_pickem_season_weeks(uuid,integer,timestamptz)
to service_role;

commit;