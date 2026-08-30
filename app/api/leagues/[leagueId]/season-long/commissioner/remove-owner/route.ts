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


type RemoveOwnerBody = {
  fantasyTeamId?: number;
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


export async function POST(
  request: Request,
  context: RouteContext
) {
  try {
    const {
      leagueId,
    } =
      await context.params;

    if (!leagueId) {
      return jsonError(
        "A valid league ID is required.",
        400
      );
    }

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
      return jsonError(
        "You must be signed in.",
        401
      );
    }

    let body:
      RemoveOwnerBody;

    try {
      body =
        (await request.json()) as
          RemoveOwnerBody;
    } catch {
      return jsonError(
        "A valid request body is required.",
        400
      );
    }

    const fantasyTeamId =
      Number(
        body.fantasyTeamId
      );

    if (
      !Number.isInteger(
        fantasyTeamId
      ) ||
      fantasyTeamId <= 0
    ) {
      return jsonError(
        "A valid fantasy team is required.",
        400
      );
    }

    const admin =
      createSupabaseAdminClient();

    const {
      data: league,
      error: leagueError,
    } =
      await admin
        .from(
          "leagues"
        )
        .select(
          "id,name,league_type,commissioner_user_id"
        )
        .eq(
          "id",
          leagueId
        )
        .maybeSingle();

    if (
      leagueError
    ) {
      return jsonError(
        leagueError.message,
        500
      );
    }

    if (
      !league
    ) {
      return jsonError(
        "League not found.",
        404
      );
    }

    let hasCommissionerAccess =
      league.commissioner_user_id ===
      userData.user.id;

    if (
      !hasCommissionerAccess
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
        return jsonError(
          membershipError.message,
          500
        );
      }

      hasCommissionerAccess =
        membership?.role ===
          "commissioner" ||
        membership?.role ===
          "co_commissioner";
    }

    if (
      !hasCommissionerAccess
    ) {
      return jsonError(
        "Commissioner access is required.",
        403
      );
    }

    const {
      data: team,
      error: teamError,
    } =
      await admin
        .from(
          "fantasy_teams"
        )
        .select(
          "id,league_id,team_name,owner_id,active"
        )
        .eq(
          "id",
          fantasyTeamId
        )
        .eq(
          "league_id",
          leagueId
        )
        .maybeSingle();

    if (
      teamError
    ) {
      return jsonError(
        teamError.message,
        500
      );
    }

    if (
      !team
    ) {
      return jsonError(
        "Fantasy team not found in this league.",
        404
      );
    }

    const ownerUserId =
      team.owner_id as
        | string
        | null;

    if (
      !ownerUserId
    ) {
      return jsonError(
        "This team is already ownerless.",
        409
      );
    }

    if (
      league.commissioner_user_id &&
      ownerUserId ===
        league.commissioner_user_id
    ) {
      return jsonError(
        "The primary commissioner cannot be removed from their own league. Transfer commissioner ownership first.",
        400
      );
    }

    /*
     * Preserve the fantasy-team row and every league record tied to it.
     * Only detach ownership.
     */
    const {
      error: clearOwnerError,
    } =
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
          fantasyTeamId
        )
        .eq(
          "league_id",
          leagueId
        )
        .eq(
          "owner_id",
          ownerUserId
        );

    if (
      clearOwnerError
    ) {
      return jsonError(
        clearOwnerError.message,
        500
      );
    }

    /*
     * Cancel any still-pending invite that reserved this team.
     * A stale emailed link must not be able to claim the slot later.
     */
    const {
      data: cancelledInvites,
      error: cancelInviteError,
    } =
      await admin
        .from(
          "league_invitations"
        )
        .update({
          status:
            "cancelled",
          updated_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "league_id",
          leagueId
        )
        .eq(
          "fantasy_team_id",
          fantasyTeamId
        )
        .eq(
          "status",
          "pending"
        )
        .select(
          "id"
        );

    if (
      cancelInviteError
    ) {
      await admin
        .from(
          "fantasy_teams"
        )
        .update({
          owner_id:
            ownerUserId,
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
        )
        .is(
          "owner_id",
          null
        );

      return jsonError(
        cancelInviteError.message,
        500
      );
    }

    /*
     * Remove the old owner's league membership unless they still own a
     * second fantasy team in this same league. That protects unusual
     * commissioner corrections without leaving accidental duplicate access.
     */
    const {
      count: otherOwnedTeamCount,
      error: otherOwnedTeamError,
    } =
      await admin
        .from(
          "fantasy_teams"
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
          "owner_id",
          ownerUserId
        );

    if (
      otherOwnedTeamError
    ) {
      await admin
        .from(
          "fantasy_teams"
        )
        .update({
          owner_id:
            ownerUserId,
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
        )
        .is(
          "owner_id",
          null
        );

      return jsonError(
        otherOwnedTeamError.message,
        500
      );
    }

    if (
      (otherOwnedTeamCount ??
        0) === 0
    ) {
      const {
        error: membershipDeleteError,
      } =
        await admin
          .from(
            "league_members"
          )
          .delete()
          .eq(
            "league_id",
            leagueId
          )
          .eq(
            "user_id",
            ownerUserId
          );

      if (
        membershipDeleteError
      ) {
        await admin
          .from(
            "fantasy_teams"
          )
          .update({
            owner_id:
              ownerUserId,
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
          )
          .is(
            "owner_id",
            null
          );

        /*
         * If the operation rolls back, do not leave the team's pending
         * invitations cancelled. Restore only invitations cancelled by
         * this request.
         */
        const cancelledIds =
          (
            cancelledInvites ??
            []
          ).map(
            (
              row
            ) =>
              row.id
          );

        if (
          cancelledIds.length >
          0
        ) {
          await admin
            .from(
              "league_invitations"
            )
            .update({
              status:
                "pending",
              updated_at:
                new Date()
                  .toISOString(),
            })
            .in(
              "id",
              cancelledIds
            )
            .eq(
              "status",
              "cancelled"
            );
        }

        return jsonError(
          membershipDeleteError.message,
          500
        );
      }
    }

    return NextResponse.json({
      success:
        true,
      leagueId,
      fantasyTeamId,
      teamName:
        team.team_name,
      removedUserId:
        ownerUserId,
      cancelledInvitations:
        (
          cancelledInvites ??
          []
        ).length,
      membershipRemoved:
        (otherOwnedTeamCount ??
          0) === 0,
    });
  } catch (
    error
  ) {
    return jsonError(
      error instanceof Error
        ? error.message
        : "The owner could not be removed.",
      500
    );
  }
}
