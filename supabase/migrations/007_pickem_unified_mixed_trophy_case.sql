begin;


-- ============================================================
-- 1. ENSURE MIXED NHL PERIOD AWARDS ARE BUILT ON FINALIZATION
-- ============================================================

create or replace function public.g365_build_mixed_nhl_awards_on_period_final()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if new.status = 'final'
     and old.status is distinct from new.status
     and private.g365_pickem_is_mixed_with_nhl(new.league_id)
  then
    perform public.build_nhl_pickem_period_awards(new.id);

    -- Safe to call repeatedly. The mature NHL season-award function
    -- returns season_not_complete until every NHL period is final and
    -- uses conflict protection once the award is eligible.
    perform public.build_nhl_pickem_season_awards(
      new.league_id,
      new.season
    );
  end if;

  return new;
end;
$$;

drop trigger if exists
  trg_g365_build_mixed_nhl_awards_on_period_final
on public.nhl_pickem_periods;

create trigger
  trg_g365_build_mixed_nhl_awards_on_period_final
after update of status
on public.nhl_pickem_periods
for each row
when (
  new.status = 'final'
  and old.status is distinct from new.status
)
execute function public.g365_build_mixed_nhl_awards_on_period_final();


-- ============================================================
-- 2. ONE CONTINUOUS TROPHY CASE FOR MIXED G365 PICK'EM
-- ============================================================

create or replace function public.get_pickem_unified_trophy_case(
  p_league_id uuid
)
returns table (
  id bigint,
  league_id uuid,
  fantasy_team_id bigint,
  franchise_id uuid,
  team_name text,
  season integer,
  week integer,
  badge_key text,
  badge_name text,
  badge_category text,
  details jsonb,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, private, auth, pg_temp
as $$
declare
  v_history_id uuid;
  v_nhl_history_id uuid;
begin
  select
    l.pickem_history_id,
    l.nhl_pickem_history_id
  into
    v_history_id,
    v_nhl_history_id
  from public.leagues l
  where l.id = p_league_id
    and l.league_type = 'pickem';

  if not found then
    raise exception 'Pick''em league could not be found.';
  end if;

  if auth.role() <> 'service_role'
     and not exists (
       select 1
       from public.league_members lm
       where lm.league_id = p_league_id
         and lm.user_id = auth.uid()
     )
     and not exists (
       select 1
       from public.leagues l
       where l.id = p_league_id
         and l.commissioner_user_id = auth.uid()
     )
  then
    raise exception 'League membership is required.';
  end if;

  return query
  with football as (
    select
      f.id,
      f.league_id,
      f.fantasy_team_id,
      f.franchise_id,
      f.team_name,
      f.season,
      f.week,
      f.badge_key,
      f.badge_name,
      f.badge_category,
      coalesce(f.details, '{}'::jsonb)
        || jsonb_build_object(
             'sourceSport', 'football',
             'sourceSystem', 'pickem_badge_awards'
           ) as details,
      f.created_at
    from public.get_pickem_history_trophy_case(
      p_league_id
    ) f
  ),
  nhl_history_leagues as (
    select l.id, l.season
    from public.leagues l
    where
      (
        v_nhl_history_id is not null
        and l.nhl_pickem_history_id = v_nhl_history_id
      )
      or
      (
        v_nhl_history_id is null
        and l.id = p_league_id
      )
  ),
  nhl_raw as (
    select
      a.id as award_id,
      a.league_id,
      a.season,
      a.nhl_pickem_period_id,
      a.franchise_id as nhl_franchise_id,
      a.award_type,
      a.award_key,
      a.title,
      a.description,
      a.metadata,
      a.awarded_at,
      e.fantasy_team_id,
      ft.pickem_franchise_id as canonical_pickem_franchise_id,
      ft.team_name as source_team_name,
      p.period_number
    from nhl_history_leagues hl
    join public.nhl_pickem_awards a
      on a.league_id = hl.id
    left join public.nhl_pickem_entries e
      on e.league_id = a.league_id
     and e.franchise_id = a.franchise_id
     and e.season = a.season
    left join public.fantasy_teams ft
      on ft.id = e.fantasy_team_id
     and ft.league_id = a.league_id
    left join public.nhl_pickem_periods p
      on p.id = a.nhl_pickem_period_id
  ),
  nhl_mapped as (
    select
      -- Negative IDs keep NHL rows unique from positive Football badge IDs
      -- while preserving the existing bigint UI contract.
      (-1 * r.award_id)::bigint as id,
      r.league_id,
      coalesce(r.fantasy_team_id, 0)::bigint as fantasy_team_id,
      coalesce(
        r.canonical_pickem_franchise_id,
        r.nhl_franchise_id
      ) as franchise_id,
      coalesce(
        latest_team.team_name,
        r.source_team_name,
        'Pick''em Entry'
      )::text as team_name,
      r.season,
      coalesce(r.period_number, 0)::integer as week,
      ('nhl:' || r.award_key)::text as badge_key,
      r.title::text as badge_name,
      case
        when r.award_type = 'period_winner'
          then 'WEEKLY'
        when r.award_type = 'season_champion'
          then 'ACHIEVEMENT'
        else 'ACHIEVEMENT'
      end::text as badge_category,
      coalesce(r.metadata, '{}'::jsonb)
        || jsonb_build_object(
             'sourceSport', 'nhl',
             'sourceSystem', 'nhl_pickem_awards',
             'awardType', r.award_type,
             'nhlFranchiseId', r.nhl_franchise_id,
             'detail', coalesce(
               r.description,
               'Earned in G365 Pick''em NHL competition.'
             ),
             'emoji',
               case
                 when r.award_type = 'season_champion'
                   then '🏆'
                 when r.award_type = 'period_winner'
                   then '🥇'
                 else '🏒'
               end
           ) as details,
      r.awarded_at as created_at
    from nhl_raw r
    left join lateral (
      select ft2.team_name
      from public.fantasy_teams ft2
      join public.leagues l2
        on l2.id = ft2.league_id
      where r.canonical_pickem_franchise_id is not null
        and ft2.pickem_franchise_id =
            r.canonical_pickem_franchise_id
        and (
          v_history_id is null
          or l2.pickem_history_id = v_history_id
        )
      order by l2.season desc, ft2.id desc
      limit 1
    ) latest_team
      on true
  )
  select
    f.id,
    f.league_id,
    f.fantasy_team_id,
    f.franchise_id,
    f.team_name,
    f.season,
    f.week,
    f.badge_key,
    f.badge_name,
    f.badge_category,
    f.details,
    f.created_at
  from football f

  union all

  select
    n.id,
    n.league_id,
    n.fantasy_team_id,
    n.franchise_id,
    n.team_name,
    n.season,
    n.week,
    n.badge_key,
    n.badge_name,
    n.badge_category,
    n.details,
    n.created_at
  from nhl_mapped n

  order by season desc, created_at desc, id desc;
end;
$$;


-- ============================================================
-- 3. PERMISSIONS
-- ============================================================

revoke all
on function public.get_pickem_unified_trophy_case(uuid)
from public, anon;

grant execute
on function public.get_pickem_unified_trophy_case(uuid)
to authenticated, service_role;

revoke all
on function public.g365_build_mixed_nhl_awards_on_period_final()
from public, anon, authenticated;

grant execute
on function public.g365_build_mixed_nhl_awards_on_period_final()
to service_role;


commit;


-- ============================================================
-- VERIFICATION
-- ============================================================

select
  to_regprocedure(
    'public.get_pickem_unified_trophy_case(uuid)'
  ) is not null as unified_trophy_rpc_exists,
  to_regprocedure(
    'public.g365_build_mixed_nhl_awards_on_period_final()'
  ) is not null as mixed_nhl_award_trigger_function_exists;

select
  trigger_name,
  event_object_table
from information_schema.triggers
where trigger_schema = 'public'
  and trigger_name =
      'trg_g365_build_mixed_nhl_awards_on_period_final';

select
  l.id as league_id,
  l.name,
  l.pickem_history_id,
  l.nhl_pickem_history_id,
  private.g365_pickem_is_mixed_with_nhl(l.id)
    as mixed_with_nhl
from public.leagues l
where l.id =
  '4db2e702-2901-46bd-80dc-d7346a15ee55';
