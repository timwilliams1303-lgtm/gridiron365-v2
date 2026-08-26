import {
  NextResponse,
} from "next/server";

import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";

import {
  requireTraditionalLeague,
} from "@/lib/traditional/requireTraditionalLeague";


type RouteContext = {
  params:
    Promise<{
      leagueId: string;
      playerId: string;
    }>;
};


export const dynamic =
  "force-dynamic";


export async function GET(
  request: Request,
  context: RouteContext
) {
  try {
    const {
      leagueId,
      playerId:
        rawPlayerId,
    } =
      await context.params;


    /*
     * Confirms the signed-in user can access this
     * Traditional league.
     */
    const access =
      await requireTraditionalLeague(
        leagueId
      );


    const playerId =
      Number(
        rawPlayerId
      );


    if (
      !Number.isInteger(
        playerId
      ) ||
      playerId <=
        0
    ) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            "A valid player ID is required.",
        },
        {
          status:
            400,
        }
      );
    }


    const url =
      new URL(
        request.url
      );


    const requestedSeason =
      Number(
        url.searchParams.get(
          "season"
        )
      );


    const leagueSeason =
      Number(
        access.league.season
      );


    const season =
      Number.isInteger(
        requestedSeason
      ) &&
      requestedSeason >=
        2000 &&
      requestedSeason <=
        2200
        ? requestedSeason
        : leagueSeason;


    /*
     * Keep the profile tied to the league's season.
     */
    if (
      season !==
      leagueSeason
    ) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            "The requested season does not match this league.",
        },
        {
          status:
            400,
        }
      );
    }


    const supabase =
      await createSupabaseServerClient();


    const {
      data,
      error,
    } =
      await supabase.rpc(
        "get_traditional_player_season_profile",
        {
          p_league_id:
            leagueId,

          p_player_id:
            playerId,

          p_season:
            season,
        }
      );


    if (
      error
    ) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            `Could not load player season profile: ${error.message}`,
        },
        {
          status:
            500,
        }
      );
    }


    return NextResponse.json(
      {
        success:
          true,

        profile:
          data,
      },
      {
        headers: {
          "Cache-Control":
            "no-store, max-age=0",
        },
      }
    );
  } catch (
    error
  ) {
    console.error(
      "Traditional player season profile failed:",
      error
    );


    return NextResponse.json(
      {
        success:
          false,

        error:
          error instanceof Error
            ? error.message
            : "The player season profile could not be loaded.",
      },
      {
        status:
          500,
      }
    );
  }
}