import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type RouteContext = {
  params: Promise<{
    leagueId: string;
  }>;
};

type InviteRequestBody = {
  firstName?: string;
  lastName?: string;
  email?: string;
  fantasyTeamId?: number | null;
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

function normalizeEmail(
  value: string
) {
  return value
    .trim()
    .toLowerCase();
}

function isValidEmail(
  value: string
) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value
  );
}

function escapeHtml(
  value: string
) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

async function sendInvitationEmail({
  recipientEmail,
  recipientName,
  leagueName,
  teamName,
  invitationUrl,
  expiresAt,
}: {
  recipientEmail: string;
  recipientName: string;
  leagueName: string;
  teamName: string;
  invitationUrl: string;
  expiresAt: string;
}) {
  const resendApiKey =
    process.env
      .RESEND_API_KEY;

  const fromEmail =
    process.env
      .INVITE_FROM_EMAIL ??
    process.env
      .MOCK_DRAFT_GRADE_FROM_EMAIL;

  if (!resendApiKey) {
    throw new Error(
      "RESEND_API_KEY is missing."
    );
  }

  if (!fromEmail) {
    throw new Error(
      "INVITE_FROM_EMAIL is missing. You may also reuse MOCK_DRAFT_GRADE_FROM_EMAIL."
    );
  }

  const expirationText =
    new Date(
      expiresAt
    ).toLocaleString(
      "en-US",
      {
        dateStyle:
          "long",

        timeStyle:
          "short",
      }
    );

  const response =
    await fetch(
      "https://api.resend.com/emails",
      {
        method:
          "POST",

        headers: {
          Authorization:
            `Bearer ${resendApiKey}`,

          "Content-Type":
            "application/json",

          "User-Agent":
            "Gridiron365/1.0",
        },

        body:
          JSON.stringify({
            from:
              fromEmail,

            to: [
              recipientEmail,
            ],

            subject:
              `You're invited to ${leagueName} on Gridiron365`,

            html: `
              <div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;padding:28px;background:#0b0b0b;color:#ffffff;">
                <div style="font-size:13px;font-weight:900;letter-spacing:.12em;color:#ff6b22;">
                  GRIDIRON365
                </div>

                <h1 style="margin:8px 0 18px;font-size:32px;">
                  League Invitation
                </h1>

                <p>
                  Hello ${escapeHtml(recipientName)},
                </p>

                <p>
                  You've been invited to join
                  <strong>${escapeHtml(leagueName)}</strong>
                  and take ownership of
                  <strong>${escapeHtml(teamName)}</strong>.
                </p>

                <p style="margin:28px 0;">
                  <a
                    href="${escapeHtml(invitationUrl)}"
                    style="display:inline-block;padding:13px 20px;border-radius:8px;background:linear-gradient(90deg,#c91810,#ff7600);color:white;text-decoration:none;font-weight:900;"
                  >
                    ACCEPT INVITATION
                  </a>
                </p>

                <p style="color:#9a9a9a;font-size:13px;">
                  This invitation expires
                  ${escapeHtml(expirationText)}.
                </p>

                <p style="color:#727272;font-size:12px;word-break:break-all;">
                  ${escapeHtml(invitationUrl)}
                </p>
              </div>
            `,

            text: [
              `Hello ${recipientName},`,
              "",
              `You've been invited to join ${leagueName} on Gridiron365.`,
              `Team: ${teamName}`,
              "",
              `Accept invitation: ${invitationUrl}`,
              "",
              `Expires: ${expirationText}`,
            ].join("\n"),
          }),
      }
    );

  if (!response.ok) {
    const body =
      await response
        .text();

    throw new Error(
      `Resend ${response.status}: ${body}`
    );
  }

  return (
    await response.json()
  ) as {
    id?: string;
  };
}


export async function GET(
  _request: Request,
  context: RouteContext
) {
  const {
    leagueId,
  } =
    await context.params;

  return NextResponse.json({
    success: true,
    leagueId,

    message:
      "Gridiron365 league invitation API is running.",
  });
}


export async function POST(
  request: Request,
  context: RouteContext
) {
  try {
    const {
      leagueId:
        rawLeagueId,
    } =
      await context.params;

    const leagueId =
      rawLeagueId
        ?.trim();

    if (!leagueId) {
      return jsonError(
        "League ID is required.",
        400
      );
    }

    const authorization =
      request.headers
        .get(
          "authorization"
        );

    if (
      !authorization
        ?.startsWith(
          "Bearer "
        )
    ) {
      return jsonError(
        "You must be signed in to send a league invitation.",
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

    let body:
      InviteRequestBody;

    try {
      body =
        (await request
          .json()) as
          InviteRequestBody;
    } catch {
      return jsonError(
        "The request body must contain valid JSON.",
        400
      );
    }

    const firstName =
      body.firstName
        ?.trim() ??
      "";

    const lastName =
      body.lastName
        ?.trim() ??
      "";

    const email =
      normalizeEmail(
        body.email ??
          ""
      );

    const fantasyTeamId =
      Number(
        body
          .fantasyTeamId
      );

    if (!firstName) {
      return jsonError(
        "First name is required.",
        400
      );
    }

    if (!lastName) {
      return jsonError(
        "Last name is required.",
        400
      );
    }

    if (
      !email ||
      !isValidEmail(
        email
      )
    ) {
      return jsonError(
        "Enter a valid email address.",
        400
      );
    }

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
          user.id
        )
        .maybeSingle();

    if (
      membershipError
    ) {
      return jsonError(
        membershipError
          .message,
        500
      );
    }

    if (
      !membership ||
      ![
        "commissioner",
        "co_commissioner",
      ].includes(
        membership.role
      )
    ) {
      return jsonError(
        "You do not have permission to invite owners to this league.",
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
          "id,name"
        )
        .eq(
          "id",
          leagueId
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
        team,

      error:
        teamError,
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
      teamError ||
      !team
    ) {
      return jsonError(
        teamError?.message ??
          "Fantasy team not found.",
        404
      );
    }

    if (!team.active) {
      return jsonError(
        "This fantasy team is not active.",
        409
      );
    }

    if (
      team.owner_id
    ) {
      return jsonError(
        `${team.team_name} already has an owner.`,
        409
      );
    }


    /* =========================================================
       CHECK EXISTING PENDING INVITE FOR THIS TEAM

       NEW BEHAVIOR:
       - Same team + same email = RESEND ALLOWED.
       - Same team + different email = keep team reserved.
    ========================================================= */

    const {
      data:
        pendingTeamInvite,

      error:
        pendingTeamError,
    } =
      await admin
        .from(
          "league_invitations"
        )
        .select(
          "id,email,expires_at"
        )
        .eq(
          "fantasy_team_id",
          fantasyTeamId
        )
        .eq(
          "status",
          "pending"
        )
        .maybeSingle();

    if (
      pendingTeamError
    ) {
      return jsonError(
        pendingTeamError
          .message,
        500
      );
    }

    let reusableInvitationId:
      string |
      null =
      null;

    if (
      pendingTeamInvite
    ) {
      const pendingEmail =
        normalizeEmail(
          pendingTeamInvite
            .email
        );

      if (
        pendingEmail !==
        email
      ) {
        return jsonError(
          `A pending invitation already reserves ${team.team_name} for ${pendingTeamInvite.email}.`,
          409
        );
      }

      /*
       * Same team + same email:
       * reuse the invitation row and issue a brand-new token.
       * This invalidates the previous emailed link.
       */
      reusableInvitationId =
        pendingTeamInvite.id;
    }


    /* =========================================================
       SAME EMAIL CANNOT HOLD A DIFFERENT TEAM'S PENDING INVITE
    ========================================================= */

    if (
      !reusableInvitationId
    ) {
      const {
        data:
          pendingEmailInvite,

        error:
          pendingEmailError,
      } =
        await admin
          .from(
            "league_invitations"
          )
          .select(
            "id,fantasy_team_id,expires_at"
          )
          .eq(
            "league_id",
            leagueId
          )
          .ilike(
            "email",
            email
          )
          .eq(
            "status",
            "pending"
          )
          .maybeSingle();

      if (
        pendingEmailError
      ) {
        return jsonError(
          pendingEmailError
            .message,
          500
        );
      }

      if (
        pendingEmailInvite
      ) {
        return jsonError(
          "This email already has a pending invitation to another team in this league.",
          409
        );
      }
    }


    /* =========================================================
       CREATE / REFRESH INVITATION
    ========================================================= */

    const token =
      crypto
        .randomUUID();

    const expiresAt =
      new Date(
        Date.now() +
          14 *
            24 *
            60 *
            60 *
            1000
      ).toISOString();

    let invitation:
      {
        id: string;
        token: string;
        expires_at: string;
      } |
      null =
      null;

    if (
      reusableInvitationId
    ) {
      const {
        data:
          updatedInvitation,

        error:
          updateInvitationError,
      } =
        await admin
          .from(
            "league_invitations"
          )
          .update({
            first_name:
              firstName,

            last_name:
              lastName,

            email,

            invited_by:
              user.id,

            token,

            expires_at:
              expiresAt,

            email_sent_at:
              null,

            updated_at:
              new Date()
                .toISOString(),
          })
          .eq(
            "id",
            reusableInvitationId
          )
          .eq(
            "status",
            "pending"
          )
          .select(
            "id,token,expires_at"
          )
          .single();

      if (
        updateInvitationError ||
        !updatedInvitation
      ) {
        return jsonError(
          updateInvitationError
            ?.message ??
            "The invitation could not be refreshed.",
          500
        );
      }

      invitation =
        updatedInvitation;
    } else {
      const {
        data:
          createdInvitation,

        error:
          invitationError,
      } =
        await admin
          .from(
            "league_invitations"
          )
          .insert({
            league_id:
              leagueId,

            fantasy_team_id:
              fantasyTeamId,

            first_name:
              firstName,

            last_name:
              lastName,

            email,

            invited_by:
              user.id,

            token,

            status:
              "pending",

            expires_at:
              expiresAt,
          })
          .select(
            "id,token,expires_at"
          )
          .single();

      if (
        invitationError ||
        !createdInvitation
      ) {
        return jsonError(
          invitationError
            ?.message ??
            "The invitation could not be created.",
          500
        );
      }

      invitation =
        createdInvitation;
    }


    const siteUrl =
      (
        process.env
          .NEXT_PUBLIC_SITE_URL ??
        "http://localhost:3000"
      ).replace(
        /\/$/,
        ""
      );

    const inviteUrl =
      `${siteUrl}/invite/${invitation.token}`;


    /* =========================================================
       SEND / RESEND EMAIL
    ========================================================= */

    try {
      const emailResult =
        await sendInvitationEmail({
          recipientEmail:
            email,

          recipientName:
            `${firstName} ${lastName}`
              .trim(),

          leagueName:
            league.name,

          teamName:
            team.team_name,

          invitationUrl:
            inviteUrl,

          expiresAt:
            invitation
              .expires_at,
        });

      const {
        error:
          sentUpdateError,
      } =
        await admin
          .from(
            "league_invitations"
          )
          .update({
            email_sent_at:
              new Date()
                .toISOString(),

            updated_at:
              new Date()
                .toISOString(),
          })
          .eq(
            "id",
            invitation.id
          );

      if (
        sentUpdateError
      ) {
        throw new Error(
          sentUpdateError
            .message
        );
      }

      return NextResponse.json({
        success: true,

        resent:
          Boolean(
            reusableInvitationId
          ),

        message:
          reusableInvitationId
            ? `Invitation resent to ${email} for ${team.team_name}. The previous invitation link is no longer valid.`
            : `Invitation sent to ${email} for ${team.team_name}.`,

        inviteUrl,

        invitation: {
          id:
            invitation.id,

          leagueId,

          fantasyTeamId,

          teamName:
            team.team_name,

          email,

          token:
            invitation.token,

          expiresAt:
            invitation
              .expires_at,

          emailId:
            emailResult.id ??
            null,
        },
      });
    } catch (
      emailError
    ) {
      /*
       * For a brand-new invitation, remove the row if sending failed.
       *
       * For a resend, leave the pending reservation intact. The user
       * can retry again without losing the team's reservation.
       */
      if (
        !reusableInvitationId
      ) {
        await admin
          .from(
            "league_invitations"
          )
          .delete()
          .eq(
            "id",
            invitation.id
          );
      }

      return jsonError(
        emailError instanceof Error
          ? emailError.message
          : "The invitation email could not be sent.",
        502
      );
    }
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
