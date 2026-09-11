import { NextRequest, NextResponse } from "next/server";

import {
  syncAmtoteGreyhoundResults,
} from "@/lib/greyhound/syncAmtoteResults";
import type {
  AmtoteTrackId,
} from "@/lib/greyhound/amtote";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorized(request: NextRequest) {
  const expected =
    process.env.GRIDIRON_SYNC_SECRET?.trim();

  const received =
    request.headers
      .get("x-gridiron-sync-secret")
      ?.trim();

  return Boolean(
    expected &&
    received &&
    expected === received,
  );
}

function requestedTracks(
  request: NextRequest,
): AmtoteTrackId[] {
  const raw =
    request.nextUrl.searchParams
      .get("track")
      ?.trim()
      .toUpperCase();

  if (!raw || raw === "ALL") {
    return ["WEM", "TSE"];
  }

  if (raw === "WEM" || raw === "GWD") {
    return ["WEM"];
  }

  if (raw === "TSE" || raw === "GTS") {
    return ["TSE"];
  }

  throw new Error(
    "track must be WEM, GWD, TSE, GTS, ALL, or omitted.",
  );
}

export async function GET(
  request: NextRequest,
) {
  if (!authorized(request)) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized",
      },
      {
        status: 401,
      },
    );
  }

  try {
    const result =
      await syncAmtoteGreyhoundResults(
        requestedTracks(request),
      );

    return NextResponse.json(
      result,
      {
        status: result.success ? 200 : 207,
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown Greyhound results sync error.",
      },
      {
        status: 500,
      },
    );
  }
}