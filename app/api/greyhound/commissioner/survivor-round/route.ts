import { NextRequest, NextResponse } from "next/server";

import {
  refreshGreyhoundSurvivorRound,
  resolveGreyhoundSurvivorRoundTie,
} from "@/lib/greyhound/refreshGreyhoundSurvivorRound";
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

function errorResponse(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : "Unable to process Survivor round.";

  if (message === "GREYHOUND_ONLY") {
    return jsonError(
      "This endpoint is only available for Greyhound leagues.",
      400,
    );
  }

  if (message === "COMMISSIONER_ONLY") {
    return jsonError(
      "Only the commissioner can manage Survivor rounds.",
      403,
    );
  }

  if (message === "ROUND_SURVIVOR_ONLY") {
    return jsonError(
      "This action is only available for Round Survivor leagues.",
      409,
    );
  }

  if (message === "ROUND_NOT_FOUND") {
    return jsonError("Survivor round was not found.", 404);
  }

  if (message === "NO_SURVIVOR_PARTICIPANTS") {
    return jsonError(
      "No Survivor participants are available for this round.",
      409,
    );
  }

  if (message === "ROUND_NOT_BLOCKED_BY_TIE") {
    return jsonError(
      "This Survivor round is not currently blocked by a lowest-winnings tie.",
      409,
    );
  }

  if (message === "INVALID_TIE_ELIMINATION") {
    return jsonError(
      "Choose one of the entries tied for the lowest round winnings.",
      400,
    );
  }

  if (message === "NO_NEXT_SURVIVOR_ROUND") {
    return jsonError(
      "More than one Survivor would remain, but no next round is configured.",
      409,
    );
  }

  console.error("[greyhound/survivor-round] failed", error);
  return jsonError(message, 500);
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      leagueId?: string;
      roundId?: number;
      action?: "refresh" | "resolve_tie";
      eliminateParticipantId?: number;
    };

    const leagueId = String(body.leagueId ?? "").trim();
    const roundId = Number(body.roundId);
    const action = body.action ?? "refresh";

    if (!leagueId) {
      return jsonError("leagueId is required.", 400);
    }

    if (!Number.isInteger(roundId) || roundId <= 0) {
      return jsonError("Valid roundId is required.", 400);
    }

    await requireCommissioner(leagueId);

    if (action === "resolve_tie") {
      const eliminateParticipantId = Number(
        body.eliminateParticipantId,
      );

      if (
        !Number.isInteger(eliminateParticipantId) ||
        eliminateParticipantId <= 0
      ) {
        return jsonError(
          "Valid eliminateParticipantId is required.",
          400,
        );
      }

      const result = await resolveGreyhoundSurvivorRoundTie(
        leagueId,
        roundId,
        eliminateParticipantId,
      );

      return NextResponse.json(result, {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      });
    }

    const result = await refreshGreyhoundSurvivorRound(
      leagueId,
      roundId,
    );

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
