import "server-only";

import {
  redirect,
} from "next/navigation";

import {
  requireUser,
} from "@/lib/auth/requireUser";

import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";


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


export type LeagueAccess = {
  userId: string;

  leagueId: string;

  role:
    LeagueMemberRole;

  league: {
    id: string;

    name: string;

    leagueType:
      LeagueType;

    playerSelectionMode:
      PlayerSelectionMode;

    season: number;

    status: string;

    commissionerUserId: string;
  };

  fantasyTeam: {
    id: number;

    teamName: string;
  } | null;

  isCommissioner:
    boolean;
};


type MembershipRow = {
  role:
    LeagueMemberRole;
};


type LeagueRow = {
  id: string;

  name: string;

  league_type:
    LeagueType;

  player_selection_mode:
    PlayerSelectionMode;

  season: number;

  status: string;

  commissioner_user_id: string;
};


type FantasyTeamRow = {
  id: number;

  team_name: string;
};


function isLeagueType(
  value: unknown
): value is LeagueType {
  return (
    value ===
      "traditional" ||
    value ===
      "season_long" ||
    value ===
      "nfl_playoffs" ||
    value ===
      "pickem"
  );
}


function isPlayerSelectionMode(
  value: unknown
): value is PlayerSelectionMode {
  return (
    value ===
      "draft" ||
    value ===
      "salary" ||
    value ===
      "no_salary" ||
    value ===
      "pickem"
  );
}


function isLeagueMemberRole(
  value: unknown
): value is LeagueMemberRole {
  return (
    value ===
      "commissioner" ||
    value ===
      "co_commissioner" ||
    value ===
      "member"
  );
}


export async function requireLeagueMember(
  leagueId: string
): Promise<LeagueAccess> {
  console.log(
    "[LEAGUE ACCESS] 1 START",
    {
      leagueId,
    }
  );


  /*
   * =========================================
   * AUTHENTICATED USER
   * =========================================
   */
  const user =
    await requireUser();


  console.log(
    "[LEAGUE ACCESS] 2 USER",
    {
      leagueId,
      userId:
        user.id,
    }
  );


  if (!leagueId) {
    console.log(
      "[LEAGUE ACCESS] REDIRECT - NO LEAGUE ID",
      {
        userId:
          user.id,
      }
    );

    redirect(
      "/my-leagues"
    );
  }


  /*
   * =========================================
   * SUPABASE CLIENT
   * =========================================
   */
  const supabase =
    await createSupabaseServerClient();


  console.log(
    "[LEAGUE ACCESS] 3 CLIENT READY",
    {
      leagueId,
      userId:
        user.id,
    }
  );


  /*
   * =========================================
   * 1. VERIFY LEAGUE MEMBERSHIP
   * =========================================
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
        "role"
      )
      .eq(
        "league_id",
        leagueId
      )
      .eq(
        "user_id",
        user.id
      )
      .maybeSingle();


  console.log(
    "[LEAGUE ACCESS] 4 MEMBERSHIP",
    {
      leagueId,

      userId:
        user.id,

      membership:
        membershipData,

      error:
        membershipError
          ?.message ??
        null,
    }
  );


  if (
    membershipError
  ) {
    console.error(
      "[LEAGUE ACCESS] MEMBERSHIP ERROR",
      {
        leagueId,

        userId:
          user.id,

        error:
          membershipError
            .message,
      }
    );

    throw new Error(
      `Could not verify league membership: ${membershipError.message}`
    );
  }


  if (
    !membershipData
  ) {
    console.log(
      "[LEAGUE ACCESS] REDIRECT - NOT A MEMBER",
      {
        leagueId,

        userId:
          user.id,
      }
    );

    redirect(
      "/my-leagues"
    );
  }


  const rawMembership =
    membershipData as {
      role:
        unknown;
    };


  if (
    !isLeagueMemberRole(
      rawMembership.role
    )
  ) {
    console.error(
      "[LEAGUE ACCESS] INVALID MEMBERSHIP ROLE",
      {
        leagueId,

        userId:
          user.id,

        role:
          rawMembership.role,
      }
    );

    throw new Error(
      "League membership has an invalid role."
    );
  }


  const membership:
    MembershipRow = {
      role:
        rawMembership.role,
    };


  /*
   * =========================================
   * 2. LOAD LEAGUE
   * =========================================
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
        commissioner_user_id
      `)
      .eq(
        "id",
        leagueId
      )
      .maybeSingle();


  console.log(
    "[LEAGUE ACCESS] 5 LEAGUE",
    {
      leagueId,

      userId:
        user.id,

      league:
        leagueData,

      error:
        leagueError
          ?.message ??
        null,
    }
  );


  if (
    leagueError
  ) {
    console.error(
      "[LEAGUE ACCESS] LEAGUE ERROR",
      {
        leagueId,

        userId:
          user.id,

        error:
          leagueError
            .message,
      }
    );

    throw new Error(
      `Could not load league: ${leagueError.message}`
    );
  }


  if (
    !leagueData
  ) {
    console.log(
      "[LEAGUE ACCESS] REDIRECT - LEAGUE NOT VISIBLE",
      {
        leagueId,

        userId:
          user.id,
      }
    );

    redirect(
      "/my-leagues"
    );
  }


  const rawLeague =
    leagueData as {
      id:
        unknown;

      name:
        unknown;

      league_type:
        unknown;

      player_selection_mode:
        unknown;

      season:
        unknown;

      status:
        unknown;

      commissioner_user_id:
        unknown;
    };


  if (
    typeof rawLeague.id !==
      "string" ||
    typeof rawLeague.name !==
      "string" ||
    typeof rawLeague.season !==
      "number" ||
    typeof rawLeague.status !==
      "string" ||
    typeof rawLeague
      .commissioner_user_id !==
      "string"
  ) {
    console.error(
      "[LEAGUE ACCESS] INVALID LEAGUE DATA",
      {
        leagueId,

        userId:
          user.id,

        league:
          leagueData,
      }
    );

    throw new Error(
      "League returned invalid data."
    );
  }


  if (
    !isLeagueType(
      rawLeague.league_type
    )
  ) {
    console.error(
      "[LEAGUE ACCESS] INVALID LEAGUE TYPE",
      {
        leagueId,

        userId:
          user.id,

        leagueType:
          rawLeague
            .league_type,
      }
    );

    throw new Error(
      `Unsupported league type: ${String(
        rawLeague.league_type
      )}`
    );
  }


  if (
    !isPlayerSelectionMode(
      rawLeague
        .player_selection_mode
    )
  ) {
    console.error(
      "[LEAGUE ACCESS] INVALID SELECTION MODE",
      {
        leagueId,

        userId:
          user.id,

        playerSelectionMode:
          rawLeague
            .player_selection_mode,
      }
    );

    throw new Error(
      `Unsupported player selection mode: ${String(
        rawLeague
          .player_selection_mode
      )}`
    );
  }


  const league:
    LeagueRow = {
      id:
        rawLeague.id,

      name:
        rawLeague.name,

      league_type:
        rawLeague.league_type,

      player_selection_mode:
        rawLeague
          .player_selection_mode,

      season:
        rawLeague.season,

      status:
        rawLeague.status,

      commissioner_user_id:
        rawLeague
          .commissioner_user_id,
    };


  /*
   * =========================================
   * 3. LOAD USER'S FANTASY TEAM / ENTRY
   * =========================================
   *
   * fantasy_teams is used by:
   *
   * - Traditional leagues
   *   Permanent drafted roster ownership.
   *
   * - Season-Long leagues
   *   Participant identity and weekly
   *   lineup ownership.
   *
   * - NFL Playoffs leagues
   *   Participant identity and playoff
   *   round lineup ownership.
   *
   * - G365 Football Pick'em
   *   Participant / entry identity.
   * =========================================
   */
  let fantasyTeam:
    FantasyTeamRow | null =
      null;


  if (
    league.league_type ===
      "traditional" ||
    league.league_type ===
      "season_long" ||
    league.league_type ===
      "nfl_playoffs" ||
    league.league_type ===
      "pickem"
  ) {
    console.log(
      "[LEAGUE ACCESS] 6A TEAM QUERY START",
      {
        leagueId,

        userId:
          user.id,

        leagueType:
          league
            .league_type,
      }
    );


    const {
      data:
        fantasyTeamData,

      error:
        teamError,
    } =
      await supabase
        .from(
          "fantasy_teams"
        )
        .select(
          "id, team_name"
        )
        .eq(
          "league_id",
          leagueId
        )
        .eq(
          "owner_id",
          user.id
        )
        .eq(
          "active",
          true
        )
        .maybeSingle();


    console.log(
      "[LEAGUE ACCESS] 6 TEAM",
      {
        leagueId,

        userId:
          user.id,

        fantasyTeam:
          fantasyTeamData,

        error:
          teamError
            ?.message ??
          null,
      }
    );


    if (
      teamError
    ) {
      console.error(
        "[LEAGUE ACCESS] TEAM ERROR",
        {
          leagueId,

          userId:
            user.id,

          error:
            teamError
              .message,
        }
      );

      throw new Error(
        `Could not load fantasy team: ${teamError.message}`
      );
    }


    if (
      fantasyTeamData
    ) {
      const rawTeam =
        fantasyTeamData as {
          id:
            unknown;

          team_name:
            unknown;
        };


      const parsedId =
        typeof rawTeam.id ===
          "number"
          ? rawTeam.id
          : Number(
              rawTeam.id
            );


      if (
        !Number.isFinite(
          parsedId
        ) ||
        typeof rawTeam
          .team_name !==
          "string"
      ) {
        console.error(
          "[LEAGUE ACCESS] INVALID FANTASY TEAM DATA",
          {
            leagueId,

            userId:
              user.id,

            fantasyTeam:
              fantasyTeamData,
          }
        );

        throw new Error(
          "Fantasy team returned invalid data."
        );
      }


      fantasyTeam = {
        id:
          parsedId,

        team_name:
          rawTeam.team_name,
      };
    }
  }


  /*
   * =========================================
   * 4. BUILD ACCESS OBJECT
   * =========================================
   */
  const role =
    membership.role;


  console.log(
    "[LEAGUE ACCESS] 7 COMPLETE",
    {
      leagueId,

      userId:
        user.id,

      role,

      leagueType:
        league
          .league_type,

      playerSelectionMode:
        league
          .player_selection_mode,

      fantasyTeamId:
        fantasyTeam
          ?.id ??
        null,

      fantasyTeamName:
        fantasyTeam
          ?.team_name ??
        null,

      isCommissioner:
        role ===
          "commissioner" ||
        role ===
          "co_commissioner",
    }
  );


  return {
    userId:
      user.id,

    leagueId,

    role,

    league: {
      id:
        league.id,

      name:
        league.name,

      leagueType:
        league.league_type,

      playerSelectionMode:
        league
          .player_selection_mode,

      season:
        league.season,

      status:
        league.status,

      commissionerUserId:
        league
          .commissioner_user_id,
    },

    fantasyTeam:
      fantasyTeam
        ? {
            id:
              fantasyTeam.id,

            teamName:
              fantasyTeam
                .team_name,
          }
        : null,

    isCommissioner:
      role ===
        "commissioner" ||
      role ===
        "co_commissioner",
  };
}