import type {
  SupabaseClient,
} from "@supabase/supabase-js";


export type LeagueType =
  | "traditional"
  | "season_long"
  | "nfl_playoffs"
  | "pickem";


export type PlayerSelectionMode =
  | "draft"
  | "salary"
  | "no_salary"
  | "pickem";


export type LeagueMemberRole =
  | "commissioner"
  | "co_commissioner"
  | "member";


export type CreateLeagueInput = {
  name: string;

  leagueType:
    LeagueType;

  playerSelectionMode:
    PlayerSelectionMode;

  season:
    number;

  teamName?:
    string;

  regularSeasonWeeks?:
    number;
};


export type CreateLeagueResult = {
  success:
    boolean;

  leagueId:
    string;

  leagueType:
    LeagueType;

  playerSelectionMode:
    PlayerSelectionMode;

  season:
    number;

  role:
    LeagueMemberRole;

  fantasyTeamId:
    number | null;
};


export type MyLeague = {
  id:
    string;

  name:
    string;

  leagueType:
    LeagueType;

  playerSelectionMode:
    PlayerSelectionMode;

  season:
    number;

  status:
    string;

  role:
    string;

  commissionerUserId:
    string;

  teamId:
    number | null;

  teamName:
    string | null;

  createdAt:
    string;
};


type MembershipRow = {
  league_id:
    string;

  role:
    string;
};


type LeagueRow = {
  id:
    string;

  name:
    string;

  league_type:
    LeagueType;

  player_selection_mode:
    PlayerSelectionMode;

  season:
    number;

  status:
    string;

  commissioner_user_id:
    string;

  created_at:
    string;
};


type FantasyTeamRow = {
  id:
    number;

  league_id:
    string;

  team_name:
    string;
};


function cleanRequiredText(
  value:
    string,

  fieldName:
    string,

  maxLength =
    100
) {
  const clean =
    value.trim();

  if (!clean) {
    throw new Error(
      `${fieldName} is required.`
    );
  }

  if (
    clean.length >
    maxLength
  ) {
    throw new Error(
      `${fieldName} must be ${maxLength} characters or fewer.`
    );
  }

  return clean;
}


function validateSeason(
  season:
    number
) {
  if (
    !Number.isInteger(
      season
    ) ||
    season < 2000 ||
    season > 2200
  ) {
    throw new Error(
      "A valid season is required."
    );
  }

  return season;
}


function validateLeagueCombination(
  leagueType:
    LeagueType,

  playerSelectionMode:
    PlayerSelectionMode
) {
  if (
    leagueType ===
      "traditional" &&
    playerSelectionMode !==
      "draft"
  ) {
    throw new Error(
      "Traditional leagues must use a draft."
    );
  }


  if (
    (
      leagueType ===
        "season_long" ||
      leagueType ===
        "nfl_playoffs"
    ) &&
    ![
      "salary",
      "no_salary",
    ].includes(
      playerSelectionMode
    )
  ) {
    throw new Error(
      "Season-Long and NFL Playoffs leagues must use Salary Cap or No Salary Cap."
    );
  }


  if (
    leagueType === "pickem" &&
    playerSelectionMode !== "pickem"
  ) {
    throw new Error(
      "G365 Football Pick'em leagues must use Pick'em mode."
    );
  }


  if (
    leagueType !== "traditional" &&
    playerSelectionMode === "draft"
  ) {
    throw new Error(
      "Only Traditional leagues can use a draft."
    );
  }


  if (
    leagueType !== "pickem" &&
    playerSelectionMode === "pickem"
  ) {
    throw new Error(
      "Pick'em mode can only be used by G365 Football Pick'em leagues."
    );
  }
}


async function initializeNewPickemLeagueImmediately(
  supabase:
    SupabaseClient,
  leagueId:
    string
) {
  /*
   * A brand-new Pick'em league should be usable immediately.
   *
   * The global lifecycle cron remains the permanent maintenance
   * and fallback system for every Pick'em league. This call simply
   * avoids making the commissioner wait for the next scheduled run.
   *
   * IMPORTANT:
   * League creation itself must remain successful even if ESPN or
   * the lifecycle endpoint is temporarily unavailable. In that case
   * the global cron will repair/prepare the league automatically.
   */
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }

  try {
    const {
      data:
        sessionData,
    } =
      await supabase.auth
        .getSession();

    const accessToken =
      sessionData.session
        ?.access_token;

    if (!accessToken) {
      console.warn(
        "Pick'em league was created, but immediate lifecycle preparation was skipped because the session token was unavailable."
      );
      return;
    }

    const response =
      await fetch(
        "/api/pickem/commissioner-sync",
        {
          method:
            "POST",
          headers: {
            "Content-Type":
              "application/json",
            Authorization:
              `Bearer ${accessToken}`,
          },
          body:
            JSON.stringify({
              leagueId,
            }),
        }
      );

    if (!response.ok) {
      const body =
        await response
          .text()
          .catch(
            () => ""
          );

      console.warn(
        `Pick'em league ${leagueId} was created, but immediate lifecycle preparation returned HTTP ${response.status}. The global lifecycle cron will retry automatically.${body ? ` Response: ${body.slice(0, 300)}` : ""}`
      );
    }
  } catch (error) {
    console.warn(
      `Pick'em league ${leagueId} was created, but immediate lifecycle preparation failed. The global lifecycle cron will retry automatically.`,
      error
    );
  }
}


export async function createLeague(
  supabase:
    SupabaseClient,

  input:
    CreateLeagueInput
): Promise<CreateLeagueResult> {
  const name =
    cleanRequiredText(
      input.name,
      "League name"
    );

  const season =
    validateSeason(
      input.season
    );


  validateLeagueCombination(
    input.leagueType,
    input.playerSelectionMode
  );


  let teamName:
    string | null =
      null;

  let regularSeasonWeeks:
    number | null =
      null;


  /*
   * Traditional and Season-Long leagues
   * both use fantasy_teams.
   *
   * Traditional:
   *   permanent drafted roster
   *
   * Season-Long:
   *   participant identity / weekly
   *   lineup ownership
   */
  if (
    input.leagueType ===
      "traditional" ||
    input.leagueType ===
      "season_long" ||
    input.leagueType ===
      "pickem"
  ) {
    teamName =
      cleanRequiredText(
        input.teamName ??
          "",
        "Team name"
      );
  }


  /*
   * Only Traditional leagues use
   * regular-season matchup weeks.
   */
  if (
    input.leagueType ===
    "traditional"
  ) {
    regularSeasonWeeks =
      input.regularSeasonWeeks ??
      14;


    if (
      !Number.isInteger(
        regularSeasonWeeks
      ) ||
      regularSeasonWeeks <
        1 ||
      regularSeasonWeeks >
        18
    ) {
      throw new Error(
        "Regular-season weeks must be between 1 and 18."
      );
    }
  }


  const {
    data,
    error,
  } =
    input.leagueType === "pickem"
      ? await supabase.rpc(
          "create_pickem_league_transaction",
          {
            p_name: name,
            p_season: season,
            p_entry_name: teamName,
          }
        )
      : await supabase.rpc(
          "create_league_transaction",
          {
            p_name: name,
            p_league_type: input.leagueType,
            p_player_selection_mode: input.playerSelectionMode,
            p_season: season,
            p_team_name: teamName,
            p_regular_season_weeks: regularSeasonWeeks,
          }
        );


  if (error) {
    throw new Error(
      error.message
    );
  }


  if (
    !data ||
    typeof data !==
      "object"
  ) {
    throw new Error(
      "League creation returned an invalid response."
    );
  }


  const result =
    data as Record<
      string,
      unknown
    >;


  const leagueId =
    result.leagueId;


  if (
    typeof leagueId !==
    "string"
  ) {
    throw new Error(
      "League creation did not return a league ID."
    );
  }


  const returnedLeagueType =
    result.leagueType;


  const returnedSelectionMode =
    result.playerSelectionMode;


  if (
    returnedLeagueType !==
      "traditional" &&
    returnedLeagueType !==
      "season_long" &&
    returnedLeagueType !==
      "nfl_playoffs" &&
    returnedLeagueType !==
      "pickem"
  ) {
    throw new Error(
      "League creation returned an invalid league type."
    );
  }


  if (
    returnedSelectionMode !==
      "draft" &&
    returnedSelectionMode !==
      "salary" &&
    returnedSelectionMode !==
      "no_salary" &&
    returnedSelectionMode !==
      "pickem"
  ) {
    throw new Error(
      "League creation returned an invalid player selection mode."
    );
  }


  const returnedRole =
    result.role;


  if (
    returnedRole !==
      "commissioner" &&
    returnedRole !==
      "co_commissioner" &&
    returnedRole !==
      "member"
  ) {
    throw new Error(
      "League creation returned an invalid league role."
    );
  }


  const rawFantasyTeamId =
    result.fantasyTeamId;


  let fantasyTeamId:
    number | null =
      null;


  if (
    typeof rawFantasyTeamId ===
      "number"
  ) {
    fantasyTeamId =
      rawFantasyTeamId;
  } else if (
    typeof rawFantasyTeamId ===
      "string" &&
    rawFantasyTeamId.trim() !==
      ""
  ) {
    const parsed =
      Number(
        rawFantasyTeamId
      );

    if (
      Number.isFinite(
        parsed
      )
    ) {
      fantasyTeamId =
        parsed;
    }
  }


  if (
    returnedLeagueType ===
      "pickem" &&
    result.success ===
      true
  ) {
    await initializeNewPickemLeagueImmediately(
      supabase,
      leagueId
    );
  }


  return {
    success:
      result.success ===
      true,

    leagueId,

    leagueType:
      returnedLeagueType,

    playerSelectionMode:
      returnedSelectionMode,

    season:
      Number(
        result.season
      ),

    role:
      returnedRole,

    fantasyTeamId,
  };
}


export async function getMyLeagues(
  supabase:
    SupabaseClient,

  userId:
    string
): Promise<MyLeague[]> {

  /*
   * STEP 1
   *
   * Find exactly which leagues
   * this user belongs to.
   */
  const {
    data:
      membershipData,

    error:
      membershipError,
  } =
    await supabase
      .from(
        "league_members"
      )
      .select(
        "league_id, role"
      )
      .eq(
        "user_id",
        userId
      );


  if (
    membershipError
  ) {
    throw new Error(
      `Could not load league memberships: ${membershipError.message}`
    );
  }


  const memberships =
    (
      membershipData ??
      []
    ) as MembershipRow[];


  if (
    memberships.length ===
    0
  ) {
    return [];
  }


  const leagueIds =
    memberships.map(
      (
        membership
      ) =>
        membership
          .league_id
    );


  /*
   * STEP 2
   *
   * Load all of the user's leagues.
   */
  const {
    data:
      leagueData,

    error:
      leagueError,
  } =
    await supabase
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
        created_at
      `)
      .in(
        "id",
        leagueIds
      );


  if (
    leagueError
  ) {
    throw new Error(
      `Could not load leagues: ${leagueError.message}`
    );
  }


  const leagues =
    (
      leagueData ??
      []
    ) as LeagueRow[];


  /*
   * STEP 3
   *
   * Load fantasy teams.
   *
   * This now applies to:
   *
   *   Traditional
   *   Season-Long Salary
   *   Season-Long No-Salary
   *
   * NFL Playoffs can use its own
   * participant/entry model when
   * that format is built.
   */
  const {
    data:
      teamData,

    error:
      teamError,
  } =
    await supabase
      .from(
        "fantasy_teams"
      )
      .select(
        "id, league_id, team_name"
      )
      .eq(
        "owner_id",
        userId
      )
      .eq(
        "active",
        true
      )
      .in(
        "league_id",
        leagueIds
      );


  if (
    teamError
  ) {
    throw new Error(
      `Could not load fantasy teams: ${teamError.message}`
    );
  }


  const teams =
    (
      teamData ??
      []
    ) as FantasyTeamRow[];


  /*
   * Fast lookup maps.
   */
  const membershipByLeague =
    new Map<
      string,
      MembershipRow
    >();


  for (
    const membership
    of memberships
  ) {
    membershipByLeague.set(
      membership
        .league_id,

      membership
    );
  }


  const teamByLeague =
    new Map<
      string,
      FantasyTeamRow
    >();


  for (
    const team
    of teams
  ) {
    teamByLeague.set(
      team.league_id,
      team
    );
  }


  /*
   * STEP 4
   *
   * Build the My Leagues response.
   */
  const result =
    leagues.map(
      (
        league
      ): MyLeague => {
        const membership =
          membershipByLeague
            .get(
              league.id
            );

        const team =
          teamByLeague
            .get(
              league.id
            );


        return {
          id:
            league.id,

          name:
            league.name,

          leagueType:
            league
              .league_type,

          playerSelectionMode:
            league
              .player_selection_mode,

          season:
            league.season,

          status:
            league.status,

          role:
            membership
              ?.role ??
            "member",

          commissionerUserId:
            league
              .commissioner_user_id,

          teamId:
            team?.id ??
            null,

          teamName:
            team
              ?.team_name ??
            null,

          createdAt:
            league
              .created_at,
        };
      }
    );


  /*
   * Newest leagues first.
   */
  result.sort(
    (
      a,
      b
    ) =>
      new Date(
        b.createdAt
      ).getTime() -
      new Date(
        a.createdAt
      ).getTime()
  );


  return result;
}