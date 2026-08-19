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


export type LeagueAccess = {
  userId: string;

  leagueId: string;

  role:
    | "commissioner"
    | "co_commissioner"
    | "member";

  league: {
    id: string;

    name: string;

    leagueType:
      | "traditional"
      | "weekly"
      | "nfl_playoffs";

    playerSelectionMode:
      | "draft"
      | "salary_cap"
      | "no_salary_cap";

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
   * 1. Membership
   */
  const {
    data:
      membership,

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


  if (!membership) {
    redirect(
      "/my-leagues"
    );
  }


  /*
   * 2. League
   */
  const {
    data:
      league,

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


  if (!league) {
    redirect(
      "/my-leagues"
    );
  }


  /*
   * 3. User's Traditional fantasy team, if one exists.
   *
   * Weekly / NFL Playoff leagues will not use this table.
   */
  const {
    data:
      fantasyTeam,

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


  const role =
    membership.role as
      | "commissioner"
      | "co_commissioner"
      | "member";


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
        league.player_selection_mode,

      season:
        league.season,

      status:
        league.status,

      commissionerUserId:
        league.commissioner_user_id,
    },

    fantasyTeam:
      fantasyTeam
        ? {
            id:
              fantasyTeam.id,

            teamName:
              fantasyTeam.team_name,
          }
        : null,

    isCommissioner:
      role ===
        "commissioner" ||
      role ===
        "co_commissioner",
  };
}