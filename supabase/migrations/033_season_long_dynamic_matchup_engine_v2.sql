begin;

-- --------------------------------------------------------------------------
-- 1. Add auditable dynamic-personnel fields.
-- --------------------------------------------------------------------------

alter table public.season_long_matchup_rankings
  add column if not exists base_weighted_points_allowed numeric(12,4),
  add column if not exists personnel_adjustment numeric(8,4) not null default 0.0000,
  add column if not exists adjusted_points_allowed numeric(12,4),
  add column if not exists personnel_injury_count integer not null default 0,
  add column if not exists personnel_details jsonb not null default '{}'::jsonb;

comment on column public.season_long_matchup_rankings.base_weighted_points_allowed is
  'Statistical fantasy-points-allowed value before current personnel/injury adjustment.';

comment on column public.season_long_matchup_rankings.personnel_adjustment is
  'Capped proportional matchup adjustment from current injuries and estimated player importance. Positive values make the matchup more favorable for the fantasy position.';

comment on column public.season_long_matchup_rankings.adjusted_points_allowed is
  'Fantasy-points-allowed value after current personnel/injury adjustment; used for final 1-32 ranking.';

comment on column public.season_long_matchup_rankings.personnel_injury_count is
  'Number of current injury rows that materially contributed to the personnel adjustment.';

comment on column public.season_long_matchup_rankings.personnel_details is
  'Audit JSON describing current personnel adjustment inputs and weighting.';


-- --------------------------------------------------------------------------
-- 2. Replace matchup refresh with Dynamic Matchup Engine V2.
-- --------------------------------------------------------------------------

create or replace function public.refresh_season_long_matchup_rankings(
  p_league_id uuid,
  p_season integer,
  p_week integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_league_type text;
  v_rows integer := 0;
  v_ranked integer := 0;
begin
  if p_week not between 1 and 18 then
    raise exception 'Week must be between 1 and 18.';
  end if;

  select l.league_type
  into v_league_type
  from public.leagues l
  where l.id = p_league_id;

  if not found then
    raise exception 'League could not be found.';
  end if;

  if v_league_type <> 'season_long' then
    raise exception 'This is not a Season-Long league.';
  end if;

  insert into public.league_scoring_settings (league_id)
  values (p_league_id)
  on conflict (league_id) do nothing;

  delete from public.season_long_matchup_rankings
  where league_id = p_league_id
    and season = p_season
    and week = p_week;

  with
  positions(position) as (
    values
      ('QB'::text),
      ('RB'::text),
      ('WR'::text),
      ('TE'::text),
      ('K'::text),
      ('DST'::text)
  ),

  season_teams as (
    select distinct upper(nt.abbreviation) as abbreviation
    from public.nfl_games g
    join public.nfl_teams nt
      on nt.id = g.home_team_id
      or nt.id = g.away_team_id
    where g.season = p_season
      and g.season_type = 2
      and nt.abbreviation is not null
  ),

  -- ------------------------------------------------------------------------
  -- Historical fantasy points allowed by position.
  -- ------------------------------------------------------------------------

  eligible_game_rows as (
    select
      s.id as player_game_stat_id,
      s.nfl_game_id,
      s.season as stat_season,
      s.week as stat_week,

      case
        when upper(coalesce(p.primary_position,'')) = 'PK' then 'K'
        when upper(coalesce(p.primary_position,'')) in ('DEF','D/ST') then 'DST'
        else upper(coalesce(p.primary_position,''))
      end as position,

      upper(
        case
          when upper(coalesce(s.team_abbreviation,'')) =
               upper(coalesce(ht.abbreviation,''))
          then at.abbreviation
          else ht.abbreviation
        end
      ) as opponent_abbreviation,

      public.calculate_fantasy_points(
        p_league_id,
        s.id
      )::numeric as fantasy_points,

      case
        when s.season = p_season then 1.00::numeric
        else 0.25::numeric
      end as season_weight

    from public.nfl_player_game_stats s
    join public.nfl_players p
      on p.id = s.nfl_player_id
    join public.nfl_games g
      on g.id = s.nfl_game_id
    join public.nfl_teams ht
      on ht.id = g.home_team_id
    join public.nfl_teams at
      on at.id = g.away_team_id

    where s.season_type = 2
      and s.is_final = true
      and (
        (
          s.season = p_season
          and s.week < p_week
        )
        or s.season = p_season - 1
      )
      and (
        case
          when upper(coalesce(p.primary_position,'')) = 'PK' then 'K'
          when upper(coalesce(p.primary_position,'')) in ('DEF','D/ST') then 'DST'
          else upper(coalesce(p.primary_position,''))
        end
      ) in ('QB','RB','WR','TE','K','DST')
  ),

  position_game_totals as (
    select
      e.nfl_game_id,
      e.stat_season,
      e.stat_week,
      e.position,
      e.opponent_abbreviation,
      sum(e.fantasy_points) as position_points,
      max(e.season_weight) as season_weight
    from eligible_game_rows e
    where e.opponent_abbreviation is not null
    group by
      e.nfl_game_id,
      e.stat_season,
      e.stat_week,
      e.position,
      e.opponent_abbreviation
  ),

  ranked_history as (
    select
      pgt.*,
      row_number() over (
        partition by
          pgt.position,
          pgt.opponent_abbreviation
        order by
          pgt.stat_season desc,
          pgt.stat_week desc,
          pgt.nfl_game_id desc
      ) as recency_rank
    from position_game_totals pgt
  ),

  team_position_history as (
    select
      rh.position,
      rh.opponent_abbreviation,
      count(*)::integer as games_sampled,

      count(*) filter (
        where rh.stat_season = p_season
      )::integer as current_season_games,

      count(*) filter (
        where rh.stat_season = p_season - 1
      )::integer as prior_season_games,

      case
        when sum(rh.season_weight) > 0
        then
          sum(rh.position_points * rh.season_weight)
          / sum(rh.season_weight)
        else null
      end as season_average_allowed,

      avg(rh.position_points) filter (
        where rh.stat_season = p_season
          and rh.recency_rank <= 3
      ) as recent_average_allowed

    from ranked_history rh
    group by
      rh.position,
      rh.opponent_abbreviation
  ),

  -- ------------------------------------------------------------------------
  -- Current injury severity.
  --
  -- 1.00 = unavailable
  -- 0.75 = doubtful
  -- 0.35 = questionable
  -- Other designations do not move the matchup board.
  -- ------------------------------------------------------------------------

  current_injuries as (
    select
      i.nfl_player_id,
      upper(coalesce(i.team_abbreviation,'')) as team_abbreviation,
      upper(coalesce(i.primary_position,'')) as primary_position,
      i.status,
      case
        when upper(coalesce(i.status,'')) in (
          'OUT',
          'O',
          'IR',
          'INJURED RESERVE',
          'RESERVE/INJURED',
          'PUP',
          'PHYSICALLY UNABLE TO PERFORM',
          'NFI',
          'SUSPENDED',
          'SUSP',
          'INACTIVE'
        )
        or upper(coalesce(i.status,'')) like '%OUT%'
        or upper(coalesce(i.status,'')) like '%INJURED RESERVE%'
        or upper(coalesce(i.status,'')) like '%SUSPEND%'
        then 1.00::numeric

        when upper(coalesce(i.status,'')) in ('DOUBTFUL','D')
          or upper(coalesce(i.status,'')) like '%DOUBT%'
        then 0.75::numeric

        when upper(coalesce(i.status,'')) in ('QUESTIONABLE','Q')
          or upper(coalesce(i.status,'')) like '%QUESTION%'
        then 0.35::numeric

        else 0.00::numeric
      end as severity
    from public.current_nfl_player_injuries i
    where i.season = p_season
      and i.nfl_player_id is not null
      and coalesce(i.team_abbreviation,'') <> ''
  ),

  -- ------------------------------------------------------------------------
  -- Recent defensive importance.
  --
  -- No snap counts are stored, so use actual recent defensive production:
  -- tackles + TFL + sacks + interceptions. The score is normalized within
  -- each NFL team so a productive starter matters more than a depth player.
  -- ------------------------------------------------------------------------

  recent_defensive_games as (
    select
      s.nfl_player_id,
      upper(coalesce(s.team_abbreviation,'')) as team_abbreviation,
      s.nfl_game_id,
      s.week,
      (
        coalesce(s.defensive_total_tackles,0)::numeric
        + 1.50 * coalesce(s.defensive_tackles_for_loss,0)::numeric
        + 2.00 * coalesce(s.dst_sacks,0)::numeric
        + 2.50 * coalesce(s.dst_interceptions,0)::numeric
      ) as production_score,

      row_number() over (
        partition by s.nfl_player_id
        order by s.week desc, s.nfl_game_id desc
      ) as player_game_recency

    from public.nfl_player_game_stats s
    join public.nfl_players p
      on p.id = s.nfl_player_id

    where s.season = p_season
      and s.season_type = 2
      and s.is_final = true
      and s.week < p_week
      and upper(coalesce(p.primary_position,'')) in (
        'CB','DB','S','FS','SS',
        'LB','ILB','OLB','MLB',
        'DE','DL','DT','NT','EDGE'
      )
  ),

  defensive_player_importance_raw as (
    select
      r.nfl_player_id,
      r.team_abbreviation,
      avg(r.production_score) filter (
        where r.player_game_recency <= 3
      ) as recent_production
    from recent_defensive_games r
    group by
      r.nfl_player_id,
      r.team_abbreviation
  ),

  defensive_player_importance as (
    select
      d.*,
      case
        when max(d.recent_production) over (
          partition by d.team_abbreviation
        ) > 0
        then least(
          1.00::numeric,
          greatest(
            0.20::numeric,
            d.recent_production /
            max(d.recent_production) over (
              partition by d.team_abbreviation
            )
          )
        )
        else 0.35::numeric
      end as importance
    from defensive_player_importance_raw d
  ),

  -- ------------------------------------------------------------------------
  -- Current offensive importance for DST matchup adjustments.
  --
  -- QB = attempts
  -- RB = rush attempts + receiving targets
  -- WR/TE = receiving targets + receptions
  -- K = field goal + XP attempts
  -- ------------------------------------------------------------------------

  recent_offensive_games as (
    select
      s.nfl_player_id,
      upper(coalesce(s.team_abbreviation,'')) as team_abbreviation,
      case
        when upper(coalesce(p.primary_position,'')) = 'PK' then 'K'
        else upper(coalesce(p.primary_position,''))
      end as position,
      s.nfl_game_id,
      s.week,

      case
        when upper(coalesce(p.primary_position,'')) = 'QB'
        then
          coalesce(s.passing_attempts,0)::numeric
          + 0.35 * coalesce(s.rushing_attempts,0)::numeric

        when upper(coalesce(p.primary_position,'')) = 'RB'
        then
          coalesce(s.rushing_attempts,0)::numeric
          + 0.75 * coalesce(s.receiving_targets,0)::numeric

        when upper(coalesce(p.primary_position,'')) in ('WR','TE')
        then
          coalesce(s.receiving_targets,0)::numeric
          + 0.35 * coalesce(s.receptions,0)::numeric

        when upper(coalesce(p.primary_position,'')) in ('K','PK')
        then
          coalesce(s.field_goals_attempted,0)::numeric
          + 0.50 * coalesce(s.extra_points_attempted,0)::numeric

        else 0::numeric
      end as usage_score,

      row_number() over (
        partition by s.nfl_player_id
        order by s.week desc, s.nfl_game_id desc
      ) as player_game_recency

    from public.nfl_player_game_stats s
    join public.nfl_players p
      on p.id = s.nfl_player_id

    where s.season = p_season
      and s.season_type = 2
      and s.is_final = true
      and s.week < p_week
      and upper(coalesce(p.primary_position,'')) in (
        'QB','RB','WR','TE','K','PK'
      )
  ),

  offensive_player_importance_raw as (
    select
      r.nfl_player_id,
      r.team_abbreviation,
      r.position,
      avg(r.usage_score) filter (
        where r.player_game_recency <= 3
      ) as recent_usage
    from recent_offensive_games r
    group by
      r.nfl_player_id,
      r.team_abbreviation,
      r.position
  ),

  offensive_player_importance as (
    select
      o.*,
      case
        when max(o.recent_usage) over (
          partition by o.team_abbreviation, o.position
        ) > 0
        then least(
          1.00::numeric,
          greatest(
            0.20::numeric,
            o.recent_usage /
            max(o.recent_usage) over (
              partition by o.team_abbreviation, o.position
            )
          )
        )
        else 0.35::numeric
      end as importance
    from offensive_player_importance_raw o
  ),

  -- ------------------------------------------------------------------------
  -- Defensive injury impact on QB/RB/WR/TE/K.
  --
  -- Each current injury receives:
  -- severity x estimated importance x position-specific influence.
  -- The final team/position adjustment is capped at +10%.
  -- ------------------------------------------------------------------------

  defensive_injury_impacts as (
    select
      ci.team_abbreviation,
      target.position,
      ci.nfl_player_id,
      ci.primary_position as injured_position,
      ci.status,
      ci.severity,
      coalesce(dpi.importance,0.35::numeric) as importance,

      (
        ci.severity
        * coalesce(dpi.importance,0.35::numeric)
        * target.influence
      ) as raw_impact

    from current_injuries ci

    left join defensive_player_importance dpi
      on dpi.nfl_player_id = ci.nfl_player_id
     and dpi.team_abbreviation = ci.team_abbreviation

    cross join lateral (
      select *
      from (
        values
          (
            'QB'::text,
            case
              when ci.primary_position in ('CB','DB','S','FS','SS') then 0.035::numeric
              when ci.primary_position in ('LB','ILB','OLB','MLB') then 0.015::numeric
              when ci.primary_position in ('DE','DL','DT','NT','EDGE') then 0.025::numeric
              else 0.000::numeric
            end
          ),
          (
            'RB'::text,
            case
              when ci.primary_position in ('CB','DB','S','FS','SS') then 0.008::numeric
              when ci.primary_position in ('LB','ILB','OLB','MLB') then 0.035::numeric
              when ci.primary_position in ('DE','DL','DT','NT','EDGE') then 0.030::numeric
              else 0.000::numeric
            end
          ),
          (
            'WR'::text,
            case
              when ci.primary_position in ('CB','DB','S','FS','SS') then 0.045::numeric
              when ci.primary_position in ('LB','ILB','OLB','MLB') then 0.008::numeric
              when ci.primary_position in ('DE','DL','DT','NT','EDGE') then 0.010::numeric
              else 0.000::numeric
            end
          ),
          (
            'TE'::text,
            case
              when ci.primary_position in ('CB','DB','S','FS','SS') then 0.018::numeric
              when ci.primary_position in ('LB','ILB','OLB','MLB') then 0.040::numeric
              when ci.primary_position in ('DE','DL','DT','NT','EDGE') then 0.008::numeric
              else 0.000::numeric
            end
          ),
          (
            'K'::text,
            case
              when ci.primary_position in (
                'CB','DB','S','FS','SS',
                'LB','ILB','OLB','MLB',
                'DE','DL','DT','NT','EDGE'
              ) then 0.006::numeric
              else 0.000::numeric
            end
          )
      ) as v(position,influence)
    ) target

    where ci.severity > 0
      and target.influence > 0
  ),

  defensive_team_adjustments as (
    select
      d.team_abbreviation,
      d.position,

      least(
        0.1000::numeric,
        sum(d.raw_impact)
      ) as personnel_adjustment,

      count(*)::integer as injury_count,

      jsonb_build_object(
        'side','defense',
        'method','injury_severity_x_recent_production',
        'snapCountsAvailable',false,
        'injuries',
        jsonb_agg(
          jsonb_build_object(
            'playerId',d.nfl_player_id,
            'position',d.injured_position,
            'status',d.status,
            'severity',round(d.severity,4),
            'importance',round(d.importance,4),
            'impact',round(d.raw_impact,4)
          )
          order by d.raw_impact desc
        )
      ) as details

    from defensive_injury_impacts d
    group by
      d.team_abbreviation,
      d.position
  ),

  -- ------------------------------------------------------------------------
  -- Offensive injury impact for DST.
  --
  -- Injuries on the offense make the opposing DST matchup more favorable.
  -- ------------------------------------------------------------------------

  offensive_injury_impacts as (
    select
      ci.team_abbreviation,
      ci.nfl_player_id,
      ci.primary_position,
      ci.status,
      ci.severity,
      coalesce(opi.importance,0.35::numeric) as importance,

      (
        ci.severity
        * coalesce(opi.importance,0.35::numeric)
        * case
            when ci.primary_position = 'QB' then 0.055::numeric
            when ci.primary_position = 'RB' then 0.025::numeric
            when ci.primary_position = 'WR' then 0.022::numeric
            when ci.primary_position = 'TE' then 0.018::numeric
            when ci.primary_position in ('K','PK') then 0.006::numeric
            else 0.000::numeric
          end
      ) as raw_impact

    from current_injuries ci

    left join offensive_player_importance opi
      on opi.nfl_player_id = ci.nfl_player_id
     and opi.team_abbreviation = ci.team_abbreviation
     and opi.position =
       case
         when ci.primary_position = 'PK' then 'K'
         else ci.primary_position
       end

    where ci.severity > 0
      and ci.primary_position in ('QB','RB','WR','TE','K','PK')
  ),

  offensive_team_adjustments as (
    select
      o.team_abbreviation,

      least(
        0.1000::numeric,
        sum(o.raw_impact)
      ) as personnel_adjustment,

      count(*)::integer as injury_count,

      jsonb_build_object(
        'side','offense',
        'method','injury_severity_x_recent_usage',
        'snapCountsAvailable',false,
        'injuries',
        jsonb_agg(
          jsonb_build_object(
            'playerId',o.nfl_player_id,
            'position',o.primary_position,
            'status',o.status,
            'severity',round(o.severity,4),
            'importance',round(o.importance,4),
            'impact',round(o.raw_impact,4)
          )
          order by o.raw_impact desc
        )
      ) as details

    from offensive_injury_impacts o
    where o.raw_impact > 0
    group by o.team_abbreviation
  ),

  -- ------------------------------------------------------------------------
  -- Combine historical performance and current personnel.
  -- ------------------------------------------------------------------------

  all_team_positions as (
    select
      p.position,
      st.abbreviation as opponent_abbreviation
    from positions p
    cross join season_teams st
  ),

  combined as (
    select
      atp.position,
      atp.opponent_abbreviation,
      coalesce(tph.games_sampled,0) as games_sampled,
      coalesce(tph.current_season_games,0) as current_season_games,
      coalesce(tph.prior_season_games,0) as prior_season_games,
      tph.season_average_allowed,
      tph.recent_average_allowed,

      case
        when tph.recent_average_allowed is not null
          and tph.season_average_allowed is not null
        then
          0.65 * tph.recent_average_allowed
          + 0.35 * tph.season_average_allowed

        when tph.recent_average_allowed is not null
        then tph.recent_average_allowed

        else tph.season_average_allowed
      end as base_weighted_points_allowed,

      case
        when atp.position = 'DST'
        then coalesce(ota.personnel_adjustment,0.0000::numeric)
        else coalesce(dta.personnel_adjustment,0.0000::numeric)
      end as personnel_adjustment,

      case
        when atp.position = 'DST'
        then coalesce(ota.injury_count,0)
        else coalesce(dta.injury_count,0)
      end as personnel_injury_count,

      case
        when atp.position = 'DST'
        then coalesce(
          ota.details,
          jsonb_build_object(
            'side','offense',
            'method','injury_severity_x_recent_usage',
            'snapCountsAvailable',false,
            'injuries','[]'::jsonb
          )
        )
        else coalesce(
          dta.details,
          jsonb_build_object(
            'side','defense',
            'method','injury_severity_x_recent_production',
            'snapCountsAvailable',false,
            'injuries','[]'::jsonb
          )
        )
      end as personnel_details

    from all_team_positions atp

    left join team_position_history tph
      on tph.position = atp.position
     and tph.opponent_abbreviation = atp.opponent_abbreviation

    left join defensive_team_adjustments dta
      on dta.team_abbreviation = atp.opponent_abbreviation
     and dta.position = atp.position

    left join offensive_team_adjustments ota
      on ota.team_abbreviation = atp.opponent_abbreviation
  ),

  adjusted as (
    select
      c.*,

      case
        when c.base_weighted_points_allowed is null
        then null
        else
          c.base_weighted_points_allowed
          * (1.0000::numeric + c.personnel_adjustment)
      end as adjusted_points_allowed

    from combined c
  ),

  with_league_average as (
    select
      a.*,

      avg(a.adjusted_points_allowed) over (
        partition by a.position
      ) as league_position_average

    from adjusted a
  ),

  normalized as (
    select
      wla.*,

      case
        when wla.adjusted_points_allowed is null
          or wla.league_position_average is null
          or wla.league_position_average <= 0
        then 1.0000::numeric

        else greatest(
          0.8800::numeric,
          least(
            1.1200::numeric,
            wla.adjusted_points_allowed /
              wla.league_position_average
          )
        )
      end as matchup_multiplier

    from with_league_average wla
  ),

  ranked as (
    select
      n.*,

      case
        when n.adjusted_points_allowed is null
        then null

        else row_number() over (
          partition by n.position
          order by
            n.adjusted_points_allowed asc nulls last,
            n.opponent_abbreviation asc
        )
      end as matchup_rank

    from normalized n
  )

  insert into public.season_long_matchup_rankings (
    league_id,
    season,
    week,
    position,
    opponent_abbreviation,
    games_sampled,
    current_season_games,
    prior_season_games,
    season_average_allowed,
    recent_average_allowed,
    weighted_points_allowed,
    league_position_average,
    matchup_multiplier,
    matchup_rank,
    difficulty,
    calculated_at,
    updated_at,
    base_weighted_points_allowed,
    personnel_adjustment,
    adjusted_points_allowed,
    personnel_injury_count,
    personnel_details
  )
  select
    p_league_id,
    p_season,
    p_week,
    r.position,
    r.opponent_abbreviation,
    r.games_sampled,
    r.current_season_games,
    r.prior_season_games,
    round(r.season_average_allowed,4),
    round(r.recent_average_allowed,4),

    -- Keep the existing column meaningful for downstream consumers:
    -- weighted_points_allowed now represents the final adjusted value.
    round(r.adjusted_points_allowed,4),

    round(r.league_position_average,4),
    round(r.matchup_multiplier,4),
    r.matchup_rank,

    case
      when r.matchup_rank is null then 'unavailable'
      when r.matchup_rank <= 10 then 'tough'
      when r.matchup_rank <= 22 then 'average'
      else 'favorable'
    end,

    now(),
    now(),

    round(r.base_weighted_points_allowed,4),
    round(r.personnel_adjustment,4),
    round(r.adjusted_points_allowed,4),
    r.personnel_injury_count,
    r.personnel_details

  from ranked r;

  get diagnostics v_rows = row_count;

  select count(*)
  into v_ranked
  from public.season_long_matchup_rankings r
  where r.league_id = p_league_id
    and r.season = p_season
    and r.week = p_week
    and r.matchup_rank is not null;

  return jsonb_build_object(
    'success', true,
    'engine', 'g365_dynamic_matchup_v2',
    'leagueId', p_league_id,
    'season', p_season,
    'week', p_week,
    'rowsWritten', v_rows,
    'rankedRows', v_ranked,
    'rankConvention', '#1 toughest, #32 easiest',
    'difficultyTiers', jsonb_build_object(
      'hard','1-10',
      'medium','11-22',
      'easy','23-32'
    ),
    'currentSeasonWeight', 1.00,
    'priorSeasonWeight', 0.25,
    'recentBlend', 0.65,
    'personnelAdjustmentCap', 0.10,
    'snapCountsAvailable', false
  );
end;
$function$;

revoke all
on function public.refresh_season_long_matchup_rankings(uuid,integer,integer)
from public;

grant execute
on function public.refresh_season_long_matchup_rankings(uuid,integer,integer)
to authenticated;


-- --------------------------------------------------------------------------
-- 3. Convenience refresh for all active/setup Season-Long leagues.
--
-- This calls the full weekly projection function because that function already
-- invokes refresh_season_long_matchup_rankings and then writes the resulting
-- matchup multiplier/rank into weekly_player_projections.
-- --------------------------------------------------------------------------

create or replace function public.refresh_active_season_long_dynamic_matchups()
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_season integer;
  v_week integer;
  v_league record;
  v_result jsonb;
  v_refreshed integer := 0;
  v_failed integer := 0;
  v_errors jsonb := '[]'::jsonb;
begin
  select max(g.season)
  into v_season
  from public.nfl_games g
  where g.season_type = 2;

  if v_season is null then
    return jsonb_build_object(
      'success', false,
      'reason', 'No regular-season NFL schedule is available.'
    );
  end if;

  v_week := public.get_active_season_long_week(v_season);

  if v_week is null then
    return jsonb_build_object(
      'success', false,
      'season', v_season,
      'reason', 'No active Season-Long week could be resolved.'
    );
  end if;

  for v_league in
    select l.id
    from public.leagues l
    where l.league_type = 'season_long'
      and l.season = v_season
      and l.status in ('setup','active')
  loop
    begin
      v_result :=
        public.refresh_season_long_weekly_player_projections(
          v_league.id,
          v_season,
          v_week
        );

      v_refreshed := v_refreshed + 1;

    exception
      when others then
        v_failed := v_failed + 1;

        v_errors :=
          v_errors ||
          jsonb_build_array(
            jsonb_build_object(
              'leagueId',v_league.id,
              'error',sqlerrm
            )
          );
    end;
  end loop;

  return jsonb_build_object(
    'success', v_failed = 0,
    'engine', 'g365_dynamic_matchup_v2',
    'season', v_season,
    'week', v_week,
    'leaguesRefreshed', v_refreshed,
    'leaguesFailed', v_failed,
    'errors', v_errors
  );
end;
$function$;

revoke all
on function public.refresh_active_season_long_dynamic_matchups()
from public;

grant execute
on function public.refresh_active_season_long_dynamic_matchups()
to authenticated;


-- --------------------------------------------------------------------------
-- 4. Helpful lookup index for current injury/personnel recalculation.
-- --------------------------------------------------------------------------

create index if not exists
  nfl_player_game_stats_matchup_recent_idx
on public.nfl_player_game_stats (
  season,
  season_type,
  week,
  nfl_player_id
)
where is_final = true;


commit;
