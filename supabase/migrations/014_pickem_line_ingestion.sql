begin;

create or replace function public.add_pickem_line_source(
  p_pickem_game_id bigint,
  p_source_provider text,
  p_sportsbook_key text,
  p_sportsbook_name text,
  p_home_spread numeric,
  p_away_spread numeric default null,
  p_source_event_id text default null,
  p_source_market_key text default null,
  p_raw_audit jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_game public.pickem_games%rowtype;
  v_line_id bigint;
  v_provider text := trim(coalesce(p_source_provider, ''));
  v_book_key text := trim(coalesce(p_sportsbook_key, ''));
begin
  if v_user is null then
    raise exception using errcode = '42501',
      message = 'You must be signed in to add a Pick''em source line.';
  end if;

  select *
  into v_game
  from public.pickem_games
  where id = p_pickem_game_id
  for update;

  if not found then
    raise exception 'Pick''em game could not be found.';
  end if;

  if not exists (
    select 1
    from public.league_members lm
    where lm.league_id = v_game.league_id
      and lm.user_id = v_user
      and lm.role in ('commissioner','co_commissioner')
  ) then
    raise exception using errcode = '42501',
      message = 'Commissioner access is required.';
  end if;

  if v_game.spread_status = 'frozen' then
    raise exception using errcode = '22023',
      message = 'The G365 Spread is already frozen for this game.';
  end if;

  if now() >= v_game.kickoff_at or v_game.is_started or v_game.is_final then
    raise exception using errcode = '22023',
      message = 'Source lines cannot be added after kickoff.';
  end if;

  if length(v_provider) < 1 or length(v_provider) > 80 then
    raise exception using errcode = '22023',
      message = 'Source provider is required and must be 80 characters or fewer.';
  end if;

  if length(v_book_key) < 1 or length(v_book_key) > 100 then
    raise exception using errcode = '22023',
      message = 'Sportsbook key is required and must be 100 characters or fewer.';
  end if;

  if p_home_spread is null
     or p_home_spread < -100
     or p_home_spread > 100 then
    raise exception using errcode = '22023',
      message = 'A valid home-team spread between -100 and 100 is required.';
  end if;

  insert into public.pickem_line_sources (
    pickem_game_id,
    captured_at,
    source_provider,
    sportsbook_key,
    sportsbook_name,
    home_spread,
    away_spread,
    source_event_id,
    source_market_key,
    raw_audit
  )
  values (
    p_pickem_game_id,
    now(),
    v_provider,
    v_book_key,
    nullif(trim(coalesce(p_sportsbook_name, '')), ''),
    p_home_spread,
    p_away_spread,
    nullif(trim(coalesce(p_source_event_id, '')), ''),
    nullif(trim(coalesce(p_source_market_key, '')), ''),
    p_raw_audit
  )
  returning id into v_line_id;

  update public.pickem_games
  set spread_status = case
        when spread_status = 'excluded' then 'pending'
        else spread_status
      end,
      is_eligible = true,
      exclusion_reason = null,
      updated_at = now()
  where id = p_pickem_game_id;

  return jsonb_build_object(
    'success', true,
    'lineSourceId', v_line_id,
    'gameId', p_pickem_game_id,
    'sportsbookKey', v_book_key,
    'homeSpread', p_home_spread
  );
end;
$$;

revoke all on function public.add_pickem_line_source(
  bigint,text,text,text,numeric,numeric,text,text,jsonb
) from public;

grant execute on function public.add_pickem_line_source(
  bigint,text,text,text,numeric,numeric,text,text,jsonb
) to authenticated;

commit;
