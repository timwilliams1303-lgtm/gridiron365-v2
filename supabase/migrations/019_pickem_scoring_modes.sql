begin;

alter table public.pickem_settings
  add column if not exists scoring_mode text not null default 'record_only',
  add column if not exists confidence_points jsonb not null default '[50,40,30,20,10]'::jsonb,
  add column if not exists confidence_push_multiplier numeric(5,2) not null default 0.50;

alter table public.pickem_settings
  drop constraint if exists pickem_settings_scoring_mode_check;

alter table public.pickem_settings
  add constraint pickem_settings_scoring_mode_check
  check (scoring_mode in (
    'record_only',
    'standard',
    'three_one_zero',
    'custom',
    'confidence'
  ));

alter table public.pickem_settings
  drop constraint if exists pickem_settings_confidence_push_multiplier_check;

alter table public.pickem_settings
  add constraint pickem_settings_confidence_push_multiplier_check
  check (confidence_push_multiplier in (0, 0.5, 1));

create or replace function public.save_pickem_settings_v2(
  p_league_id uuid,
  p_football_scope text,
  p_picks_per_week integer,
  p_pick_lock_mode text,
  p_minimum_source_books integer,
  p_scoring_mode text,
  p_win_points numeric,
  p_push_points numeric,
  p_loss_points numeric,
  p_confidence_points numeric[],
  p_confidence_push_multiplier numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_season integer;
  v_confidence_json jsonb;
begin
  if v_user is null then
    raise exception using errcode = '42501', message = 'You must be signed in.';
  end if;

  if not exists (
    select 1
    from public.league_members lm
    where lm.league_id = p_league_id
      and lm.user_id = v_user
      and lm.role in ('commissioner','co_commissioner')
  ) then
    raise exception using errcode = '42501', message = 'Commissioner access is required.';
  end if;

  select season into v_season
  from public.leagues
  where id = p_league_id
    and league_type = 'pickem';

  if not found then
    raise exception 'Pick''em league could not be found.';
  end if;

  if p_football_scope not in ('college_nfl','college_only','nfl_only') then
    raise exception using errcode = '22023', message = 'Invalid football scope.';
  end if;

  if p_picks_per_week not between 1 and 20 then
    raise exception using errcode = '22023', message = 'Picks required per week must be between 1 and 20.';
  end if;

  if p_pick_lock_mode not in ('per_game','full_card') then
    raise exception using errcode = '22023', message = 'Invalid pick lock mode.';
  end if;

  if p_minimum_source_books not between 1 and 20 then
    raise exception using errcode = '22023', message = 'Minimum sportsbook sources must be between 1 and 20.';
  end if;

  if p_scoring_mode not in (
    'record_only','standard','three_one_zero','custom','confidence'
  ) then
    raise exception using errcode = '22023', message = 'Invalid Pick''em scoring mode.';
  end if;

  if p_win_points < 0 or p_push_points < 0 or p_loss_points < 0 then
    raise exception using errcode = '22023', message = 'Pick scoring values cannot be negative.';
  end if;

  if p_confidence_push_multiplier not in (0, 0.5, 1) then
    raise exception using errcode = '22023', message = 'Invalid confidence push credit.';
  end if;

  if p_scoring_mode = 'confidence' then
    if coalesce(array_length(p_confidence_points, 1), 0) <> p_picks_per_week then
      raise exception using errcode = '22023',
        message = 'Confidence scoring requires exactly one value per required pick.';
    end if;

    if exists (
      select 1
      from unnest(p_confidence_points) value
      group by value
      having count(*) > 1
    ) then
      raise exception using errcode = '22023',
        message = 'Confidence point values must be unique.';
    end if;
  end if;

  v_confidence_json :=
    coalesce(to_jsonb(p_confidence_points), '[]'::jsonb);

  insert into public.pickem_settings (
    league_id,
    season,
    football_scope,
    picks_per_week,
    pick_lock_mode,
    minimum_source_books,
    scoring_mode,
    win_points,
    push_points,
    loss_points,
    confidence_points,
    confidence_push_multiplier,
    updated_at
  ) values (
    p_league_id,
    v_season,
    p_football_scope,
    p_picks_per_week,
    p_pick_lock_mode,
    p_minimum_source_books,
    p_scoring_mode,
    p_win_points,
    p_push_points,
    p_loss_points,
    v_confidence_json,
    p_confidence_push_multiplier,
    now()
  )
  on conflict (league_id)
  do update set
    football_scope = excluded.football_scope,
    picks_per_week = excluded.picks_per_week,
    pick_lock_mode = excluded.pick_lock_mode,
    minimum_source_books = excluded.minimum_source_books,
    scoring_mode = excluded.scoring_mode,
    win_points = excluded.win_points,
    push_points = excluded.push_points,
    loss_points = excluded.loss_points,
    confidence_points = excluded.confidence_points,
    confidence_push_multiplier = excluded.confidence_push_multiplier,
    updated_at = now();

  return jsonb_build_object(
    'success', true,
    'leagueId', p_league_id,
    'scoringMode', p_scoring_mode
  );
end;
$$;

grant execute on function public.save_pickem_settings_v2(
  uuid,text,integer,text,integer,text,numeric,numeric,numeric,numeric[],numeric
) to authenticated;

commit;
