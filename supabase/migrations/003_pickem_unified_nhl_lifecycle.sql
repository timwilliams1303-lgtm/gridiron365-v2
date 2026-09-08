create or replace function public.prepare_active_nhl_pickem_games(
  p_lookahead_days integer default 8
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $function$
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
    raise exception
      'NHL Pick''em look-ahead days must be between 1 and 31.';
  end if;

  for r in
    select p.id
    from public.nhl_pickem_periods p
    join public.leagues l
      on l.id = p.league_id
    left join public.pickem_settings ps
      on ps.league_id = p.league_id
    where (
      l.league_type = 'nhl_pickem'
      or (
        l.league_type = 'pickem'
        and coalesce(ps.enabled_sports, array[]::text[])
              @> array['nhl']::text[]
        and exists (
          select 1
          from public.nhl_pickem_settings ns
          where ns.league_id = p.league_id
        )
      )
    )
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
$function$;


create or replace function public.advance_nhl_pickem_period_lifecycle()
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $function$
declare
  r record;
  v_result jsonb;
  v_finalized integer := 0;
  v_waiting integer := 0;
  v_awards integer := 0;
  v_locked jsonb;
  v_graded jsonb;
begin
  v_locked := public.lock_due_nhl_pickem_picks();
  v_graded := public.grade_final_nhl_pickem_games(1000);

  update public.nhl_pickem_periods
  set status = case
        when status = 'final' then 'final'
        when now() < starts_at then 'upcoming'
        when now() < ends_at then 'open'
        else 'locked'
      end,
      updated_at = now()
  where status <> 'final';

  for r in
    select p.id, p.league_id, p.season
    from public.nhl_pickem_periods p
    join public.leagues l
      on l.id = p.league_id
    left join public.pickem_settings ps
      on ps.league_id = p.league_id
    where (
      l.league_type = 'nhl_pickem'
      or (
        l.league_type = 'pickem'
        and coalesce(ps.enabled_sports, array[]::text[])
              @> array['nhl']::text[]
        and exists (
          select 1
          from public.nhl_pickem_settings ns
          where ns.league_id = p.league_id
        )
      )
    )
      and p.status <> 'final'
      and now() >= p.ends_at
    order by p.ends_at, p.id
  loop
    v_result := public.finalize_nhl_pickem_period(r.id);

    if coalesce((v_result ->> 'finalized')::boolean, false) then
      v_finalized := v_finalized + 1;

      v_result := public.build_nhl_pickem_period_awards(r.id);

      v_awards :=
        v_awards
        + coalesce((v_result ->> 'awardsCreated')::integer, 0);

      perform public.build_nhl_pickem_season_awards(
        r.league_id,
        r.season
      );
    else
      v_waiting := v_waiting + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'success', true,
    'lockedPicks', coalesce((v_locked ->> 'lockedPicks')::integer, 0),
    'gamesGraded', coalesce((v_graded ->> 'gamesGraded')::integer, 0),
    'picksGraded', coalesce((v_graded ->> 'picksGraded')::integer, 0),
    'periodsFinalized', v_finalized,
    'periodsWaiting', v_waiting,
    'periodAwardsCreated', v_awards
  );
end;
$function$;


grant execute
on function public.prepare_active_nhl_pickem_games(integer)
to authenticated, service_role;

grant execute
on function public.advance_nhl_pickem_period_lifecycle()
to authenticated, service_role;


select
  l.id as league_id,
  l.name,
  l.league_type,
  ps.enabled_sports,
  ns.market_mode as nhl_market_mode,
  count(p.id) as nhl_periods
from public.leagues l
left join public.pickem_settings ps
  on ps.league_id = l.id
left join public.nhl_pickem_settings ns
  on ns.league_id = l.id
left join public.nhl_pickem_periods p
  on p.league_id = l.id
where l.id = '4db2e702-2901-46bd-80dc-d7346a15ee55'
group by
  l.id,
  l.name,
  l.league_type,
  ps.enabled_sports,
  ns.market_mode;
