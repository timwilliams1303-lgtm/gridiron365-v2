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


type RequestBody = {
  fantasyTeamId?: number;
  season?: number;
  week?: number;
  playerId?: number;
  dropPlayerId?:
    number |
    null;
  faabBid?:
    number |
    null;
};


function errorResponse(
  message: string,
  status: number
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


    if (!leagueId) {
      return errorResponse(
        "A valid league ID is required.",
        400
      );
    }


    let body:
      RequestBody;


    try {
      body =
        (await request.json()) as
          RequestBody;
    } catch {
      return errorResponse(
        "A valid JSON request body is required.",
        400
      );
    }


    const fantasyTeamId =
      Number(
        body.fantasyTeamId
      );


    const season =
      Number(
        body.season
      );


    const week =
      Number(
        body.week
      );


    const playerId =
      Number(
        body.playerId
      );


    const dropPlayerId =
      body.dropPlayerId ===
        null ||
      body.dropPlayerId ===
        undefined
        ? null
        : Number(
            body.dropPlayerId
          );


    const faabBid =
      body.faabBid ===
        null ||
      body.faabBid ===
        undefined
        ? null
        : Number(
            body.faabBid
          );


    if (
      !Number.isInteger(
        fantasyTeamId
      ) ||
      fantasyTeamId <= 0
    ) {
      return errorResponse(
        "A valid fantasy team ID is required.",
        400
      );
    }


    if (
      !Number.isInteger(
        season
      ) ||
      season < 2000 ||
      season > 2200
    ) {
      return errorResponse(
        "A valid season is required.",
        400
      );
    }


    if (
      !Number.isInteger(
        week
      ) ||
      week < 1 ||
      week > 25
    ) {
      return errorResponse(
        "A valid week is required.",
        400
      );
    }


    if (
      !Number.isInteger(
        playerId
      ) ||
      playerId <= 0
    ) {
      return errorResponse(
        "A valid player ID is required.",
        400
      );
    }


    if (
      dropPlayerId !==
        null &&
      (
        !Number.isInteger(
          dropPlayerId
        ) ||
        dropPlayerId <= 0
      )
    ) {
      return errorResponse(
        "The selected drop player is invalid.",
        400
      );
    }


    if (
      faabBid !==
        null &&
      (
        !Number.isInteger(
          faabBid
        ) ||
        faabBid < 0
      )
    ) {
      return errorResponse(
        "FAAB bid must be a non-negative whole number.",
        400
      );
    }


    const supabase =
      await createSupabaseServerClient();


    /*
     * Confirm the caller is logged in.
     */
    const {
      data:
        userData,

      error:
        userError,
    } =
      await supabase.auth
        .getUser();


    if (
      userError ||
      !userData.user
    ) {
      return errorResponse(
        "You must be signed in to manage your roster.",
        401
      );
    }


    /*
     * Call the authoritative Supabase
     * transaction function.
     *
     * The database function handles:
     *
     * - fantasy-team ownership
     * - player availability
     * - roster limits
     * - positional maximums
     * - drop validation
     * - waiver vs free-agent behavior
     * - FAAB validation
     * - transaction history
     */
    const {
      data,
      error,
    } =
      await supabase.rpc(
        "add_or_claim_traditional_player",
        {
          p_league_id:
            leagueId,

          p_fantasy_team_id:
            fantasyTeamId,

          p_season:
            season,

          p_week:
            week,

          p_player_id:
            playerId,

          p_drop_player_id:
            dropPlayerId,

          p_faab_bid:
            faabBid,
        }
      );


    if (error) {
      console.error(
        "Supabase add/claim RPC error:",
        error
      );


      return errorResponse(
        error.message,
        400
      );
    }


    return NextResponse.json(
      {
        success: true,
        result: data,
      },
      {
        status: 200,
      }
    );
  } catch (
    error
  ) {
    console.error(
      "Traditional add/claim route failed:",
      error
    );


    return errorResponse(
      error instanceof Error
        ? error.message
        : "The roster transaction could not be completed.",
      500
    );
  }
}