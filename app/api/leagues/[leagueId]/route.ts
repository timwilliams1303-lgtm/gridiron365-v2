import {
  NextResponse,
} from "next/server";

import {
  createSupabaseAdminClient,
} from "@/lib/supabase/admin";

import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";


export const dynamic =
  "force-dynamic";


type RouteContext = {
  params:
    Promise<{
      leagueId: string;
    }>;
};


type LeagueRow = {
  id: string;
  name: string;
  commissioner_user_id:
    string | null;
};


function jsonError(
  error: string,
  status: number
) {
  return NextResponse.json(
    {
      success: false,
      error,
    },
    {
      status,
    }
  );
}


export async function DELETE(
  _request: Request,
  context: RouteContext
) {
  const {
    leagueId,
  } =
    await context.params;


  if (!leagueId) {
    return jsonError(
      "A valid league ID is required.",
      400
    );
  }


  const userClient =
    await createSupabaseServerClient();


  const {
    data:
      userData,

    error:
      userError,
  } =
    await userClient.auth
      .getUser();


  if (
    userError ||
    !userData.user
  ) {
    return jsonError(
      "You must be signed in.",
      401
    );
  }


  const admin =
    createSupabaseAdminClient();


  const {
    data:
      leagueData,

    error:
      leagueError,
  } =
    await admin
      .from(
        "leagues"
      )
      .select(
        "id, name, commissioner_user_id"
      )
      .eq(
        "id",
        leagueId
      )
      .maybeSingle();


  if (leagueError) {
    return jsonError(
      leagueError.message,
      500
    );
  }


  if (!leagueData) {
    return jsonError(
      "League not found.",
      404
    );
  }


  const league =
    leagueData as LeagueRow;


  if (
    league.commissioner_user_id !==
    userData.user.id
  ) {
    return jsonError(
      "Only the primary commissioner can delete this league.",
      403
    );
  }


  const {
    error:
      deleteError,
  } =
    await admin
      .from(
        "leagues"
      )
      .delete()
      .eq(
        "id",
        leagueId
      )
      .eq(
        "commissioner_user_id",
        userData.user.id
      );


  if (deleteError) {
    return jsonError(
      deleteError.message,
      500
    );
  }


  return NextResponse.json({
    success:
      true,

    deletedLeagueId:
      league.id,

    deletedLeagueName:
      league.name,
  });
}