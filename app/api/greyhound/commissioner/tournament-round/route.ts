import { NextRequest, NextResponse } from "next/server";

import { refreshGreyhoundTournamentRound } from "@/lib/greyhound/refreshGreyhoundTournamentRound";
import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { success: false, error: message },
    {
      status,
      headers: { "Cache-Control": "no-store, max-age=0" },
    },
  );
}

async function requireCommissioner(leagueId: string) {
  const access = await requireLeagueMember(leagueId);

  if (String(access.league.leagueType) !== "greyhound") {
    throw new Error("GREYHOUND_ONLY");
  }

  if (!access.isCommissioner) {
    throw new Error("COMMISSIONER_ONLY");
  }

  return access;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      leagueId?: string;
      roundId?: number;
      action?: "refresh" | "resolve_cutoff_tie";
      advancingParticipantIds?: number[];
    };

    const leagueId = String(body.leagueId ?? "").trim();
    const roundId = Number(body.roundId);

    if (!leagueId) {
      return jsonError("leagueId is required.", 400);
    }

    if (!Number.isInteger(roundId) || roundId <= 0) {
      return jsonError("Valid roundId is required.", 400);
    }

    await requireCommissioner(leagueId);

    const action = body.action ?? "refresh";

    if (action !== "refresh" && action !== "resolve_cutoff_tie") {
      return jsonError("Unsupported Tournament round action.", 400);
    }

    const advancingParticipantIds =
      action === "resolve_cutoff_tie" &&
      Array.isArray(body.advancingParticipantIds)
        ? body.advancingParticipantIds.map(Number)
        : [];

    const result = await refreshGreyhoundTournamentRound(
      leagueId,
      roundId,
      advancingParticipantIds,
    );

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to refresh Tournament round.";

    if (message === "GREYHOUND_ONLY") {
      return jsonError(
        "This endpoint is only available for Greyhound leagues.",
        400,
      );
    }

    if (message === "COMMISSIONER_ONLY") {
      return jsonError(
        "Only the commissioner can refresh Tournament rounds.",
        403,
      );
    }

    if (message === "TOURNAMENT_ONLY") {
      return jsonError(
        "This action is only available for Tournament leagues.",
        409,
      );
    }

    if (message === "ROUND_NOT_FOUND") {
      return jsonError("Tournament round was not found.", 404);
    }

    if (message === "NO_TOURNAMENT_PARTICIPANTS") {
      return jsonError(
        "No Tournament participants are available for this round.",
        409,
      );
    }

    if (message === "TOURNAMENT_TIE_SELECTION_COUNT") {
      return jsonError(
        "Select exactly the required number of tied entries to advance.",
        409,
      );
    }

    if (message === "TOURNAMENT_TIE_SELECTION_INVALID") {
      return jsonError(
        "Only entries tied at the advancement cutoff can be selected.",
        409,
      );
    }

    console.error("[greyhound/tournament-round] failed", error);
    return jsonError(message, 500);
  }
}
