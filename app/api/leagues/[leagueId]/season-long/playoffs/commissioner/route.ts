import {
  NextResponse,
} from "next/server";

import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";


type RouteContext = {
  params:
    Promise<{
      leagueId: string;
    }>;
};


type ResolveTieBody = {
  action?: string;
  matchupId?: number;
  winnerFantasyTeamId?: number;
  note?: string;
};


function errorResponse(
  message: string,
  status = 400
) {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    {
      status,
    }
  );
}


async function getLeagueSeason(
  leagueId: string
) {
  const supabase =
    await createSupabaseServerClient();

  const {
    data: league,
    error,
  } =
    await supabase
      .from(
        "leagues"
      )
      .select(
        "id, season, league_type"
      )
      .eq(
        "id",
        leagueId
      )
      .maybeSingle();

  if (
    error
  ) {
    throw new Error(
      error.message
    );
  }

  if (
    !league
  ) {
    throw new Error(
      "League was not found."
    );
  }

  if (
    league.league_type !==
    "season_long"
  ) {
    throw new Error(
      "This action is only available for Season-Long leagues."
    );
  }

  return {
    supabase,
    season:
      Number(
        league.season
      ),
  };
}


export async function GET(
  _request: Request,
  context: RouteContext
) {
  try {
    const {
      leagueId,
    } =
      await context.params;

    const {
      supabase,
      season,
    } =
      await getLeagueSeason(
        leagueId
      );

    const [
      stateResult,
      tiesResult,
      teamsResult,
    ] =
      await Promise.all([
        supabase
          .from(
            "season_long_playoff_state"
          )
          .select(`
            status,
            current_round,
            round_count,
            playoff_start_week,
            champion_fantasy_team_id
          `)
          .eq(
            "league_id",
            leagueId
          )
          .eq(
            "season",
            season
          )
          .maybeSingle(),

        supabase
          .from(
            "season_long_matchups"
          )
          .select(`
            id,
            week,
            playoff_round,
            playoff_slot,
            home_fantasy_team_id,
            away_fantasy_team_id,
            home_points,
            away_points,
            home_seed,
            away_seed
          `)
          .eq(
            "league_id",
            leagueId
          )
          .eq(
            "season",
            season
          )
          .eq(
            "matchup_type",
            "playoff"
          )
          .eq(
            "is_final",
            true
          )
          .eq(
            "is_tie",
            true
          )
          .eq(
            "resolved_by_commissioner",
            false
          )
          .order(
            "week",
            {
              ascending: true,
            }
          )
          .order(
            "playoff_slot",
            {
              ascending: true,
            }
          ),

        supabase
          .from(
            "fantasy_teams"
          )
          .select(
            "id, owner_id, team_name, active"
          )
          .eq(
            "league_id",
            leagueId
          )
          .eq(
            "active",
            true
          )
          .order(
            "id",
            {
              ascending: true,
            }
          ),
      ]);

    const failed =
      [
        stateResult,
        tiesResult,
        teamsResult,
      ].find(
        (
          result
        ) =>
          result.error
      );

    if (
      failed?.error
    ) {
      return errorResponse(
        failed.error.message,
        500
      );
    }

    return NextResponse.json({
      success: true,
      season,
      playoffState:
        stateResult.data ??
        null,
      unresolvedTies:
        tiesResult.data ??
        [],
      teams:
        teamsResult.data ??
        [],
    });
  } catch (
    error
  ) {
    return errorResponse(
      error instanceof Error
        ? error.message
        : "Unable to load playoff commissioner controls.",
      500
    );
  }
}


export async function POST(
  request: Request,
  context: RouteContext
) {
  try {
    const {
      leagueId,
    } =
      await context.params;

    const body =
      (
        await request.json()
      ) as ResolveTieBody;

    if (
      body.action !==
      "resolve-tie"
    ) {
      return errorResponse(
        "Unsupported playoff commissioner action."
      );
    }

    const matchupId =
      Number(
        body.matchupId
      );

    const winnerFantasyTeamId =
      Number(
        body.winnerFantasyTeamId
      );

    if (
      !Number.isInteger(
        matchupId
      ) ||
      matchupId <= 0
    ) {
      return errorResponse(
        "A valid playoff matchup ID is required."
      );
    }

    if (
      !Number.isInteger(
        winnerFantasyTeamId
      ) ||
      winnerFantasyTeamId <= 0
    ) {
      return errorResponse(
        "A valid advancing team is required."
      );
    }

    const {
      supabase,
      season,
    } =
      await getLeagueSeason(
        leagueId
      );

    /*
     * The database RPC is the authority for commissioner access.
     * It also verifies:
     *   - the matchup belongs to this league/season
     *   - both scores are final
     *   - the matchup is actually tied
     *   - the selected team belongs to the matchup
     */
    const {
      data: resolution,
      error: resolutionError,
    } =
      await supabase.rpc(
        "resolve_season_long_playoff_tiebreak",
        {
          p_league_id:
            leagueId,
          p_season:
            season,
          p_matchup_id:
            matchupId,
          p_winner_fantasy_team_id:
            winnerFantasyTeamId,
          p_note:
            body.note?.trim() ||
            "Commissioner playoff tiebreak",
        }
      );

    if (
      resolutionError
    ) {
      return errorResponse(
        resolutionError.message,
        403
      );
    }

    /*
     * Immediately rerun the playoff lifecycle. If this tie was the
     * last unresolved matchup in the round, the normal Tuesday gate
     * and bracket rules decide whether advancement can occur.
     */
    const {
      data: lifecycle,
      error: lifecycleError,
    } =
      await supabase.rpc(
        "run_season_long_h2h_playoff_lifecycle",
        {
          p_league_id:
            leagueId,
          p_season:
            season,
        }
      );

    if (
      lifecycleError
    ) {
      return errorResponse(
        lifecycleError.message,
        500
      );
    }

    return NextResponse.json({
      success: true,
      resolution,
      lifecycle,
    });
  } catch (
    error
  ) {
    return errorResponse(
      error instanceof Error
        ? error.message
        : "Unable to resolve playoff tie.",
      500
    );
  }
}
