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
  const user =
    await requireUser();


  if (!leagueId) {
    redirect(
      "/my-leagues"
    );
  }


  const supabase =
    await createSupabaseServerClient();


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


  if (
    membershipError
  ) {
    throw new Error(
      `Could not verify league membership: ${membershipError.message}`
    );
  }


  if (
    !membershipData
  ) {
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


  if (
    leagueError
  ) {
    throw new Error(
      `Could not load league: ${leagueError.message}`
    );
  }


  if (
    !leagueData
  ) {
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
    throw new Error(
      "League returned invalid data."
    );
  }


  if (
    !isLeagueType(
      rawLeague.league_type
    )
  ) {
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
   * - G365 Football Pick'em
   *   Participant / entry identity.
   *
   * NFL Playoffs can use its own entry
   * model when that league type is wired.
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
      "pickem"
  ) {
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


    if (
      teamError
    ) {
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
