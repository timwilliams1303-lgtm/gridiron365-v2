begin;

create or replace function public.award_pickem_week_badges(
  p_pickem_week_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week public.pickem_weeks%rowtype;
  v_rows integer := 0;
begin
  select *
  into v_week
  from public.pickem_weeks
  where id = p_pickem_week_id;

  if not found then
    raise exception 'Pick''em week could not be found.';
  end if;

  if v_week.status <> 'final' then
    return jsonb_build_object(
      'success', true,
      'awarded', false,
      'reason', 'week_not_final'
    );
  end if;

  delete from public.pickem_badge_awards
  where pickem_badge_awards.league_id = v_week.league_id
    and pickem_badge_awards.season = v_week.season
    and pickem_badge_awards.week = v_week.week;

  with results as (
    select
      r.fantasy_team_id,
      r.wins,
      r.losses,
      r.pushes,
      r.pending,
      r.points,
      r.weekly_rank,
      w.required_picks
    from public.pickem_weekly_results r
    join public.pickem_weeks w
      on w.id = r.pickem_week_id
    where r.pickem_week_id = v_week.id
      and r.is_final = true
  ),
  awards as (
    -- Weekly winner. Ties at weekly_rank = 1 all earn it.
    select
      fantasy_team_id,
      'WEEKLY_CHAMP'::text as badge_key,
      'Weekly Champ'::text as badge_name,
      'WEEKLY'::text as badge_category,
      jsonb_build_object(
        'emoji', '🏆',
        'detail', 'Finished #1 in the official weekly Pick''em standings.',
        'wins', wins,
        'losses', losses,
        'pushes', pushes,
        'points', points
      ) as details
    from results
    where weekly_rank = 1

    union all

    -- Perfect card: every required pick wins, with no push/loss/pending.
    select
      fantasy_team_id,
      'PERFECT_CARD',
      'Perfect Card',
      'ACHIEVEMENT',
      jsonb_build_object(
        'emoji', '🔥',
        'detail', 'Won every required ATS pick on the weekly card.',
        'record', format('%s-%s-%s', wins, losses, pushes),
        'requiredPicks', required_picks
      )
    from results
    where wins = required_picks
      and losses = 0
      and pushes = 0
      and pending = 0

    union all

    -- Strong card: at least 80% wins with 5+ required picks.
    select
      fantasy_team_id,
      'HEATER',
      'On a Heater',
      'ACHIEVEMENT',
      jsonb_build_object(
        'emoji', '🌋',
        'detail', 'Won at least 80% of the required ATS picks this week.',
        'wins', wins,
        'requiredPicks', required_picks
      )
    from results
    where required_picks >= 5
      and wins::numeric / required_picks::numeric >= 0.80
      and losses + pushes + wins = required_picks

    union all

    -- Zero-win finished card.
    select
      fantasy_team_id,
      'ICE_COLD',
      'Ice Cold',
      'INFAMY',
      jsonb_build_object(
        'emoji', '🥶',
        'detail', 'Finished the week without a single ATS win.',
        'losses', losses,
        'pushes', pushes
      )
    from results
    where wins = 0
      and pending = 0
      and losses + pushes > 0

    union all

    -- All losses, no pushes.
    select
      fantasy_team_id,
      'WRONG_WAY',
      'Wrong Way',
      'INFAMY',
      jsonb_build_object(
        'emoji', '🧭',
        'detail', 'Lost every completed ATS selection on the weekly card.',
        'losses', losses
      )
    from results
    where losses = required_picks
      and wins = 0
      and pushes = 0
      and pending = 0

    union all

    -- Multiple pushes is unusual enough to call out.
    select
      fantasy_team_id,
      'PUSH_MAGNET',
      'Push Magnet',
      'WEEKLY',
      jsonb_build_object(
        'emoji', '🧲',
        'detail', 'Recorded multiple pushes against the frozen G365 Spread.',
        'pushes', pushes
      )
    from results
    where pushes >= 2
  )
  insert into public.pickem_badge_awards (
    league_id,
    fantasy_team_id,
    season,
    week,
    badge_key,
    badge_name,
    badge_category,
    details
  )
  select
    v_week.league_id,
    awards.fantasy_team_id,
    v_week.season,
    v_week.week,
    awards.badge_key,
    awards.badge_name,
    awards.badge_category,
    awards.details
  from awards
  on conflict (
    league_id,
    fantasy_team_id,
    season,
    week,
    badge_key
  )
  do update set
    badge_name = excluded.badge_name,
    badge_category = excluded.badge_category,
    details = excluded.details;

  get diagnostics v_rows = row_count;

  return jsonb_build_object(
    'success', true,
    'awarded', true,
    'badgeRows', v_rows,
    'week', v_week.week
  );
end;
$$;

revoke all on function public.award_pickem_week_badges(bigint) from public;
grant execute on function public.award_pickem_week_badges(bigint) to authenticated;


create or replace function public.run_pickem_badges_after_week_final()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'final'
     and old.status is distinct from 'final' then
    perform public.award_pickem_week_badges(new.id);
  end if;

  return new;
end;
$$;


drop trigger if exists trg_pickem_award_badges_after_week_final
on public.pickem_weeks;

create trigger trg_pickem_award_badges_after_week_final
after update of status
on public.pickem_weeks
for each row
execute function public.run_pickem_badges_after_week_final();


-- Backfill any already-final weeks created before Stage 7.
do $$
declare
  r record;
begin
  for r in
    select id
    from public.pickem_weeks
    where status = 'final'
  loop
    perform public.award_pickem_week_badges(r.id);
  end loop;
end;
$$;

commit;
