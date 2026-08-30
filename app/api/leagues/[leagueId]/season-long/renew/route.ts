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

type MembershipRow = {
  user_id: string;
  role: string;
};

type TeamRow = {
  owner_id: string | null;
  team_name: string;
  active: boolean;
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
        userId:
          null,
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
          "owner_id,team_name,active"
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
   * Fresh weekly entries, lineups, weekly scores, standings,
   * salaries and trophy rows are intentionally NOT copied.
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
  });
}
