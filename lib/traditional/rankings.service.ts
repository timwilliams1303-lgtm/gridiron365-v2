import type {
  SupabaseClient,
} from "@supabase/supabase-js";


export type TraditionalRankingPlayer = {
  playerId: number;
  fullName: string;
  position: string;
  teamAbbreviation: string | null;
  headshotUrl: string | null;

  injuryStatus: string | null;
  injuryType: string | null;
  injuryLocation: string | null;
  injuryDetail: string | null;
  injuryDate: string | null;
  injuryReturnDate: string | null;

  byeWeek: number | null;
  defaultRank: number;
  myRank: number;
  projectedPoints: number | null;
};


export type TraditionalRankingsData = {
  initialized: boolean;
  totalPlayers: number;
  players: TraditionalRankingPlayer[];
  teams: string[];
};


type DefaultRankingRow = {
  player_id: number;
  rank: number;
  projected_points:
    number |
    string |
    null;
};


type MyRankingRow = {
  player_id: number;
  rank: number;
};


type PlayerRow = {
  id: number;
  full_name: string;
  primary_position: string;
  team_abbreviation:
    string |
    null;
  headshot_url:
    string |
    null;
  status:
    string |
    null;
};


type ByeWeekRow = {
  abbreviation: string;
  bye_week:
    number |
    null;
};


type InjuryRow = {
  nfl_player_id:
    number |
    null;

  season:
    number |
    null;

  status:
    string |
    null;

  injury_type:
    string |
    null;

  injury_location:
    string |
    null;

  injury_detail:
    string |
    null;

  injury_date:
    string |
    null;

  return_date:
    string |
    null;

  source_updated_at:
    string |
    null;

  updated_at:
    string |
    null;
};


type ProjectionRow = {
  nfl_player_id: number;

  passing_attempts:
    number |
    string |
    null;

  passing_completions:
    number |
    string |
    null;

  passing_yards:
    number |
    string |
    null;

  passing_touchdowns:
    number |
    string |
    null;

  passing_interceptions:
    number |
    string |
    null;

  rushing_attempts:
    number |
    string |
    null;

  rushing_yards:
    number |
    string |
    null;

  rushing_touchdowns:
    number |
    string |
    null;

  receiving_targets:
    number |
    string |
    null;

  receptions:
    number |
    string |
    null;

  receiving_yards:
    number |
    string |
    null;

  receiving_touchdowns:
    number |
    string |
    null;

  fumbles:
    number |
    string |
    null;

  fumbles_lost:
    number |
    string |
    null;

  field_goals_made:
    number |
    string |
    null;

  field_goals_attempted:
    number |
    string |
    null;

  extra_points_made:
    number |
    string |
    null;

  extra_points_attempted:
    number |
    string |
    null;
};


type ScoringSettingsRow = {
  passing_yards_per_point:
    number |
    string |
    null;

  passing_td_points:
    number |
    string |
    null;

  passing_interception_points:
    number |
    string |
    null;

  passing_two_point_points:
    number |
    string |
    null;

  passing_completion_points:
    number |
    string |
    null;

  passing_incompletion_points:
    number |
    string |
    null;

  rushing_yards_per_point:
    number |
    string |
    null;

  rushing_td_points:
    number |
    string |
    null;

  rushing_two_point_points:
    number |
    string |
    null;

  rushing_attempt_points:
    number |
    string |
    null;

  receiving_yards_per_point:
    number |
    string |
    null;

  receiving_td_points:
    number |
    string |
    null;

  receiving_two_point_points:
    number |
    string |
    null;

  reception_points:
    number |
    string |
    null;

  receiving_target_points:
    number |
    string |
    null;

  passing_first_down_points:
    number |
    string |
    null;

  rushing_first_down_points:
    number |
    string |
    null;

  receiving_first_down_points:
    number |
    string |
    null;

  fumble_points:
    number |
    string |
    null;

  fumble_lost_points:
    number |
    string |
    null;

  extra_point_made_points:
    number |
    string |
    null;

  extra_point_missed_points:
    number |
    string |
    null;

  field_goal_missed_points:
    number |
    string |
    null;

  kick_return_yards_per_point:
    number |
    string |
    null;

  punt_return_yards_per_point:
    number |
    string |
    null;

  kick_return_td_points:
    number |
    string |
    null;

  punt_return_td_points:
    number |
    string |
    null;

  offensive_fumble_recovery_td_points:
    number |
    string |
    null;

  fractional_scoring_enabled:
    boolean |
    null;

  decimal_places:
    number |
    null;
};


/*
 * The current projection table contains season-total
 * ESPN projections for the core offensive statistics.
 *
 * We calculate the fantasy-point total against the
 * current league's scoring settings here. That keeps
 * one league's scoring from overwriting another
 * league's projections.
 *
 * IMPORTANT:
 * - The current league_scoring_rules table is empty.
 * - Per-game threshold bonuses should NOT be applied
 *   to season-total statistics because that would
 *   over/under-count them.
 * - When weekly ESPN projections are stored later,
 *   threshold bonuses can be calculated week-by-week
 *   and summed safely.
 */


function numberValue(
  value:
    number |
    string |
    null |
    undefined,
  fallback =
    0
) {
  if (
    value ===
      null ||
    value ===
      undefined
  ) {
    return fallback;
  }


  const parsed =
    Number(
      value
    );


  return Number.isFinite(
    parsed
  )
    ? parsed
    : fallback;
}


function divideByRate(
  amount:
    number,
  unitsPerPoint:
    number
) {
  if (
    !Number.isFinite(
      unitsPerPoint
    ) ||
    unitsPerPoint <=
      0
  ) {
    return 0;
  }


  return (
    amount /
    unitsPerPoint
  );
}


function roundProjectedPoints(
  value:
    number,
  settings:
    ScoringSettingsRow
) {
  if (
    !Number.isFinite(
      value
    )
  ) {
    return null;
  }


  if (
    settings
      .fractional_scoring_enabled ===
    false
  ) {
    return Math.round(
      value
    );
  }


  const requestedPlaces =
    Number(
      settings
        .decimal_places ??
      2
    );


  const places =
    Math.min(
      4,
      Math.max(
        0,
        Number.isFinite(
          requestedPlaces
        )
          ? requestedPlaces
          : 2
      )
    );


  const multiplier =
    10 **
    places;


  return (
    Math.round(
      value *
      multiplier
    ) /
    multiplier
  );
}


function calculateLeagueProjectedPoints(
  projection:
    ProjectionRow,
  settings:
    ScoringSettingsRow
) {
  const passingAttempts =
    numberValue(
      projection
        .passing_attempts
    );

  const passingCompletions =
    numberValue(
      projection
        .passing_completions
    );

  const passingIncompletions =
    Math.max(
      0,
      passingAttempts -
      passingCompletions
    );


  const passingPoints =
    divideByRate(
      numberValue(
        projection
          .passing_yards
      ),
      numberValue(
        settings
          .passing_yards_per_point
      )
    ) +
    (
      numberValue(
        projection
          .passing_touchdowns
      ) *
      numberValue(
        settings
          .passing_td_points
      )
    ) +
    (
      numberValue(
        projection
          .passing_interceptions
      ) *
      numberValue(
        settings
          .passing_interception_points
      )
    ) +
    (
      passingCompletions *
      numberValue(
        settings
          .passing_completion_points
      )
    ) +
    (
      passingIncompletions *
      numberValue(
        settings
          .passing_incompletion_points
      )
    );


  const rushingPoints =
    divideByRate(
      numberValue(
        projection
          .rushing_yards
      ),
      numberValue(
        settings
          .rushing_yards_per_point
      )
    ) +
    (
      numberValue(
        projection
          .rushing_touchdowns
      ) *
      numberValue(
        settings
          .rushing_td_points
      )
    ) +
    (
      numberValue(
        projection
          .rushing_attempts
      ) *
      numberValue(
        settings
          .rushing_attempt_points
      )
    );


  const receivingPoints =
    divideByRate(
      numberValue(
        projection
          .receiving_yards
      ),
      numberValue(
        settings
          .receiving_yards_per_point
      )
    ) +
    (
      numberValue(
        projection
          .receiving_touchdowns
      ) *
      numberValue(
        settings
          .receiving_td_points
      )
    ) +
    (
      numberValue(
        projection
          .receptions
      ) *
      numberValue(
        settings
          .reception_points
      )
    ) +
    (
      numberValue(
        projection
          .receiving_targets
      ) *
      numberValue(
        settings
          .receiving_target_points
      )
    );


  const fumblePoints =
    (
      numberValue(
        projection
          .fumbles
      ) *
      numberValue(
        settings
          .fumble_points
      )
    ) +
    (
      numberValue(
        projection
          .fumbles_lost
      ) *
      numberValue(
        settings
          .fumble_lost_points
      )
    );


  const extraPointsMade =
    numberValue(
      projection
        .extra_points_made
    );

  const extraPointsAttempted =
    numberValue(
      projection
        .extra_points_attempted
    );

  const extraPointsMissed =
    Math.max(
      0,
      extraPointsAttempted -
      extraPointsMade
    );


  const fieldGoalsMade =
    numberValue(
      projection
        .field_goals_made
    );

  const fieldGoalsAttempted =
    numberValue(
      projection
        .field_goals_attempted
    );

  const fieldGoalsMissed =
    Math.max(
      0,
      fieldGoalsAttempted -
      fieldGoalsMade
    );


  /*
   * league_scoring_settings does not contain a single
   * field_goal_made_points column. Made field-goal
   * scoring is expected to be represented by kicking
   * rules (usually distance bands).
   *
   * Since there are currently no league_scoring_rules
   * rows, use the standard 3 points per made FG as the
   * temporary baseline. Once kicking-distance projection
   * distributions are stored, this can use the exact
   * league rule bands instead.
   */
  const standardFieldGoalMadePoints =
    3;


  const kickingPoints =
    (
      extraPointsMade *
      numberValue(
        settings
          .extra_point_made_points
      )
    ) +
    (
      extraPointsMissed *
      numberValue(
        settings
          .extra_point_missed_points
      )
    ) +
    (
      fieldGoalsMade *
      standardFieldGoalMadePoints
    ) +
    (
      fieldGoalsMissed *
      numberValue(
        settings
          .field_goal_missed_points
      )
    );


  const total =
    passingPoints +
    rushingPoints +
    receivingPoints +
    fumblePoints +
    kickingPoints;


  return roundProjectedPoints(
    total,
    settings
  );
}


export async function getTraditionalRankingsData(
  supabase: SupabaseClient,
  leagueId: string,
  season: number,
  userId: string
): Promise<TraditionalRankingsData> {
  const [
    defaultResult,
    myResult,
    playerResult,
    byeResult,
    injuryResult,
    projectionResult,
    scoringResult,
  ] =
    await Promise.all([
      supabase
        .from(
          "traditional_default_draft_rankings"
        )
        .select(
          `
            player_id,
            rank,
            projected_points
          `
        )
        .eq(
          "season",
          season
        )
        .order(
          "rank"
        ),

      supabase
        .from(
          "traditional_draft_rankings"
        )
        .select(
          `
            player_id,
            rank
          `
        )
        .eq(
          "league_id",
          leagueId
        )
        .eq(
          "season",
          season
        )
        .eq(
          "user_id",
          userId
        )
        .order(
          "rank"
        ),

      supabase
        .from(
          "nfl_players"
        )
        .select(
          `
            id,
            full_name,
            primary_position,
            team_abbreviation,
            headshot_url,
            status
          `
        )
        .in(
          "primary_position",
          [
            "QB",
            "RB",
            "WR",
            "TE",
            "K",
            "DST",
          ]
        ),

      supabase.rpc(
        "get_nfl_team_bye_weeks",
        {
          p_season:
            season,
        }
      ),

      supabase
        .from(
          "current_nfl_player_injuries"
        )
        .select(
          `
            nfl_player_id,
            season,
            status,
            injury_type,
            injury_location,
            injury_detail,
            injury_date,
            return_date,
            source_updated_at,
            updated_at
          `
        )
        .eq(
          "season",
          season
        ),

      supabase
        .from(
          "nfl_player_season_projections"
        )
        .select(
          `
            nfl_player_id,
            passing_attempts,
            passing_completions,
            passing_yards,
            passing_touchdowns,
            passing_interceptions,
            rushing_attempts,
            rushing_yards,
            rushing_touchdowns,
            receiving_targets,
            receptions,
            receiving_yards,
            receiving_touchdowns,
            fumbles,
            fumbles_lost,
            field_goals_made,
            field_goals_attempted,
            extra_points_made,
            extra_points_attempted
          `
        )
        .eq(
          "season",
          season
        ),

      supabase
        .from(
          "league_scoring_settings"
        )
        .select(
          `
            passing_yards_per_point,
            passing_td_points,
            passing_interception_points,
            passing_two_point_points,
            passing_completion_points,
            passing_incompletion_points,
            rushing_yards_per_point,
            rushing_td_points,
            rushing_two_point_points,
            rushing_attempt_points,
            receiving_yards_per_point,
            receiving_td_points,
            receiving_two_point_points,
            reception_points,
            receiving_target_points,
            passing_first_down_points,
            rushing_first_down_points,
            receiving_first_down_points,
            fumble_points,
            fumble_lost_points,
            extra_point_made_points,
            extra_point_missed_points,
            field_goal_missed_points,
            kick_return_yards_per_point,
            punt_return_yards_per_point,
            kick_return_td_points,
            punt_return_td_points,
            offensive_fumble_recovery_td_points,
            fractional_scoring_enabled,
            decimal_places
          `
        )
        .eq(
          "league_id",
          leagueId
        )
        .maybeSingle(),
    ]);


  for (
    const result
    of [
      defaultResult,
      myResult,
      playerResult,
      byeResult,
      injuryResult,
      projectionResult,
      scoringResult,
    ]
  ) {
    if (
      result.error
    ) {
      throw new Error(
        result.error.message
      );
    }
  }


  const defaults =
    (
      defaultResult.data ??
      []
    ) as DefaultRankingRow[];


  const personal =
    (
      myResult.data ??
      []
    ) as MyRankingRow[];


  const nflPlayers =
    (
      playerResult.data ??
      []
    ) as PlayerRow[];


  const byeWeeks =
    (
      byeResult.data ??
      []
    ) as ByeWeekRow[];


  const injuries =
    (
      injuryResult.data ??
      []
    ) as InjuryRow[];


  const projections =
    (
      projectionResult.data ??
      []
    ) as ProjectionRow[];


  const scoringSettings =
    (
      scoringResult.data ??
      null
    ) as
      ScoringSettingsRow |
      null;


  const playerMap =
    new Map(
      nflPlayers.map(
        (
          player
        ) => [
          player.id,
          player,
        ]
      )
    );


  const personalMap =
    new Map(
      personal.map(
        (
          row
        ) => [
          row.player_id,
          row.rank,
        ]
      )
    );


  const byeMap =
    new Map(
      byeWeeks.map(
        (
          row
        ) => [
          row.abbreviation,
          row.bye_week,
        ]
      )
    );


  const projectionMap =
    new Map(
      projections.map(
        (
          row
        ) => [
          row.nfl_player_id,
          row,
        ]
      )
    );


  /*
   * Build injury map by nfl_player_id.
   *
   * current_nfl_player_injuries should normally
   * contain the current row for each player.
   * If duplicates ever appear, the most recently
   * updated row wins.
   */
  const injuryMap =
    new Map<
      number,
      InjuryRow
    >();


  const sortedInjuries =
    [...injuries]
      .sort(
        (
          a,
          b
        ) => {
          const aDate =
            new Date(
              a.source_updated_at ??
              a.updated_at ??
              a.injury_date ??
              0
            ).getTime();


          const bDate =
            new Date(
              b.source_updated_at ??
              b.updated_at ??
              b.injury_date ??
              0
            ).getTime();


          return (
            aDate -
            bDate
          );
        }
      );


  for (
    const injury
    of sortedInjuries
  ) {
    if (
      injury.nfl_player_id ===
      null
    ) {
      continue;
    }


    injuryMap.set(
      injury.nfl_player_id,
      injury
    );
  }


  const initialized =
    personal.length >
    0;


  const players =
    defaults
      .map(
        (
          row
        ):
          TraditionalRankingPlayer |
          null => {
          const player =
            playerMap.get(
              row.player_id
            );


          if (
            !player
          ) {
            return null;
          }


          const injury =
            injuryMap.get(
              player.id
            ) ??
            null;


          const projection =
            projectionMap.get(
              player.id
            ) ??
            null;


          const storedProjectedPoints =
            row.projected_points ===
              null
              ? null
              : Number(
                  row.projected_points
                );


          const leagueProjectedPoints =
            projection &&
            scoringSettings
              ? calculateLeagueProjectedPoints(
                  projection,
                  scoringSettings
                )
              : null;


          const projectedPoints =
            leagueProjectedPoints ??
            (
              Number.isFinite(
                storedProjectedPoints
              )
                ? storedProjectedPoints
                : null
            );


          return {
            playerId:
              player.id,

            fullName:
              player.full_name,

            position:
              player.primary_position,

            teamAbbreviation:
              player.team_abbreviation,

            headshotUrl:
              player.headshot_url,

            /*
             * Prefer the current injury-feed
             * designation over nfl_players.status.
             */
            injuryStatus:
              injury?.status ??
              (
                player.status &&
                player.status !==
                  "ACTIVE"
                  ? player.status
                  : null
              ),

            injuryType:
              injury?.injury_type ??
              null,

            injuryLocation:
              injury?.injury_location ??
              null,

            injuryDetail:
              injury?.injury_detail ??
              null,

            injuryDate:
              injury?.injury_date ??
              null,

            injuryReturnDate:
              injury?.return_date ??
              null,

            byeWeek:
              player
                .team_abbreviation
                ? byeMap.get(
                    player
                      .team_abbreviation
                  ) ??
                  null
                : null,

            defaultRank:
              row.rank,

            myRank:
              personalMap.get(
                row.player_id
              ) ??
              row.rank,

            projectedPoints,
          };
        }
      )
      .filter(
        (
          player
        ):
          player is TraditionalRankingPlayer =>
          player !==
          null
      )
      .sort(
        (
          a,
          b
        ) =>
          a.myRank -
          b.myRank
      );


  const teams =
    Array.from(
      new Set(
        players
          .map(
            (
              player
            ) =>
              player.teamAbbreviation
          )
          .filter(
            (
              team
            ):
              team is string =>
              Boolean(
                team
              )
          )
      )
    ).sort();


  return {
    initialized,

    totalPlayers:
      players.length,

    players,

    teams,
  };
}