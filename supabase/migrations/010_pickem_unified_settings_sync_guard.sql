begin;

create or replace function private.g365_sync_unified_pickem_to_nhl_settings()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_league_type text;
  v_settings public.pickem_settings%rowtype;
begin
  select l.league_type
  into v_league_type
  from public.leagues l
  where l.id = new.league_id;

  if v_league_type <> 'pickem' then
    return new;
  end if;

  select *
  into v_settings
  from public.pickem_settings ps
  where ps.league_id = new.league_id;

  if not found then
    return new;
  end if;

  -- Only synchronize the NHL engine when NHL is enabled for this
  -- unified G365 Pick'em league.
  if not (
    coalesce(v_settings.enabled_sports, array[]::text[])
      @> array['nhl']::text[]
  ) then
    return new;
  end if;

  new.picks_per_period := v_settings.picks_per_week;

  -- NHL lock mode is game-based by design in the mature NHL engine.
  new.pick_lock_mode := 'game';

  new.minimum_source_books := v_settings.minimum_source_books;
  new.scoring_mode := v_settings.scoring_mode;
  new.win_points := v_settings.win_points;
  new.push_points := v_settings.push_points;
  new.loss_points := v_settings.loss_points;

  -- pickem_settings stores confidence values as jsonb while the NHL engine
  -- stores numeric[]. Convert the master values into the NHL representation.
  select coalesce(
    array_agg(x.value::numeric order by x.ordinality),
    array[]::numeric[]
  )
  into new.confidence_points
  from jsonb_array_elements_text(
    coalesce(v_settings.confidence_points, '[]'::jsonb)
  ) with ordinality as x(value, ordinality);

  new.confidence_push_multiplier :=
    v_settings.confidence_push_multiplier;

  new.missing_pick_policy :=
    case v_settings.missing_pick_policy
      when 'count_as_losses' then 'loss'
      when 'no_penalty' then 'ungraded'
      when 'disqualify_week' then 'ungraded'
      else 'ungraded'
    end;

  -- Preserve the mature NHL market semantics.
  if v_settings.hockey_market_mode in (
    'puck_line_only',
    'total_only',
    'puck_line_and_total'
  ) then
    new.market_mode := v_settings.hockey_market_mode;
  end if;

  -- Unified Pick'em currently treats the required pick total as one
  -- combined card; do not allow a second pick from the same NHL game.
  new.allow_same_game_multiple_markets := false;

  return new;
end;
$$;

drop trigger if exists
  trg_g365_sync_unified_pickem_to_nhl_settings
on public.nhl_pickem_settings;

create trigger
  trg_g365_sync_unified_pickem_to_nhl_settings
before insert or update
on public.nhl_pickem_settings
for each row
execute function private.g365_sync_unified_pickem_to_nhl_settings();

revoke all
on function private.g365_sync_unified_pickem_to_nhl_settings()
from public, anon, authenticated;

grant execute
on function private.g365_sync_unified_pickem_to_nhl_settings()
to service_role;

-- Bring currently-existing NHL settings rows into sync now.
update public.nhl_pickem_settings ns
set
  picks_per_period = ns.picks_per_period
from public.leagues l
join public.pickem_settings ps
  on ps.league_id = l.id
where ns.league_id = l.id
  and l.league_type = 'pickem'
  and coalesce(ps.enabled_sports, array[]::text[])
        @> array['nhl']::text[];

commit;

-- ============================================================
-- VERIFICATION
-- ============================================================

select
  ps.league_id,
  ps.enabled_sports,
  ps.picks_per_week,
  ps.pick_lock_mode,
  ps.scoring_mode,
  ps.missing_pick_policy,
  ps.pick_market_mode,
  ps.hockey_market_mode,
  ns.picks_per_period as nhl_picks_per_period,
  ns.pick_lock_mode as nhl_pick_lock_mode,
  ns.scoring_mode as nhl_scoring_mode,
  ns.missing_pick_policy as nhl_missing_pick_policy,
  ns.market_mode as nhl_market_mode,
  ns.allow_same_game_multiple_markets
from public.pickem_settings ps
left join public.nhl_pickem_settings ns
  on ns.league_id = ps.league_id
where ps.league_id =
  '4db2e702-2901-46bd-80dc-d7346a15ee55';
