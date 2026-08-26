import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
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

function invitationIsExpired(
  expiresAt: string
) {
  const date =
    new Date(
      expiresAt
    );

  return (
    Number.isNaN(
      date.getTime()
    ) ||
    date.getTime() <=
      Date.now()
  );
}

async function expireInvitation(
  admin: ReturnType<
    typeof createAdminClient
  >,
  invitationId: string
) {
  await admin
    .from(
      "league_invitations"
    )
    .update({
      status:
        "expired",
      updated_at:
        new Date()
          .toISOString(),
    })
    .eq(
      "id",
      invitationId
    )
    .eq(
      "status",
      "pending"
    );
}


/* ============================================================
   GET
   Publicly loads the invitation so the recipient can see
   which league/team they were invited to before signing in.
============================================================ */

export async function GET(
  _request: Request,
  context: RouteContext
) {
  try {
    const {
      token: rawToken,
    } =
      await context.params;

    const token =
      rawToken?.trim();

    if (!token) {
      return jsonError(
        "Invitation token is missing.",
        400
      );
    }

    const {
      supabaseUrl,
      adminKey,
    } =
      getEnvironment();

    const admin =
      createAdminClient(
        supabaseUrl,
        adminKey
      );

    const {
      data:
        invitation,
      error:
        invitationError,
    } =
      await admin
        .from(
          "league_invitations"
        )
        .select(
          `
            id,
            league_id,
            fantasy_team_id,
            first_name,
            last_name,
            email,
            status,
            expires_at,
            accepted_at,
            accepted_by
          `
        )
        .eq(
          "token",
          token
        )
        .maybeSingle();

    if (
      invitationError ||
      !invitation
    ) {
      return jsonError(
        invitationError
          ?.message ??
          "Invitation not found.",
        404
      );
    }

    if (
      invitation.status ===
      "cancelled"
    ) {
      return jsonError(
        "This invitation was cancelled.",
        410
      );
    }

    if (
      invitation.status ===
      "accepted"
    ) {
      return jsonError(
        "This invitation has already been accepted.",
        409
      );
    }

    if (
      invitation.status ===
        "expired" ||
      invitationIsExpired(
        invitation.expires_at
      )
    ) {
      await expireInvitation(
        admin,
        invitation.id
      );

      return jsonError(
        "This invitation has expired.",
        410
      );
    }

    const {
      data:
        league,
      error:
        leagueError,
    } =
      await admin
        .from(
          "leagues"
        )
        .select(
          "id,name,league_type,season"
        )
        .eq(
          "id",
          invitation.league_id
        )
        .maybeSingle();

    if (
      leagueError ||
      !league
    ) {
      return jsonError(
        leagueError?.message ??
          "The invited league could not be found.",
        404
      );
    }

    let fantasyTeam:
      {
        id: number;
        team_name: string;
        owner_id:
          string | null;
        active:
          boolean;
      } | null =
      null;

    if (
      invitation
        .fantasy_team_id !==
      null
    ) {
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
            "id,team_name,owner_id,active"
          )
          .eq(
            "id",
            invitation
              .fantasy_team_id
          )
          .eq(
            "league_id",
            invitation
              .league_id
          )
          .maybeSingle();

      if (
        teamError ||
        !team
      ) {
        return jsonError(
          teamError?.message ??
            "The reserved fantasy team could not be found.",
          404
        );
      }

      fantasyTeam =
        team;
    }

    if (
      fantasyTeam &&
      fantasyTeam.owner_id
    ) {
      return jsonError(
        "The team reserved by this invitation already has an owner.",
        409
      );
    }

    return NextResponse.json({
      success: true,

      invitation: {
        id:
          invitation.id,

        email:
          invitation.email,

        firstName:
          invitation.first_name,

        lastName:
          invitation.last_name,

        expiresAt:
          invitation.expires_at,

        league: {
          id:
            league.id,

          name:
            league.name,

          leagueType:
            league.league_type,

          season:
            league.season,
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
      },
    });
  } catch (
    error
  ) {
    return jsonError(
      error instanceof Error
        ? error.message
        : "An unexpected invitation error occurred.",
      500
    );
  }
}


/* ============================================================
   POST
   Accepts the invite for the signed-in user.

   It:
   - verifies the JWT
   - verifies the signed-in email matches the invited email
   - creates league_members if needed
   - assigns the exact reserved fantasy team
   - marks the invitation accepted
============================================================ */

export async function POST(
  request: Request,
  context: RouteContext
) {
  try {
    const {
      token: rawToken,
    } =
      await context.params;

    const token =
      rawToken?.trim();

    if (!token) {
      return jsonError(
        "Invitation token is missing.",
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
        "You must be signed in to accept this invitation.",
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
        invitation,
      error:
        invitationError,
    } =
      await admin
        .from(
          "league_invitations"
        )
        .select(
          `
            id,
            league_id,
            fantasy_team_id,
            first_name,
            last_name,
            email,
            status,
            expires_at
          `
        )
        .eq(
          "token",
          token
        )
        .maybeSingle();

    if (
      invitationError ||
      !invitation
    ) {
      return jsonError(
        invitationError
          ?.message ??
          "Invitation not found.",
        404
      );
    }

    if (
      invitation.status ===
      "cancelled"
    ) {
      return jsonError(
        "This invitation was cancelled.",
        410
      );
    }

    if (
      invitation.status ===
      "accepted"
    ) {
      return jsonError(
        "This invitation has already been accepted.",
        409
      );
    }

    if (
      invitation.status ===
        "expired" ||
      invitationIsExpired(
        invitation.expires_at
      )
    ) {
      await expireInvitation(
        admin,
        invitation.id
      );

      return jsonError(
        "This invitation has expired.",
        410
      );
    }

    const signedInEmail =
      user.email
        ?.trim()
        .toLowerCase();

    const invitedEmail =
      invitation.email
        .trim()
        .toLowerCase();

    if (
      !signedInEmail ||
      signedInEmail !==
        invitedEmail
    ) {
      return jsonError(
        `This invitation was sent to ${invitation.email}. Sign in or create an account using that email address.`,
        403
      );
    }

    const {
      data:
        league,
      error:
        leagueError,
    } =
      await admin
        .from(
          "leagues"
        )
        .select(
          "id,name,league_type,season"
        )
        .eq(
          "id",
          invitation.league_id
        )
        .maybeSingle();

    if (
      leagueError ||
      !league
    ) {
      return jsonError(
        leagueError?.message ??
          "League not found.",
        404
      );
    }

    const {
      data:
        existingMembership,
      error:
        membershipLookupError,
    } =
      await admin
        .from(
          "league_members"
        )
        .select(
          "id,role"
        )
        .eq(
          "league_id",
          invitation.league_id
        )
        .eq(
          "user_id",
          user.id
        )
        .maybeSingle();

    if (
      membershipLookupError
    ) {
      return jsonError(
        membershipLookupError
          .message,
        500
      );
    }

    let membershipCreated =
      false;

    if (
      !existingMembership
    ) {
      const {
        error:
          membershipInsertError,
      } =
        await admin
          .from(
            "league_members"
          )
          .insert({
            league_id:
              invitation
                .league_id,

            user_id:
              user.id,

            role:
              "member",
          });

      if (
        membershipInsertError
      ) {
        return jsonError(
          membershipInsertError
            .message,
          500
        );
      }

      membershipCreated =
        true;
    }

    let teamId:
      number | null =
      null;

    let teamName:
      string | null =
      null;

    if (
      invitation
        .fantasy_team_id !==
      null
    ) {
      const {
        data:
          team,
        error:
          teamLookupError,
      } =
        await admin
          .from(
            "fantasy_teams"
          )
          .select(
            "id,team_name,owner_id,active"
          )
          .eq(
            "id",
            invitation
              .fantasy_team_id
          )
          .eq(
            "league_id",
            invitation
              .league_id
          )
          .maybeSingle();

      if (
        teamLookupError ||
        !team
      ) {
        if (
          membershipCreated
        ) {
          await admin
            .from(
              "league_members"
            )
            .delete()
            .eq(
              "league_id",
              invitation
                .league_id
            )
            .eq(
              "user_id",
              user.id
            );
        }

        return jsonError(
          teamLookupError
            ?.message ??
            "The reserved fantasy team could not be found.",
          404
        );
      }

      if (!team.active) {
        if (
          membershipCreated
        ) {
          await admin
            .from(
              "league_members"
            )
            .delete()
            .eq(
              "league_id",
              invitation
                .league_id
            )
            .eq(
              "user_id",
              user.id
            );
        }

        return jsonError(
          "The reserved fantasy team is no longer active.",
          409
        );
      }

      if (
        team.owner_id &&
        team.owner_id !==
          user.id
      ) {
        if (
          membershipCreated
        ) {
          await admin
            .from(
              "league_members"
            )
            .delete()
            .eq(
              "league_id",
              invitation
                .league_id
            )
            .eq(
              "user_id",
              user.id
            );
        }

        return jsonError(
          "The reserved fantasy team already has an owner.",
          409
        );
      }

      const {
        data:
          claimedTeam,
        error:
          teamUpdateError,
      } =
        await admin
          .from(
            "fantasy_teams"
          )
          .update({
            owner_id:
              user.id,

            updated_at:
              new Date()
                .toISOString(),
          })
          .eq(
            "id",
            team.id
          )
          .eq(
            "league_id",
            invitation
              .league_id
          )
          .is(
            "owner_id",
            null
          )
          .select(
            "id,team_name"
          )
          .maybeSingle();

      if (
        teamUpdateError
      ) {
        if (
          membershipCreated
        ) {
          await admin
            .from(
              "league_members"
            )
            .delete()
            .eq(
              "league_id",
              invitation
                .league_id
            )
            .eq(
              "user_id",
              user.id
            );
        }

        return jsonError(
          teamUpdateError
            .message,
          500
        );
      }

      /*
       * If owner_id was already this same user,
       * the null-only update returns no row.
       */
      if (!claimedTeam) {
        const {
          data:
            alreadyOwnedTeam,
        } =
          await admin
            .from(
              "fantasy_teams"
            )
            .select(
              "id,team_name,owner_id"
            )
            .eq(
              "id",
              team.id
            )
            .maybeSingle();

        if (
          !alreadyOwnedTeam ||
          alreadyOwnedTeam
            .owner_id !==
            user.id
        ) {
          if (
            membershipCreated
          ) {
            await admin
              .from(
                "league_members"
              )
              .delete()
              .eq(
                "league_id",
                invitation
                  .league_id
              )
              .eq(
                "user_id",
                user.id
              );
          }

          return jsonError(
            "The team was claimed by another owner before this invitation could be accepted.",
            409
          );
        }

        teamId =
          alreadyOwnedTeam.id;

        teamName =
          alreadyOwnedTeam
            .team_name;
      } else {
        teamId =
          claimedTeam.id;

        teamName =
          claimedTeam.team_name;
      }
    }

    const {
      data:
        acceptedInvitation,
      error:
        acceptUpdateError,
    } =
      await admin
        .from(
          "league_invitations"
        )
        .update({
          status:
            "accepted",

          accepted_at:
            new Date()
              .toISOString(),

          accepted_by:
            user.id,

          updated_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "id",
          invitation.id
        )
        .eq(
          "status",
          "pending"
        )
        .select(
          "id"
        )
        .maybeSingle();

    if (
      acceptUpdateError ||
      !acceptedInvitation
    ) {
      /*
       * Do not remove an existing membership.
       * If we created it in this request, clean it up.
       */
      if (
        membershipCreated
      ) {
        await admin
          .from(
            "league_members"
          )
          .delete()
          .eq(
            "league_id",
            invitation
              .league_id
          )
          .eq(
            "user_id",
            user.id
          );
      }

      if (
        teamId !== null
      ) {
        await admin
          .from(
            "fantasy_teams"
          )
          .update({
            owner_id:
              null,
            updated_at:
              new Date()
                .toISOString(),
          })
          .eq(
            "id",
            teamId
          )
          .eq(
            "owner_id",
            user.id
          );
      }

      return jsonError(
        acceptUpdateError
          ?.message ??
          "The invitation was no longer pending.",
        409
      );
    }

    return NextResponse.json({
      success: true,

      message:
        teamName
          ? `You joined ${league.name} as the owner of ${teamName}.`
          : `You joined ${league.name}.`,

      league: {
        id:
          league.id,

        name:
          league.name,
      },

      fantasyTeam:
        teamId !== null
          ? {
              id:
                teamId,

              teamName:
                teamName,
            }
          : null,
    });
  } catch (
    error
  ) {
    return jsonError(
      error instanceof Error
        ? error.message
        : "An unexpected invitation acceptance error occurred.",
      500
    );
  }
}
