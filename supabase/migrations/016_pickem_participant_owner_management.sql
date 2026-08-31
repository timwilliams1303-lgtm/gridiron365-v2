begin;

create or replace function public.remove_pickem_entry_owner(
  p_league_id uuid,
  p_fantasy_team_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_league public.leagues%rowtype;
  v_team public.fantasy_teams%rowtype;
  v_target_role text;
begin
  if v_user is null then
    raise exception using errcode = '42501',
      message = 'You must be signed in.';
  end if;

  select *
  into v_league
  from public.leagues
  where id = p_league_id
    and league_type = 'pickem';

  if not found then
    raise exception 'Pick''em league could not be found.';
  end if;

  if not exists (
    select 1
    from public.league_members lm
    where lm.league_id = p_league_id
      and lm.user_id = v_user
      and lm.role in ('commissioner','co_commissioner')
  ) then
    raise exception using errcode = '42501',
      message = 'Commissioner access is required.';
  end if;

  select *
  into v_team
  from public.fantasy_teams
  where id = p_fantasy_team_id
    and league_id = p_league_id
  for update;

  if not found then
    raise exception 'Pick''em entry could not be found.';
  end if;

  if v_team.owner_id is null then
    return jsonb_build_object(
      'success', true,
      'removed', false,
      'reason', 'already_vacant',
      'fantasyTeamId', v_team.id
    );
  end if;

  if v_team.owner_id = v_league.commissioner_user_id then
    raise exception using errcode = '22023',
      message = 'The primary commissioner cannot be removed before commissioner ownership is transferred.';
  end if;

  select lm.role
  into v_target_role
  from public.league_members lm
  where lm.league_id = p_league_id
    and lm.user_id = v_team.owner_id
  limit 1;

  update public.fantasy_teams
  set owner_id = null,
      updated_at = now()
  where id = v_team.id;

  delete from public.league_members
  where league_id = p_league_id
    and user_id = v_team.owner_id;

  update public.league_invitations
  set status = 'cancelled',
      updated_at = now()
  where league_id = p_league_id
    and fantasy_team_id = v_team.id
    and status = 'pending';

  return jsonb_build_object(
    'success', true,
    'removed', true,
    'fantasyTeamId', v_team.id,
    'formerOwnerId', v_team.owner_id,
    'formerRole', v_target_role,
    'historyPreserved', true
  );
end;
$$;

revoke all on function public.remove_pickem_entry_owner(uuid,bigint) from public;
grant execute on function public.remove_pickem_entry_owner(uuid,bigint) to authenticated;

commit;
