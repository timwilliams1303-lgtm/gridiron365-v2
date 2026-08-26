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


type CancelClaimBody = {
  claimId?: number;
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
      CancelClaimBody;


    try {
      body =
        (await request.json()) as
          CancelClaimBody;
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
        "You must be signed in to cancel a waiver claim.",
        401
      );
    }


    const {
      data,
      error,
    } =
      await supabase.rpc(
        "cancel_traditional_waiver_claim",
        {
          p_league_id:
            leagueId,

          p_claim_id:
            claimId,
        }
      );


    if (error) {
      console.error(
        "Supabase cancel waiver claim RPC error:",
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
      "Traditional waiver cancellation failed:",
      error
    );


    return errorResponse(
      error instanceof Error
        ? error.message
        : "The waiver claim could not be cancelled.",
      500
    );
  }
}