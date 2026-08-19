import type {
  SupabaseClient,
} from "@supabase/supabase-js";


export type LeagueType =
  | "traditional"
  | "weekly"
  | "nfl_playoffs";


export type PlayerSelectionMode =
  | "draft"
  | "salary_cap"
  | "no_salary_cap";


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
        "weekly" ||
      leagueType ===
        "nfl_playoffs"
    ) &&
    playerSelectionMode ===
      "draft"
  ) {
    throw new Error(
      "Weekly and NFL Playoffs leagues must use Salary Cap or No Salary Cap."
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


  if (
    input.leagueType ===
    "traditional"
  ) {
    teamName =
      cleanRequiredText(
        input.teamName ??
          "",
        "Team name"
      );

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
    await supabase.rpc(
      "create_league_transaction",
      {
        p_name:
          name,

        p_league_type:
          input.leagueType,

        p_player_selection_mode:
          input.playerSelectionMode,

        p_season:
          season,

        p_team_name:
          teamName,

        p_regular_season_weeks:
          regularSeasonWeeks,
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


  return {
    success:
      result.success ===
      true,

    leagueId,

    leagueType:
      result.leagueType as
        LeagueType,

    playerSelectionMode:
      result.playerSelectionMode as
        PlayerSelectionMode,

    season:
      Number(
        result.season
      ),

    role:
      result.role as
        LeagueMemberRole,

    fantasyTeamId:
      typeof result
        .fantasyTeamId ===
      "number"
        ? result
            .fantasyTeamId
        : null,
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
   * Load the leagues in one query.
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
   * Load the user's Traditional
   * fantasy teams in one query.
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
   * Build fast lookup maps.
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
   * Build one clean response
   * for the My Leagues page.
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