import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type RouteContext = {
  params: Promise<{
    draftId: string;
  }>;
};

function getBearerToken(
  request: NextRequest
): string | null {
  const header =
    request.headers.get("authorization");

  if (!header) {
    return null;
  }

  const match =
    header.match(/^Bearer\s+(.+)$/i);

  return match?.[1] ?? null;
}

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { draftId } =
      await context.params;

    if (!draftId) {
      return NextResponse.json(
        {
          success: false,
          error: "Draft ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    const token =
      getBearerToken(request);

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication is required.",
        },
        {
          status: 401,
        }
      );
    }

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const anonKey =
      process.env
        .NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const serviceRoleKey =
      process.env
        .SUPABASE_SERVICE_ROLE_KEY;

    if (
      !supabaseUrl ||
      !anonKey ||
      !serviceRoleKey
    ) {
      console.error(
        "Draft grades: Supabase environment variables are missing."
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Draft-grade service configuration is incomplete.",
        },
        {
          status: 500,
        }
      );
    }

    // ------------------------------------------------------
    // AUTH CLIENT
    // Used only to verify the requesting user.
    // ------------------------------------------------------

    const authClient =
      createClient(
        supabaseUrl,
        anonKey,
        {
          global: {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          },
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        }
      );

    const {
      data: userData,
      error: userError,
    } =
      await authClient.auth
        .getUser(token);

    const user =
      userData.user;

    if (
      userError ||
      !user
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Your login session has expired.",
        },
        {
          status: 401,
        }
      );
    }

    // ------------------------------------------------------
    // ADMIN CLIENT
    // Never exposed to the browser.
    // ------------------------------------------------------

    const admin =
      createClient(
        supabaseUrl,
        serviceRoleKey,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        }
      );

    // ------------------------------------------------------
    // LOAD DRAFT
    // ------------------------------------------------------

    const {
      data: draft,
      error: draftError,
    } =
      await admin
        .from("league_drafts")
        .select(`
          id,
          league_id,
          status
        `)
        .eq(
          "id",
          draftId
        )
        .maybeSingle();

    if (
      draftError ||
      !draft
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            draftError?.message ??
            "Draft could not be found.",
        },
        {
          status: 404,
        }
      );
    }

    // ------------------------------------------------------
    // COMMISSIONER AUTHORIZATION
    // ------------------------------------------------------

    const {
      data: membership,
      error: membershipError,
    } =
      await admin
        .from("league_members")
        .select("role")
        .eq(
          "league_id",
          draft.league_id
        )
        .eq(
          "user_id",
          user.id
        )
        .maybeSingle();

    if (
      membershipError ||
      !membership
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "You are not a member of this league.",
        },
        {
          status: 403,
        }
      );
    }

    const isCommissioner =
      membership.role ===
        "commissioner" ||
      membership.role ===
        "co_commissioner";

    if (!isCommissioner) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Only the commissioner can generate draft grades.",
        },
        {
          status: 403,
        }
      );
    }

    if (
      draft.status !==
      "completed"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The draft must be completed before grades are generated.",
        },
        {
          status: 409,
        }
      );
    }

    // ------------------------------------------------------
    // RUN V4
    // ------------------------------------------------------

    const {
      data: gradeResult,
      error: gradeError,
    } =
      await admin.rpc(
        "rebuild_traditional_draft_grade_v4_team_grades",
        {
          p_draft_id:
            draftId,
        }
      );

    if (gradeError) {
      console.error(
        "Draft Grade V4 RPC failed:",
        gradeError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            gradeError.message,
        },
        {
          status: 500,
        }
      );
    }

    // ------------------------------------------------------
    // COUNT FINAL TEAM GRADES
    // ------------------------------------------------------

    const {
      count,
      error: countError,
    } =
      await admin
        .from(
          "traditional_draft_grade_v4_team_metrics"
        )
        .select(
          "id",
          {
            count: "exact",
            head: true,
          }
        )
        .eq(
          "draft_id",
          draftId
        );

    if (countError) {
      console.error(
        "Draft Grade V4 count failed:",
        countError
      );
    }

    return NextResponse.json({
      success: true,
      engine:
        "traditional_draft_grade_v4_final",
      generatedCount:
        count ?? 0,
      result:
        gradeResult,
    });
  } catch (error) {
    console.error(
      "Draft Grade V4 route error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Draft grades could not be generated.",
      },
      {
        status: 500,
      }
    );
  }
}