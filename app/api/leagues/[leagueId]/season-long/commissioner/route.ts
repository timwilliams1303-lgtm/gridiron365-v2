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
  error:
    string,
  status:
    number
) {
  return NextResponse.json(
    {
      success:
        false,
      error,
    },
    {
      status,
    }
  );
}


function integer(
  value:
    unknown,
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
  value:
    unknown,
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
  leagueId:
    string
) {
  const userClient =
    await createSupabaseServerClient();

  const {
    data:
      userData,
    error:
      userError,
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
    data:
      leagueData,
    error:
      leagueError,
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
      data:
        membership,
      error:
        membershipError,
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
    userClient,
    userId:
      userData.user.id,
  };
}


export async function GET(
  _request:
    Request,
  context:
    RouteContext
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
    !auth.admin ||
    !auth.userClient
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
    userClient,
  } =
    auth;


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
      activeWeekResult.error.message,
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
   * SUMMER AUTOMATION / NEXT-SEASON READINESS
   *
   * These RPCs must use the authenticated user client because the
   * database readiness function checks auth.uid(). Using the admin
   * service-role client here would lose that JWT identity.
   */
  const renewalReadinessResult =
    await userClient.rpc(
      "get_season_long_rollover_readiness",
      {
        p_league_id:
          leagueId,
      }
    );


  if (
    renewalReadinessResult.error
  ) {
    return jsonError(
      renewalReadinessResult.error.message,
      500
    );
  }


  const [
    settingsResult,
    scoringResult,
    teamsResult,
    standingsResult,
    h2hStandingsResult,
    h2hMatchupsResult,
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
          "season_long_h2h_standings"
        )
        .select(`
          fantasy_team_id,
          wins,
          losses,
          ties,
          points_for,
          points_against,
          games_played,
          win_percentage,
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
          "season_long_matchups"
        )
        .select(`
          id,
          week,
          home_fantasy_team_id,
          away_fantasy_team_id,
          home_points,
          away_points,
          home_score_final,
          away_score_final,
          is_final
        `)
        .eq(
          "league_id",
          leagueId
        )
        .eq(
          "season",
          league.season
        )
        .eq(
          "matchup_type",
          "regular_season"
        )
        .order(
          "week",
          {
            ascending:
              true,
          }
        )
        .order(
          "id",
          {
            ascending:
              true,
          }
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
    h2hStandingsResult,
    h2hMatchupsResult,
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
    h2hStandings:
      h2hStandingsResult.data ??
      [],
    h2hMatchupCount:
      (
        h2hMatchupsResult.data ??
        []
      ).length,
    regularSeasonWeeks:
      integer(
        settingsResult.data?.regular_season_weeks,
        14,
        1,
        18
      ),
    matchups:
      (
        h2hMatchupsResult.data ??
        []
      ).map(
        (
          matchup
        ) => ({
          id:
            matchup.id,
          week:
            matchup.week,
          home_team_id:
            matchup.home_fantasy_team_id,
          away_team_id:
            matchup.away_fantasy_team_id,
          home_points:
            matchup.home_points,
          away_points:
            matchup.away_points,
          home_score_final:
            matchup.home_score_final,
          away_score_final:
            matchup.away_score_final,
          is_final:
            matchup.is_final,
        })
      ),
    activeWeek,
    submittedEntries:
      submittedResult.count ??
      0,
    renewalReadiness:
      renewalReadinessResult.data,
  });
}


export async function POST(
  request:
    Request,
  context:
    RouteContext
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
    !auth.admin ||
    !auth.userClient
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
    userClient,
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


  if (
    action ===
    "renew-season"
  ) {
    const expectedCurrentSeason =
      integer(
        body.expectedCurrentSeason,
        0,
        1,
        9999
      );


    if (
      expectedCurrentSeason !==
      league.season
    ) {
      return jsonError(
        `League season changed. Expected ${expectedCurrentSeason}, current season is ${league.season}. Refresh the commissioner page before renewing.`,
        409
      );
    }


    /*
     * Re-check readiness on the server immediately before rollover.
     * The UI status is informational; this server-side gate is the
     * authoritative protection against an early or duplicate renewal.
     */
    const {
      data:
        readinessData,
      error:
        readinessError,
    } =
      await userClient.rpc(
        "get_season_long_rollover_readiness",
        {
          p_league_id:
            leagueId,
        }
      );


    if (
      readinessError
    ) {
      return jsonError(
        readinessError.message,
        500
      );
    }


    const readiness =
      (
        readinessData ??
        {}
      ) as {
        success?: boolean;
        ready?: boolean;
        reason?: string;
        currentSeason?: number;
        nextSeason?: number;
      };


    if (
      readiness.success ===
      false
    ) {
      return jsonError(
        readiness.reason ??
          "Unable to verify Season-Long renewal readiness.",
        409
      );
    }


    if (
      readiness.ready !==
      true
    ) {
      return jsonError(
        readiness.reason ??
          `Season ${league.season} is not ready to renew.`,
        409
      );
    }


    const {
      data:
        rolloverData,
      error:
        rolloverError,
    } =
      await userClient.rpc(
        "rollover_season_long_league_season",
        {
          p_league_id:
            leagueId,
          p_expected_current_season:
            expectedCurrentSeason,
        }
      );


    if (
      rolloverError
    ) {
      return jsonError(
        rolloverError.message,
        409
      );
    }


    return NextResponse.json({
      success:
        true,
      leagueId,
      previousSeason:
        expectedCurrentSeason,
      newSeason:
        expectedCurrentSeason +
        1,
      result:
        rolloverData,
    });
  }


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
      competition_format:
        String(
          source.competition_format ??
          "total_points"
        ) === "head_to_head"
          ? "head_to_head"
          : "total_points",
      regular_season_weeks:
        integer(
          source.regular_season_weeks,
          14,
          1,
          18
        ),
      playoffs_enabled:
        Boolean(
          source.playoffs_enabled ??
          true
        ),
      playoff_team_count:
        integer(
          source.playoff_team_count,
          6,
          2,
          Number.MAX_SAFE_INTEGER
        ),
      reseed_playoffs:
        Boolean(
          source.reseed_playoffs ??
          true
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


  if (
    action ===
    "randomize-h2h-schedule"
  ) {
    const {
      data:
        result,
      error:
        resultError,
    } =
      await userClient.rpc(
        "commissioner_generate_season_long_h2h_schedule",
        {
          p_league_id:
            leagueId,
          p_season:
            league.season,
          p_randomize:
            true,
        }
      );


    if (
      resultError
    ) {
      return jsonError(
        resultError.message,
        409
      );
    }


    return NextResponse.json({
      success:
        true,
      result,
    });
  }


  if (
    action ===
    "save-h2h-schedule-week"
  ) {
    const week =
      integer(
        body.week,
        0,
        1,
        18
      );


    if (!week) {
      return jsonError(
        "A valid regular-season week is required.",
        400
      );
    }


    if (
      !Array.isArray(
        body.matchups
      )
    ) {
      return jsonError(
        "Matchups must be supplied as an array.",
        400
      );
    }


    const normalizedMatchups =
      body.matchups.map(
        (
          matchup
        ) => {
          const source =
            (
              matchup ??
              {}
            ) as Record<
              string,
              unknown
            >;

          const homeRaw =
            source.homeTeamId;

          const awayRaw =
            source.awayTeamId;

          const homeTeamId =
            homeRaw ===
              null ||
            homeRaw ===
              undefined ||
            homeRaw ===
              ""
              ? null
              : integer(
                  homeRaw,
                  0,
                  1,
                  Number.MAX_SAFE_INTEGER
                );

          const awayTeamId =
            awayRaw ===
              null ||
            awayRaw ===
              undefined ||
            awayRaw ===
              ""
              ? null
              : integer(
                  awayRaw,
                  0,
                  1,
                  Number.MAX_SAFE_INTEGER
                );

          return {
            homeTeamId:
              homeTeamId ||
              null,
            awayTeamId:
              awayTeamId ||
              null,
          };
        }
      );


    const {
      data:
        result,
      error:
        resultError,
    } =
      await userClient.rpc(
        "commissioner_replace_season_long_h2h_week",
        {
          p_league_id:
            leagueId,
          p_season:
            league.season,
          p_week:
            week,
          p_matchups:
            normalizedMatchups,
        }
      );


    if (
      resultError
    ) {
      return jsonError(
        resultError.message,
        409
      );
    }


    return NextResponse.json({
      success:
        true,
      result,
    });
  }


  if (
    action ===
    "set-h2h-matchup"
  ) {
    const week =
      integer(
        body.week,
        0,
        1,
        18
      );

    const homeFantasyTeamId =
      integer(
        body.homeFantasyTeamId,
        0,
        1,
        Number.MAX_SAFE_INTEGER
      );

    const awayFantasyTeamId =
      integer(
        body.awayFantasyTeamId,
        0,
        1,
        Number.MAX_SAFE_INTEGER
      );

    const matchupId =
      body.matchupId ===
        null ||
      body.matchupId ===
        undefined ||
      body.matchupId ===
        ""
        ? null
        : integer(
            body.matchupId,
            0,
            1,
            Number.MAX_SAFE_INTEGER
          );


    if (
      !week ||
      !homeFantasyTeamId ||
      !awayFantasyTeamId
    ) {
      return jsonError(
        "Week, home team and away team are required.",
        400
      );
    }


    const {
      data:
        result,
      error:
        resultError,
    } =
      await userClient.rpc(
        "commissioner_set_season_long_h2h_matchup",
        {
          p_league_id:
            leagueId,
          p_season:
            league.season,
          p_week:
            week,
          p_home_fantasy_team_id:
            homeFantasyTeamId,
          p_away_fantasy_team_id:
            awayFantasyTeamId,
          p_matchup_id:
            matchupId,
        }
      );


    if (
      resultError
    ) {
      return jsonError(
        resultError.message,
        409
      );
    }


    return NextResponse.json({
      success:
        true,
      result,
    });
  }


  if (
    action ===
    "delete-h2h-matchup"
  ) {
    const matchupId =
      integer(
        body.matchupId,
        0,
        1,
        Number.MAX_SAFE_INTEGER
      );


    if (!matchupId) {
      return jsonError(
        "A valid matchup ID is required.",
        400
      );
    }


    const {
      data:
        result,
      error:
        resultError,
    } =
      await userClient.rpc(
        "commissioner_delete_season_long_h2h_matchup",
        {
          p_league_id:
            leagueId,
          p_season:
            league.season,
          p_matchup_id:
            matchupId,
        }
      );


    if (
      resultError
    ) {
      return jsonError(
        resultError.message,
        409
      );
    }


    return NextResponse.json({
      success:
        true,
      result,
    });
  }


  if (
    action ===
    "build-h2h-schedule"
  ) {
    /*
     * Compatibility action for any older UI still calling
     * "build-h2h-schedule". Route it through the new protected
     * commissioner generator instead of the legacy unguarded builder.
     */
    const {
      data:
        result,
      error:
        resultError,
    } =
      await userClient.rpc(
        "commissioner_generate_season_long_h2h_schedule",
        {
          p_league_id:
            leagueId,
          p_season:
            league.season,
          p_randomize:
            false,
        }
      );


    if (
      resultError
    ) {
      return jsonError(
        resultError.message,
        409
      );
    }


    return NextResponse.json({
      success:
        true,
      result,
    });
  }


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