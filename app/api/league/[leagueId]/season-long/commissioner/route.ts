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
  league_type: string;
  player_selection_mode: string;
  season: number;
  status: string;
  commissioner_user_id: string | null;
};


const scoringKeys = [
  "passing_yards_per_point",
  "passing_td_points",
  "passing_interception_points",
  "passing_two_point_points",

  "rushing_yards_per_point",
  "rushing_td_points",
  "rushing_two_point_points",

  "receiving_yards_per_point",
  "receiving_td_points",
  "receiving_two_point_points",
  "reception_points",

  "fumble_points",
  "fumble_lost_points",

  "extra_point_made_points",
  "extra_point_missed_points",

  "sack_points",
  "interception_points",
  "forced_fumble_points",
  "fumble_recovery_points",
  "defensive_touchdown_points",
  "safety_points",
  "blocked_kick_points",
  "return_touchdown_points",
] as const;


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


function integer(
  value: unknown,
  fallback = 0,
  min = 0,
  max = 100
) {
  const parsed =
    Number(
      value
    );


  if (
    !Number.isInteger(
      parsed
    )
  ) {
    return fallback;
  }


  return Math.max(
    min,
    Math.min(
      max,
      parsed
    )
  );
}


function numeric(
  value: unknown,
  fallback = 0
) {
  const parsed =
    Number(
      value
    );


  return Number.isFinite(
    parsed
  )
    ? parsed
    : fallback;
}


async function requireCommissioner(
  leagueId: string
) {
  const userClient =
    await createSupabaseServerClient();


  const {
    data: userData,
    error: userError,
  } =
    await userClient.auth.getUser();


  if (
    userError ||
    !userData.user
  ) {
    return {
      error:
        "You must be signed in.",

      status:
        401,

      league:
        null,

      admin:
        null,
    };
  }


  const admin =
    createSupabaseAdminClient();


  const {
    data: leagueData,
    error: leagueError,
  } =
    await admin
      .from(
        "leagues"
      )
      .select(`
        id,
        name,
        league_type,
        player_selection_mode,
        season,
        status,
        commissioner_user_id
      `)
      .eq(
        "id",
        leagueId
      )
      .maybeSingle();


  if (
    leagueError
  ) {
    return {
      error:
        leagueError.message,

      status:
        500,

      league:
        null,

      admin:
        null,
    };
  }


  if (
    !leagueData
  ) {
    return {
      error:
        "League not found.",

      status:
        404,

      league:
        null,

      admin:
        null,
    };
  }


  const league =
    leagueData as LeagueRow;


  if (
    league.league_type !==
    "season_long"
  ) {
    return {
      error:
        "This endpoint is only available for Season-Long leagues.",

      status:
        400,

      league:
        null,

      admin:
        null,
    };
  }


  let isCommissioner =
    league.commissioner_user_id ===
    userData.user.id;


  if (
    !isCommissioner
  ) {
    const {
      data: membership,
      error: membershipError,
    } =
      await admin
        .from(
          "league_members"
        )
        .select(
          "role"
        )
        .eq(
          "league_id",
          leagueId
        )
        .eq(
          "user_id",
          userData.user.id
        )
        .maybeSingle();


    if (
      membershipError
    ) {
      return {
        error:
          membershipError.message,

        status:
          500,

        league:
          null,

        admin:
          null,
      };
    }


    isCommissioner =
      membership?.role ===
        "commissioner" ||
      membership?.role ===
        "co_commissioner";
  }


  if (
    !isCommissioner
  ) {
    return {
      error:
        "Commissioner access is required.",

      status:
        403,

      league:
        null,

      admin:
        null,
    };
  }


  return {
    error:
      null,

    status:
      200,

    league,

    admin,
  };
}


/* =========================================================
   GET
========================================================= */

export async function GET(
  _request: Request,
  context: RouteContext
) {
  const {
    leagueId,
  } =
    await context.params;


  const auth =
    await requireCommissioner(
      leagueId
    );


  if (
    auth.error ||
    !auth.league ||
    !auth.admin
  ) {
    return jsonError(
      auth.error ??
        "Unauthorized.",

      auth.status
    );
  }


  const {
    admin,
    league,
  } =
    auth;


  /*
   * Get the active Season-Long week.
   */

  const activeWeekResult =
    await admin.rpc(
      "get_active_season_long_week",
      {
        p_season:
          league.season,
      }
    );


  if (
    activeWeekResult.error
  ) {
    return jsonError(
      activeWeekResult
        .error
        .message,

      500
    );
  }


  const activeWeek =
    integer(
      activeWeekResult.data,
      1,
      1,
      18
    );


  /*
   * Load all Commissioner-page information.
   */

  const [
    settingsResult,
    scoringResult,
    teamsResult,
    standingsResult,
    submittedResult,
  ] =
    await Promise.all([
      admin
        .from(
          "season_long_settings"
        )
        .select("*")
        .eq(
          "league_id",
          leagueId
        )
        .maybeSingle(),

      admin
        .from(
          "league_scoring_settings"
        )
        .select("*")
        .eq(
          "league_id",
          leagueId
        )
        .maybeSingle(),

      admin
        .from(
          "fantasy_teams"
        )
        .select(`
          id,
          owner_id,
          team_name,
          active
        `)
        .eq(
          "league_id",
          leagueId
        )
        .order(
          "team_name",
          {
            ascending:
              true,
          }
        ),

      admin
        .from(
          "season_long_standings"
        )
        .select(`
          fantasy_team_id,
          total_points,
          weeks_scored,
          current_rank
        `)
        .eq(
          "league_id",
          leagueId
        )
        .eq(
          "season",
          league.season
        ),

      admin
        .from(
          "season_long_weekly_entries"
        )
        .select(
          "id",
          {
            count:
              "exact",

            head:
              true,
          }
        )
        .eq(
          "league_id",
          leagueId
        )
        .eq(
          "season",
          league.season
        )
        .eq(
          "week",
          activeWeek
        )
        .eq(
          "status",
          "submitted"
        ),
    ]);


  const failed = [
    settingsResult,
    scoringResult,
    teamsResult,
    standingsResult,
    submittedResult,
  ].find(
    (
      result
    ) =>
      result.error
  );


  if (
    failed?.error
  ) {
    return jsonError(
      failed.error.message,
      500
    );
  }


  return NextResponse.json({
    success:
      true,

    league,

    settings:
      settingsResult.data,

    scoring:
      scoringResult.data,

    teams:
      teamsResult.data ??
      [],

    standings:
      standingsResult.data ??
      [],

    activeWeek,

    submittedEntries:
      submittedResult.count ??
      0,
  });
}


/* =========================================================
   POST
========================================================= */

export async function POST(
  request: Request,
  context: RouteContext
) {
  const {
    leagueId,
  } =
    await context.params;


  const auth =
    await requireCommissioner(
      leagueId
    );


  if (
    auth.error ||
    !auth.league ||
    !auth.admin
  ) {
    return jsonError(
      auth.error ??
        "Unauthorized.",

      auth.status
    );
  }


  const {
    admin,
    league,
  } =
    auth;


  let body:
    Record<
      string,
      unknown
    >;


  try {
    body =
      await request.json();
  } catch {
    return jsonError(
      "Invalid JSON body.",
      400
    );
  }


  const action =
    String(
      body.action ??
      ""
    );


  /* =======================================================
     SAVE LEAGUE / LINEUP SETTINGS
  ======================================================= */

  if (
    action ===
    "save-settings"
  ) {
    const source =
      (
        body.settings ??
        {}
      ) as Record<
        string,
        unknown
      >;


    const update = {
      season:
        league.season,

      weekly_salary_cap:
        league.player_selection_mode ===
        "salary"
          ? Math.max(
              0,
              numeric(
                source.weekly_salary_cap,
                0
              )
            )
          : null,

      starting_qb:
        integer(
          source.starting_qb,
          1,
          0,
          10
        ),

      starting_rb:
        integer(
          source.starting_rb,
          2,
          0,
          10
        ),

      starting_wr:
        integer(
          source.starting_wr,
          2,
          0,
          10
        ),

      starting_te:
        integer(
          source.starting_te,
          1,
          0,
          10
        ),

      starting_flex:
        integer(
          source.starting_flex,
          1,
          0,
          10
        ),

      starting_superflex:
        integer(
          source.starting_superflex,
          0,
          0,
          10
        ),

      starting_k:
        integer(
          source.starting_k,
          1,
          0,
          10
        ),

      starting_dst:
        integer(
          source.starting_dst,
          1,
          0,
          10
        ),

      updated_at:
        new Date()
          .toISOString(),
    };


    const existing =
      await admin
        .from(
          "season_long_settings"
        )
        .select(
          "league_id"
        )
        .eq(
          "league_id",
          leagueId
        )
        .maybeSingle();


    if (
      existing.error
    ) {
      return jsonError(
        existing.error.message,
        500
      );
    }


    const save =
      existing.data
        ? await admin
            .from(
              "season_long_settings"
            )
            .update(
              update
            )
            .eq(
              "league_id",
              leagueId
            )

        : await admin
            .from(
              "season_long_settings"
            )
            .insert({
              league_id:
                leagueId,

              ...update,
            });


    if (
      save.error
    ) {
      return jsonError(
        save.error.message,
        500
      );
    }


    return NextResponse.json({
      success:
        true,
    });
  }


  /* =======================================================
     SAVE SCORING
  ======================================================= */

  if (
    action ===
    "save-scoring"
  ) {
    const source =
      (
        body.scoring ??
        {}
      ) as Record<
        string,
        unknown
      >;


    const update:
      Record<
        string,
        number |
        null |
        string
      > = {
        updated_at:
          new Date()
            .toISOString(),
      };


    for (
      const key
      of scoringKeys
    ) {
      const value =
        source[
          key
        ];


      update[
        key
      ] =
        value ===
          null ||
        value ===
          "" ||
        value ===
          undefined
          ? null
          : numeric(
              value
            );
    }


    const existing =
      await admin
        .from(
          "league_scoring_settings"
        )
        .select(
          "league_id"
        )
        .eq(
          "league_id",
          leagueId
        )
        .maybeSingle();


    if (
      existing.error
    ) {
      return jsonError(
        existing.error.message,
        500
      );
    }


    const save =
      existing.data
        ? await admin
            .from(
              "league_scoring_settings"
            )
            .update(
              update
            )
            .eq(
              "league_id",
              leagueId
            )

        : await admin
            .from(
              "league_scoring_settings"
            )
            .insert({
              league_id:
                leagueId,

              ...update,
            });


    if (
      save.error
    ) {
      return jsonError(
        save.error.message,
        500
      );
    }


    return NextResponse.json({
      success:
        true,
    });
  }


  /* =======================================================
     RENAME TEAM
  ======================================================= */

  if (
    action ===
    "rename-team"
  ) {
    const fantasyTeamId =
      integer(
        body.fantasyTeamId,
        0,
        1,
        Number.MAX_SAFE_INTEGER
      );


    const teamName =
      String(
        body.teamName ??
        ""
      )
        .trim()
        .slice(
          0,
          80
        );


    if (
      !fantasyTeamId ||
      !teamName
    ) {
      return jsonError(
        "A valid team and team name are required.",
        400
      );
    }


    const save =
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
        );


    if (
      save.error
    ) {
      return jsonError(
        save.error.message,
        500
      );
    }


    return NextResponse.json({
      success:
        true,
    });
  }


  /* =======================================================
     REBUILD STANDINGS
  ======================================================= */

  if (
    action ===
    "rebuild-standings"
  ) {
    const result =
      await admin.rpc(
        "rebuild_season_long_standings",
        {
          p_league_id:
            leagueId,

          p_season:
            league.season,
        }
      );


    if (
      result.error
    ) {
      return jsonError(
        result.error.message,
        500
      );
    }


    return NextResponse.json({
      success:
        true,
    });
  }


  return jsonError(
    "Unknown commissioner action.",
    400
  );
}