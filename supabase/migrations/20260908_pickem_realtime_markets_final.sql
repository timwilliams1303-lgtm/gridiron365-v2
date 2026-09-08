begin;

-- ============================================================
-- G365 PICK'EM — FINAL MARKET + REALTIME POLICY
-- ============================================================

-- Football is always Spread + Over/Under going forward.
alter table public.pickem_settings
  alter column pick_market_mode set default 'spread_total';

update public.pickem_settings
set pick_market_mode = 'spread_total',
    updated_at = now()
where coalesce(enabled_sports, array['cfb','nfl']::text[])
      && array['cfb','nfl']::text[]
  and pick_market_mode is distinct from 'spread_total';

-- Only update contest snapshots that have not started.
update public.pickem_weeks w
set pick_market_mode = 'spread_total',
    updated_at = now()
where w.status = 'setup'
  and exists (
    select 1
    from public.pickem_settings s
    where s.league_id = w.league_id
      and coalesce(s.enabled_sports, array['cfb','nfl']::text[])
          && array['cfb','nfl']::text[]
  )
  and not exists (
    select 1
    from public.pickem_games g
    where g.pickem_week_id = w.id
      and (g.is_started = true or g.kickoff_at <= now())
  )
  and w.pick_market_mode is distinct from 'spread_total';

-- Enforce the product rule at the master settings row so older clients cannot
-- accidentally save football back to spread-only or total-only.
create or replace function private.g365_force_pickem_football_spread_total()
returns trigger
language plpgsql
set search_path = public, private, pg_temp
as $$
begin
  if coalesce(new.enabled_sports, array['cfb','nfl']::text[])
       && array['cfb','nfl']::text[] then
    new.pick_market_mode := 'spread_total';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_g365_force_pickem_football_spread_total
  on public.pickem_settings;

create trigger trg_g365_force_pickem_football_spread_total
before insert or update on public.pickem_settings
for each row
execute function private.g365_force_pickem_football_spread_total();

-- Protect only unstarted week snapshots. Historical/in-progress weeks are never
-- rewritten by this trigger.
create or replace function private.g365_force_setup_pickem_week_spread_total()
returns trigger
language plpgsql
set search_path = public, private, pg_temp
as $$
declare
  v_has_football boolean := false;
begin
  if new.status <> 'setup' then
    return new;
  end if;

  if exists (
    select 1
    from public.pickem_games g
    where g.pickem_week_id = new.id
      and (g.is_started = true or g.kickoff_at <= now())
  ) then
    return new;
  end if;

  select coalesce(s.enabled_sports, array['cfb','nfl']::text[])
           && array['cfb','nfl']::text[]
  into v_has_football
  from public.pickem_settings s
  where s.league_id = new.league_id;

  if coalesce(v_has_football, false) then
    new.pick_market_mode := 'spread_total';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_g365_force_setup_pickem_week_spread_total
  on public.pickem_weeks;

create trigger trg_g365_force_setup_pickem_week_spread_total
before insert or update on public.pickem_weeks
for each row
execute function private.g365_force_setup_pickem_week_spread_total();

-- Ensure all Pick'em tables used by the browser are available to Supabase
-- Realtime. RLS continues to control what each authenticated user can read.
do $$
declare
  v_table text;
  v_tables text[] := array[
    'leagues',
    'fantasy_teams',
    'pickem_settings',
    'pickem_weeks',
    'pickem_games',
    'pickem_picks',
    'pickem_weekly_results',
    'pickem_badge_awards',
    'nhl_pickem_settings',
    'nhl_pickem_periods',
    'nhl_pickem_games',
    'nhl_pickem_picks',
    'nhl_pickem_period_results',
    'nhl_pickem_standings',
    'nhl_pickem_awards'
  ];
begin
  foreach v_table in array v_tables loop
    if to_regclass(format('public.%I', v_table)) is not null
       and not exists (
         select 1
         from pg_publication_tables
         where pubname = 'supabase_realtime'
           and schemaname = 'public'
           and tablename = v_table
       ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        v_table
      );
    end if;
  end loop;
end;
$$;

commit;
