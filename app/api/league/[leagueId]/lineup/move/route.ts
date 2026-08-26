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


type MoveLineupBody = {
  fantasyTeamId?: number;
  season?: number;
  week?: number;
  playerId?: number;
  targetSlot?: string;
  targetSlotIndex?: number;
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
      MoveLineupBody;


    try {
      body =
        (await request.json()) as
          MoveLineupBody;
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


    const targetSlot =
      String(
        body.targetSlot ??
        ""
      )
        .trim()
        .toUpperCase();


    const targetSlotIndex =
      Number(
        body.targetSlotIndex
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


    const validSlots =
      new Set([
        "QB",
        "RB",
        "WR",
        "TE",
        "FLEX",
        "SUPERFLEX",
        "K",
        "DST",
        "BENCH",
        "IR",
      ]);


    if (
      !validSlots.has(
        targetSlot
      )
    ) {
      return errorResponse(
        "A valid target lineup slot is required.",
        400
      );
    }


    if (
      !Number.isInteger(
        targetSlotIndex
      ) ||
      targetSlotIndex < 1
    ) {
      return errorResponse(
        "A valid target slot index is required.",
        400
      );
    }


    const supabase =
      await createSupabaseServerClient();


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
        "You must be signed in to edit your lineup.",
        401
      );
    }


    const {
      data,
      error,
    } =
      await supabase.rpc(
        "move_traditional_lineup_player",
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

          p_target_slot:
            targetSlot,

          p_target_slot_index:
            targetSlotIndex,
        }
      );


    if (error) {
      console.error(
        "Supabase lineup move RPC error:",
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
      "Traditional lineup move route failed:",
      error
    );


    return errorResponse(
      error instanceof Error
        ? error.message
        : "The lineup move could not be completed.",
      500
    );
  }
}