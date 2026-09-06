begin;

create or replace function public.remove_nfl_playoffs_entry_owner(
  p_league_id uuid,
  p_fantasy_team_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_league public.leagues%rowtype;
  v_team public.fantasy_teams%rowtype;
  v_target_role text;
  v_other_active_team_count integer := 0;
  v_cancelled_invites integer := 0;
begin
  if v_actor is null then
    raise exception using
      errcode = '42501',
      message = 'You must be signed in.';
  end if;

  select *
  into v_league
  from public.leagues
  where id = p_league_id
    and league_type::text = 'nfl_playoffs';

  if not found then
    raise exception using
      errcode = '22023',
      message = 'NFL Playoffs league could not be found.';
  end if;

  if v_actor <> v_league.commissioner_user_id
     and not exists (
       select 1
       from public.league_members lm
       where lm.league_id = p_league_id
         and lm.user_id = v_actor
         and lm.role in ('commissioner', 'co_commissioner')
     ) then
    raise exception using
      errcode = '42501',
      message = 'Commissioner access is required.';
  end if;

  select *
  into v_team
  from public.fantasy_teams ft
  where ft.id = p_fantasy_team_id
    and ft.league_id = p_league_id
    and coalesce(ft.active, true) = true
  for update;

  if not found then
    raise exception using
      errcode = '22023',
      message = 'NFL Playoffs entry could not be found.';
  end if;

  if v_team.owner_id is null then
    update public.league_invitations
    set
      status = 'cancelled',
      updated_at = now()
    where league_id = p_league_id
      and fantasy_team_id = p_fantasy_team_id
      and status = 'pending';

    get diagnostics
      v_cancelled_invites = row_count;

    return jsonb_build_object(
      'success', true,
      'removed', false,
      'reason', 'already_vacant',
      'fantasyTeamId', p_fantasy_team_id,
      'cancelledInvitations', v_cancelled_invites,
      'historyPreserved', true
    );
  end if;

  if v_team.owner_id = v_league.commissioner_user_id then
    raise exception using
      errcode = '22023',
      message = 'The primary commissioner cannot be removed before commissioner ownership is transferred.';
  end if;

  select lm.role
  into v_target_role
  from public.league_members lm
  where lm.league_id = p_league_id
    and lm.user_id = v_team.owner_id
  limit 1;

  /*
   * Preserve the fantasy_teams row itself.
   *
   * NFL Playoffs lineups, round scores, standings, recap/trophy records,
   * and historical postseason results remain attached to this same
   * fantasy_team_id. A replacement invitation can therefore reserve
   * and claim this exact entry without creating duplicate history.
   */
  update public.fantasy_teams
  set
    owner_id = null,
    is_cpu = false,
    active = true,
    updated_at = now()
  where id = p_fantasy_team_id
    and league_id = p_league_id
    and owner_id = v_team.owner_id;

  if not found then
    raise exception using
      errcode = '40001',
      message = 'The entry owner changed before the removal could be completed.';
  end if;

  update public.league_invitations
  set
    status = 'cancelled',
    updated_at = now()
  where league_id = p_league_id
    and fantasy_team_id = p_fantasy_team_id
    and status = 'pending';

  get diagnostics
    v_cancelled_invites = row_count;

  /*
   * Only remove league membership when this former owner does not still
   * own another active team in the same league. This keeps the function
   * safe if multiple entries are ever supported or legacy data contains
   * more than one owned team.
   */
  select count(*)
  into v_other_active_team_count
  from public.fantasy_teams ft
  where ft.league_id = p_league_id
    and ft.owner_id = v_team.owner_id
    and coalesce(ft.active, true) = true
    and ft.id <> p_fantasy_team_id;

  if v_other_active_team_count = 0 then
    delete from public.league_members lm
    where lm.league_id = p_league_id
      and lm.user_id = v_team.owner_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'removed', true,
    'fantasyTeamId', p_fantasy_team_id,
    'formerOwnerId', v_team.owner_id,
    'formerRole', v_target_role,
    'membershipRemoved', (v_other_active_team_count = 0),
    'cancelledInvitations', v_cancelled_invites,
    'historyPreserved', true
  );
end;
$$;

revoke all
on function public.remove_nfl_playoffs_entry_owner(uuid, bigint)
from public;

grant execute
on function public.remove_nfl_playoffs_entry_owner(uuid, bigint)
to authenticated;

commit;