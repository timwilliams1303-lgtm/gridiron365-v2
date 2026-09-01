begin;

CREATE OR REPLACE FUNCTION public.generate_season_long_weekly_salaries(p_league_id uuid, p_season integer, p_week integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

declare
  v_league_type text;
  v_selection_mode text;

  v_min_salary numeric;
  v_max_salary numeric;
  v_increment numeric;

  -- Player prices are percentages of the commissioner-set weekly cap.
  -- $65,000 is only the reference curve used to preserve the approved
  -- Gridiron365 price distribution; it is never the league's hard-coded cap.
  v_weekly_salary_cap numeric;
  v_salary_scale numeric;
  v_reference_salary_cap constant numeric := 65000.0;

  v_projection_weight numeric;

  v_recent_form_weight numeric;
  v_usage_weight numeric;
  v_base_weight numeric;

  v_qb_multiplier numeric;
  v_rb_multiplier numeric;
  v_wr_multiplier numeric;
  v_te_multiplier numeric;
  v_k_multiplier numeric;
  v_dst_multiplier numeric;

  v_max_weekly_increase numeric;
  v_max_weekly_decrease numeric;

  v_questionable_multiplier numeric;
  v_doubtful_multiplier numeric;
  v_out_multiplier numeric;

  v_player_count integer := 0;
  v_removed_unavailable integer := 0;

  v_min_projection numeric := 0;
  v_max_projection numeric := 0;

begin

  -- =========================================================
  -- INPUT
  -- =========================================================

  if p_week not between 1 and 18 then
    raise exception
      'Week must be between 1 and 18.';
  end if;


  -- =========================================================
  -- LEAGUE
  -- =========================================================

  select
    l.league_type,
    l.player_selection_mode

  into
    v_league_type,
    v_selection_mode

  from public.leagues l

  where l.id =
    p_league_id;


  if not found then
    raise exception
      'League could not be found.';
  end if;


  if v_league_type <> 'season_long' then
    raise exception
      'This is not a Season-Long league.';
  end if;


  if v_selection_mode <> 'salary' then
    raise exception
      'Weekly salaries are only generated for Salary leagues.';
  end if;


  -- =========================================================
  -- LEAGUE WEEKLY SALARY CAP
  -- =========================================================
  --
  -- Every player salary is derived as a percentage of this number.
  -- Changing a league from $65,000 to $100,000, for example, scales
  -- the entire player-price curve by 100000 / 65000.
  -- =========================================================

  select
    sls.weekly_salary_cap
  into
    v_weekly_salary_cap
  from public.season_long_settings sls
  where sls.league_id =
    p_league_id;


  if v_weekly_salary_cap is null
     or v_weekly_salary_cap <= 0
  then
    raise exception
      'Season-Long weekly salary cap must be greater than zero.';
  end if;


  v_salary_scale :=
    v_weekly_salary_cap
    /
    v_reference_salary_cap;


  -- =========================================================
  -- DEFAULT SALARY SETTINGS
  -- =========================================================

  insert into public.season_long_salary_settings (
    league_id
  )
  values (
    p_league_id
  )
  on conflict (
    league_id
  )
  do nothing;


  -- =========================================================
  -- LOAD SETTINGS
  -- =========================================================

  select
    s.minimum_salary,
    s.maximum_salary,
    s.salary_increment,

    s.projection_weight,
    s.recent_form_weight,
    s.usage_weight,

    s.qb_multiplier,
    s.rb_multiplier,
    s.wr_multiplier,
    s.te_multiplier,
    s.k_multiplier,
    s.dst_multiplier,

    s.maximum_weekly_increase,
    s.maximum_weekly_decrease,

    s.questionable_multiplier,
    s.doubtful_multiplier,
    s.out_multiplier

  into
    v_min_salary,
    v_max_salary,
    v_increment,

    v_projection_weight,
    v_recent_form_weight,
    v_usage_weight,

    v_qb_multiplier,
    v_rb_multiplier,
    v_wr_multiplier,
    v_te_multiplier,
    v_k_multiplier,
    v_dst_multiplier,

    v_max_weekly_increase,
    v_max_weekly_decrease,

    v_questionable_multiplier,
    v_doubtful_multiplier,
    v_out_multiplier

  from public.season_long_salary_settings s

  where s.league_id =
    p_league_id;



  -- =========================================================
  -- G365 CAP-PERCENTAGE PRICE CURVE
  -- =========================================================
  --
  -- Final roster-building targets:
  --   minimum player salary = 3% of weekly salary cap
  --   maximum player salary = 15% of weekly salary cap
  --   displayed player salaries use clean $100 denominations
  --
  -- Examples:
  --   $65,000 cap  -> approximately $2,000 to $9,800
  --   $100,000 cap -> $3,000 to $15,000
  --
  -- Projection, recent form, usage, matchup, injury and position
  -- adjustments still determine where each player lands inside
  -- this range.
  --
  -- Weekly increase/decrease guardrails continue to scale relative
  -- to the commissioner-selected cap.
  -- =========================================================

  v_increment :=
    100;

  v_min_salary :=
    greatest(
      v_increment,
      round(
        (
          v_weekly_salary_cap
          *
          0.03
        )
        /
        v_increment
      )
      *
      v_increment
    );

  v_max_salary :=
    greatest(
      v_min_salary,
      round(
        (
          v_weekly_salary_cap
          *
          0.15
        )
        /
        v_increment
      )
      *
      v_increment
    );

  v_max_weekly_increase :=
    greatest(
      0,
      round(
        v_max_weekly_increase
        *
        v_salary_scale
      )
    );

  v_max_weekly_decrease :=
    greatest(
      0,
      round(
        v_max_weekly_decrease
        *
        v_salary_scale
      )
    );


  /*
   * Treat projection_weight as the overall
   * pricing intensity rather than allowing
   * weights to add above 100%.
   *
   * Default:
   *
   * 55% baseline projection
   * 30% recent production
   * 15% recent usage
   */

  v_recent_form_weight :=
    greatest(
      0,
      least(
        coalesce(
          v_recent_form_weight,
          0.30
        ),
        1
      )
    );


  v_usage_weight :=
    greatest(
      0,
      least(
        coalesce(
          v_usage_weight,
          0.15
        ),
        1
      )
    );


  v_base_weight :=
    greatest(
      0,
      1
      -
      v_recent_form_weight
      -
      v_usage_weight
    );


  -- =========================================================
  -- REMOVE PLAYERS WHO SHOULD NOT BE SELECTABLE
  -- =========================================================
  --
  -- OUT / IR / PUP / Suspended players should not simply
  -- become cheap DFS options.
  --
  -- If their status later clears, the next regeneration will
  -- add them back automatically.
  -- =========================================================

  delete from public.season_long_player_salaries s

  using public.current_nfl_player_injuries i

  where s.league_id =
    p_league_id

  and s.season =
    p_season

  and s.week =
    p_week

  and i.nfl_player_id =
    s.nfl_player_id

  and i.season =
    p_season

  and (
       upper(
         coalesce(
           i.status,
           ''
         )
       ) like '%OUT%'

    or upper(
         coalesce(
           i.status,
           ''
         )
       ) like '%INJURED RESERVE%'

    or upper(
         coalesce(
           i.status,
           ''
         )
       ) = 'IR'

    or upper(
         coalesce(
           i.status,
           ''
         )
       ) like '%PUP%'

    or upper(
         coalesce(
           i.status,
           ''
         )
       ) like '%SUSPEND%'
  );


  get diagnostics
    v_removed_unavailable =
      row_count;


  -- =========================================================
  -- GENERATE DFS-STYLE PRICING
  -- =========================================================

  with

  -- ---------------------------------------------------------
  -- WEEKLY PLAYER POOL
  -- ---------------------------------------------------------

  weekly_pool as (

    select
      wp.player_id,

      upper(
        p.primary_position
      ) as position,

      wp.team_abbreviation,

      wp.opponent_abbreviation,

      wp.home_or_away,

      wp.kickoff_at,

      wp.is_bye,

      greatest(
        coalesce(
          wp.projected_points,
          0
        ),
        0
      ) as baseline_projection,

      i.status
        as injury_status,

      i.injury_type,

      i.injury_location,

      i.return_date

    from public.weekly_player_projections wp

    join public.nfl_players p
      on p.id =
         wp.player_id

    left join public.current_nfl_player_injuries i
      on i.nfl_player_id =
         wp.player_id

     and i.season =
         p_season

    where wp.league_id =
      p_league_id

    and wp.season =
      p_season

    and wp.season_type = 2

    and wp.week =
      p_week

    and wp.is_bye =
      false

    and p.is_active =
      true

    and upper(
      p.primary_position
    ) in (
      'QB',
      'RB',
      'WR',
      'TE',
      'K',
      'DST'
    )

  ),


  -- ---------------------------------------------------------
  -- LAST THREE COMPLETED REGULAR-SEASON GAMES
  -- ---------------------------------------------------------

  recent_game_rows as (

    select
      pool.player_id,

      pool.position,

      gs.id as player_game_stat_id,

      gs.week,

      row_number() over (
        partition by
          pool.player_id

        order by
          gs.week desc,
          gs.id desc
      ) as game_rank,

      public.calculate_fantasy_points(
        p_league_id,
        gs.id
      ) as fantasy_points,


      -- -----------------------------------------------------
      -- POSITION-SPECIFIC OPPORTUNITY / USAGE
      -- -----------------------------------------------------

      case

        when pool.position = 'QB'
        then
            coalesce(
              gs.passing_attempts,
              0
            )
          +
            coalesce(
              gs.rushing_attempts,
              0
            )


        when pool.position = 'RB'
        then
            coalesce(
              gs.rushing_attempts,
              0
            )
          +
            coalesce(
              gs.receiving_targets,
              0
            )


        when pool.position in (
          'WR',
          'TE'
        )
        then
            coalesce(
              gs.receiving_targets,
              0
            )
          +
            coalesce(
              gs.rushing_attempts,
              0
            )


        when pool.position = 'K'
        then
            coalesce(
              gs.field_goals_attempted,
              0
            )
          +
            coalesce(
              gs.extra_points_attempted,
              0
            )


        when pool.position = 'DST'
        then
            coalesce(
              gs.dst_sacks,
              0
            )
          +
            coalesce(
              gs.dst_interceptions,
              0
            )
          +
            coalesce(
              gs.dst_fumble_recoveries,
              0
            )
          +
            coalesce(
              gs.dst_blocked_kicks,
              0
            )


        else 0

      end::numeric
        as usage_opportunities

    from weekly_pool pool

    join public.nfl_player_game_stats gs
      on gs.nfl_player_id =
         pool.player_id

     and gs.season =
         p_season

     and gs.season_type = 2

     and gs.week <
         p_week

     and gs.is_final =
         true

  ),


  recent_three as (

    select *
    from recent_game_rows
    where game_rank <= 3

  ),


  recent_summary as (

    select
      player_id,

      count(*) as recent_games,

      avg(
        fantasy_points
      ) as recent_fantasy_points,

      avg(
        usage_opportunities
      ) as average_usage

    from recent_three

    group by
      player_id

  ),


  -- ---------------------------------------------------------
  -- MAXIMUM RECENT USAGE BY POSITION
  --
  -- Allows opportunity to be normalized from 0 → 1.
  -- ---------------------------------------------------------

  usage_position_max as (

    select
      pool.position,

      max(
        coalesce(
          rs.average_usage,
          0
        )
      ) as maximum_usage

    from weekly_pool pool

    left join recent_summary rs
      on rs.player_id =
         pool.player_id

    group by
      pool.position

  ),


  -- ---------------------------------------------------------
  -- BUILD ADJUSTED WEEKLY PROJECTION
  -- ---------------------------------------------------------

  projection_components as (

    select
      pool.*,

      coalesce(
        rs.recent_games,
        0
      ) as recent_games,


      /*
       * If we have no current-season history yet,
       * use the baseline projection as the recent-form
       * component.
       *
       * This makes Week 1 stable.
       */

      case
        when coalesce(
          rs.recent_games,
          0
        ) > 0

        then greatest(
          coalesce(
            rs.recent_fantasy_points,
            0
          ),
          0
        )

        else pool.baseline_projection
      end
        as recent_form_projection,


      coalesce(
        rs.average_usage,
        0
      ) as average_usage,


      /*
       * Usage component is expressed on the same fantasy-point
       * scale as the baseline projection.
       */

      case
        when coalesce(
          rs.recent_games,
          0
        ) = 0
        then pool.baseline_projection

        when coalesce(
          upm.maximum_usage,
          0
        ) > 0

        then
          pool.baseline_projection
          *
          greatest(
            0,
            least(
              coalesce(
                rs.average_usage,
                0
              )
              /
              upm.maximum_usage,
              1.25
            )
          )

        else pool.baseline_projection
      end
        as usage_projection,


      -- -----------------------------------------------------
      -- INJURY / AVAILABILITY
      -- -----------------------------------------------------

      case

        when pool.injury_status is null
          or trim(
            pool.injury_status
          ) = ''
        then 1.00::numeric


        when upper(
          pool.injury_status
        ) like '%QUESTION%'
        then v_questionable_multiplier


        when upper(
          pool.injury_status
        ) like '%DOUBTFUL%'
        then v_doubtful_multiplier


        when upper(
          pool.injury_status
        ) like '%OUT%'
        then v_out_multiplier


        when upper(
          pool.injury_status
        ) like '%INJURED RESERVE%'
        then 0.00::numeric


        when upper(
          pool.injury_status
        ) = 'IR'
        then 0.00::numeric


        when upper(
          pool.injury_status
        ) like '%PUP%'
        then 0.00::numeric


        when upper(
          pool.injury_status
        ) like '%SUSPEND%'
        then 0.00::numeric


        when upper(
          pool.injury_status
        ) like '%PROBABLE%'
        then 0.99::numeric


        else 1.00::numeric

      end as injury_multiplier,


      -- -----------------------------------------------------
      -- HOME / AWAY
      --
      -- Keep this intentionally small.
      -- -----------------------------------------------------

      case
        when lower(
          coalesce(
            pool.home_or_away,
            ''
          )
        ) = 'home'
        then 1.02::numeric

        when lower(
          coalesce(
            pool.home_or_away,
            ''
          )
        ) = 'away'
        then 0.98::numeric

        else 1.00::numeric
      end as location_multiplier,


      -- -----------------------------------------------------
      -- POSITION SALARY MULTIPLIER
      -- -----------------------------------------------------

      case pool.position

        when 'QB'
          then v_qb_multiplier

        when 'RB'
          then v_rb_multiplier

        when 'WR'
          then v_wr_multiplier

        when 'TE'
          then v_te_multiplier

        when 'K'
          then v_k_multiplier

        when 'DST'
          then v_dst_multiplier

        else 1.00::numeric

      end as position_multiplier

    from weekly_pool pool

    left join recent_summary rs
      on rs.player_id =
         pool.player_id

    left join usage_position_max upm
      on upm.position =
         pool.position

  ),


  adjusted as (

    select
      pc.*,

      greatest(
        0,

        (
            pc.baseline_projection
            *
            v_base_weight

          +

            pc.recent_form_projection
            *
            v_recent_form_weight

          +

            pc.usage_projection
            *
            v_usage_weight
        )

        *
        pc.location_multiplier

        *
        pc.injury_multiplier

      ) as adjusted_projection

    from projection_components pc

  ),


  -- ---------------------------------------------------------
  -- WEEKLY PROJECTION RANGE
  -- ---------------------------------------------------------

  projection_range as (

    select
      coalesce(
        min(
          adjusted_projection
        ) filter (
          where adjusted_projection > 0
        ),
        0
      ) as minimum_projection,

      coalesce(
        max(
          adjusted_projection
        ),
        0
      ) as maximum_projection

    from adjusted

    where injury_multiplier > 0

  ),


  -- ---------------------------------------------------------
  -- PREVIOUS-WEEK SALARY
  -- ---------------------------------------------------------

  previous_salary as (

    select
      s.nfl_player_id,
      s.salary

    from public.season_long_player_salaries s

    where s.league_id =
      p_league_id

    and s.season =
      p_season

    and s.week =
      p_week - 1

  ),


  -- ---------------------------------------------------------
  -- RAW DFS SALARY
  -- ---------------------------------------------------------

  raw_salary as (

    select
      a.*,

      pr.minimum_projection,
      pr.maximum_projection,

      previous.salary
        as previous_week_salary,


      /*
       * Normalize adjusted fantasy value against the
       * current week's player pool.
       */

      (
        v_min_salary

        +

        (
          case

            when
              pr.maximum_projection >
              pr.minimum_projection

            then

              (
                greatest(
                  a.adjusted_projection,
                  pr.minimum_projection
                )
                -
                pr.minimum_projection
              )

              /

              nullif(
                pr.maximum_projection
                -
                pr.minimum_projection,
                0
              )

            else 0

          end

          *

          (
            v_max_salary -
            v_min_salary
          )

          *

          coalesce(
            v_projection_weight,
            1
          )

          *

          a.position_multiplier
        )

      ) as calculated_salary

    from adjusted a

    cross join projection_range pr

    left join previous_salary previous
      on previous.nfl_player_id =
         a.player_id

    where a.adjusted_projection > 0

    and a.injury_multiplier > 0

  ),


  -- ---------------------------------------------------------
  -- ROUND / BOUND INITIAL SALARY
  -- ---------------------------------------------------------

  rounded_salary as (

    select
      rs.*,

      greatest(
        v_min_salary,

        least(
          v_max_salary,

          round(
            rs.calculated_salary
            /
            v_increment
          )
          *
          v_increment
        )
      ) as unguarded_salary

    from raw_salary rs

  ),


  -- ---------------------------------------------------------
  -- WEEK-OVER-WEEK MOVEMENT GUARDRAIL
  -- ---------------------------------------------------------

  guarded_salary as (

    select
      r.*,

      case

        /*
         * Week 1 or newly priced player:
         * there is no prior salary to constrain.
         */

        when r.previous_week_salary
             is null

        then r.unguarded_salary


        else

          greatest(
            v_min_salary,

            least(
              v_max_salary,

              greatest(
                r.previous_week_salary
                -
                v_max_weekly_decrease,

                least(
                  r.unguarded_salary,

                  r.previous_week_salary
                  +
                  v_max_weekly_increase
                )
              )
            )
          )

      end as guarded_salary

    from rounded_salary r

  ),


  final_price as (

    select
      gs.*,

      greatest(
        v_min_salary,

        least(
          v_max_salary,

          round(
            gs.guarded_salary
            /
            v_increment
          )
          *
          v_increment
        )
      ) as final_salary

    from guarded_salary gs

  )


  -- =========================================================
  -- WRITE WEEKLY SALARIES
  -- =========================================================

  insert into public.season_long_player_salaries (
    league_id,
    season,
    week,
    nfl_player_id,

    salary,
    projected_points,

    previous_week_salary,
    salary_change,
    salary_change_percent,

    pricing_details,

    source,
    calculated_at,
    created_at,
    updated_at
  )

  select
    p_league_id,
    p_season,
    p_week,
    fp.player_id,

    fp.final_salary,

    round(
      fp.adjusted_projection,
      2
    ),

    fp.previous_week_salary,


    case
      when fp.previous_week_salary
           is null
      then null

      else
        fp.final_salary
        -
        fp.previous_week_salary
    end,


    case
      when fp.previous_week_salary
           is null

        or fp.previous_week_salary = 0

      then null

      else round(
        (
          (
            fp.final_salary
            -
            fp.previous_week_salary
          )
          /
          fp.previous_week_salary
        )
        *
        100,
        2
      )
    end,


    jsonb_build_object(

      'algorithm',
        'gridiron365_dfs_cap_3_15_clean100_v5',

      'baselineProjection',
        round(
          fp.baseline_projection,
          2
        ),

      'recentGames',
        fp.recent_games,

      'recentFormProjection',
        round(
          fp.recent_form_projection,
          2
        ),

      'averageUsage',
        round(
          fp.average_usage,
          2
        ),

      'usageProjection',
        round(
          fp.usage_projection,
          2
        ),

      'baseWeight',
        v_base_weight,

      'recentFormWeight',
        v_recent_form_weight,

      'usageWeight',
        v_usage_weight,

      'injuryStatus',
        fp.injury_status,

      'injuryType',
        fp.injury_type,

      'injuryLocation',
        fp.injury_location,

      'returnDate',
        fp.return_date,

      'injuryMultiplier',
        fp.injury_multiplier,

      'homeAway',
        fp.home_or_away,

      'locationMultiplier',
        fp.location_multiplier,

      'position',
        fp.position,

      'positionMultiplier',
        fp.position_multiplier,

      'adjustedProjection',
        round(
          fp.adjusted_projection,
          2
        ),

      'rawSalary',
        round(
          fp.calculated_salary,
          2
        ),

      'unguardedSalary',
        fp.unguarded_salary,

      'previousWeekSalary',
        fp.previous_week_salary,

      'maximumWeeklyIncrease',
        v_max_weekly_increase,

      'maximumWeeklyDecrease',
        v_max_weekly_decrease,

      'finalSalary',
        fp.final_salary

    ),

    'gridiron365_dfs_cap_3_15_clean100_v5',

    now(),
    now(),
    now()

  from final_price fp


  on conflict (
    league_id,
    season,
    week,
    nfl_player_id
  )

  do update
  set
    salary =
      excluded.salary,

    projected_points =
      excluded.projected_points,

    previous_week_salary =
      excluded.previous_week_salary,

    salary_change =
      excluded.salary_change,

    salary_change_percent =
      excluded.salary_change_percent,

    pricing_details =
      excluded.pricing_details,

    source =
      excluded.source,

    calculated_at =
      now(),

    updated_at =
      now();


  get diagnostics
    v_player_count =
      row_count;


  -- =========================================================
  -- RETURN SUMMARY
  -- =========================================================

  select
    coalesce(
      min(
        s.projected_points
      ) filter (
        where s.projected_points > 0
      ),
      0
    ),

    coalesce(
      max(
        s.projected_points
      ),
      0
    )

  into
    v_min_projection,
    v_max_projection

  from public.season_long_player_salaries s

  where s.league_id =
    p_league_id

  and s.season =
    p_season

  and s.week =
    p_week;


  return jsonb_build_object(

    'success',
      true,

    'leagueId',
      p_league_id,

    'season',
      p_season,

    'week',
      p_week,

    'playersPriced',
      v_player_count,

    'unavailablePlayersRemoved',
      v_removed_unavailable,

    'minimumSalary',
      v_min_salary,

    'maximumSalary',
      v_max_salary,

    'salaryIncrement',
      v_increment,

    'weeklySalaryCap',
      v_weekly_salary_cap,

    'salaryScale',
      round(v_salary_scale, 6),

    'minimumSalaryPercentOfCap',
      round((v_min_salary / v_weekly_salary_cap) * 100, 4),

    'maximumSalaryPercentOfCap',
      round((v_max_salary / v_weekly_salary_cap) * 100, 4),

    'minimumPositiveProjection',
      v_min_projection,

    'maximumProjection',
      v_max_projection,

    'baseWeight',
      v_base_weight,

    'recentFormWeight',
      v_recent_form_weight,

    'usageWeight',
      v_usage_weight,

    'maximumWeeklyIncrease',
      v_max_weekly_increase,

    'maximumWeeklyDecrease',
      v_max_weekly_decrease,

    'source',
      'gridiron365_dfs_cap_3_15_clean100_v5'
  );

end;

$function$;

grant execute on function public.generate_season_long_weekly_salaries(uuid, integer, integer)
  to authenticated;

commit;