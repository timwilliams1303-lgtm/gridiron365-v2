begin;

-- Live football situation copied from ESPN's scoreboard situation.
alter table public.pickem_games
  add column if not exists possession_team_espn_id text,
  add column if not exists possession_team_abbreviation text,
  add column if not exists down integer,
  add column if not exists distance integer,
  add column if not exists yard_line integer,
  add column if not exists yards_to_endzone integer,
  add column if not exists down_distance_text text,
  add column if not exists possession_text text,
  add column if not exists is_red_zone boolean,
  add column if not exists last_play_text text;

-- Privacy-safe League Picks RPC with scoring + live situation.
-- A new v2 function avoids changing the return type of the existing RPC.
create or replace function public.get_pickem_league_picks_v2(
  p_league_id uuid,
  p_season integer,
  p_week integer
)
returns table (
  fantasy_team_id bigint,
  team_name text,
  pick_id bigint,
  game_id bigint,
  sport text,
  kickoff_at timestamptz,
  away_team_name text,
  home_team_name text,
  away_score integer,
  home_score integer,
  status_type text,
  status_name text,
  status_detail text,
  period integer,
  display_clock text,
  is_final boolean,
  pick_visible boolean,
  selected_side text,
  frozen_home_spread numeric,
  confidence_value numeric,
  pick_result text,
  points_awarded numeric,
  possession_team_abbreviation text,
  down integer,
  distance integer,
  yard_line integer,
  yards_to_endzone integer,
  down_distance_text text,
  possession_text text,
  is_red_zone boolean,
  last_play_text text
)
language sql
stable
security definer
set search_path = public, auth
as $$
  with me as (
    select auth.uid() as user_id
  ),
  rows as (
    select
      ft.id as fantasy_team_id,
      ft.team_name,
      ft.owner_id,
      p.id as pick_id,
      g.id as game_id,
      g.sport,
      g.kickoff_at,
      g.away_team_name,
      g.home_team_name,
      g.away_score,
      g.home_score,
      g.status_type,
      g.status_name,
      g.status_detail,
      g.period,
      g.display_clock,
      g.is_final,
      p.selected_side,
      p.frozen_home_spread,
      p.confidence_value,
      p.result as pick_result,
      p.points_awarded,
      g.possession_team_abbreviation,
      g.down,
      g.distance,
      g.yard_line,
      g.yards_to_endzone,
      g.down_distance_text,
      g.possession_text,
      g.is_red_zone,
      g.last_play_text,
      (
        ft.owner_id = me.user_id
        or now() >= g.kickoff_at
        or g.is_started
        or g.is_final
      ) as visible
    from public.fantasy_teams ft
    cross join me
    join public.league_members lm
      on lm.league_id = p_league_id
     and lm.user_id = me.user_id
    left join public.pickem_weeks w
      on w.league_id = p_league_id
     and w.season = p_season
     and w.week = p_week
    left join public.pickem_picks p
      on p.pickem_week_id = w.id
     and p.fantasy_team_id = ft.id
     and p.result <> 'void'
    left join public.pickem_games g
      on g.id = p.pickem_game_id
    where ft.league_id = p_league_id
      and coalesce(ft.active,true) = true
  )
  select
    fantasy_team_id,
    team_name,
    pick_id,
    case when visible then game_id else null end,
    case when visible then sport else null end,
    case when visible then kickoff_at else null end,
    case when visible then away_team_name else null end,
    case when visible then home_team_name else null end,
    case when visible then away_score else null end,
    case when visible then home_score else null end,
    case when visible then status_type else null end,
    case when visible then status_name else null end,
    case when visible then status_detail else null end,
    case when visible then period else null end,
    case when visible then display_clock else null end,
    case when visible then is_final else false end,
    coalesce(visible,false),
    case when visible then selected_side else null end,
    case when visible then frozen_home_spread else null end,
    case when visible then confidence_value else null end,
    case when visible then pick_result else null end,
    case when visible then points_awarded else null end,
    case when visible then possession_team_abbreviation else null end,
    case when visible then down else null end,
    case when visible then distance else null end,
    case when visible then yard_line else null end,
    case when visible then yards_to_endzone else null end,
    case when visible then down_distance_text else null end,
    case when visible then possession_text else null end,
    case when visible then is_red_zone else null end,
    case when visible then last_play_text else null end
  from rows
  order by team_name, kickoff_at nulls last, pick_id nulls last;
$$;

grant execute on function public.get_pickem_league_picks_v2(
  uuid, integer, integer
) to authenticated;

commit;