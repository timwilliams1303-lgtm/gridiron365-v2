import { NextResponse } from "next/server";

import { syncAmtoteGreyhoundLiveState } from "@/lib/greyhound/syncAmtoteLiveState";
import type { AmtoteTrackId } from "@/lib/greyhound/amtote";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function hasValidSyncSecret(request: Request): boolean {
  const expected = process.env.GRIDIRON_SYNC_SECRET;
  const supplied = request.headers.get("x-gridiron-sync-secret");

  return Boolean(expected && supplied && supplied === expected);
}

function requestedTracks(value: string | null): AmtoteTrackId[] {
  switch ((value ?? "all").toUpperCase()) {
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

export async function GET(request: Request) {
  if (!hasValidSyncSecret(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);

  try {
    const result = await syncAmtoteGreyhoundLiveState(
      requestedTracks(url.searchParams.get("track")),
    );

    return NextResponse.json(result, {
      status: result.success ? 200 : 207,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("AmTote Greyhound live-state sync failed:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "AmTote Greyhound live-state sync failed.",
      },
      { status: 500 },
    );
  }
}