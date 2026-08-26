import {
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@supabase/supabase-js";


type RouteContext = {
  params:
    Promise<{
      leagueId: string;
    }>;
};


type RenameBody = {
  fantasyTeamId?:
    number;

  teamName?:
    string;
};


function jsonError(
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


function getEnvironment() {
  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;

  const publishableKey =
    process.env
      .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env
      .NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const adminKey =
    process.env
      .SUPABASE_SERVICE_ROLE_KEY ??
    process.env
      .SUPABASE_SECRET_KEY;


  if (!supabaseUrl) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is missing."
    );
  }


  if (!publishableKey) {
    throw new Error(
      "The Supabase publishable key is missing."
    );
  }


  if (!adminKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) is missing."
    );
  }


  return {
    supabaseUrl,
    publishableKey,
    adminKey,
  };
}


function createUserClient(
  supabaseUrl: string,
  publishableKey: string,
  accessToken: string
) {
  return createClient(
    supabaseUrl,
    publishableKey,
    {
      global: {
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },
      },

      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
}


function createAdminClient(
  supabaseUrl: string,
  adminKey: string
) {
  return createClient(
    supabaseUrl,
    adminKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
}


export async function POST(
  request: Request,
  context: RouteContext
) {
  try {
    const {
      leagueId:
        rawLeagueId,
    } =
      await context.params;


    const leagueId =
      rawLeagueId
        ?.trim();


    if (!leagueId) {
      return jsonError(
        "League ID is required.",
        400
      );
    }


    const authorization =
      request.headers.get(
        "authorization"
      );


    if (
      !authorization
        ?.startsWith(
          "Bearer "
        )
    ) {
      return jsonError(
        "You must be signed in to rename your team.",
        401
      );
    }


    const accessToken =
      authorization
        .slice(
          "Bearer ".length
        )
        .trim();


    if (!accessToken) {
      return jsonError(
        "Your login token is missing.",
        401
      );
    }


    let body:
      RenameBody;


    try {
      body =
        (await request
          .json()) as
          RenameBody;
    } catch {
      return jsonError(
        "The request body must contain valid JSON.",
        400
      );
    }


    const fantasyTeamId =
      Number(
        body
          .fantasyTeamId
      );


    const teamName =
      (
        body.teamName ??
        ""
      )
        .trim()
        .replace(
          /\s+/g,
          " "
        );


    if (
      !Number.isInteger(
        fantasyTeamId
      ) ||
      fantasyTeamId <=
        0
    ) {
      return jsonError(
        "A valid fantasy team is required.",
        400
      );
    }


    if (!teamName) {
      return jsonError(
        "Team name cannot be blank.",
        400
      );
    }


    if (
      teamName.length >
      40
    ) {
      return jsonError(
        "Team name must be 40 characters or fewer.",
        400
      );
    }


    const {
      supabaseUrl,
      publishableKey,
      adminKey,
    } =
      getEnvironment();


    const userClient =
      createUserClient(
        supabaseUrl,
        publishableKey,
        accessToken
      );


    const admin =
      createAdminClient(
        supabaseUrl,
        adminKey
      );


    const {
      data: {
        user,
      },

      error:
        userError,
    } =
      await userClient
        .auth
        .getUser(
          accessToken
        );


    if (
      userError ||
      !user
    ) {
      return jsonError(
        userError?.message ??
          "Your login session is invalid.",
        401
      );
    }


    const {
      data:
        team,

      error:
        teamError,
    } =
      await admin
        .from(
          "fantasy_teams"
        )
        .select(
          "id,league_id,owner_id,team_name,active"
        )
        .eq(
          "id",
          fantasyTeamId
        )
        .eq(
          "league_id",
          leagueId
        )
        .maybeSingle();


    if (
      teamError ||
      !team
    ) {
      return jsonError(
        teamError?.message ??
          "Fantasy team not found.",
        404
      );
    }


    if (!team.active) {
      return jsonError(
        "This fantasy team is not active.",
        409
      );
    }


    if (
      team.owner_id !==
      user.id
    ) {
      return jsonError(
        "You can only rename the fantasy team that you own.",
        403
      );
    }


    /*
     * Prevent duplicate active team names inside the same league.
     */
    const {
      data:
        duplicate,

      error:
        duplicateError,
    } =
      await admin
        .from(
          "fantasy_teams"
        )
        .select(
          "id"
        )
        .eq(
          "league_id",
          leagueId
        )
        .eq(
          "active",
          true
        )
        .ilike(
          "team_name",
          teamName
        )
        .neq(
          "id",
          fantasyTeamId
        )
        .limit(
          1
        )
        .maybeSingle();


    if (
      duplicateError
    ) {
      return jsonError(
        duplicateError
          .message,
        500
      );
    }


    if (duplicate) {
      return jsonError(
        "Another active team in this league already uses that team name.",
        409
      );
    }


    const {
      data:
        updatedTeam,

      error:
        updateError,
    } =
      await admin
        .from(
          "fantasy_teams"
        )
        .update({
          team_name:
            teamName,

          updated_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "id",
          fantasyTeamId
        )
        .eq(
          "league_id",
          leagueId
        )
        .eq(
          "owner_id",
          user.id
        )
        .select(
          "id,team_name"
        )
        .maybeSingle();


    if (
      updateError ||
      !updatedTeam
    ) {
      return jsonError(
        updateError?.message ??
          "The team name could not be changed.",
        500
      );
    }


    return NextResponse.json({
      success: true,

      teamName:
        updatedTeam
          .team_name,
    });
  } catch (
    error
  ) {
    return jsonError(
      error instanceof Error
        ? error.message
        : "An unexpected team-name error occurred.",
      500
    );
  }
}
