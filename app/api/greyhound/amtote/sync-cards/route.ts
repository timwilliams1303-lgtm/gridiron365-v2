import { NextResponse } from "next/server";

import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";
import { syncAmtoteGreyhoundCards } from "@/lib/greyhound/syncAmtoteCards";
import type { AmtoteTrackId } from "@/lib/greyhound/amtote";

type RequestBody = {
  leagueId?: string;
  track?: "all" | "WEM" | "TSE" | "GWD" | "GTS";
};

function requestedTracks(value: RequestBody["track"]): AmtoteTrackId[] {
  switch (value) {
    case "WEM":
    case "GWD":
      return ["WEM"];
    case "TSE":
    case "GTS":
      return ["TSE"];
    default:
      return ["WEM", "TSE"];
  }
}

function hasValidSyncSecret(request: Request): boolean {
  const expected = process.env.GRIDIRON_SYNC_SECRET;
  const supplied = request.headers.get("x-gridiron-sync-secret");

  return Boolean(expected && supplied && supplied === expected);
}

async function runSync(trackIds: AmtoteTrackId[]) {
  try {
    const result = await syncAmtoteGreyhoundCards(trackIds);
    return NextResponse.json(result);
  } catch (error) {
    console.error("AmTote Greyhound card sync failed:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "AmTote Greyhound card sync failed.",
      },
      { status: 500 },
    );
  }
}

// Supabase pg_cron / server-to-server automation.
export async function GET(request: Request) {
  if (!hasValidSyncSecret(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const track = (url.searchParams.get("track") ?? "all") as RequestBody["track"];

  return runSync(requestedTracks(track));
}

// Commissioner "Sync now" action from the Race Cards screen.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as RequestBody | null;
  const leagueId = typeof body?.leagueId === "string" ? body.leagueId.trim() : "";

  if (!leagueId) {
    return NextResponse.json({ error: "leagueId is required." }, { status: 400 });
  }

  try {
    const access = await requireLeagueMember(leagueId);

    if (String(access.league.leagueType) !== "greyhound") {
      return NextResponse.json(
        { error: "This endpoint is only available for Greyhound leagues." },
        { status: 400 },
      );
    }

    if (!access.isCommissioner) {
      return NextResponse.json(
        { error: "Only the league commissioner can sync Greyhound race cards." },
        { status: 403 },
      );
    }

    return runSync(requestedTracks(body?.track));
  } catch (error) {
    console.error("Commissioner AmTote Greyhound card sync failed:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "AmTote Greyhound card sync failed.",
      },
      { status: 500 },
    );
  }
}
