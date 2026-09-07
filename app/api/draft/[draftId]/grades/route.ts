import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    draftId: string;
  }>;
};

type JsonObject = Record<string, unknown>;

function jsonError(
  error: string,
  status = 400,
  details?: unknown
) {
  return NextResponse.json(
    {
      success: false,
      error,
      ...(details !== undefined ? { details } : {}),
    },
    { status }
  );
}

function createAuthenticatedClient(accessToken: string) {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const publicKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !publicKey) {
    throw new Error(
      "Supabase public configuration is incomplete."
    );
  }

  return createClient(
    supabaseUrl,
    publicKey,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
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

function getGeneratedTeamCount(teamResult: unknown): number {
  if (
    teamResult &&
    typeof teamResult === "object" &&
    !Array.isArray(teamResult)
  ) {
    const result = teamResult as Record<string, unknown>;

    if (
      typeof result.teamCount === "number" &&
      Number.isFinite(result.teamCount)
    ) {
      return result.teamCount;
    }

    if (
      typeof result.teamCount === "string"
    ) {
      const parsed = Number(result.teamCount);

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return 0;
}

export async function POST(
  request: Request,
  context: RouteContext
) {
  try {
    const authorization =
      request.headers.get("authorization");

    if (
      !authorization?.startsWith("Bearer ")
    ) {
      return jsonError(
        "Your login session is missing.",
        401
      );
    }

    const accessToken =
      authorization.slice("Bearer ".length);

    const { draftId } = await context.params;

    if (!draftId) {
      return jsonError(
        "The draft ID is missing.",
        400
      );
    }

    const supabase =
      createAuthenticatedClient(accessToken);

    const {
      data: userData,
      error: userError,
    } = await supabase.auth.getUser();

    if (
      userError ||
      !userData.user
    ) {
      return jsonError(
        "Your login session has expired.",
        401
      );
    }

    const userId = userData.user.id;

    const {
      data: draft,
      error: draftError,
    } = await supabase
      .from("league_drafts")
      .select(
        "id, league_id, season, status"
      )
      .eq("id", draftId)
      .maybeSingle();

    if (draftError) {
      return jsonError(
        draftError.message,
        400
      );
    }

    if (!draft) {
      return jsonError(
        "The draft could not be found.",
        404
      );
    }

    if (draft.status !== "completed") {
      return jsonError(
        "The draft must be completed before grades can be generated.",
        400
      );
    }

    const {
      data: membership,
      error: membershipError,
    } = await supabase
      .from("league_members")
      .select("role")
      .eq("league_id", draft.league_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (membershipError) {
      return jsonError(
        membershipError.message,
        400
      );
    }

    if (
      !membership ||
      !["commissioner", "co_commissioner"].includes(
        String(membership.role)
      )
    ) {
      return jsonError(
        "Only a commissioner may generate draft grades.",
        403
      );
    }

    /*
     * Draft Grades V4 rebuild order:
     *
     * 1. Weekly optimal lineup / starter strength
     * 2. Per-player draft value / VORP / positional metrics
     * 3. Final team scores, grades and analysis
     *
     * These routines use the league's own commissioner scoring
     * configuration through the V4 projection foundation.
     */

    const {
      data: weeklyResult,
      error: weeklyError,
    } = await supabase.rpc(
      "rebuild_traditional_draft_grade_v4_weekly",
      {
        p_draft_id: draftId,
      }
    );

    if (weeklyError) {
      return jsonError(
        `V4 weekly grade rebuild failed: ${weeklyError.message}`,
        400
      );
    }

    const {
      data: playerResult,
      error: playerError,
    } = await supabase.rpc(
      "rebuild_traditional_draft_grade_v4_players",
      {
        p_draft_id: draftId,
      }
    );

    if (playerError) {
      return jsonError(
        `V4 player grade rebuild failed: ${playerError.message}`,
        400
      );
    }

    const {
      data: teamResult,
      error: teamError,
    } = await supabase.rpc(
      "rebuild_traditional_draft_grade_v4_team_grades",
      {
        p_draft_id: draftId,
      }
    );

    if (teamError) {
      return jsonError(
        `V4 team grade rebuild failed: ${teamError.message}`,
        400
      );
    }

    /*
     * The final V4 team-grade RPC already returns the authoritative
     * number of teams it generated:
     *
     * {
     *   success: true,
     *   teamCount: 12,
     *   ...
     * }
     *
     * Use that value directly instead of issuing a separate SELECT
     * against traditional_draft_grade_v4_team_metrics.
     *
     * The separate count query can be filtered by RLS for the
     * authenticated API client even though the SECURITY DEFINER /
     * grading RPC successfully generated all team rows.
     */
    const generatedCount =
      getGeneratedTeamCount(teamResult);

    return NextResponse.json({
      success: true,
      generatedCount,
      gradingVersion:
        "traditional-draft-grade-v4",
      results: {
        weekly:
          weeklyResult as JsonObject | unknown,
        players:
          playerResult as JsonObject | unknown,
        teams:
          teamResult as JsonObject | unknown,
      },
    });
  } catch (error) {
    return jsonError(
      error instanceof Error
        ? error.message
        : "Draft grades could not be generated.",
      500
    );
  }
}