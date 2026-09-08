begin;

create or replace function private.g365_initialize_unified_nhl_after_nhl_settings()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  r record;
begin
  -- Legacy standalone NHL Pick'em leagues are intentionally ignored here.
  -- This trigger is only for the unified G365 Pick'em architecture.
  if exists (
    select 1
    from public.leagues l
    join public.pickem_settings ps
      on ps.league_id = l.id
    where l.id = new.league_id
      and l.league_type = 'pickem'
      and coalesce(ps.enabled_sports, array[]::text[])
            @> array['nhl']::text[]
  ) then
    for r in
      select
        ft.id as fantasy_team_id,
        ft.owner_id
      from public.fantasy_teams ft
      where ft.league_id = new.league_id
        and ft.owner_id is not null
        and coalesce(ft.active, true) = true
      order by ft.id
    loop
      perform private.g365_ensure_unified_nhl_participant(
        new.league_id,
        r.owner_id,
        r.fantasy_team_id
      );
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists
  trg_g365_initialize_unified_nhl_after_nhl_settings
on public.nhl_pickem_settings;

create trigger
  trg_g365_initialize_unified_nhl_after_nhl_settings
after insert or update
on public.nhl_pickem_settings
for each row
execute function private.g365_initialize_unified_nhl_after_nhl_settings();

revoke all
on function private.g365_initialize_unified_nhl_after_nhl_settings()
from public, anon, authenticated;

grant execute
on function private.g365_initialize_unified_nhl_after_nhl_settings()
to service_role;

commit;

-- ============================================================
-- VERIFICATION
-- ============================================================

select
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation
from information_schema.triggers
where trigger_schema = 'public'
  and trigger_name = 'trg_g365_initialize_unified_nhl_after_nhl_settings';

-- Current unified NHL-enabled Pick'em leagues should have zero missing
-- participant entries after settings are saved.
select
  ft.league_id,
  l.name as league_name,
  count(*)::integer as active_owned_teams,
  count(*) filter (
    where e.id is null
       or ft.nhl_pickem_franchise_id is null
  )::integer as missing_nhl_participants
from public.fantasy_teams ft
join public.leagues l
  on l.id = ft.league_id
join public.pickem_settings ps
  on ps.league_id = ft.league_id
join public.nhl_pickem_settings ns
  on ns.league_id = ft.league_id
left join public.nhl_pickem_entries e
  on e.league_id = ft.league_id
 and e.season = l.season
 and e.fantasy_team_id = ft.id
where l.league_type = 'pickem'
  and coalesce(ps.enabled_sports, array[]::text[])
        @> array['nhl']::text[]
  and ft.owner_id is not null
  and coalesce(ft.active, true) = true
group by ft.league_id, l.name
order by l.name;
