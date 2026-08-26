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
    }>;
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


export async function POST(
  request: Request,
  context: RouteContext
) {
  try {
    const {
      leagueId,
    } =
      await context.params;


    await requireTraditionalLeague(
      leagueId
    );


    const {
      season,
      playerId,
      newRank,
    } =
      (await request.json()) as {
        season?: number;
        playerId?: number;
        newRank?: number;
      };


    if (
      !season ||
      !playerId ||
      !newRank
    ) {
      return errorResponse(
        "season, playerId, and newRank are required."
      );
    }


    const supabase =
      await createSupabaseServerClient();


    const {
      data,
      error,
    } =
      await supabase.rpc(
        "move_my_traditional_draft_rank",
        {
          p_league_id:
            leagueId,

          p_season:
            season,

          p_player_id:
            playerId,

          p_new_rank:
            newRank,
        }
      );


    if (
      error
    ) {
      return errorResponse(
        error.message,
        500
      );
    }


    return NextResponse.json({
      success: true,
      result: data,
    });
  } catch (
    error
  ) {
    return errorResponse(
      error instanceof Error
        ? error.message
        : "Unable to move ranking.",
      500
    );
  }
}