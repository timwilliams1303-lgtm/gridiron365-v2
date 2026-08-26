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
  claimId?: number;

  direction?:
    "up" |
    "down";
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


    const claimId =
      Number(
        body.claimId
      );


    const direction =
      String(
        body.direction ??
        ""
      )
        .trim()
        .toLowerCase();


    if (
      !Number.isInteger(
        claimId
      ) ||
      claimId <= 0
    ) {
      return errorResponse(
        "A valid waiver claim ID is required.",
        400
      );
    }


    if (
      direction !==
        "up" &&
      direction !==
        "down"
    ) {
      return errorResponse(
        "Direction must be up or down.",
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
        "You must be signed in to reorder waiver claims.",
        401
      );
    }


    const {
      data,
      error,
    } =
      await supabase.rpc(
        "move_traditional_waiver_claim_rank",
        {
          p_league_id:
            leagueId,

          p_claim_id:
            claimId,

          p_direction:
            direction,
        }
      );


    if (error) {
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
      "Traditional waiver reorder failed:",
      error
    );


    return errorResponse(
      error instanceof Error
        ? error.message
        : "The waiver claim order could not be updated.",
      500
    );
  }
}