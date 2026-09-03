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
  season_long_history_id: string | null;
};

type MembershipRow = {
  user_id: string;
  role: string;
};

type TeamRow = {
  id: number;
  owner_id: string | null;
  team_name: string;
  active: boolean;
  season_long_franchise_id: string | null;
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

function cleanCopiedRow(
  row:
    Record<
      string,
      unknown
    >,
  overrides:
    Record<
      string,
      unknown
    >
) {
  const copy = {
    ...row,
  };

  delete copy.id;
  delete copy.created_at;
  delete copy.updated_at;

  return {
    ...copy,
    ...overrides,
  };
}

async function requireCommissioner(
  leagueId: string
) {
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
    return {
      error:
        "You must be signed in.",
      status:
        401,
      userId:
        null,
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
        commissioner_user_id,
        season_long_history_id
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
      userId:
        null,
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
      userId:
        null,
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
      userId:
        null,
      league:
        null,
      admin:
        null,
    };
  }

  const isCommissioner =
    league.commissioner_user_id ===
    userData.user.id;

  if (
    !isCommissioner
  ) {
    return {
      error:
        "Commissioner access is required.",
      status:
        403,
      userId:
        null,
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
    userId:
      userData.user.id,
    league,
    admin,
  };
}

export async function POST(
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
    !auth.userId ||
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
    userId,
  } =
    auth;

  const targetSeason =
    league.season +
    1;

  /*
   * ----------------------------------------------------------
   * CONTINUOUS HISTORY IDENTITY
   * ----------------------------------------------------------
   * The migration creates a permanent history id for the league
   * and a permanent franchise id for every Season-Long team.
   */
  const historyIdentityResult =
    await admin.rpc(
      "ensure_season_long_history_identity",
      {
        p_league_id:
          league.id,
      }
    );

  if (
    historyIdentityResult.error
  ) {
    return jsonError(
      historyIdentityResult.error.message,
      500
    );
  }

  const historyId =
    String(
      historyIdentityResult.data ??
      league.season_long_history_id ??
      ""
    );

  if (
    !historyId
  ) {
    return jsonError(
      "Could not initialize the continuous Season-Long league history.",
      500
    );
  }

  /*
   * ----------------------------------------------------------
   * FORMAT-AWARE SEASON COMPLETION SAFEGUARD
   * ----------------------------------------------------------
   * Total Points:
   *   requires every active team to have a final score in the
   *   configured final Season-Long week.
   *
   * Head-to-Head without playoffs:
   *   requires every scheduled regular-season matchup through
   *   regular_season_weeks to be final.
   *
   * Head-to-Head with playoffs:
   *   requires the playoff state to be complete with a champion.
   */
  const [
    activeTeamsResult,
    completionSettingsResult,
  ] =
    await Promise.all([
      admin
        .from(
          "fantasy_teams"
        )
        .select(
          "id"
        )
        .eq(
          "league_id",
          league.id
        )
        .eq(
          "active",
          true
        ),

      admin
        .from(
          "season_long_settings"
        )
        .select(`
          competition_format,
          regular_season_weeks,
          playoffs_enabled
        `)
        .eq(
          "league_id",
          league.id
        )
        .maybeSingle(),
    ]);

  if (
    activeTeamsResult.error
  ) {
    return jsonError(
      activeTeamsResult.error.message,
      500
    );
  }

  if (
    completionSettingsResult.error
  ) {
    return jsonError(
      completionSettingsResult.error.message,
      500
    );
  }

  const activeTeamIds =
    new Set(
      (
        activeTeamsResult.data ??
        []
      ).map(
        (
          row
        ) =>
          Number(
            row.id
          )
      )
    );

  if (
    activeTeamIds.size ===
    0
  ) {
    return jsonError(
      "This Season-Long league has no active teams to renew.",
      409
    );
  }

  const completionSettings =
    completionSettingsResult.data as
      | {
          competition_format:
            string |
            null;
          regular_season_weeks:
            number |
            null;
          playoffs_enabled:
            boolean |
            null;
        }
      | null;

  const competitionFormat =
    completionSettings
      ?.competition_format ===
    "head_to_head"
      ? "head_to_head"
      : "total_points";

  const regularSeasonWeeks =
    Math.max(
      1,
      Number(
        completionSettings
          ?.regular_season_weeks ??
        18
      )
    );

  const playoffsEnabled =
    competitionFormat ===
      "head_to_head" &&
    Boolean(
      completionSettings
        ?.playoffs_enabled
    );

  if (
    competitionFormat ===
    "head_to_head"
  ) {
    const regularMatchupsResult =
      await admin
        .from(
          "season_long_matchups"
        )
        .select(
          "id,is_final"
        )
        .eq(
          "league_id",
          league.id
        )
        .eq(
          "season",
          league.season
        )
        .eq(
          "matchup_type",
          "regular_season"
        )
        .lte(
          "week",
          regularSeasonWeeks
        );

    if (
      regularMatchupsResult.error
    ) {
      return jsonError(
        regularMatchupsResult
          .error.message,
        500
      );
    }

    const regularMatchups =
      regularMatchupsResult.data ??
      [];

    const regularSeasonComplete =
      regularMatchups.length >
        0 &&
      regularMatchups.every(
        (
          matchup
        ) =>
          matchup.is_final ===
          true
      );

    if (
      !regularSeasonComplete
    ) {
      return jsonError(
        `This Head-to-Head league can be renewed after all regular-season matchups through Week ${regularSeasonWeeks} are final.`,
        409
      );
    }

    if (
      playoffsEnabled
    ) {
      const playoffStateResult =
        await admin
          .from(
            "season_long_playoff_state"
          )
          .select(
            "status,champion_fantasy_team_id"
          )
          .eq(
            "league_id",
            league.id
          )
          .eq(
            "season",
            league.season
          )
          .maybeSingle();

      if (
        playoffStateResult.error
      ) {
        return jsonError(
          playoffStateResult
            .error.message,
          500
        );
      }

      const playoffStatus =
        String(
          playoffStateResult
            .data
            ?.status ??
          ""
        ).toLowerCase();

      const playoffComplete =
        (
          playoffStatus ===
            "complete" ||
          playoffStatus ===
            "completed"
        ) &&
        Boolean(
          playoffStateResult
            .data
            ?.champion_fantasy_team_id
        );

      if (
        !playoffComplete
      ) {
        return jsonError(
          "This Head-to-Head league can be renewed after the fantasy playoffs are complete and a champion has been finalized.",
          409
        );
      }
    }
  } else {
    const finalWeekResult =
      await admin
        .from(
          "season_long_weekly_scores"
        )
        .select(
          "fantasy_team_id,is_final"
        )
        .eq(
          "league_id",
          league.id
        )
        .eq(
          "season",
          league.season
        )
        .eq(
          "week",
          regularSeasonWeeks
        )
        .eq(
          "is_final",
          true
        );

    if (
      finalWeekResult.error
    ) {
      return jsonError(
        finalWeekResult
          .error.message,
        500
      );
    }

    const finalTeamIds =
      new Set(
        (
          finalWeekResult.data ??
          []
        ).map(
          (
            row
          ) =>
            Number(
              row.fantasy_team_id
            )
        )
      );

    const seasonComplete =
      Array.from(
        activeTeamIds
      ).every(
        (
          teamId
        ) =>
          finalTeamIds.has(
            teamId
          )
      );

    if (
      !seasonComplete
    ) {
      return jsonError(
        `This Total Points league can be renewed after every active team has a final Week ${regularSeasonWeeks} score.`,
        409
      );
    }
  }

  /*
   * ----------------------------------------------------------
   * IDEMPOTENCY
   * ----------------------------------------------------------
   * If this league was already renewed into the same season,
   * return that existing renewed league instead of creating
   * another one.
   */
  const existingRenewal =
    await admin
      .from(
        "season_long_league_renewals"
      )
      .select(
        "target_league_id,target_season"
      )
      .eq(
        "source_league_id",
        league.id
      )
      .eq(
        "target_season",
        targetSeason
      )
      .maybeSingle();

  if (
    existingRenewal.error
  ) {
    return jsonError(
      existingRenewal
        .error.message,
      500
    );
  }

  if (
    existingRenewal.data
  ) {
    return NextResponse.json({
      success:
        true,
      alreadyRenewed:
        true,
      leagueId:
        existingRenewal
          .data
          .target_league_id,
      season:
        existingRenewal
          .data
          .target_season,
    });
  }

  /*
   * ----------------------------------------------------------
   * LOAD REUSABLE LEAGUE CONFIGURATION
   * ----------------------------------------------------------
   */
  const [
    settingsResult,
    scoringSettingsResult,
    scoringRulesResult,
    membershipsResult,
    teamsResult,
  ] =
    await Promise.all([
      admin
        .from(
          "season_long_settings"
        )
        .select("*")
        .eq(
          "league_id",
          league.id
        )
        .maybeSingle(),

      admin
        .from(
          "league_scoring_settings"
        )
        .select("*")
        .eq(
          "league_id",
          league.id
        )
        .maybeSingle(),

      admin
        .from(
          "league_scoring_rules"
        )
        .select(
          "rule_key,enabled,points"
        )
        .eq(
          "league_id",
          league.id
        ),

      admin
        .from(
          "league_members"
        )
        .select(
          "user_id,role"
        )
        .eq(
          "league_id",
          league.id
        ),

      admin
        .from(
          "fantasy_teams"
        )
        .select(
          "id,owner_id,team_name,active,season_long_franchise_id"
        )
        .eq(
          "league_id",
          league.id
        )
        .eq(
          "active",
          true
        ),
    ]);

  for (
    const result
    of [
      settingsResult,
      scoringSettingsResult,
      scoringRulesResult,
      membershipsResult,
      teamsResult,
    ]
  ) {
    if (
      result.error
    ) {
      return jsonError(
        result.error.message,
        500
      );
    }
  }

  /*
   * ----------------------------------------------------------
   * CREATE NEXT-SEASON LEAGUE
   * ----------------------------------------------------------
   */
  const {
    data:
      newLeague,
    error:
      newLeagueError,
  } =
    await admin
      .from(
        "leagues"
      )
      .insert({
        name:
          league.name,
        league_type:
          "season_long",
        player_selection_mode:
          league.player_selection_mode,
        season:
          targetSeason,
        commissioner_user_id:
          league.commissioner_user_id ??
          userId,
        status:
          "setup",
        season_long_history_id:
          historyId,
      })
      .select(
        "id,name,season"
      )
      .single();

  if (
    newLeagueError ||
    !newLeague
  ) {
    return jsonError(
      newLeagueError
        ?.message ??
        "Could not create the renewed league.",
      500
    );
  }

  const newLeagueId =
    newLeague.id;

  /*
   * ----------------------------------------------------------
   * CLEANUP HELPER
   * ----------------------------------------------------------
   * If a later copy step fails, deleting the newly-created
   * league cascades its child rows so the commissioner can
   * safely try again.
   */
  async function rollback(
    message:
      string
  ) {
    await admin
      .from(
        "leagues"
      )
      .delete()
      .eq(
        "id",
        newLeagueId
      );

    return jsonError(
      message,
      500
    );
  }

  /*
   * ----------------------------------------------------------
   * COPY MEMBERSHIPS
   * ----------------------------------------------------------
   */
  const memberships =
    (
      membershipsResult.data ??
      []
    ) as MembershipRow[];

  if (
    memberships.length >
    0
  ) {
    const membershipInsert =
      await admin
        .from(
          "league_members"
        )
        .insert(
          memberships.map(
            (
              membership
            ) => ({
              league_id:
                newLeagueId,
              user_id:
                membership.user_id,
              role:
                membership.role,
            })
          )
        );

    if (
      membershipInsert.error
    ) {
      return rollback(
        membershipInsert
          .error.message
      );
    }
  }

  /*
   * ----------------------------------------------------------
   * COPY ACTIVE TEAMS / OWNERS
   * ----------------------------------------------------------
   */
  const teams =
    (
      teamsResult.data ??
      []
    ) as TeamRow[];

  if (
    teams.length >
    0
  ) {
    const teamInsert =
      await admin
        .from(
          "fantasy_teams"
        )
        .insert(
          teams.map(
            (
              team
            ) => ({
              league_id:
                newLeagueId,
              owner_id:
                team.owner_id,
              team_name:
                team.team_name,
              active:
                true,
              season_long_franchise_id:
                team.season_long_franchise_id,
            })
          )
        );

    if (
      teamInsert.error
    ) {
      return rollback(
        teamInsert
          .error.message
      );
    }
  }

  /*
   * ----------------------------------------------------------
   * COPY SEASON-LONG SETTINGS
   * ----------------------------------------------------------
   */
  if (
    settingsResult.data
  ) {
    const settingsCopy =
      cleanCopiedRow(
        settingsResult
          .data as Record<
            string,
            unknown
          >,
        {
          league_id:
            newLeagueId,
          season:
            targetSeason,

          ...(competitionFormat ===
          "total_points"
            ? {
                competition_format:
                  "total_points",
                playoffs_enabled:
                  false,
              }
            : {
                competition_format:
                  "head_to_head",
              }),
        }
      );

    const settingsInsert =
      await admin
        .from(
          "season_long_settings"
        )
        .insert(
          settingsCopy
        );

    if (
      settingsInsert.error
    ) {
      return rollback(
        settingsInsert
          .error.message
      );
    }
  }

  /*
   * ----------------------------------------------------------
   * COPY LEGACY / AGGREGATE SCORING SETTINGS
   * ----------------------------------------------------------
   */
  if (
    scoringSettingsResult.data
  ) {
    const scoringCopy =
      cleanCopiedRow(
        scoringSettingsResult
          .data as Record<
            string,
            unknown
          >,
        {
          league_id:
            newLeagueId,
        }
      );

    const scoringInsert =
      await admin
        .from(
          "league_scoring_settings"
        )
        .insert(
          scoringCopy
        );

    if (
      scoringInsert.error
    ) {
      return rollback(
        scoringInsert
          .error.message
      );
    }
  }

  /*
   * ----------------------------------------------------------
   * COPY CUSTOM SCORING RULES
   * ----------------------------------------------------------
   */
  const scoringRules =
    scoringRulesResult.data ??
    [];

  if (
    scoringRules.length >
    0
  ) {
    const rulesInsert =
      await admin
        .from(
          "league_scoring_rules"
        )
        .insert(
          scoringRules.map(
            (
              rule
            ) => ({
              league_id:
                newLeagueId,
              rule_key:
                rule.rule_key,
              enabled:
                rule.enabled,
              points:
                rule.points,
            })
          )
        );

    if (
      rulesInsert.error
    ) {
      return rollback(
        rulesInsert
          .error.message
      );
    }
  }

  /*
   * ----------------------------------------------------------
   * INITIALIZE FRESH H2H SEASON
   * ----------------------------------------------------------
   * The new league receives new fantasy_team ids, so no old
   * matchup / standings / playoff rows are copied. Build the
   * new regular-season schedule from the renewed teams instead.
   */
  let h2hMatchupsCreated =
    0;

  if (
    competitionFormat ===
    "head_to_head"
  ) {
    const {
      data:
        h2hScheduleData,
      error:
        h2hScheduleError,
    } =
      await admin.rpc(
        "build_season_long_h2h_schedule",
        {
          p_league_id:
            newLeagueId,
          p_season:
            targetSeason,
        }
      );

    if (
      h2hScheduleError
    ) {
      return rollback(
        h2hScheduleError.message
      );
    }

    h2hMatchupsCreated =
      Number(
        h2hScheduleData ??
        0
      );

    const {
      error:
        h2hStandingsError,
    } =
      await admin.rpc(
        "rebuild_season_long_h2h_standings",
        {
          p_league_id:
            newLeagueId,
          p_season:
            targetSeason,
        }
      );

    if (
      h2hStandingsError
    ) {
      return rollback(
        h2hStandingsError.message
      );
    }
  }

  /*
   * ----------------------------------------------------------
   * RECORD THE RENEWAL
   * ----------------------------------------------------------
   */
  const renewalInsert =
    await admin
      .from(
        "season_long_league_renewals"
      )
      .insert({
        source_league_id:
          league.id,
        target_league_id:
          newLeagueId,
        source_season:
          league.season,
        target_season:
          targetSeason,
        renewed_by:
          userId,
      });

  if (
    renewalInsert.error
  ) {
    return rollback(
      renewalInsert
        .error.message
    );
  }

  /*
   * Fresh weekly entries, lineups, weekly scores, standings and
   * salaries are intentionally NOT copied.
   *
   * Badge/honor rows also remain in their original season. The new
   * league sees them through season_long_history_id plus each team's
   * persistent season_long_franchise_id, so there are no duplicate
   * trophy rows in the renewed season.
   */
  return NextResponse.json({
    success:
      true,
    alreadyRenewed:
      false,
    leagueId:
      newLeagueId,
    season:
      targetSeason,
    historyId,
    competitionFormat,
    playerSelectionMode:
      league.player_selection_mode,
    h2hMatchupsCreated,
  });
}