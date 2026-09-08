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
  v_nhl_enabled boolean := false;
begin
  select *
    into v_league
  from public.leagues
  where id = p_league_id;

  if not found then
    raise exception 'NHL Pick''em league could not be found.';
  end if;

  -- Preserve support for the original standalone NHL Pick'em league type.
  if v_league.league_type = 'nhl_pickem' then
    return v_league;
  end if;

  -- Unified G365 Pick'em support.
  if v_league.league_type = 'pickem' then
    select (
      coalesce(ps.enabled_sports, array[]::text[])
        @> array['nhl']::text[]
      and exists (
        select 1
        from public.nhl_pickem_settings ns
        where ns.league_id = p_league_id
      )
    )
    into v_nhl_enabled
    from public.pickem_settings ps
    where ps.league_id = p_league_id;

    if coalesce(v_nhl_enabled, false) then
      return v_league;
    end if;
  end if;

  raise exception
    'League % is not enabled for G365 NHL Pick''em.',
    p_league_id;
end;
$$;

grant execute on function private.assert_nhl_pickem_league(uuid)
to authenticated, service_role;

-- Verification
select
  l.id as league_id,
  l.name,
  l.league_type,
  ps.enabled_sports,
  (private.assert_nhl_pickem_league(l.id)).id as nhl_engine_league_id
from public.leagues l
left join public.pickem_settings ps
  on ps.league_id = l.id
where l.id = '4db2e702-2901-46bd-80dc-d7346a15ee55';
