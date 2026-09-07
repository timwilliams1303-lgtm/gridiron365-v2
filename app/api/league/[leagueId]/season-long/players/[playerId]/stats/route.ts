import { NextResponse } from "next/server";

import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";


type RouteContext = {
  params: Promise<{
    leagueId: string;
    playerId: string;
  }>;
};


type NumericValue =
  | number
  | string
  | null;


type GameStatRow = {
  week: number;
  game_status: string | null;
  is_live: boolean | null;
  is_final: boolean | null;
  passing_attempts: number | null;
  passing_completions: number | null;
  passing_yards: number | null;
  passing_touchdowns: number | null;
  passing_interceptions: number | null;
  rushing_attempts: number | null;
  rushing_yards: number | null;
  rushing_touchdowns: number | null;
  receiving_targets: number | null;
  receptions: number | null;
  receiving_yards: number | null;
  receiving_touchdowns: number | null;
  fumbles: number | null;
  fumbles_lost: number | null;
  field_goals_made: number | null;
  field_goals_attempted: number | null;
  extra_points_made: number | null;
  extra_points_attempted: number | null;
  field_goals_made_0_19: number | null;
  field_goals_made_20_29: number | null;
  field_goals_made_30_39: number | null;
  field_goals_made_40_49: number | null;
  field_goals_made_50_59: number | null;
  field_goals_made_60_plus: number | null;
  dst_sacks: NumericValue;
  dst_interceptions: number | null;
  dst_fumble_recoveries: number | null;
  dst_touchdowns: number | null;
  dst_safeties: number | null;
  dst_blocked_kicks: number | null;
  dst_points_allowed: number | null;
  dst_yards_allowed: number | null;
  defensive_total_tackles: number | null;
  defensive_tackles_for_loss: number | null;
};


type FantasyScoreRow = {
  week: number;
  fantasy_points: NumericValue;
  is_live: boolean | null;
  is_final: boolean | null;
};


type ProjectionRow = {
  week: number;
  opponent_abbreviation: string | null;
  home_or_away: string | null;
  kickoff_at: string | null;
  is_bye: boolean | null;
  projected_points: NumericValue;
};


function numeric(
  value: NumericValue | undefined
) {
  const result =
    Number(value ?? 0);

  return Number.isFinite(result)
    ? result
    : 0;
}


export async function GET(
  request: Request,
  context: RouteContext
) {
  try {
    const {
      leagueId,
      playerId: rawPlayerId,
    } = await context.params;

    const url =
      new URL(request.url);

    const season =
      Number(
        url.searchParams.get(
          "season"
        )
      );

    const playerId =
      Number(rawPlayerId);


    if (
      !leagueId ||
      !Number.isInteger(playerId) ||
      playerId <= 0 ||
      !Number.isInteger(season) ||
      season < 2000
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid league, player, or season.",
        },
        {
          status: 400,
        }
      );
    }


    const supabase =
      await createSupabaseServerClient();

    const {
      data: authData,
      error: authError,
    } =
      await supabase.auth.getUser();


    if (
      authError ||
      !authData.user
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "You must be signed in to view player stats.",
        },
        {
          status: 401,
        }
      );
    }


    const [
      playerResult,
      statsResult,
      scoresResult,
      projectionsResult,
    ] = await Promise.all([
      supabase
        .from("nfl_players")
        .select(`
          id,
          full_name,
          primary_position,
          team_abbreviation,
          headshot_url,
          status
        `)
        .eq("id", playerId)
        .maybeSingle(),

      supabase
        .from("nfl_player_game_stats")
        .select(`
          week,
          game_status,
          is_live,
          is_final,
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
          extra_points_attempted,
          field_goals_made_0_19,
          field_goals_made_20_29,
          field_goals_made_30_39,
          field_goals_made_40_49,
          field_goals_made_50_59,
          field_goals_made_60_plus,
          dst_sacks,
          dst_interceptions,
          dst_fumble_recoveries,
          dst_touchdowns,
          dst_safeties,
          dst_blocked_kicks,
          dst_points_allowed,
          dst_yards_allowed,
          defensive_total_tackles,
          defensive_tackles_for_loss
        `)
        .eq("nfl_player_id", playerId)
        .eq("season", season)
        .eq("season_type", 2)
        .order("week", {
          ascending: true,
        }),

      supabase
        .from("fantasy_player_game_scores")
        .select(`
          week,
          fantasy_points,
          is_live,
          is_final
        `)
        .eq("league_id", leagueId)
        .eq("nfl_player_id", playerId)
        .eq("season", season)
        .eq("season_type", 2)
        .order("week", {
          ascending: true,
        }),

      supabase
        .from("season_long_weekly_player_projections")
        .select(`
          week,
          opponent_abbreviation,
          home_or_away,
          kickoff_at,
          is_bye,
          projected_points
        `)
        .eq("league_id", leagueId)
        .eq("player_id", playerId)
        .eq("season", season)
        .eq("season_type", 2)
        .order("week", {
          ascending: true,
        }),
    ]);


    if (playerResult.error) {
      throw new Error(
        playerResult.error.message
      );
    }

    if (!playerResult.data) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Player could not be found.",
        },
        {
          status: 404,
        }
      );
    }

    if (statsResult.error) {
      throw new Error(
        statsResult.error.message
      );
    }

    if (scoresResult.error) {
      throw new Error(
        scoresResult.error.message
      );
    }

    if (projectionsResult.error) {
      throw new Error(
        projectionsResult.error.message
      );
    }


    const statsByWeek =
      new Map<number, GameStatRow>();

    for (
      const row
      of (
        statsResult.data ??
        []
      ) as GameStatRow[]
    ) {
      statsByWeek.set(
        Number(row.week),
        row
      );
    }


    const scoresByWeek =
      new Map<number, FantasyScoreRow>();

    for (
      const row
      of (
        scoresResult.data ??
        []
      ) as FantasyScoreRow[]
    ) {
      scoresByWeek.set(
        Number(row.week),
        row
      );
    }


    const projectionsByWeek =
      new Map<number, ProjectionRow>();

    for (
      const row
      of (
        projectionsResult.data ??
        []
      ) as ProjectionRow[]
    ) {
      projectionsByWeek.set(
        Number(row.week),
        row
      );
    }


    const weeks =
      Array.from(
        new Set([
          ...statsByWeek.keys(),
          ...scoresByWeek.keys(),
          ...projectionsByWeek.keys(),
        ])
      ).sort(
        (a, b) => a - b
      );


    const weekly =
      weeks.map((week) => {
        const stat =
          statsByWeek.get(week) ??
          null;

        const score =
          scoresByWeek.get(week) ??
          null;

        const projection =
          projectionsByWeek.get(week) ??
          null;

        return {
          week,
          opponentAbbreviation:
            projection
              ?.opponent_abbreviation ??
            null,
          homeOrAway:
            projection
              ?.home_or_away ??
            null,
          kickoffAt:
            projection
              ?.kickoff_at ??
            null,
          isBye:
            projection
              ?.is_bye ??
            false,
          projectedPoints:
            projection
              ?.projected_points !==
                null &&
            projection
              ?.projected_points !==
                undefined
              ? numeric(
                  projection.projected_points
                )
              : null,
          fantasyPoints:
            score
              ?.fantasy_points !==
                null &&
            score
              ?.fantasy_points !==
                undefined
              ? numeric(
                  score.fantasy_points
                )
              : null,
          gameStatus:
            stat?.game_status ??
            null,
          isLive:
            score?.is_live ??
            stat?.is_live ??
            false,
          isFinal:
            score?.is_final ??
            stat?.is_final ??
            false,
          stats: stat,
        };
      });


    const playedWeeks =
      weekly.filter(
        (row) =>
          row.stats !== null ||
          row.fantasyPoints !== null
      );


    const seasonFantasyPoints =
      playedWeeks.reduce(
        (total, row) =>
          total +
          (row.fantasyPoints ?? 0),
        0
      );


    const totals = {
      passingAttempts: 0,
      passingCompletions: 0,
      passingYards: 0,
      passingTouchdowns: 0,
      passingInterceptions: 0,
      rushingAttempts: 0,
      rushingYards: 0,
      rushingTouchdowns: 0,
      receivingTargets: 0,
      receptions: 0,
      receivingYards: 0,
      receivingTouchdowns: 0,
      fumbles: 0,
      fumblesLost: 0,
      fieldGoalsMade: 0,
      fieldGoalsAttempted: 0,
      extraPointsMade: 0,
      extraPointsAttempted: 0,
      dstSacks: 0,
      dstInterceptions: 0,
      dstFumbleRecoveries: 0,
      dstTouchdowns: 0,
      dstSafeties: 0,
      dstBlockedKicks: 0,
      dstPointsAllowed: 0,
      dstYardsAllowed: 0,
      defensiveTotalTackles: 0,
      defensiveTacklesForLoss: 0,
    };


    for (const row of playedWeeks) {
      const stat = row.stats;

      if (!stat) {
        continue;
      }

      totals.passingAttempts += numeric(stat.passing_attempts);
      totals.passingCompletions += numeric(stat.passing_completions);
      totals.passingYards += numeric(stat.passing_yards);
      totals.passingTouchdowns += numeric(stat.passing_touchdowns);
      totals.passingInterceptions += numeric(stat.passing_interceptions);
      totals.rushingAttempts += numeric(stat.rushing_attempts);
      totals.rushingYards += numeric(stat.rushing_yards);
      totals.rushingTouchdowns += numeric(stat.rushing_touchdowns);
      totals.receivingTargets += numeric(stat.receiving_targets);
      totals.receptions += numeric(stat.receptions);
      totals.receivingYards += numeric(stat.receiving_yards);
      totals.receivingTouchdowns += numeric(stat.receiving_touchdowns);
      totals.fumbles += numeric(stat.fumbles);
      totals.fumblesLost += numeric(stat.fumbles_lost);
      totals.fieldGoalsMade += numeric(stat.field_goals_made);
      totals.fieldGoalsAttempted += numeric(stat.field_goals_attempted);
      totals.extraPointsMade += numeric(stat.extra_points_made);
      totals.extraPointsAttempted += numeric(stat.extra_points_attempted);
      totals.dstSacks += numeric(stat.dst_sacks);
      totals.dstInterceptions += numeric(stat.dst_interceptions);
      totals.dstFumbleRecoveries += numeric(stat.dst_fumble_recoveries);
      totals.dstTouchdowns += numeric(stat.dst_touchdowns);
      totals.dstSafeties += numeric(stat.dst_safeties);
      totals.dstBlockedKicks += numeric(stat.dst_blocked_kicks);
      totals.dstPointsAllowed += numeric(stat.dst_points_allowed);
      totals.dstYardsAllowed += numeric(stat.dst_yards_allowed);
      totals.defensiveTotalTackles += numeric(stat.defensive_total_tackles);
      totals.defensiveTacklesForLoss += numeric(stat.defensive_tackles_for_loss);
    }


    const projectionValues =
      weekly
        .map(
          (row) =>
            row.projectedPoints
        )
        .filter(
          (
            value
          ): value is number =>
            value !== null
        );


    return NextResponse.json({
      success: true,
      player: {
        id:
          playerResult.data.id,
        fullName:
          playerResult.data.full_name,
        position:
          playerResult.data.primary_position ===
          "PK"
            ? "K"
            : playerResult.data.primary_position,
        teamAbbreviation:
          playerResult.data.team_abbreviation,
        headshotUrl:
          playerResult.data.headshot_url,
        status:
          playerResult.data.status,
      },
      weekly,
      season: {
        gamesPlayed:
          playedWeeks.length,
        fantasyPoints:
          seasonFantasyPoints,
        fantasyPointsPerGame:
          playedWeeks.length > 0
            ? seasonFantasyPoints /
              playedWeeks.length
            : 0,
        averageProjection:
          projectionValues.length > 0
            ? projectionValues.reduce(
                (sum, value) =>
                  sum + value,
                0
              ) /
              projectionValues.length
            : 0,
        totals,
      },
    });
  } catch (error) {
    console.error(
      "Season-Long player stats route failed:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Player stats could not be loaded.",
      },
      {
        status: 500,
      }
    );
  }
}
