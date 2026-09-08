begin;


-- ============================================================
-- 1. INTERNAL IDEMPOTENT PARTICIPANT PROVISIONER
-- ============================================================

create or replace function private.g365_ensure_unified_nhl_participant(
  p_league_id uuid,
  p_user_id uuid,
  p_fantasy_team_id bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_league public.leagues%rowtype;
  v_team public.fantasy_teams%rowtype;
  v_history_id uuid;
  v_franchise_id uuid;
  v_entry_id bigint;
  v_entry_name text;
  v_nhl_enabled boolean := false;
begin
  if p_league_id is null
     or p_user_id is null
  then
    return jsonb_build_object(
      'success', false,
      'reason', 'missing_identity'
    );
  end if;

  select *
  into v_league
  from public.leagues
  where id = p_league_id;

  if not found then
    return jsonb_build_object(
      'success', false,
      'reason', 'league_not_found'
    );
  end if;

  -- This helper is only for the unified Pick'em league.
  if v_league.league_type <> 'pickem' then
    return jsonb_build_object(
      'success', true,
      'provisioned', false,
      'reason', 'not_unified_pickem'
    );
  end if;

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

  if not coalesce(v_nhl_enabled, false) then
    return jsonb_build_object(
      'success', true,
      'provisioned', false,
      'reason', 'nhl_not_enabled'
    );
  end if;

  -- The user must actually belong to the league.
  if not exists (
    select 1
    from public.league_members lm
    where lm.league_id = p_league_id
      and lm.user_id = p_user_id
  )
  and v_league.commissioner_user_id is distinct from p_user_id
  then
    return jsonb_build_object(
      'success', false,
      'provisioned', false,
      'reason', 'user_not_member'
    );
  end if;

  -- Prefer the explicitly supplied team; otherwise locate the active
  -- Pick'em team already owned by this member.
  if p_fantasy_team_id is not null then
    select *
    into v_team
    from public.fantasy_teams ft
    where ft.id = p_fantasy_team_id
      and ft.league_id = p_league_id
      and ft.owner_id = p_user_id
      and coalesce(ft.active, true) = true
    limit 1;
  else
    select *
    into v_team
    from public.fantasy_teams ft
    where ft.league_id = p_league_id
      and ft.owner_id = p_user_id
      and coalesce(ft.active, true) = true
    order by ft.id
    limit 1;
  end if;

  if not found then
    return jsonb_build_object(
      'success', true,
      'provisioned', false,
      'reason', 'active_team_not_ready'
    );
  end if;

  v_entry_name :=
    coalesce(
      nullif(btrim(v_team.team_name), ''),
      'My G365 Pick''em Entry'
    );

  -- Make sure this unified league has a persistent NHL history identity.
  v_history_id :=
    public.ensure_nhl_pickem_history_identity(
      p_league_id
    );

  -- Reuse the franchise already attached to this fantasy team first.
  if v_team.nhl_pickem_franchise_id is not null then
    select f.id
    into v_franchise_id
    from public.nhl_pickem_franchises f
    where f.id = v_team.nhl_pickem_franchise_id
      and f.history_id = v_history_id
    limit 1;
  end if;

  -- If the team does not yet point at one, reuse an existing NHL franchise
  -- for this same owner/history before creating anything new.
  if v_franchise_id is null then
    select f.id
    into v_franchise_id
    from public.nhl_pickem_franchises f
    where f.history_id = v_history_id
      and f.owner_id = p_user_id
    order by
      f.active desc,
      f.created_at,
      f.id
    limit 1;
  end if;

  if v_franchise_id is null then
    insert into public.nhl_pickem_franchises (
      history_id,
      owner_id,
      display_name,
      active,
      created_at,
      updated_at
    )
    values (
      v_history_id,
      p_user_id,
      v_entry_name,
      true,
      now(),
      now()
    )
    returning id
    into v_franchise_id;
  else
    update public.nhl_pickem_franchises
    set
      owner_id = p_user_id,
      display_name = v_entry_name,
      active = true,
      updated_at = now()
    where id = v_franchise_id;
  end if;

  -- Attach NHL identity to the SAME existing G365 fantasy team.
  update public.fantasy_teams
  set
    nhl_pickem_franchise_id = v_franchise_id
  where id = v_team.id
    and nhl_pickem_franchise_id is distinct from v_franchise_id;

  -- One NHL entry per league/season/fantasy team is already enforced by
  -- the mature subsystem's unique constraint.
  insert into public.nhl_pickem_entries (
    league_id,
    fantasy_team_id,
    user_id,
    franchise_id,
    season,
    entry_name,
    active,
    created_at,
    updated_at
  )
  values (
    p_league_id,
    v_team.id,
    p_user_id,
    v_franchise_id,
    v_league.season,
    v_entry_name,
    true,
    now(),
    now()
  )
  on conflict (
    league_id,
    season,
    fantasy_team_id
  )
  do update
  set
    user_id = excluded.user_id,
    franchise_id = excluded.franchise_id,
    entry_name = excluded.entry_name,
    active = true,
    updated_at = now()
  returning id
  into v_entry_id;

  -- Guarantee a standings shell for the mature NHL engine.
  insert into public.nhl_pickem_standings (
    league_id,
    season,
    entry_id,
    fantasy_team_id,
    updated_at
  )
  values (
    p_league_id,
    v_league.season,
    v_entry_id,
    v_team.id,
    now()
  )
  on conflict (
    league_id,
    season,
    entry_id
  )
  do update
  set
    fantasy_team_id = excluded.fantasy_team_id,
    updated_at = now();

  return jsonb_build_object(
    'success', true,
    'provisioned', true,
    'leagueId', p_league_id,
    'season', v_league.season,
    'userId', p_user_id,
    'fantasyTeamId', v_team.id,
    'nhlFranchiseId', v_franchise_id,
    'nhlEntryId', v_entry_id
  );
end;
$$;


-- ============================================================
-- 2. FUTURE OWNER / INVITATION SAFETY
--
-- Invitation acceptance ultimately assigns owner_id on fantasy_teams.
-- Provisioning here means the route no longer has to know whether the
-- unified Pick'em league also has NHL enabled.
-- ============================================================

create or replace function private.g365_auto_initialize_unified_nhl_owner()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if new.owner_id is not null
     and (
       tg_op = 'INSERT'
       or old.owner_id is distinct from new.owner_id
     )
  then
    perform private.g365_ensure_unified_nhl_participant(
      new.league_id,
      new.owner_id,
      new.id
    );
  end if;

  return new;
end;
$$;

drop trigger if exists
  trg_g365_auto_initialize_unified_nhl_owner
on public.fantasy_teams;

create trigger
  trg_g365_auto_initialize_unified_nhl_owner
after insert or update of owner_id
on public.fantasy_teams
for each row
execute function private.g365_auto_initialize_unified_nhl_owner();


-- ============================================================
-- 3. WHEN NHL IS TURNED ON LATER, INITIALIZE EXISTING OWNERS
-- ============================================================

create or replace function private.g365_initialize_unified_nhl_after_settings()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  r record;
  v_now_enabled boolean := false;
  v_was_enabled boolean := false;
begin
  v_now_enabled :=
    coalesce(new.enabled_sports, array[]::text[])
      @> array['nhl']::text[];

  if tg_op = 'UPDATE' then
    v_was_enabled :=
      coalesce(old.enabled_sports, array[]::text[])
        @> array['nhl']::text[];
  end if;

  if v_now_enabled
     and (
       tg_op = 'INSERT'
       or not v_was_enabled
     )
  then
    -- The NHL settings row is normally created by save_pickem_settings_v5.
    -- If it has not been created yet, skip; the explicit backfill below or
    -- future owner assignment can safely retry.
    if exists (
      select 1
      from public.nhl_pickem_settings ns
      where ns.league_id = new.league_id
    ) then
      for r in
        select
          ft.id as fantasy_team_id,
          ft.owner_id
        from public.fantasy_teams ft
        where ft.league_id = new.league_id
          and ft.owner_id is not null
          and coalesce(ft.active, true) = true
      loop
        perform private.g365_ensure_unified_nhl_participant(
          new.league_id,
          r.owner_id,
          r.fantasy_team_id
        );
      end loop;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists
  trg_g365_initialize_unified_nhl_after_settings
on public.pickem_settings;

create trigger
  trg_g365_initialize_unified_nhl_after_settings
after insert or update of enabled_sports
on public.pickem_settings
for each row
execute function private.g365_initialize_unified_nhl_after_settings();


-- ============================================================
-- 4. ONE-TIME BACKFILL OF EVERY CURRENT MIXED PICK'EM MEMBER/TEAM
-- ============================================================

do $$
declare
  r record;
begin
  for r in
    select
      ft.league_id,
      ft.id as fantasy_team_id,
      ft.owner_id
    from public.fantasy_teams ft
    join public.leagues l
      on l.id = ft.league_id
    join public.pickem_settings ps
      on ps.league_id = ft.league_id
    join public.nhl_pickem_settings ns
      on ns.league_id = ft.league_id
    where l.league_type = 'pickem'
      and coalesce(ps.enabled_sports, array[]::text[])
            @> array['nhl']::text[]
      and ft.owner_id is not null
      and coalesce(ft.active, true) = true
  loop
    perform private.g365_ensure_unified_nhl_participant(
      r.league_id,
      r.owner_id,
      r.fantasy_team_id
    );
  end loop;
end
$$;


-- ============================================================
-- 5. PERMISSIONS
-- ============================================================

revoke all
on function private.g365_ensure_unified_nhl_participant(
  uuid,
  uuid,
  bigint
)
from public, anon, authenticated;

grant execute
on function private.g365_ensure_unified_nhl_participant(
  uuid,
  uuid,
  bigint
)
to service_role;

revoke all
on function private.g365_auto_initialize_unified_nhl_owner()
from public, anon, authenticated;

grant execute
on function private.g365_auto_initialize_unified_nhl_owner()
to service_role;

revoke all
on function private.g365_initialize_unified_nhl_after_settings()
from public, anon, authenticated;

grant execute
on function private.g365_initialize_unified_nhl_after_settings()
to service_role;


commit;


-- ============================================================
-- 6. VERIFICATION
-- ============================================================

select
  trigger_name,
  event_object_table
from information_schema.triggers
where trigger_schema = 'public'
  and trigger_name in (
    'trg_g365_auto_initialize_unified_nhl_owner',
    'trg_g365_initialize_unified_nhl_after_settings'
  )
order by trigger_name;


-- Every active owned fantasy team in an NHL-enabled unified Pick'em league
-- should now have exactly one matching NHL entry.
select
  ft.league_id,
  l.name as league_name,
  ft.id as fantasy_team_id,
  ft.team_name,
  ft.owner_id,
  ft.pickem_franchise_id,
  ft.nhl_pickem_franchise_id,
  e.id as nhl_entry_id,
  e.franchise_id as nhl_entry_franchise_id,
  case
    when e.id is not null
     and ft.nhl_pickem_franchise_id is not null
      then true
    else false
  end as nhl_participant_ready
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
order by l.name, ft.id;


-- Summary: missing_nhl_entries should be 0.
select
  count(*) filter (
    where e.id is null
       or ft.nhl_pickem_franchise_id is null
  )::integer as missing_nhl_entries,
  count(*)::integer as active_owned_pickem_teams
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
  and coalesce(ft.active, true) = true;