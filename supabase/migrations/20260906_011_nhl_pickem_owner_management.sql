-- ============================================================================
-- Gridiron365
-- NHL Pick'em commissioner owner management
--
-- Removing an owner:
--   - DOES NOT delete the fantasy team
--   - DOES NOT delete the NHL franchise
--   - DOES NOT delete historical picks
--   - DOES NOT delete standings/history/trophies
--   - clears ownership so a replacement may be invited
--   - removes the former owner's league membership when they no longer own
--     another active team in the same league
-- ============================================================================

create or replace function public.commissioner_remove_nhl_pickem_owner(
  p_league_id uuid,
  p_fantasy_team_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $function$
declare
  v_actor uuid := auth.uid();

  v_league public.leagues%rowtype;

  v_actor_role text;

  v_target_owner uuid;

  v_team_name text;

  v_franchise_id uuid;

  v_entry_id bigint;

  v_keep_membership boolean := false;
begin
  ---------------------------------------------------------------------------
  -- Authentication
  ---------------------------------------------------------------------------

  if v_actor is null then
    raise exception
      'You must be signed in.';
  end if;


  ---------------------------------------------------------------------------
  -- League
  ---------------------------------------------------------------------------

  select l.*
  into v_league
  from public.leagues l
  where l.id = p_league_id
    and l.league_type::text = 'nhl_pickem'
  limit 1;

  if not found then
    raise exception
      'NHL Pick''em league could not be found.';
  end if;


  ---------------------------------------------------------------------------
  -- Commissioner access
  ---------------------------------------------------------------------------

  select lm.role
  into v_actor_role
  from public.league_members lm
  where lm.league_id = p_league_id
    and lm.user_id = v_actor
  limit 1;

  if
    v_actor <> v_league.commissioner_user_id
    and coalesce(v_actor_role, '') not in (
      'commissioner',
      'co_commissioner'
    )
  then
    raise exception
      'Commissioner access is required.';
  end if;


  ---------------------------------------------------------------------------
  -- Lock and validate target fantasy team
  ---------------------------------------------------------------------------

  select
    ft.owner_id,
    ft.team_name,
    ft.nhl_pickem_franchise_id
  into
    v_target_owner,
    v_team_name,
    v_franchise_id
  from public.fantasy_teams ft
  where ft.id = p_fantasy_team_id
    and ft.league_id = p_league_id
    and ft.active = true
    and coalesce(ft.is_cpu, false) = false
  for update;

  if not found then
    raise exception
      'The NHL Pick''em team could not be found.';
  end if;

  if v_target_owner is null then
    raise exception
      'This NHL Pick''em team does not currently have an owner.';
  end if;


  ---------------------------------------------------------------------------
  -- Primary commissioner may not remove themselves
  ---------------------------------------------------------------------------

  if
    v_target_owner =
      v_league.commissioner_user_id
  then
    raise exception
      'The primary commissioner cannot be removed from their own league.';
  end if;


  ---------------------------------------------------------------------------
  -- Locate current NHL entry
  ---------------------------------------------------------------------------

  select e.id
  into v_entry_id
  from public.nhl_pickem_entries e
  where e.league_id = p_league_id
    and e.season = v_league.season
    and e.fantasy_team_id =
      p_fantasy_team_id
  limit 1;


  ---------------------------------------------------------------------------
  -- Cancel any stale pending invitations that reserve this team.
  --
  -- A future replacement invitation will receive a fresh token.
  ---------------------------------------------------------------------------

  update public.league_invitations
  set
    status = 'cancelled',
    updated_at = now()
  where league_id = p_league_id
    and fantasy_team_id =
      p_fantasy_team_id
    and status = 'pending';


  ---------------------------------------------------------------------------
  -- Preserve team; detach owner
  ---------------------------------------------------------------------------

  update public.fantasy_teams
  set
    owner_id = null,
    is_cpu = false,
    active = true,
    updated_at = now()
  where id = p_fantasy_team_id
    and league_id = p_league_id
    and owner_id = v_target_owner;

  if not found then
    raise exception
      'The team owner changed before removal could be completed.';
  end if;


  ---------------------------------------------------------------------------
  -- Preserve NHL entry/history; detach current owner identity
  ---------------------------------------------------------------------------

  update public.nhl_pickem_entries
  set
    user_id = null,
    active = true,
    updated_at = now()
  where league_id = p_league_id
    and fantasy_team_id =
      p_fantasy_team_id
    and user_id = v_target_owner;


  ---------------------------------------------------------------------------
  -- Preserve franchise/trophies/history; detach current owner
  ---------------------------------------------------------------------------

  if v_franchise_id is not null then
    update public.nhl_pickem_franchises
    set
      owner_id = null,
      active = true,
      updated_at = now()
    where id = v_franchise_id
      and owner_id = v_target_owner;
  end if;


  ---------------------------------------------------------------------------
  -- If somehow this owner still owns another active team in this same league,
  -- preserve league membership. Otherwise remove membership.
  ---------------------------------------------------------------------------

  select exists (
    select 1
    from public.fantasy_teams ft
    where ft.league_id = p_league_id
      and ft.owner_id = v_target_owner
      and ft.active = true
      and coalesce(
        ft.is_cpu,
        false
      ) = false
  )
  into v_keep_membership;

  if not v_keep_membership then
    delete from public.league_members lm
    where lm.league_id = p_league_id
      and lm.user_id = v_target_owner;
  end if;


  ---------------------------------------------------------------------------
  -- Result
  ---------------------------------------------------------------------------

  return jsonb_build_object(
    'success',
    true,

    'leagueId',
    p_league_id,

    'season',
    v_league.season,

    'fantasyTeamId',
    p_fantasy_team_id,

    'entryId',
    v_entry_id,

    'franchiseId',
    v_franchise_id,

    'teamName',
    v_team_name,

    'removedUserId',
    v_target_owner,

    'membershipRemoved',
    not v_keep_membership,

    'historyPreserved',
    true
  );
end;
$function$;


revoke all
on function public.commissioner_remove_nhl_pickem_owner(
  uuid,
  bigint
)
from public;


grant execute
on function public.commissioner_remove_nhl_pickem_owner(
  uuid,
  bigint
)
to authenticated;